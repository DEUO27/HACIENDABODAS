import { useMemo, useState } from 'react'
import { format, startOfDay, startOfYear, subDays } from 'date-fns'
import { useFilters, useFilteredLeads } from '@/contexts/FilterContext'
import { getLeadTrackingDate, isSinInfo, normalizeCanal } from '@/lib/leadUtils'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'

function getUniqueVals(leads, keyOrFn, normalizer = (value) => value) {
    const set = new Set()
    const extractor = typeof keyOrFn === 'function' ? keyOrFn : (lead) => lead[keyOrFn]

    leads.forEach((lead) => {
        const raw = extractor(lead)
        const value = isSinInfo(raw) ? 'Sin Informacion' : normalizer(raw)
        set.add(value)
    })

    return Array.from(set).sort()
}

function formatDateInputValue(date) {
    return format(date, 'yyyy-MM-dd')
}

function getEarliestLeadDate(leads) {
    const sortedDates = leads
        .map((lead) => getLeadTrackingDate(lead))
        .filter(Boolean)
        .sort((a, b) => a.getTime() - b.getTime())

    return sortedDates[0] ? startOfDay(sortedDates[0]) : startOfDay(new Date())
}

function buildDateRangeDefaults(dateRange, leads, existingCustomFrom, existingCustomTo) {
    if (existingCustomFrom && existingCustomTo) {
        return {
            customFrom: existingCustomFrom,
            customTo: existingCustomTo,
        }
    }

    const today = startOfDay(new Date())
    let start = subDays(today, 30)

    switch (dateRange) {
        case 'today':
            start = today
            break
        case '7d':
            start = subDays(today, 7)
            break
        case '30d':
            start = subDays(today, 30)
            break
        case '90d':
            start = subDays(today, 90)
            break
        case 'ytd':
            start = startOfYear(today)
            break
        case 'all':
            start = getEarliestLeadDate(leads)
            break
        case 'custom':
        default:
            start = subDays(today, 30)
            break
    }

    return {
        customFrom: formatDateInputValue(start),
        customTo: formatDateInputValue(today),
    }
}

function MultiSelectDropdown({ title, options, selected, onToggle }) {
    const count = selected.length

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 w-full justify-between rounded-none border-border bg-card px-4 text-sm font-normal text-foreground hover:bg-secondary/50">
                    <span className="truncate">{title}</span>
                    {count > 0 && (
                        <Badge className="ml-2 rounded-none bg-primary px-1.5 py-0 text-xs text-primary-foreground">
                            {count}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 rounded-none border-border bg-card shadow-md">
                {options.map((option) => (
                    <DropdownMenuCheckboxItem
                        key={option}
                        checked={selected.includes(option)}
                        onCheckedChange={() => onToggle(option)}
                        className="rounded-none text-sm text-foreground hover:bg-secondary/50 focus:bg-secondary/50"
                    >
                        {option}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default function FilterBar({ leads }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const { filters, updateFilter, toggleArrayFilter, toggleBooleanFilter, clearFilters } = useFilters()
    const filteredLeads = useFilteredLeads(leads)

    const options = useMemo(() => ({
        fases: getUniqueVals(leads, 'fase_embudo'),
        vendedoras: getUniqueVals(leads, 'vendedora'),
        eventos: getUniqueVals(leads, (lead) => lead.evento_normalizado || lead.evento),
        canales: getUniqueVals(leads, (lead) => lead.canal_normalizado || lead.canal_de_contacto, normalizeCanal),
        origenes: getUniqueVals(leads, 'como_nos_encontro'),
        salones: getUniqueVals(leads, 'salon'),
    }), [leads])

    const activeCount =
        (filters.search ? 1 : 0) +
        (filters.dateRange !== '30d' ? 1 : 0) +
        filters.fases.length +
        filters.vendedoras.length +
        filters.eventos.length +
        filters.canales.length +
        filters.origenes.length +
        filters.salones.length +
        (filters.solo24h ? 1 : 0) +
        (filters.soloPerdidos ? 1 : 0) +
        (filters.soloActivos ? 1 : 0) +
        (filters.datosIncompletos ? 1 : 0)

    const handleDateRangeChange = (nextRange) => {
        if (nextRange === 'custom') {
            const defaults = buildDateRangeDefaults(
                filters.dateRange,
                leads,
                filters.customFrom,
                filters.customTo
            )

            updateFilter('customFrom', defaults.customFrom)
            updateFilter('customTo', defaults.customTo)
        }

        updateFilter('dateRange', nextRange)
    }

    const handleCustomFromChange = (value) => {
        if (!value) return

        updateFilter('customFrom', value)

        if (filters.customTo && value > filters.customTo) {
            updateFilter('customTo', value)
        }
    }

    const handleCustomToChange = (value) => {
        if (!value) return

        updateFilter('customTo', value)

        if (filters.customFrom && value < filters.customFrom) {
            updateFilter('customFrom', value)
        }
    }

    return (
        <div className="mb-8 space-y-4">
            <Card className="overflow-visible rounded-none border-border bg-card shadow-sm transition-all">
                <div
                    className="flex cursor-pointer items-center justify-between px-6 py-4 transition-colors hover:bg-secondary/30"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <Filter className="h-5 w-5 stroke-[1.5] text-muted-foreground" />
                        <span className="font-heading text-lg tracking-wider text-card-foreground">Filtros Avanzados y Busqueda</span>
                        {activeCount > 0 && (
                            <>
                                <Badge className="ml-3 rounded-none bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                                    {activeCount} activos
                                </Badge>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        clearFilters()
                                    }}
                                    className="ml-3 h-8 rounded-none px-4 text-xs font-medium uppercase tracking-widest text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                                >
                                    Restablecer
                                </Button>
                            </>
                        )}
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                </div>

                {isExpanded && (
                    <CardContent className="space-y-6 border-t border-border px-6 pb-6 pt-6">
                        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                            <div className="relative w-full max-w-md flex-1">
                                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 stroke-[1.5] text-muted-foreground" />
                                <Input
                                    placeholder="Buscar nombre, telefono, ID..."
                                    value={filters.search}
                                    onChange={(event) => updateFilter('search', event.target.value)}
                                    className="h-11 rounded-none border-border bg-secondary/30 pl-11 text-sm text-foreground focus:border-foreground focus:ring-0"
                                />
                            </div>

                            <Select value={filters.dateRange} onValueChange={handleDateRangeChange}>
                                <SelectTrigger className="h-11 w-full rounded-none border-border bg-card text-foreground sm:w-[240px]">
                                    <SelectValue placeholder="Fecha" />
                                </SelectTrigger>
                                <SelectContent className="rounded-none border-border bg-card text-foreground">
                                    <SelectItem value="today" className="focus:bg-secondary/50">Hoy</SelectItem>
                                    <SelectItem value="7d" className="focus:bg-secondary/50">Ultimos 7 dias</SelectItem>
                                    <SelectItem value="30d" className="focus:bg-secondary/50">Ultimos 30 dias</SelectItem>
                                    <SelectItem value="90d" className="focus:bg-secondary/50">Ultimos 90 dias</SelectItem>
                                    <SelectItem value="ytd" className="focus:bg-secondary/50">Este año (YTD)</SelectItem>
                                    <SelectItem value="all" className="focus:bg-secondary/50">Todo Historico</SelectItem>
                                    <SelectItem value="custom" className="focus:bg-secondary/50">Rango personalizado</SelectItem>
                                </SelectContent>
                            </Select>

                            <div className="flex-1" />
                        </div>

                        {filters.dateRange === 'custom' && (
                            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                        Fecha inicio
                                    </label>
                                    <Input
                                        type="date"
                                        required
                                        value={filters.customFrom || ''}
                                        max={filters.customTo || undefined}
                                        onChange={(event) => handleCustomFromChange(event.target.value)}
                                        className="h-11 rounded-none border-border bg-card text-sm text-foreground focus:border-foreground focus:ring-0"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                        Fecha fin
                                    </label>
                                    <Input
                                        type="date"
                                        required
                                        value={filters.customTo || ''}
                                        min={filters.customFrom || undefined}
                                        onChange={(event) => handleCustomToChange(event.target.value)}
                                        className="h-11 rounded-none border-border bg-card text-sm text-foreground focus:border-foreground focus:ring-0"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            <MultiSelectDropdown title="Fase Embudo" options={options.fases} selected={filters.fases} onToggle={(value) => toggleArrayFilter('fases', value)} />
                            <MultiSelectDropdown title="Vendedoras" options={options.vendedoras} selected={filters.vendedoras} onToggle={(value) => toggleArrayFilter('vendedoras', value)} />
                            <MultiSelectDropdown title="Canales" options={options.canales} selected={filters.canales} onToggle={(value) => toggleArrayFilter('canales', value)} />
                            <MultiSelectDropdown title="Origenes" options={options.origenes} selected={filters.origenes} onToggle={(value) => toggleArrayFilter('origenes', value)} />
                            <MultiSelectDropdown title="Eventos" options={options.eventos} selected={filters.eventos} onToggle={(value) => toggleArrayFilter('eventos', value)} />
                            <MultiSelectDropdown title="Salones" options={options.salones} selected={filters.salones} onToggle={(value) => toggleArrayFilter('salones', value)} />
                        </div>

                        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                            <span className="mr-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Filtros Rapidos</span>

                            <Badge
                                variant="outline"
                                onClick={() => toggleBooleanFilter('solo24h')}
                                className={`cursor-pointer rounded-none px-4 py-1.5 text-xs font-medium tracking-wide transition-colors ${filters.solo24h ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary/50'
                                    }`}
                            >
                                Solo Seguimientos
                            </Badge>

                            <Badge
                                variant="outline"
                                onClick={() => toggleBooleanFilter('soloPerdidos')}
                                className={`cursor-pointer rounded-none px-4 py-1.5 text-xs font-medium tracking-wide transition-colors ${filters.soloPerdidos ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary/50'
                                    }`}
                            >
                                Solo Ventas Perdidas
                            </Badge>

                            <Badge
                                variant="outline"
                                onClick={() => toggleBooleanFilter('soloActivos')}
                                className={`cursor-pointer rounded-none px-4 py-1.5 text-xs font-medium tracking-wide transition-colors ${filters.soloActivos ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary/50'
                                    }`}
                            >
                                Solo Activos
                            </Badge>

                            <Badge
                                variant="outline"
                                onClick={() => toggleBooleanFilter('datosIncompletos')}
                                className={`cursor-pointer rounded-none px-4 py-1.5 text-xs font-medium tracking-wide transition-colors ${filters.datosIncompletos ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary/50'
                                    }`}
                            >
                                Con Datos Incompletos
                            </Badge>
                        </div>
                    </CardContent>
                )}
            </Card>

            <div className="flex items-center justify-between px-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Mostrando <span className="font-bold text-foreground">{filteredLeads.length}</span> de <span className="text-muted-foreground">{leads.length}</span> leads
                </p>
            </div>
        </div>
    )
}
