import { useState, useCallback, useEffect } from 'react'

import { supabase } from '@/lib/supabase'

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
    let page = 0
    let totalCount = 0
    const allLeads = []

    while (true) {
        const { data, error } = await supabase.rpc('list_dashboard_leads', {
            p_search: '',
            p_page: page,
            p_page_size: LEADS_PAGE_SIZE,
        })

        if (error) throw error

        const pageData = (data || []).map((row) => row.lead).filter(Boolean)

        if (page === 0) {
            totalCount = Number(data?.[0]?.total_count || pageData.length)
        }

        allLeads.push(...pageData)

        if (pageData.length < LEADS_PAGE_SIZE) break
        if (totalCount > 0 && allLeads.length >= totalCount) break

        page += 1
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

        // Sync with the protected backend function when forcing a refresh.
        if (force) {
            try {
                const aiProvider = Number(localStorage.getItem('aiProvider')) || 0
                const { error } = await supabase.functions.invoke('sync-leads-from-webhook', {
                    body: { provider: aiProvider, force: true },
                })
                if (error) throw error
            } catch (err) {
                console.error('[Sync] Error during protected lead sync:', err)
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
