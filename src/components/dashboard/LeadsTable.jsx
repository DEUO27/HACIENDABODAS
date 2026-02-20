import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { parseISO } from 'date-fns'
import LeadDetailSheet from './LeadDetailSheet'

function isSinInfo(val) {
    return !val || val === 'Sin Informacion' || val.trim() === ''
}

function StatusBadge({ value, field }) {
    if (isSinInfo(value)) {
        return <Badge variant="outline" className="border-amber-700/50 bg-amber-950/30 text-amber-400 text-xs">Sin Info</Badge>
    }

    if (field === 'fase_embudo') {
        if (value === 'Venta Perdido') {
            return <Badge variant="outline" className="border-red-700/50 bg-red-950/30 text-red-400 text-xs">{value}</Badge>
        }
        if (value.toUpperCase().includes('+24') || value.toUpperCase().includes('NO CONTESTA')) {
            return <Badge variant="outline" className="border-orange-700/50 bg-orange-950/30 text-orange-400 text-xs">{value}</Badge>
        }
    }

    if (field === 'salon' && (value.toLowerCase().includes('no está seguro') || value.toLowerCase().includes('no esta seguro'))) {
        return <Badge variant="outline" className="border-purple-700/50 bg-purple-950/30 text-purple-400 text-xs">Indeciso</Badge>
    }

    return <span className="text-sm text-zinc-300">{value}</span>
}

export default function LeadsTable({ leads, loading }) {
    const [selectedLead, setSelectedLead] = useState(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const recentLeads = useMemo(() => {
        return [...leads]
            .sort((a, b) => {
                const da = a.fecha_primer_mensaje && a.fecha_primer_mensaje !== 'Sin Informacion'
                    ? parseISO(a.fecha_primer_mensaje).getTime() : 0
                const db = b.fecha_primer_mensaje && b.fecha_primer_mensaje !== 'Sin Informacion'
                    ? parseISO(b.fecha_primer_mensaje).getTime() : 0
                return db - da
            })
            .slice(0, 50)
    }, [leads])

    const handleRowClick = (lead) => {
        setSelectedLead(lead)
        setSheetOpen(true)
    }

    if (loading) {
        return (
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader>
                    <Skeleton className="h-5 w-36 bg-zinc-800" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-zinc-300">
                        Leads recientes ({recentLeads.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-transparent">
                                    <TableHead className="text-zinc-400 text-xs">ID</TableHead>
                                    <TableHead className="text-zinc-400 text-xs">Nombre</TableHead>
                                    <TableHead className="text-zinc-400 text-xs">Evento</TableHead>
                                    <TableHead className="text-zinc-400 text-xs">Fase</TableHead>
                                    <TableHead className="text-zinc-400 text-xs">Vendedora</TableHead>
                                    <TableHead className="text-zinc-400 text-xs">Canal</TableHead>
                                    <TableHead className="text-zinc-400 text-xs">Origen</TableHead>
                                    <TableHead className="text-zinc-400 text-xs">Fecha Evento</TableHead>
                                    <TableHead className="text-zinc-400 text-xs">Teléfono</TableHead>
                                    <TableHead className="text-zinc-400 text-xs">Salón</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentLeads.map((lead, i) => (
                                    <TableRow
                                        key={lead.lead_id || i}
                                        className="border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                                        onClick={() => handleRowClick(lead)}
                                    >
                                        <TableCell className="text-xs text-zinc-400 font-mono">{lead.lead_id}</TableCell>
                                        <TableCell className="text-sm text-zinc-200 font-medium max-w-[150px] truncate">{lead.nombre}</TableCell>
                                        <TableCell className="text-sm"><StatusBadge value={lead.evento} field="evento" /></TableCell>
                                        <TableCell className="text-sm"><StatusBadge value={lead.fase_embudo} field="fase_embudo" /></TableCell>
                                        <TableCell className="text-sm"><StatusBadge value={lead.vendedora} field="vendedora" /></TableCell>
                                        <TableCell className="text-sm"><StatusBadge value={lead.canal_de_contacto} field="canal_de_contacto" /></TableCell>
                                        <TableCell className="text-sm"><StatusBadge value={lead.como_nos_encontro} field="como_nos_encontro" /></TableCell>
                                        <TableCell className="text-sm"><StatusBadge value={lead.fecha_evento} field="fecha_evento" /></TableCell>
                                        <TableCell className="text-sm"><StatusBadge value={lead.telefono} field="telefono" /></TableCell>
                                        <TableCell className="text-sm"><StatusBadge value={lead.salon} field="salon" /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <LeadDetailSheet
                lead={selectedLead}
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
            />
        </>
    )
}
