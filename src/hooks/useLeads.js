import { useState, useCallback, useRef } from 'react'

// Module-level in-memory cache
let cachedLeads = null

export function useLeads() {
    const [leads, setLeads] = useState(cachedLeads || [])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const fetchingRef = useRef(false)

    const refresh = useCallback(async (force = true) => {
        if (fetchingRef.current) return

        // If we have cached data and not forcing, skip
        if (!force && cachedLeads) {
            setLeads(cachedLeads)
            return
        }

        fetchingRef.current = true
        setLoading(true)
        setError(null)

        try {
            const res = await fetch(import.meta.env.VITE_WEBHOOK_URL)
            if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
            const data = await res.json()
            const leadsData = data.leads || data || []
            cachedLeads = leadsData
            setLeads(leadsData)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
            fetchingRef.current = false
        }
    }, [])

    return { leads, loading, error, refresh }
}
