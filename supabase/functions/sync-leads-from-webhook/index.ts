import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { assertAdmin } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { adminClient } from '../_shared/supabase.ts'

const LEADS_WEBHOOK_URL = Deno.env.get('LEADS_WEBHOOK_URL') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const LEADS_PAGE_SIZE = 100
const AI_BATCH_SIZE = 5

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function createImportJobId() {
  return `n8n_webhook_sistemahacienda_${crypto.randomUUID()}`
}

function applyTracking(lead: Record<string, unknown>, tracking: Record<string, string>) {
  return {
    ...lead,
    fuente: lead.fuente || tracking.fuente,
    created_at_import: lead.created_at_import || tracking.created_at_import,
    import_job_id: lead.import_job_id || tracking.import_job_id,
  }
}

function sanitizeLeadForInsert(lead: Record<string, unknown> = {}) {
  const {
    error: _error,
    errors: _errors,
    leads: _leads,
    ...safeLead
  } = lead

  return safeLead
}

async function fetchWebhookLeads() {
  if (!LEADS_WEBHOOK_URL) {
    throw new Error('LEADS_WEBHOOK_URL no esta configurado en Supabase Secrets.')
  }

  const response = await fetch(LEADS_WEBHOOK_URL)
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(`Webhook de leads respondio HTTP ${response.status}.`)
  }

  const leads = Array.isArray(payload?.leads)
    ? payload.leads
    : (Array.isArray(payload) ? payload : [])

  return leads.filter((lead: unknown): lead is Record<string, unknown> => {
    return Boolean(lead && typeof lead === 'object' && (lead as Record<string, unknown>).lead_id)
  })
}

async function findExistingLeadIds(leadIds: string[]) {
  const existingIds = new Set<string>()

  for (let index = 0; index < leadIds.length; index += LEADS_PAGE_SIZE) {
    const chunk = leadIds.slice(index, index + LEADS_PAGE_SIZE)
    const { data, error } = await adminClient
      .from('leads')
      .select('lead_id')
      .in('lead_id', chunk)

    if (error) throw error
    ;(data || []).forEach((row: { lead_id: unknown }) => {
      existingIds.add(String(row.lead_id))
    })
  }

  return existingIds
}

async function normalizeBatch(batch: Record<string, unknown>[], provider: number, authHeader: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/normalize-leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: authHeader,
      },
      body: JSON.stringify({ leads: batch, provider }),
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok || payload?.error) {
      throw new Error(payload?.error || `normalize-leads respondio HTTP ${response.status}.`)
    }

    return Array.isArray(payload) ? payload : (payload.leads || [payload])
  } finally {
    clearTimeout(timeout)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    await assertAdmin(req)

    const body = await req.json().catch(() => ({}))
    const provider = body?.provider === 1 ? 1 : 0
    const authHeader = req.headers.get('Authorization') || ''
    const tracking = {
      fuente: 'n8n_webhook_sistemahacienda',
      created_at_import: new Date().toISOString(),
      import_job_id: createImportJobId(),
    }

    const incomingLeads = await fetchWebhookLeads()
    const trackedLeads = incomingLeads.map((lead) => applyTracking(lead, tracking))
    const incomingIds = trackedLeads.map((lead) => String(lead.lead_id))
    const existingIds = await findExistingLeadIds(incomingIds)
    const newLeads = trackedLeads.filter((lead) => !existingIds.has(String(lead.lead_id)))

    console.info('[sync-leads-from-webhook]', JSON.stringify({
      incoming: trackedLeads.length,
      existing: existingIds.size,
      new: newLeads.length,
      provider: provider === 1 ? 'openai' : 'gemini',
    }))

    let inserted = 0
    const errors: string[] = []

    for (let index = 0; index < newLeads.length; index += AI_BATCH_SIZE) {
      const batch = newLeads.slice(index, index + AI_BATCH_SIZE)
      const originalById = new Map(batch.map((lead) => [String(lead.lead_id), lead]))

      try {
        const normalizedBatch = await normalizeBatch(batch, provider, authHeader)
        const rows = normalizedBatch.map((normalizedLead: Record<string, unknown>) => {
          const originalLead = originalById.get(String(normalizedLead?.lead_id)) || {}
          return sanitizeLeadForInsert(applyTracking({
            ...originalLead,
            ...normalizedLead,
          }, tracking))
        })

        const { data, error } = await adminClient
          .from('leads')
          .upsert(rows, {
            onConflict: 'lead_id',
            ignoreDuplicates: true,
          })
          .select('lead_id')

        if (error) throw error
        inserted += data?.length || 0
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Error desconocido normalizando leads.')
      }
    }

    return jsonResponse({
      success: errors.length === 0,
      incoming: trackedLeads.length,
      existing: existingIds.size,
      inserted,
      failed: errors.length,
      errors: errors.slice(0, 5),
    }, errors.length ? 207 : 200)
  } catch (error) {
    if (error instanceof Response) {
      const body = await error.text()
      return new Response(body, {
        status: error.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    console.error('[sync-leads-from-webhook]', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error.' }, 500)
  }
})
