import { createContext, useContext, useState, useMemo } from 'react'
import { isWithinInterval, parseISO, startOfDay, subDays, startOfYear, endOfDay } from 'date-fns'
import { parseLeadDate, isSinInfo, safeDisplay, normalizeCanal } from '@/lib/leadUtils'

const FilterContext = createContext(null)

const initialFilters = {
    search: '',
    dateRange: 'all',
    customFrom: null,
    customTo: null,
    fases: [],
    vendedoras: [],
    eventos: [],
    canales: [],
    origenes: [],
    salones: [],
    solo24h: false,
    soloPerdidos: false,
    soloActivos: false,
    datosIncompletos: false,
}

function getDateInterval(dateRange, customFrom, customTo) {
    const now = new Date()
    const end = endOfDay(now)
    const today = startOfDay(now)

    switch (dateRange) {
        case 'today':
            return { start: today, end }
        case '7d':
            return { start: subDays(today, 7), end }
        case '30d':
            return { start: subDays(today, 30), end }
        case '90d':
            return { start: subDays(today, 90), end }
        case 'ytd':
            return { start: startOfYear(today), end }
        case 'custom':
            return {
                start: customFrom ? startOfDay(parseISO(customFrom)) : subDays(today, 365),
                end: customTo ? endOfDay(parseISO(customTo)) : end,
            }
        case 'all':
        default:
            return null // null means no date filtering
    }
}

export function FilterProvider({ children }) {
    const [filters, setFilters] = useState(initialFilters)
    const [isExportOpen, setIsExportOpen] = useState(false)

    const updateFilter = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }))
    }

    const toggleArrayFilter = (key, value) => {
        setFilters((prev) => {
            const arr = prev[key] || []
            if (arr.includes(value)) {
                return { ...prev, [key]: arr.filter(v => v !== value) }
            }
            return { ...prev, [key]: [...arr, value] }
        })
    }

    const toggleBooleanFilter = (key) => {
        setFilters((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    const clearFilters = () => setFilters(initialFilters)

    return (
        <FilterContext.Provider value={{
            filters,
            updateFilter,
            toggleArrayFilter,
            toggleBooleanFilter,
            clearFilters,
            setFilters,
            isExportOpen,
            setIsExportOpen
        }}>
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
            // 1. Search filter
            if (filters.search) {
                const q = filters.search.toLowerCase()
                const name = (lead.nombre || '').toLowerCase()
                const phone = (lead.telefono || '').toLowerCase()
                const id = String(lead.lead_id || '').toLowerCase()
                if (!name.includes(q) && !phone.includes(q) && !id.includes(q)) return false
            }

            // 2. Date Range Filter on fecha_primer_mensaje
            if (interval) {
                const d = parseLeadDate(lead.fecha_primer_mensaje)
                if (!d || !isWithinInterval(d, interval)) return false
            }

            // 3. Multi-select arrays (OR logic within arrays, AND logic between arrays)
            if (filters.fases.length > 0) {
                const fase = isSinInfo(lead.fase_embudo) ? 'Sin Información' : lead.fase_embudo
                if (!filters.fases.includes(fase)) return false
            }
            if (filters.vendedoras.length > 0) {
                const vendedora = isSinInfo(lead.vendedora) ? 'Sin Información' : lead.vendedora
                if (!filters.vendedoras.includes(vendedora)) return false
            }
            if (filters.eventos.length > 0) {
                const evento = isSinInfo(lead.evento) ? 'Sin Información' : lead.evento
                if (!filters.eventos.includes(evento)) return false
            }
            if (filters.canales.length > 0) {
                const canal = normalizeCanal(lead.canal_de_contacto)
                if (!filters.canales.includes(canal)) return false
            }
            if (filters.origenes.length > 0) {
                const origen = isSinInfo(lead.como_nos_encontro) ? 'Sin Información' : lead.como_nos_encontro
                if (!filters.origenes.includes(origen)) return false
            }
            if (filters.salones.length > 0) {
                const salon = isSinInfo(lead.salon) ? 'Sin Información' : lead.salon
                if (!filters.salones.includes(salon)) return false
            }

            // 4. Quick Toggles / Chips
            if (filters.solo24h && !(lead.fase_embudo || '').toLowerCase().includes('+24hrs')) return false
            if (filters.soloPerdidos && !(lead.fase_embudo || '').toLowerCase().includes('perdido')) return false
            if (filters.soloActivos && (lead.fase_embudo || '').toLowerCase().includes('perdido')) return false
            if (filters.datosIncompletos) {
                const isIncomplete = isSinInfo(lead.telefono) ||
                    isSinInfo(lead.fecha_evento) ||
                    isSinInfo(lead.canal_de_contacto) ||
                    isSinInfo(lead.como_nos_encontro) ||
                    isSinInfo(lead.salon) ||
                    isSinInfo(lead.evento) ||
                    isSinInfo(lead.vendedora)
                if (!isIncomplete) return false
            }

            return true
        })
    }, [leads, filters])
}
