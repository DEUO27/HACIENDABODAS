import { useState, useMemo, useCallback } from 'react'
import { useLeads } from '@/hooks/useLeads'
import { mockLeads } from '@/data/mockLeads'
import { isSinInfo, parseLeadDate, normalizeCanal } from '@/lib/leadUtils'

import KpiCards from '@/components/dashboard/KpiCards'
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
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-800">Reminders</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-medium text-slate-400">Seguimiento pendiente</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Follow up: {reminder.nombre}</p>
                    <p className="text-xs text-slate-500 mt-1">Lead #{reminder.lead_id} · {reminder.evento}</p>
                    {d && <p className="text-xs text-slate-400 mt-1">{format(d, "dd MMM yyyy, HH:mm", { locale: es })}</p>}
                    <Button size="sm" className="mt-3 rounded-full bg-emerald-700 text-xs text-white hover:bg-emerald-800">
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
        if (!fase) return 'bg-slate-100 text-slate-600'
        const f = fase.toLowerCase()
        if (f.includes('contrato')) return 'bg-emerald-100 text-emerald-700'
        if (f.includes('perdido')) return 'bg-red-100 text-red-700'
        if (f.includes('+24hrs')) return 'bg-amber-100 text-amber-700'
        if (f.includes('cita') || f.includes('visita')) return 'bg-blue-100 text-blue-700'
        return 'bg-slate-100 text-slate-600'
    }

    return (
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-800">Leads Recientes</CardTitle>
                <Button variant="outline" size="sm" className="rounded-full border-slate-200 text-xs">
                    <Plus className="mr-1 h-3 w-3" /> New
                </Button>
            </CardHeader>
            <CardContent className="space-y-2">
                {recent.map(lead => {
                    const d = parseLeadDate(lead.fecha_primer_mensaje)
                    return (
                        <button
                            key={lead.lead_id}
                            onClick={() => onSelectLead(lead)}
                            className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-slate-50"
                        >
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                                <User className="h-4 w-4 text-emerald-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{lead.nombre}</p>
                                <p className="text-xs text-slate-400">{d ? format(d, 'dd MMM', { locale: es }) : 'Sin fecha'}</p>
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
        if (v.perdidos > v.activos) return { label: 'Needs follow-up', color: 'bg-red-100 text-red-700' }
        if (v.activos > 3) return { label: 'On track', color: 'bg-emerald-100 text-emerald-700' }
        return { label: 'Backlog', color: 'bg-amber-100 text-amber-700' }
    }

    const colors = ['bg-emerald-200', 'bg-blue-200', 'bg-amber-200', 'bg-rose-200']

    return (
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-800">Team Collaboration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {team.map((v, i) => {
                    const status = getStatus(v)
                    return (
                        <div key={v.name} className="flex items-center gap-3 rounded-xl p-2">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className={`text-xs font-bold text-slate-700 ${colors[i % colors.length]}`}>
                                    {v.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800">{v.name}</p>
                                <p className="text-xs text-slate-400">{v.total} leads</p>
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
        { name: 'Activos', value: activos, fill: '#059669' },
        { name: 'Perdidos', value: perdidos, fill: '#e2e8f0' },
    ]

    if (loading) {
        return (
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                <CardContent className="flex items-center justify-center p-6" style={{ height: 240 }}>
                    <Skeleton className="h-36 w-36 rounded-full bg-slate-100" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold text-slate-800">Pipeline Progress</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-2">
                <div className="relative" style={{ width: 160, height: 160 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={72} paddingAngle={4} dataKey="value" startAngle={90} endAngle={-270}>
                                {data.map((e, i) => <Cell key={i} fill={e.fill} />)}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-slate-900 tabular-nums">{pct}%</span>
                        <span className="text-xs text-slate-500">Activos</span>
                    </div>
                </div>
                <div className="mt-3 flex items-center gap-5 text-xs">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" />Activos</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-200" />Perdidos</span>
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
        <Card className="relative overflow-hidden rounded-2xl border-emerald-800 bg-gradient-to-br from-emerald-900 to-emerald-950 text-white shadow-sm">
            <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-700/30" />
            <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-emerald-800/40" />
            <CardHeader className="relative pb-2">
                <CardTitle className="text-sm font-semibold text-emerald-100">Data Quality</CardTitle>
            </CardHeader>
            <CardContent className="relative grid grid-cols-2 gap-2">
                {[
                    { icon: Phone, val: stats.phone, label: 'Sin teléfono' },
                    { icon: Calendar, val: stats.event, label: 'Sin fecha evento' },
                    { icon: AlertTriangle, val: stats.origen, label: 'Origen desc.' },
                    { icon: MapPin, val: stats.salon, label: 'Salón indeciso' },
                ].map(({ icon: Icon, val, label }) => (
                    <div key={label} className="rounded-xl bg-white/10 p-3">
                        <Icon className="mb-1 h-4 w-4 text-emerald-300" />
                        <p className="text-lg font-bold tabular-nums">{val}%</p>
                        <p className="text-xs text-emerald-200">{label}</p>
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
    const rows = useMemo(() => {
        return [...leads]
            .sort((a, b) => (b.fecha_primer_mensaje || '').localeCompare(a.fecha_primer_mensaje || ''))
            .slice(0, 15)
    }, [leads])

    const getBadge = (field, value) => {
        if (isSinInfo(value)) return <Badge variant="outline" className="rounded-full text-xs border-slate-300 text-slate-400">Sin Info</Badge>
        if (field === 'fase_embudo') {
            const f = (value || '').toLowerCase()
            if (f.includes('perdido')) return <Badge className="rounded-full bg-red-100 text-xs text-red-700">Perdido</Badge>
            if (f.includes('+24hrs')) return <Badge className="rounded-full bg-amber-100 text-xs text-amber-700">+24H</Badge>
            if (f.includes('contrato')) return <Badge className="rounded-full bg-emerald-100 text-xs text-emerald-700">{value}</Badge>
            return <Badge className="rounded-full bg-blue-100 text-xs text-blue-700">{value}</Badge>
        }
        if (field === 'salon' && (value || '').toLowerCase().includes('no est'))
            return <Badge className="rounded-full bg-slate-100 text-xs text-slate-600">Indeciso</Badge>
        return <span className="text-sm text-slate-700">{value}</span>
    }

    if (loading) {
        return (
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                <CardContent className="p-6">
                    <Skeleton className="mb-4 h-5 w-32 bg-slate-100" />
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="mb-3 h-12 w-full rounded-lg bg-slate-100" />)}
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-800">Recent Leads</CardTitle>
                <Button variant="outline" size="sm" className="rounded-full border-slate-200 text-xs">
                    <Download className="mr-1 h-3 w-3" /> Export
                </Button>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100">
                                {['ID', 'Nombre', 'Evento', 'Fase', 'Vendedora', 'Canal', 'Origen', 'Teléfono', 'Salón'].map(h => (
                                    <th key={h} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(lead => (
                                <tr key={lead.lead_id} onClick={() => onSelectLead(lead)} className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50">
                                    <td className="px-3 py-2.5 text-sm font-medium text-slate-800 tabular-nums">#{lead.lead_id}</td>
                                    <td className="px-3 py-2.5 text-sm font-medium text-slate-800">{lead.nombre}</td>
                                    <td className="px-3 py-2.5 text-sm text-slate-600">{lead.evento}</td>
                                    <td className="px-3 py-2.5">{getBadge('fase_embudo', lead.fase_embudo)}</td>
                                    <td className="px-3 py-2.5 text-sm text-slate-600">{lead.vendedora}</td>
                                    <td className="px-3 py-2.5 text-sm text-slate-600">{normalizeCanal(lead.canal_de_contacto)}</td>
                                    <td className="px-3 py-2.5 text-sm text-slate-600">{lead.como_nos_encontro}</td>
                                    <td className="px-3 py-2.5">{getBadge('telefono', lead.telefono)}</td>
                                    <td className="px-3 py-2.5">{getBadge('salon', lead.salon)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
            <SheetContent className="w-full border-slate-200 bg-white sm:max-w-md overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-lg font-bold text-slate-900">Detalle del Lead</SheetTitle>
                </SheetHeader>
                <div className="space-y-4">
                    <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                        <Avatar className="h-14 w-14">
                            <AvatarFallback className="bg-emerald-100 text-lg font-bold text-emerald-700">
                                {lead.nombre?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-lg font-bold text-slate-900">{lead.nombre}</p>
                            <p className="text-sm text-slate-500">#{lead.lead_id}</p>
                        </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        {fields.map(({ label, key, icon }) => {
                            const val = lead[key]
                            const missing = isSinInfo(val)
                            return (
                                <div key={key} className="flex items-start gap-3 rounded-xl p-3 hover:bg-slate-50">
                                    <span className="text-base">{icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-400">{label}</p>
                                        {missing
                                            ? <Badge variant="outline" className="mt-1 rounded-full text-xs border-slate-300 text-slate-400">Sin Información</Badge>
                                            : <p className="text-sm font-medium text-slate-800 break-all">{val}</p>
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
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-800">Detalle de campos faltantes</CardTitle>
            </CardHeader>
            <CardContent>
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Campo</th>
                            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Faltantes</th>
                            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Total</th>
                            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {missingByField.map(r => (
                            <tr key={r.field} className="border-b border-slate-50">
                                <td className="px-3 py-2.5 text-sm font-medium text-slate-800">{r.field}</td>
                                <td className="px-3 py-2.5 text-sm text-red-600 tabular-nums">{r.missing}</td>
                                <td className="px-3 py-2.5 text-sm text-slate-600 tabular-nums">{r.total}</td>
                                <td className="px-3 py-2.5">
                                    <Badge className={`rounded-full text-xs ${r.pct > 20 ? 'bg-red-100 text-red-700' : r.pct > 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
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
export default function Dashboard({ searchValue = '' }) {
    const { leads: apiLeads, loading } = useLeads()
    const [selectedLead, setSelectedLead] = useState(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [vendedoraView, setVendedoraView] = useState('total')

    // Use API leads if available, fallback to mock
    const allLeads = apiLeads.length > 0 ? apiLeads : mockLeads

    // Search filter
    const leads = useMemo(() => {
        if (!searchValue.trim()) return allLeads
        const q = searchValue.toLowerCase()
        return allLeads.filter(l =>
            (l.nombre || '').toLowerCase().includes(q) ||
            (l.telefono || '').toLowerCase().includes(q) ||
            (l.lead_id || '').toLowerCase().includes(q)
        )
    }, [allLeads, searchValue])

    const handleSelectLead = useCallback((lead) => {
        setSelectedLead(lead)
        setSheetOpen(true)
    }, [])

    return (
        <div className="space-y-6">
            {/* 10 KPI CARDS */}
            <KpiCards leads={leads} loading={loading} />

            {/* TABBED ANALYTICS */}
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="inline-flex rounded-xl bg-slate-100 p-1">
                    <TabsTrigger value="overview" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500">
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="pipeline" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500">
                        Pipeline
                    </TabsTrigger>
                    <TabsTrigger value="acquisition" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500">
                        Acquisition
                    </TabsTrigger>
                    <TabsTrigger value="dataquality" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500">
                        Data Quality
                    </TabsTrigger>
                </TabsList>

                {/* ─── OVERVIEW ─── */}
                <TabsContent value="overview" className="mt-4 space-y-4">
                    {/* Row 1: Leads/day + Reminders + Recent leads */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                        <div className="lg:col-span-5">
                            <LeadsByDayChart leads={leads} loading={loading} />
                        </div>
                        <div className="lg:col-span-3">
                            <RemindersCard leads={leads} />
                        </div>
                        <div className="lg:col-span-4">
                            <RecentLeadsList leads={leads} onSelectLead={handleSelectLead} />
                        </div>
                    </div>

                    {/* Row 2: Team + Pipeline donut + Data quality widget */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                        <div className="lg:col-span-5">
                            <TeamCard leads={leads} />
                        </div>
                        <div className="lg:col-span-3">
                            <PipelineDonut leads={leads} loading={loading} />
                        </div>
                        <div className="lg:col-span-4">
                            <DataQualityCard leads={leads} />
                        </div>
                    </div>
                </TabsContent>

                {/* ─── PIPELINE ─── */}
                <TabsContent value="pipeline" className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <LeadsByFaseChart leads={leads} loading={loading} />
                        <div>
                            <div className="mb-3 flex gap-2">
                                <Button
                                    size="sm"
                                    variant={vendedoraView === 'total' ? 'default' : 'outline'}
                                    onClick={() => setVendedoraView('total')}
                                    className={`rounded-full text-xs ${vendedoraView === 'total' ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'border-slate-200'}`}
                                >
                                    Total
                                </Button>
                                <Button
                                    size="sm"
                                    variant={vendedoraView === 'stacked' ? 'default' : 'outline'}
                                    onClick={() => setVendedoraView('stacked')}
                                    className={`rounded-full text-xs ${vendedoraView === 'stacked' ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'border-slate-200'}`}
                                >
                                    Por fase
                                </Button>
                            </div>
                            <LeadsByVendedoraChart leads={leads} loading={loading} stacked={vendedoraView === 'stacked'} />
                        </div>
                    </div>
                </TabsContent>

                {/* ─── ACQUISITION ─── */}
                <TabsContent value="acquisition" className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <TopOrigenesChart leads={leads} loading={loading} />
                        <LeadsByCanalChart leads={leads} loading={loading} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <LeadsByEventoChart leads={leads} loading={loading} />
                        <LeadsByHourChart leads={leads} loading={loading} />
                    </div>
                </TabsContent>

                {/* ─── DATA QUALITY ─── */}
                <TabsContent value="dataquality" className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <DataQualityChart leads={leads} loading={loading} />
                        <DataQualityDetails leads={leads} />
                    </div>
                </TabsContent>
            </Tabs>

            {/* LEADS TABLE */}
            <LeadsTable leads={leads} loading={loading} onSelectLead={handleSelectLead} />

            {/* DETAIL SHEET */}
            <LeadDetailSheet lead={selectedLead} open={sheetOpen} onClose={() => setSheetOpen(false)} />
        </div>
    )
}
