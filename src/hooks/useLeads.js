import { useState, useCallback, useEffect } from 'react'

import { supabase } from '@/lib/supabase'
import { syncLeads } from '@/lib/leadService'
import { createLeadImportTracking, LEAD_IMPORT_SOURCES } from '@/lib/leadImportTracking'

// Global state mechanism
let globalLeads = null
let globalTotalCount = 0
let globalLoading = false
let globalError = null
let isFetchingCounter = 0
const listeners = new Set()
const LEADS_PAGE_SIZE = 1000

function notifyListeners() {
    listeners.forEach(listener => listener({
        leads: globalLeads || [],
        totalCount: globalTotalCount,
        loading: globalLoading,
        error: globalError
    }))
}

async function fetchAllLeads() {
    let from = 0
    let totalCount = 0
    const allLeads = []

    while (true) {
        const shouldCount = from === 0
        const query = supabase
            .from('leads')
            .select('*', shouldCount ? { count: 'exact' } : {})
            .order('fecha_primer_mensaje', { ascending: false })
            .range(from, from + LEADS_PAGE_SIZE - 1)

        const { data, error, count } = await query

        if (error) throw error

        const pageData = data || []

        if (shouldCount) {
            totalCount = count || pageData.length
        }

        allLeads.push(...pageData)

        if (pageData.length < LEADS_PAGE_SIZE) break
        if (totalCount > 0 && allLeads.length >= totalCount) break

        from += LEADS_PAGE_SIZE
    }

    return {
        leads: allLeads,
        totalCount: totalCount || allLeads.length,
    }
}

export function useLeads() {
    const [state, setState] = useState({
        leads: globalLeads || [],
        totalCount: globalTotalCount,
        loading: globalLoading,
        error: globalError
    })

    useEffect(() => {
        listeners.add(setState)
        // Ensure fresh state on mount
        setState({
            leads: globalLeads || [],
            totalCount: globalTotalCount,
            loading: globalLoading,
            error: globalError
        })
        return () => listeners.delete(setState)
    }, [])

    const refresh = useCallback(async (force = true) => {
        if (isFetchingCounter > 0) return

        // If we have cached data and not forcing, skip
        if (!force && globalLeads) {
            notifyListeners()
            return
        }

        isFetchingCounter++
        globalLoading = true
        globalError = null
        notifyListeners()

        // Sync with Make Webhook if forcing a refresh
        if (force && import.meta.env.VITE_WEBHOOK_URL) {
            try {
                const resData = await fetch(import.meta.env.VITE_WEBHOOK_URL)
                if (resData.ok) {
                    const data = await resData.json()
                    const rawLeads = data.leads || data || []
                    const aiProvider = Number(localStorage.getItem('aiProvider')) || 0
                    const syncTracking = createLeadImportTracking(LEAD_IMPORT_SOURCES.N8N_WEBHOOK_SISTEMAHACIENDA)
                    await syncLeads(rawLeads, aiProvider, syncTracking)
                }
            } catch (err) {
                console.error('[Sync] Error during background sync from webhook:', err)
            }
        }

        try {
            const { leads, totalCount } = await fetchAllLeads()
            globalLeads = leads
            globalTotalCount = totalCount
        } catch (err) {
            globalError = err.message
        } finally {
            globalLoading = false
            isFetchingCounter--
            notifyListeners()
        }
    }, [])

    return { ...state, refresh }
}
