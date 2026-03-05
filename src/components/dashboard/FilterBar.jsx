import { useMemo, useState } from 'react'
import { useFilters, useFilteredLeads } from '@/contexts/FilterContext'
import { isSinInfo, normalizeCanal } from '@/lib/leadUtils'
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
import { Search, X, Filter, ChevronDown, ChevronUp } from 'lucide-react'

// Helper to get unique sorted values from leads
function getUniqueVals(leads, keyOrFn, normalizer = (v) => v) {
    const set = new Set()
    const extractor = typeof keyOrFn === 'function' ? keyOrFn : (l) => l[keyOrFn]
    leads.forEach((l) => {
        const raw = extractor(l)
        const val = isSinInfo(raw) ? 'Sin Información' : normalizer(raw)
        set.add(val)
    })
    return Array.from(set).sort()
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
                {options.map((opt) => (
                    <DropdownMenuCheckboxItem
                        key={opt}
                        checked={selected.includes(opt)}
                        onCheckedChange={() => onToggle(opt)}
                        className="rounded-none text-sm text-foreground hover:bg-secondary/50 focus:bg-secondary/50"
                    >
                        {opt}
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

    // Extract unique options dynamically
    const opts = useMemo(() => ({
        fases: getUniqueVals(leads, 'fase_embudo'),
        vendedoras: getUniqueVals(leads, 'vendedora'),
        eventos: getUniqueVals(leads, l => l.evento_normalizado || l.evento),
        canales: getUniqueVals(leads, l => l.canal_normalizado || l.canal_de_contacto, normalizeCanal),
        origenes: getUniqueVals(leads, 'como_nos_encontro'),
        salones: getUniqueVals(leads, 'salon'),
    }), [leads])

    // Count active filters for "Active Filters" chip display
    const activeCount =
        (filters.search ? 1 : 0) +
        (filters.dateRange !== 'all' ? 1 : 0) +
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

    return (
        <div className="space-y-4 mb-8">
            <Card className="rounded-none border-border bg-card shadow-sm overflow-visible transition-all">
                {/* Expand / Collapse Header */}
                <div
                    className={`flex items-center justify-between py-4 px-6 cursor-pointer transition-colors hover:bg-secondary/30`}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <Filter className="h-5 w-5 text-muted-foreground stroke-[1.5]" />
                        <span className="font-heading text-lg tracking-wider text-card-foreground">Filtros Avanzados y Búsqueda</span>
                        {activeCount > 0 && (
                            <>
                                <Badge className="ml-3 rounded-none bg-primary px-3 py-1 text-xs font-semibold tracking-wider uppercase text-primary-foreground">
                                    {activeCount} activos
                                </Badge>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        clearFilters()
                                    }}
                                    className="ml-3 h-8 rounded-none px-4 text-xs font-medium uppercase tracking-widest text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                                >
                                    Restablecer
                                </Button>
                            </>
                        )}
                    </div>
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </div>

                {isExpanded && (
                    <CardContent className="px-6 pb-6 pt-6 border-t border-border space-y-6">

                        {/* Row 1: Search & Date Range & Reset */}
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <div className="relative flex-1 w-full max-w-md">
                                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground stroke-[1.5]" />
                                <Input
                                    placeholder="Buscar nombre, teléfono, ID..."
                                    value={filters.search}
                                    onChange={(e) => updateFilter('search', e.target.value)}
                                    className="h-11 rounded-none border-border bg-secondary/30 pl-11 text-sm text-foreground focus:border-foreground focus:ring-0"
                                />
                            </div>

                            <Select value={filters.dateRange} onValueChange={(v) => updateFilter('dateRange', v)}>
                                <SelectTrigger className="h-11 w-full sm:w-[220px] rounded-none border-border bg-card text-foreground">
                                    <SelectValue placeholder="Fecha" />
                                </SelectTrigger>
                                <SelectContent className="rounded-none border-border bg-card text-foreground">
                                    <SelectItem value="today" className="focus:bg-secondary/50">Hoy</SelectItem>
                                    <SelectItem value="7d" className="focus:bg-secondary/50">Últimos 7 días</SelectItem>
                                    <SelectItem value="30d" className="focus:bg-secondary/50">Últimos 30 días</SelectItem>
                                    <SelectItem value="90d" className="focus:bg-secondary/50">Últimos 90 días</SelectItem>
                                    <SelectItem value="ytd" className="focus:bg-secondary/50">Este año (YTD)</SelectItem>
                                    <SelectItem value="all" className="focus:bg-secondary/50">Todo Histórico</SelectItem>
                                </SelectContent>
                            </Select>

                            <div className="flex-1" />
                        </div>

                        {/* Row 2: Selects Dropdowns */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            <MultiSelectDropdown title="Fase Embudo" options={opts.fases} selected={filters.fases} onToggle={(v) => toggleArrayFilter('fases', v)} />
                            <MultiSelectDropdown title="Vendedoras" options={opts.vendedoras} selected={filters.vendedoras} onToggle={(v) => toggleArrayFilter('vendedoras', v)} />
                            <MultiSelectDropdown title="Canales" options={opts.canales} selected={filters.canales} onToggle={(v) => toggleArrayFilter('canales', v)} />
                            <MultiSelectDropdown title="Orígenes" options={opts.origenes} selected={filters.origenes} onToggle={(v) => toggleArrayFilter('origenes', v)} />
                            <MultiSelectDropdown title="Eventos" options={opts.eventos} selected={filters.eventos} onToggle={(v) => toggleArrayFilter('eventos', v)} />
                            <MultiSelectDropdown title="Salones" options={opts.salones} selected={filters.salones} onToggle={(v) => toggleArrayFilter('salones', v)} />
                        </div>

                        {/* Row 3: Quick Toggles (Chips) */}
                        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border mt-6">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mr-2">Filtros Rápidos</span>

                            <Badge
                                variant="outline"
                                onClick={() => toggleBooleanFilter('solo24h')}
                                className={`cursor-pointer rounded-none px-4 py-1.5 text-xs font-medium tracking-wide transition-colors ${filters.solo24h ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary/50'
                                    }`}
                            >
                                Solo +24HRS
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

            {/* Leads counter indicator */}
            <div className="flex items-center justify-between px-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Mostrando <span className="font-bold text-foreground">{filteredLeads.length}</span> de <span className="text-muted-foreground">{leads.length}</span> leads
                </p>
            </div>
        </div>
    )
}
