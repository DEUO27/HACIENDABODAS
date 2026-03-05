import { useState, useCallback, useEffect } from 'react'

import { supabase } from '@/lib/supabase'
import { syncLeads } from '@/lib/leadService'

// Global state mechanism
let globalLeads = null
let globalLoading = false
let globalError = null
let isFetchingCounter = 0
const listeners = new Set()

function notifyListeners() {
    listeners.forEach(listener => listener({
        leads: globalLeads || [],
        loading: globalLoading,
        error: globalError
    }))
}

export function useLeads() {
    const [state, setState] = useState({
        leads: globalLeads || [],
        loading: globalLoading,
        error: globalError
    })

    useEffect(() => {
        listeners.add(setState)
        // Ensure fresh state on mount
        setState({
            leads: globalLeads || [],
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
                    await syncLeads(rawLeads, aiProvider)
                }
            } catch (err) {
                console.error('[Sync] Error during background sync from webhook:', err)
            }
        }

        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('fecha_primer_mensaje', { ascending: false })

            if (error) throw error

            globalLeads = data || []
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
