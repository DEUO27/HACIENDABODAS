import { useState, useCallback, useEffect } from 'react'

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

        try {
            const res = await fetch(import.meta.env.VITE_WEBHOOK_URL)
            if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
            const data = await res.json()
            const leadsData = data.leads || data || []
            globalLeads = leadsData
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
