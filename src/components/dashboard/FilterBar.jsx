import { useMemo } from 'react'
import { useFilters } from '@/contexts/FilterContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FilterX } from 'lucide-react'

function getUniqueValues(leads, key) {
    const values = [...new Set(leads.map((l) => l[key]).filter(Boolean))]
    return values.sort()
}

export default function FilterBar({ leads }) {
    const { filters, updateFilter, clearFilters } = useFilters()

    const vendedoras = useMemo(() => getUniqueValues(leads, 'vendedora'), [leads])
    const fases = useMemo(() => getUniqueValues(leads, 'fase_embudo'), [leads])
    const eventos = useMemo(() => getUniqueValues(leads, 'evento'), [leads])
    const canales = useMemo(() => getUniqueValues(leads, 'canal_de_contacto'), [leads])
    const origenes = useMemo(() => getUniqueValues(leads, 'como_nos_encontro'), [leads])
    const salones = useMemo(() => getUniqueValues(leads, 'salon'), [leads])

    const hasFilters = filters.vendedora || filters.fase || filters.evento ||
        filters.canal || filters.origen || filters.salon ||
        filters.dateRange !== '30d' || filters.search

    return (
        <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="p-4">
                <div className="flex flex-wrap items-end gap-3">
                    {/* Date range - mobile only */}
                    <div className="sm:hidden space-y-1 w-full">
                        <Label className="text-xs text-zinc-400">Periodo</Label>
                        <Select value={filters.dateRange} onValueChange={(v) => updateFilter('dateRange', v)}>
                            <SelectTrigger className="border-zinc-700 bg-zinc-800/50 text-zinc-300">
                                <SelectValue placeholder="Periodo" />
                            </SelectTrigger>
                            <SelectContent className="border-zinc-800 bg-zinc-900">
                                <SelectItem value="today">Hoy</SelectItem>
                                <SelectItem value="7d">7 días</SelectItem>
                                <SelectItem value="30d">30 días</SelectItem>
                                <SelectItem value="custom">Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Custom date range inputs (mobile) */}
                    {filters.dateRange === 'custom' && (
                        <div className="md:hidden flex items-center gap-2 w-full">
                            <div className="flex-1 space-y-1">
                                <Label className="text-xs text-zinc-400">Desde</Label>
                                <Input
                                    type="date"
                                    value={filters.customFrom || ''}
                                    onChange={(e) => updateFilter('customFrom', e.target.value)}
                                    className="border-zinc-700 bg-zinc-800/50 text-zinc-300"
                                />
                            </div>
                            <div className="flex-1 space-y-1">
                                <Label className="text-xs text-zinc-400">Hasta</Label>
                                <Input
                                    type="date"
                                    value={filters.customTo || ''}
                                    onChange={(e) => updateFilter('customTo', e.target.value)}
                                    className="border-zinc-700 bg-zinc-800/50 text-zinc-300"
                                />
                            </div>
                        </div>
                    )}

                    <FilterSelect
                        label="Vendedora"
                        value={filters.vendedora}
                        onChange={(v) => updateFilter('vendedora', v)}
                        options={vendedoras}
                    />
                    <FilterSelect
                        label="Fase"
                        value={filters.fase}
                        onChange={(v) => updateFilter('fase', v)}
                        options={fases}
                    />
                    <FilterSelect
                        label="Evento"
                        value={filters.evento}
                        onChange={(v) => updateFilter('evento', v)}
                        options={eventos}
                    />
                    <FilterSelect
                        label="Canal"
                        value={filters.canal}
                        onChange={(v) => updateFilter('canal', v)}
                        options={canales}
                    />
                    <FilterSelect
                        label="Origen"
                        value={filters.origen}
                        onChange={(v) => updateFilter('origen', v)}
                        options={origenes}
                    />
                    <FilterSelect
                        label="Salón"
                        value={filters.salon}
                        onChange={(v) => updateFilter('salon', v)}
                        options={salones}
                    />

                    {hasFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                        >
                            <FilterX className="mr-1 h-4 w-4" />
                            Limpiar
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

function FilterSelect({ label, value, onChange, options }) {
    return (
        <div className="space-y-1 min-w-[140px]">
            <Label className="text-xs text-zinc-400">{label}</Label>
            <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? '' : v)}>
                <SelectTrigger className="border-zinc-700 bg-zinc-800/50 text-zinc-300 h-9 text-sm">
                    <SelectValue placeholder={`Todos`} />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900 max-h-60">
                    <SelectItem value="all">Todos</SelectItem>
                    {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                            {opt}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
