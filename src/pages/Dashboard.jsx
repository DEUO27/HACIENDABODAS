import { useState, useMemo, useCallback } from 'react'
import { useLeads } from '@/hooks/useLeads'
import { isSinInfo, parseLeadDate, normalizeCanal } from '@/lib/leadUtils'
import { useFilteredLeads, useFilters } from '@/contexts/FilterContext'

import FilterBar from '@/components/dashboard/FilterBar'
import KpiCards from '@/components/dashboard/KpiCards'
import ExportReportDialog from '@/components/dashboard/ExportReportDialog'
import {
    LeadsByDayChart,
    LeadsByFaseChart,
    TopOrigenesChart,
    LeadsByCanalChart,
    LeadsByVendedoraChart,
    LeadsByEventoChart,
    LeadsByHourChart,
    DataQualityChart,
} from '@/components/dashboard/Charts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import {
    PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import {
    TrendingUp, Users, UserCheck, UserX, PhoneOff, Clock,
    Plus, User, ArrowUpRight, Calendar, Phone, MapPin,
    AlertTriangle, CheckCircle2, Download,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/* ═══════════════════════════════════════
   MINI WIDGETS (Overview tab only)
   ═══════════════════════════════════════ */

/* Reminders */
function RemindersCard({ leads }) {
    const reminder = useMemo(() => {
        return leads.find(l => (l.fase_embudo || '').toLowerCase().includes('+24hrs')) || leads[0]
    }, [leads])
    if (!reminder) return null

    const d = parseLeadDate(reminder.fecha_primer_mensaje)

    return (
        <Card className="rounded-none border-border bg-card shadow-sm">
            <CardHeader className="pb-4">
                <CardTitle className="font-heading text-lg tracking-wider text-card-foreground">Reminders</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="bg-secondary/30 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-xs uppercase tracking-widest text-muted-foreground">Seguimiento pendiente</span>
                    </div>
                    <p className="text-base font-medium text-foreground">{reminder.nombre}</p>
                    <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wide">Lead #{reminder.lead_id} · {reminder.evento}</p>
                    {d && <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{format(d, "dd MMM yyyy, HH:mm", { locale: es })}</p>}
                    <Button size="sm" className="mt-5 rounded-none bg-primary text-xs font-medium tracking-widest text-primary-foreground hover:bg-primary/90 w-full uppercase">
                        Open Lead
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

/* Recent Leads list */
function RecentLeadsList({ leads, onSelectLead }) {
    const recent = useMemo(() => {
        return [...leads]
            .sort((a, b) => (b.fecha_primer_mensaje || '').localeCompare(a.fecha_primer_mensaje || ''))
            .slice(0, 6)
    }, [leads])

    const faseColor = (fase) => {
        if (!fase) return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
        const f = fase.toLowerCase()
        if (f.includes('contrato')) return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
        if (f.includes('perdido')) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        if (f.includes('+24hrs')) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
        if (f.includes('cita') || f.includes('visita')) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
    }

    return (
        <Card className="rounded-none border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="font-heading text-lg tracking-wider text-card-foreground">Leads Recientes</CardTitle>
                <Button variant="outline" size="sm" className="rounded-none border-foreground text-xs uppercase tracking-widest hover:bg-secondary">
                    <Plus className="mr-2 h-3 w-3" /> New
                </Button>
            </CardHeader>
            <CardContent className="space-y-2">
                {recent.map(lead => {
                    const d = parseLeadDate(lead.fecha_primer_mensaje)
                    return (
                        <button
                            key={lead.lead_id}
                            onClick={() => onSelectLead(lead)}
                            className="flex w-full items-center gap-4 p-3 text-left transition-colors hover:bg-secondary/50 border border-transparent hover:border-border"
                        >
                            <div className="flex h-10 w-10 items-center justify-center bg-secondary">
                                <User className="h-4 w-4 text-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{lead.nombre}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{d ? format(d, 'dd MMM', { locale: es }) : 'Sin fecha'}</p>
                            </div>
                            <Badge className={`rounded-full text-xs font-medium ${faseColor(lead.fase_embudo)}`}>
                                {(lead.fase_embudo || 'Sin fase').split(' ').slice(0, 2).join(' ')}
                            </Badge>
                        </button>
                    )
                })}
            </CardContent>
        </Card>
    )
}

/* Team (vendedoras) */
function TeamCard({ leads }) {
    const team = useMemo(() => {
        const map = {}
        leads.forEach(l => {
            const v = isSinInfo(l.vendedora) ? 'Sin asignar' : l.vendedora
            if (!map[v]) map[v] = { name: v, total: 0, activos: 0, perdidos: 0 }
            map[v].total++
            if ((l.fase_embudo || '').toLowerCase().includes('perdido')) map[v].perdidos++
            else map[v].activos++
        })
        return Object.values(map).sort((a, b) => b.total - a.total)
    }, [leads])

    const getStatus = (v) => {
        if (v.perdidos > v.activos) return { label: 'Needs follow-up', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' }
        if (v.activos > 3) return { label: 'On track', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' }
        return { label: 'Backlog', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' }
    }

    const colors = ['bg-emerald-200 dark:bg-emerald-800', 'bg-blue-200 dark:bg-blue-800', 'bg-amber-200 dark:bg-amber-800', 'bg-rose-200 dark:bg-rose-800']

    return (
        <Card className="rounded-none border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="font-heading text-lg tracking-wider text-card-foreground">Team Collaboration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {team.map((v, i) => {
                    const status = getStatus(v)
                    return (
                        <div key={v.name} className="flex items-center gap-4 p-3 hover:bg-secondary/30 transition-colors">
                            <Avatar className="h-10 w-10 rounded-none">
                                <AvatarFallback className={`text-xs font-bold text-foreground bg-secondary font-heading tracking-widest`}>
                                    {v.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{v.name}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">{v.total} leads</p>
                            </div>
                            <Badge className={`rounded-full text-xs font-medium ${status.color}`}>{status.label}</Badge>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}

/* Pipeline donut */
function PipelineDonut({ leads, loading }) {
    const { activos, perdidos, pct } = useMemo(() => {
        const a = leads.filter(l => !(l.fase_embudo || '').toLowerCase().includes('perdido')).length
        const p = leads.filter(l => (l.fase_embudo || '').toLowerCase().includes('perdido')).length
        return { activos: a, perdidos: p, pct: Math.round((a / (a + p || 1)) * 100) }
    }, [leads])

    const data = [
        { name: 'Activos', value: activos, fill: '#E2D4C8' },
        { name: 'Perdidos', value: perdidos, fill: '#A9AFA3' },
    ]

    if (loading) {
        return (
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
                <CardContent className="flex items-center justify-center p-6" style={{ height: 240 }}>
                    <Skeleton className="h-36 w-36 rounded-full bg-slate-100 dark:bg-slate-800" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="rounded-none border-border bg-card shadow-sm">
            <CardHeader className="pb-4">
                <CardTitle className="font-heading text-lg tracking-wider text-card-foreground">Pipeline Progress</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-2">
                <div className="relative" style={{ width: 160, height: 160 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={72} paddingAngle={4} dataKey="value" startAngle={90} endAngle={-270}>
                                {data.map((e, i) => <Cell key={i} fill={e.fill} className="dark:opacity-80" />)}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-numbers text-4xl text-foreground tabular-nums">{pct}%</span>
                        <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Activos</span>
                    </div>
                </div>
                <div className="mt-5 flex items-center justify-center gap-8 text-xs uppercase tracking-widest text-muted-foreground w-full">
                    <span className="flex items-center gap-2"><span className="h-3 w-3 bg-[#E2D4C8]" />Activos</span>
                    <span className="flex items-center gap-2"><span className="h-3 w-3 bg-[#A9AFA3] dark:bg-slate-700" />Perdidos</span>
                </div>
            </CardContent>
        </Card>
    )
}

/* Data Quality dark card */
function DataQualityCard({ leads }) {
    const stats = useMemo(() => {
        if (!leads.length) return { phone: 0, event: 0, origen: 0, salon: 0 }
        const t = leads.length
        return {
            phone: Math.round((leads.filter(l => isSinInfo(l.telefono)).length / t) * 100),
            event: Math.round((leads.filter(l => isSinInfo(l.fecha_evento)).length / t) * 100),
            origen: Math.round((leads.filter(l => isSinInfo(l.como_nos_encontro)).length / t) * 100),
            salon: Math.round((leads.filter(l => isSinInfo(l.salon) || (l.salon || '').toLowerCase().includes('no est')).length / t) * 100),
        }
    }, [leads])

    return (
        <Card className="relative overflow-hidden rounded-none border border-border bg-card text-foreground shadow-sm">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-secondary/50 blur-3xl opacity-50" />
            <div className="absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-primary/20 blur-3xl opacity-50" />
            <CardHeader className="relative pb-4">
                <CardTitle className="font-heading text-lg tracking-wider text-card-foreground">Data Quality</CardTitle>
            </CardHeader>
            <CardContent className="relative grid grid-cols-2 gap-4">
                {[
                    { icon: Phone, val: stats.phone, label: 'Sin teléfono' },
                    { icon: Calendar, val: stats.event, label: 'Sin fecha' },
                    { icon: AlertTriangle, val: stats.origen, label: 'Origen desc.' },
                    { icon: MapPin, val: stats.salon, label: 'Indecisos' },
                ].map(({ icon: Icon, val, label }) => (
                    <div key={label} className="bg-secondary/40 p-5 border border-transparent hover:border-border transition-colors">
                        <Icon className="mb-3 h-5 w-5 text-muted-foreground stroke-[1.5]" />
                        <p className="font-numbers text-3xl tabular-nums">{val}%</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}

/* ═══════════════════════════════════════
   LEADS TABLE
   ═══════════════════════════════════════ */
function LeadsTable({ leads, loading, onSelectLead }) {
    const [visibleCount, setVisibleCount] = useState(15)

    const rows = useMemo(() => {
        return [...leads]
            .sort((a, b) => (b.fecha_primer_mensaje || '').localeCompare(a.fecha_primer_mensaje || ''))
            .slice(0, visibleCount)
    }, [leads, visibleCount])

    const getBadge = (field, value) => {
        if (isSinInfo(value)) return <Badge variant="outline" className="rounded-full text-xs border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500">Sin Info</Badge>
        if (field === 'fase_embudo') {
            const f = (value || '').toLowerCase()
            if (f.includes('perdido')) return <Badge className="rounded-full bg-red-100 dark:bg-red-900/30 text-xs text-red-700 dark:text-red-400">Perdido</Badge>
            if (f.includes('+24hrs')) return <Badge className="rounded-none bg-secondary text-xs text-foreground uppercase tracking-widest border border-border">+24H</Badge>
            if (f.includes('contrato')) return <Badge className="rounded-none bg-primary text-xs text-primary-foreground uppercase tracking-widest">{value}</Badge>
            return <Badge className="rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs text-blue-700 dark:text-blue-400">{value}</Badge>
        }
        if (field === 'salon' && (value || '').toLowerCase().includes('no est'))
            return <Badge className="rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">Indeciso</Badge>
        return <span className="text-sm text-slate-700 dark:text-slate-300">{value}</span>
    }

    if (loading) {
        return (
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
                <CardContent className="p-6">
                    <Skeleton className="mb-4 h-5 w-32 bg-slate-100 dark:bg-slate-800" />
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="mb-3 h-12 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />)}
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="rounded-none border-border bg-card shadow-sm mt-8">
            <CardHeader className="flex flex-row items-center justify-between pb-6">
                <CardTitle className="font-heading text-lg tracking-wider text-card-foreground">Recent Leads</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                {['ID', 'Nombre', 'Evento', 'Fase', 'Vendedora', 'Canal', 'Origen', 'Teléfono', 'Salón'].map(h => (
                                    <th key={h} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(lead => (
                                <tr key={lead.lead_id} onClick={() => onSelectLead(lead)} className="cursor-pointer border-b border-slate-50 dark:border-slate-800/50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                    <td className="px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 tabular-nums">#{lead.lead_id}</td>
                                    <td className="px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100">{lead.nombre}</td>
                                    <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400">{lead.evento}</td>
                                    <td className="px-3 py-2.5">{getBadge('fase_embudo', lead.fase_embudo)}</td>
                                    <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400">{lead.vendedora}</td>
                                    <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400">{normalizeCanal(lead.canal_de_contacto)}</td>
                                    <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400">{lead.como_nos_encontro}</td>
                                    <td className="px-3 py-2.5">{getBadge('telefono', lead.telefono)}</td>
                                    <td className="px-3 py-2.5">{getBadge('salon', lead.salon)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {visibleCount < leads.length && (
                    <div className="mt-4 flex justify-center border-t border-slate-100 dark:border-slate-800 pt-4 pb-2">
                        <Button
                            variant="outline"
                            onClick={() => setVisibleCount(prev => prev + 50)}
                            className="rounded-full border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                            Cargar más leads ({visibleCount} de {leads.length})
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

/* ═══════════════════════════════════════
   LEAD DETAIL SHEET
   ═══════════════════════════════════════ */
function LeadDetailSheet({ lead, open, onClose }) {
    if (!lead) return null

    const fields = [
        { label: 'Lead ID', key: 'lead_id', icon: '🆔' },
        { label: 'Nombre', key: 'nombre', icon: '👤' },
        { label: 'Teléfono', key: 'telefono', icon: '📱' },
        { label: 'Canal', key: 'canal_de_contacto', icon: '📨' },
        { label: 'Evento', key: 'evento', icon: '🎉' },
        { label: 'Fecha Evento', key: 'fecha_evento', icon: '📅' },
        { label: 'Cómo nos encontró', key: 'como_nos_encontro', icon: '🔍' },
        { label: 'Fase', key: 'fase_embudo', icon: '📊' },
        { label: 'Primer Mensaje', key: 'fecha_primer_mensaje', icon: '💬' },
        { label: 'Vendedora', key: 'vendedora', icon: '👩‍💼' },
        { label: 'Salón', key: 'salon', icon: '🏛️' },
    ]

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent className="w-full border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 sm:max-w-md overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">Detalle del Lead</SheetTitle>
                </SheetHeader>
                <div className="space-y-4">
                    <div className="flex items-center gap-4 rounded-2xl bg-slate-50 dark:bg-slate-900 p-4">
                        <Avatar className="h-14 w-14">
                            <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/30 text-lg font-bold text-emerald-700 dark:text-emerald-400">
                                {lead.nombre?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{lead.nombre}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">#{lead.lead_id}</p>
                        </div>
                    </div>
                    <Separator className="dark:bg-slate-800" />
                    <div className="space-y-2">
                        {fields.map(({ label, key, icon }) => {
                            const val = lead[key]
                            const missing = isSinInfo(val)
                            return (
                                <div key={key} className="flex items-start gap-3 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                    <span className="text-base">{icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</p>
                                        {missing
                                            ? <Badge variant="outline" className="mt-1 rounded-full text-xs border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500">Sin Información</Badge>
                                            : <p className="text-sm font-medium text-slate-800 dark:text-slate-200 break-all">{val}</p>
                                        }
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

/* ═══════════════════════════════════════
   DATA QUALITY DETAILS TABLE (for DQ tab)
   ═══════════════════════════════════════ */
function DataQualityDetails({ leads }) {
    const fields = ['telefono', 'fecha_evento', 'canal_de_contacto', 'como_nos_encontro', 'vendedora', 'salon', 'evento']
    const labels = { telefono: 'Teléfono', fecha_evento: 'Fecha Evento', canal_de_contacto: 'Canal', como_nos_encontro: 'Origen', vendedora: 'Vendedora', salon: 'Salón', evento: 'Evento' }

    const missingByField = useMemo(() => {
        return fields.map(f => ({
            field: labels[f],
            missing: leads.filter(l => isSinInfo(l[f])).length,
            total: leads.length,
            pct: leads.length ? Math.round((leads.filter(l => isSinInfo(l[f])).length / leads.length) * 100) : 0,
        })).sort((a, b) => b.pct - a.pct)
    }, [leads])

    return (
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100">Detalle de campos faltantes</CardTitle>
            </CardHeader>
            <CardContent>
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Campo</th>
                            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Faltantes</th>
                            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total</th>
                            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {missingByField.map(r => (
                            <tr key={r.field} className="border-b border-slate-50 dark:border-slate-800/50">
                                <td className="px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100">{r.field}</td>
                                <td className="px-3 py-2.5 text-sm text-red-600 dark:text-red-400 tabular-nums">{r.missing}</td>
                                <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 tabular-nums">{r.total}</td>
                                <td className="px-3 py-2.5">
                                    <Badge className={`rounded-none uppercase font-mono tracking-widest text-xs ${r.pct > 20 ? 'bg-secondary text-foreground border border-border' : r.pct > 5 ? 'bg-secondary/50 text-muted-foreground border border-transparent' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                                        {r.pct}%
                                    </Badge>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    )
}

/* ═══════════════════════════════════════
   MAIN DASHBOARD PAGE
   ═══════════════════════════════════════ */
export default function Dashboard() {
    const { leads: apiLeads, loading, error } = useLeads()
    const [selectedLead, setSelectedLead] = useState(null)
    const [vendedoraView, setVendedoraView] = useState('total')

    // Context / computed
    const filteredLeads = useFilteredLeads(apiLeads || [])
    const { filters, isExportOpen, setIsExportOpen } = useFilters()

    const handleSelectLead = useCallback((lead) => {
        setSelectedLead(lead)
    }, [])

    // This variable is introduced by the user's snippet, assuming it's meant to be `loading`
    const hasInitialLoading = loading && apiLeads.length === 0;

    if (loading && apiLeads.length === 0) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-24 w-full rounded-2xl bg-white/50" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-white/50 dark:bg-slate-950/50" />)}
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-6 text-center text-red-600 dark:text-red-400">
                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500 dark:text-red-400" />
                <h3 className="text-lg font-semibold">Error cargando leads</h3>
                <p className="text-sm">{error}</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <FilterBar leads={apiLeads || []} />

            {/* 10 KPI CARDS */}
            <KpiCards leads={filteredLeads} loading={loading} />

            {/* TABBED ANALYTICS */}
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4 rounded-xl bg-slate-100 dark:bg-slate-900 p-1">
                    <TabsTrigger value="overview" className="rounded-none text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-muted-foreground">
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="pipeline" className="rounded-none text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-muted-foreground">
                        Pipeline
                    </TabsTrigger>
                    <TabsTrigger value="acquisition" className="rounded-none text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-muted-foreground">
                        Acquisition
                    </TabsTrigger>
                    <TabsTrigger value="dataquality" className="rounded-none text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-muted-foreground">
                        Data Quality
                    </TabsTrigger>
                </TabsList>

                {/* ─── OVERVIEW ─── */}
                <TabsContent value="overview" forceMount className="mt-4 space-y-4 data-[state=inactive]:hidden">
                    {/* Row 1: Leads/day + Reminders + Recent leads */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                        <div className="lg:col-span-5">
                            <LeadsByDayChart leads={filteredLeads} loading={loading} />
                        </div>
                        <div className="lg:col-span-3">
                            <RemindersCard leads={filteredLeads} />
                        </div>
                        <div className="lg:col-span-4">
                            <RecentLeadsList leads={filteredLeads} onSelectLead={handleSelectLead} />
                        </div>
                    </div>

                    {/* Row 2: Team + Pipeline donut + Data quality widget */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                        <div className="lg:col-span-5">
                            <TeamCard leads={filteredLeads} />
                        </div>
                        <div className="lg:col-span-3">
                            <PipelineDonut leads={filteredLeads} loading={loading} />
                        </div>
                        <div className="lg:col-span-4">
                            <DataQualityCard leads={filteredLeads} />
                        </div>
                    </div>
                </TabsContent>

                {/* ─── PIPELINE ─── */}
                <TabsContent value="pipeline" forceMount className="mt-4 space-y-4 data-[state=inactive]:hidden">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <LeadsByFaseChart leads={filteredLeads} loading={loading} />
                        <div>
                            <div className="mb-3 flex gap-2">
                                <Button
                                    size="sm"
                                    variant={vendedoraView === 'total' ? 'default' : 'outline'}
                                    onClick={() => setVendedoraView('total')}
                                    className={`rounded-none text-xs tracking-widest uppercase ${vendedoraView === 'total' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-border text-muted-foreground hover:bg-secondary'}`}
                                >
                                    Total
                                </Button>
                                <Button
                                    size="sm"
                                    variant={vendedoraView === 'stacked' ? 'default' : 'outline'}
                                    onClick={() => setVendedoraView('stacked')}
                                    className={`rounded-none text-xs tracking-widest uppercase ${vendedoraView === 'stacked' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-border text-muted-foreground hover:bg-secondary'}`}
                                >
                                    Por fase
                                </Button>
                            </div>
                            <LeadsByVendedoraChart leads={filteredLeads} loading={loading} stacked={vendedoraView === 'stacked'} />
                        </div>
                    </div>
                </TabsContent>

                {/* ─── ACQUISITION ─── */}
                <TabsContent value="acquisition" forceMount className="mt-4 space-y-4 data-[state=inactive]:hidden">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <TopOrigenesChart leads={filteredLeads} loading={loading} />
                        <LeadsByCanalChart leads={filteredLeads} loading={loading} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <LeadsByEventoChart leads={filteredLeads} loading={loading} />
                        <LeadsByHourChart leads={filteredLeads} loading={loading} />
                    </div>
                </TabsContent>

                {/* ─── DATA QUALITY ─── */}
                <TabsContent value="dataquality" forceMount className="mt-4 space-y-4 data-[state=inactive]:hidden">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <LeadsByEventoChart leads={filteredLeads} loading={hasInitialLoading} />
                        <DataQualityChart leads={filteredLeads} loading={hasInitialLoading} />
                    </div>
                </TabsContent>
            </Tabs>

            {/* LEADS TABLE */}
            <LeadsTable
                leads={filteredLeads}
                loading={hasInitialLoading}
                onSelectLead={setSelectedLead}
            />

            {/* DETAIL SHEET */}
            <LeadDetailSheet
                lead={selectedLead}
                open={!!selectedLead}
                onClose={() => setSelectedLead(null)}
            />

            <ExportReportDialog
                open={isExportOpen}
                onOpenChange={setIsExportOpen}
                filteredLeads={filteredLeads}
                allLeadsCount={apiLeads?.length || 0}
                activeFiltersState={filters}
            />
        </div>
    )
}
