import { supabase } from './supabase'
import {
    applyLeadImportTracking,
    createLeadImportTracking,
    LEAD_IMPORT_SOURCES,
    mergeLeadWithTracking,
} from './leadImportTracking'

/**
 * Invokes the AI normalization edge function using a raw fetch to bypass
 * the hardcoded 60s timeout present in the supabase-js client.
 */
async function invokeNormalizeLeads(leads, provider) {
    let enrichedBatch = null;
    let invokeError = null;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const aiController = new AbortController();
        const aiTimeout = setTimeout(() => aiController.abort(), 120000); // 120 seconds local timeout
        
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/normalize-leads`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ leads, provider }),
            signal: aiController.signal
        });
        
        clearTimeout(aiTimeout);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }
        
        enrichedBatch = await response.json();
    } catch (err) {
        invokeError = err.message || err;
    }
    return { data: enrichedBatch, error: invokeError };
}

function sanitizeLeadForInsert(lead = {}) {
    if (!lead || typeof lead !== 'object') return lead

    const {
        error: _error,
        errors: _errors,
        leads: _leads,
        ...safeLead
    } = lead

    return safeLead
}

function getPreferredAiProvider(provider = null) {
    if (provider === 0 || provider === 1) return provider

    const storedProvider = Number(globalThis?.localStorage?.getItem('aiProvider'))
    return storedProvider === 1 ? 1 : 0
}

/**
 * Synchronizes an array of leads with the Supabase database.
 * This function uses an idempotent "upsert" with ignoreDuplicates: true.
 * This maps to SQL's "INSERT ... ON CONFLICT (lead_id) DO NOTHING".
 * 
 * Existing leads (matching lead_id) are ignored completely, keeping their original data intact.
 * Only completely new leads are inserted.
 * 
 * @param {Array} leadsArray - Array of lead objects to sync.
 * @returns {Promise<{ success: boolean, count: number, error: any }>}
 */
export async function syncLeads(leadsArray, provider = 0, tracking = null) {
    if (!leadsArray || leadsArray.length === 0) {
        return { success: true, count: 0, error: null }
    }

    const syncTracking = createLeadImportTracking(
        tracking?.fuente || LEAD_IMPORT_SOURCES.N8N_WEBHOOK_SISTEMAHACIENDA,
        tracking || {}
    )

    // 1. Validate incoming leads structure
    const validLeads = leadsArray
        .filter(l => l && l.lead_id)
        .map(lead => applyLeadImportTracking(lead, syncTracking))

    if (validLeads.length === 0) {
        console.warn('SyncLeads: No valid leads with a lead_id found to sync.')
        return { success: false, count: 0, error: 'NO_VALID_LEADS' }
    }

    try {
        const incomingIds = validLeads.map(l => l.lead_id)

        // 2. Filter Known DB Leads (Chunking to prevent URL length limits in Supabase .in() filter)
        const CHUNK_SIZE = 100;
        let allExistingData = [];

        for (let i = 0; i < incomingIds.length; i += CHUNK_SIZE) {
            const chunk = incomingIds.slice(i, i + CHUNK_SIZE);
            const { data: chunkData, error: fetchError } = await supabase
                .from('leads')
                .select('lead_id')
                .in('lead_id', chunk)

            if (fetchError) {
                console.error('[Supabase Sync] Fetch existing error:', fetchError)
                return { success: false, count: 0, error: fetchError }
            }
            if (chunkData) {
                allExistingData = [...allExistingData, ...chunkData];
            }
        }

        // Coerce all IDs to String to prevent type mismatch (API sends numbers, DB returns strings)
        const existingIds = new Set(allExistingData.map(d => String(d.lead_id)))

        // 3. Isolate Genuinely New Leads
        const newLeads = validLeads.filter(l => !existingIds.has(String(l.lead_id)))

        console.log(`[Supabase Sync] Total incoming: ${validLeads.length} | Already exist: ${existingIds.size} | New to insert: ${newLeads.length}`)

        if (newLeads.length === 0) {
            // Nothing to do, but it's a success
            return { success: true, count: 0, error: null }
        }

        // 4. AI Normalization Call (batched to avoid Edge Function timeouts)
        const AI_BATCH_SIZE = 5;
        let allEnrichedLeads = [];

        console.log(`[Supabase Sync] Processing ${newLeads.length} new leads in batches of ${AI_BATCH_SIZE} using provider ${provider}...`);

        for (let i = 0; i < newLeads.length; i += AI_BATCH_SIZE) {
            const batch = newLeads.slice(i, i + AI_BATCH_SIZE);
            const batchNum = Math.floor(i / AI_BATCH_SIZE) + 1;
            const batchLeadLookup = new Map(batch.map((lead, index) => [String(lead.lead_id || index), lead]));
            console.log(`[Supabase Sync] Sending batch ${batchNum} (${batch.length} leads) to AI Normalizer...`);
            console.log(`[Supabase Sync] Batch JSON Payload:`, JSON.stringify(batch, null, 2));

            const { data: enrichedBatch, error: invokeError } = await invokeNormalizeLeads(batch, provider);

            // The edge function might return 200 OK but with an { error: "..." } inside the payload
            const actualError = invokeError || (enrichedBatch && enrichedBatch.error ? enrichedBatch.error : null);

            if (actualError || !enrichedBatch) {
                console.error(`[Supabase Sync] AI Normalization Error on batch ${batchNum}:`, actualError);
                // Partial success: insert what we have so far
                if (allEnrichedLeads.length > 0) {
                    console.log(`[Supabase Sync] Saving ${allEnrichedLeads.length} leads processed before error...`);
                    await supabase.from('leads').upsert(allEnrichedLeads, { onConflict: 'lead_id', ignoreDuplicates: true });
                }
                return { success: false, count: allEnrichedLeads.length, error: actualError };
            }

            // The AI may return an array or an object with a leads property
            const enrichedArray = Array.isArray(enrichedBatch) ? enrichedBatch : (enrichedBatch.leads || [enrichedBatch]);
            const trackedBatch = enrichedArray.map((enrichedLead, index) => {
                const originalLead = batchLeadLookup.get(String(enrichedLead?.lead_id ?? index)) || batch[index] || {};
                return mergeLeadWithTracking(enrichedLead, originalLead, syncTracking);
            });
            allEnrichedLeads = [...allEnrichedLeads, ...trackedBatch];

            // Short delay between batches to avoid rate limits
            if (i + AI_BATCH_SIZE < newLeads.length) {
                console.log(`[Supabase Sync] Waiting 3 seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // 5. Idempotent Insert (Failsafe fallback still using ignoreDuplicates)
        console.log(`[Supabase Sync] Upserting ${allEnrichedLeads.length} enriched leads to DB...`)
        const { error: upsertError } = await supabase
            .from('leads')
            .upsert(allEnrichedLeads, {
                onConflict: 'lead_id',
                ignoreDuplicates: true
            })

        if (upsertError) {
            console.error('[Supabase Sync] Upsert Error:', upsertError)
            return { success: false, count: 0, error: upsertError }
        }

        return { success: true, count: allEnrichedLeads.length, error: null }

    } catch (err) {
        console.error('[Supabase Sync Catch Error]', err)
        return { success: false, count: 0, error: err }
    }
}

/**
 * Creates a single lead manually, processes it through AI normalization, and saves it.
 */
export async function createLead(leadData, tracking = null, provider = null) {
    try {
        const manualTracking = createLeadImportTracking(
            tracking?.fuente || LEAD_IMPORT_SOURCES.MANUAL_DASHBOARD,
            tracking || {}
        )
        const selectedProvider = getPreferredAiProvider(provider)

        // Enforce a unique lead_id if not provided
        const lead = applyLeadImportTracking({
            ...leadData,
            lead_id: leadData.lead_id || Number(new Date().getTime().toString().slice(-8)),
        }, manualTracking)

        // Run it through the specific Edge Function
        const { data: enrichedBatch, error: invokeError } = await invokeNormalizeLeads([lead], selectedProvider);

        let finalLead = lead;
        const actualError = invokeError || (enrichedBatch && enrichedBatch.error ? enrichedBatch.error : null)

        if (!actualError && enrichedBatch) {
            const enrichedArray = Array.isArray(enrichedBatch) ? enrichedBatch : (enrichedBatch.leads || [enrichedBatch]);
            if (enrichedArray.length > 0) {
                finalLead = sanitizeLeadForInsert(
                    mergeLeadWithTracking(enrichedArray[0], lead, manualTracking)
                );
            }
        } else {
            console.error('[Create Lead] AI Normalization skipped or failed:', actualError);
        }

        finalLead = sanitizeLeadForInsert(finalLead)

        const { error: insertError } = await supabase
            .from('leads')
            .insert([finalLead])

        if (insertError) {
            console.error('[Create Lead] DB Insert Error:', insertError)
            return { success: false, error: insertError }
        }

        return { success: true, lead: finalLead, error: null }
    } catch (err) {
        console.error('[Create Lead Catch Error]', err)
        return { success: false, error: err }
    }
}

/**
 * Deletes a single lead by its lead_id.
 */
export async function deleteLead(leadId) {
    try {
        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('lead_id', leadId)

        if (error) {
            console.error('[Delete Lead] DB Delete Error:', error)
            return { success: false, error }
        }

        return { success: true, error: null }
    } catch (err) {
        console.error('[Delete Lead Catch Error]', err)
        return { success: false, error: err }
    }
}
