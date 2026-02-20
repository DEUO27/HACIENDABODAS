import { createContext, useContext, useState, useMemo } from 'react'
import { isWithinInterval, parseISO, startOfDay, subDays } from 'date-fns'

const FilterContext = createContext(null)

const initialFilters = {
    dateRange: '30d',
    customFrom: null,
    customTo: null,
    vendedora: '',
    fase: '',
    evento: '',
    canal: '',
    origen: '',
    salon: '',
    search: '',
}

function parseDateSafe(dateStr) {
    if (!dateStr || dateStr === 'Sin Informacion') return null
    try {
        const d = parseISO(dateStr)
        return isNaN(d.getTime()) ? null : d
    } catch {
        return null
    }
}

function getDateInterval(dateRange, customFrom, customTo) {
    const now = new Date()
    const today = startOfDay(now)

    switch (dateRange) {
        case 'today':
            return { start: today, end: now }
        case '7d':
            return { start: subDays(today, 7), end: now }
        case '30d':
            return { start: subDays(today, 30), end: now }
        case 'custom':
            return {
                start: customFrom ? startOfDay(parseISO(customFrom)) : subDays(today, 365),
                end: customTo ? parseISO(customTo) : now,
            }
        default:
            return { start: subDays(today, 30), end: now }
    }
}

export function FilterProvider({ children }) {
    const [filters, setFilters] = useState(initialFilters)

    const updateFilter = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }))
    }

    const clearFilters = () => setFilters(initialFilters)

    return (
        <FilterContext.Provider value={{ filters, updateFilter, clearFilters }}>
            {children}
        </FilterContext.Provider>
    )
}

export const useFilters = () => {
    const context = useContext(FilterContext)
    if (!context) throw new Error('useFilters must be used within FilterProvider')
    return context
}

export function useFilteredLeads(leads) {
    const { filters } = useFilters()

    return useMemo(() => {
        const interval = getDateInterval(filters.dateRange, filters.customFrom, filters.customTo)

        return leads.filter((lead) => {
            // Date filter on fecha_primer_mensaje
            const d = parseDateSafe(lead.fecha_primer_mensaje)
            if (d) {
                if (!isWithinInterval(d, interval)) return false
            }

            // Text filters
            if (filters.vendedora && lead.vendedora !== filters.vendedora) return false
            if (filters.fase && lead.fase_embudo !== filters.fase) return false
            if (filters.evento && lead.evento !== filters.evento) return false
            if (filters.canal && lead.canal_de_contacto !== filters.canal) return false
            if (filters.origen && lead.como_nos_encontro !== filters.origen) return false
            if (filters.salon && lead.salon !== filters.salon) return false

            // Search (nombre, telefono, lead_id)
            if (filters.search) {
                const q = filters.search.toLowerCase()
                const name = (lead.nombre || '').toLowerCase()
                const phone = (lead.telefono || '').toLowerCase()
                const id = String(lead.lead_id || '').toLowerCase()
                if (!name.includes(q) && !phone.includes(q) && !id.includes(q)) return false
            }

            return true
        })
    }, [leads, filters])
}
