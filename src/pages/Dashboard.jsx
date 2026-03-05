import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLeads } from '@/hooks/useLeads'
import { isSinInfo, parseLeadDate, normalizeCanal } from '@/lib/leadUtils'
import { useFilteredLeads, useFilters } from '@/contexts/FilterContext'
import { syncLeads, createLead, deleteLead } from '@/lib/leadService'
import { supabase } from '@/lib/supabase'

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
import { Input } from '@/components/ui/input'
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import {
    TrendingUp, Users, UserCheck, UserX, PhoneOff, Clock,
    Plus, User, ArrowUpRight, Calendar, Phone, MapPin, UploadCloud,
    AlertTriangle, CheckCircle2, Download, Edit2, Check, X, Trash2
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/* ═══════════════════════════════════════
   MINI WIDGETS (Overview tab only)
   ═══════════════════════════════════════ */

/* Reminders */
function RemindersCard({ leads, onSelectLead }) {
    const reminders = useMemo(() => {
        const items = []

        // 1. Leads that haven't responded in +24hrs — oldest first (longest waiting)
        const noResponse = leads
            .filter(l => (l.fase_embudo || '').toLowerCase().includes('+24hrs'))
            .sort((a, b) => {
                const da = parseLeadDate(a.fecha_primer_mensaje)
                const db = parseLeadDate(b.fecha_primer_mensaje)
                return (da ? da.getTime() : 0) - (db ? db.getTime() : 0)
            })
        noResponse.slice(0, 3).forEach(l => {
            items.push({ lead: l, type: 'urgent', label: 'No contesta (+24h)', icon: '🔴' })
        })

        // 2. Leads without vendedora assigned (en fase "Atendiendo") — oldest first
        const noVendedora = leads
            .filter(l => {
                const fase = (l.fase_embudo || '').toLowerCase()
                const vendedora = (l.vendedora || '').toLowerCase()
                return fase.includes('atendiendo') && (!vendedora || vendedora === 'sin informacion' || vendedora === 'sin información')
            })
            .sort((a, b) => {
                const da = parseLeadDate(a.fecha_primer_mensaje)
                const db = parseLeadDate(b.fecha_primer_mensaje)
                return (da ? da.getTime() : 0) - (db ? db.getTime() : 0)
            })
        noVendedora.slice(0, 2).forEach(l => {
            items.push({ lead: l, type: 'warning', label: 'Sin vendedora asignada', icon: '🟡' })
        })

        // 3. Leads with event date coming up in the next 30 days — nearest event first
        const now = new Date()
        const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        const upcoming = []
        leads.forEach(l => {
            if (!l.fecha_evento) return
            const parts = l.fecha_evento.split('/')
            if (parts.length !== 3) return
            const evDate = new Date(parts[2], parts[1] - 1, parts[0])
            if (evDate >= now && evDate <= in30d) {
                if (!items.find(i => i.lead.lead_id === l.lead_id)) {
                    const daysLeft = Math.ceil((evDate - now) / (1000 * 60 * 60 * 24))
                    upcoming.push({ lead: l, type: 'info', label: `Evento en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`, icon: '📅', _sortKey: evDate.getTime() })
                }
            }
        })
        upcoming.sort((a, b) => a._sortKey - b._sortKey)
        upcoming.slice(0, 3).forEach(u => items.push(u))

        return items.slice(0, 5)
    }, [leads])

    const typeStyles = {
        urgent: 'border-l-4 border-red-400 bg-red-50/50 dark:bg-red-950/20',
        warning: 'border-l-4 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
        info: 'border-l-4 border-blue-400 bg-blue-50/50 dark:bg-blue-950/20',
    }

    return (
        <Card className="rounded-none border-border bg-card shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="font-heading text-lg tracking-wider text-card-foreground">Recordatorios</CardTitle>
                    <Badge variant="outline" className="rounded-none text-xs tabular-nums">{reminders.length}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                {reminders.length === 0 ? (
                    <div className="text-center py-6">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Todo al día, sin pendientes</p>
                    </div>
                ) : (
                    reminders.map((r, i) => (
                        <button
                            key={`${r.lead.lead_id}-${i}`}
                            onClick={() => onSelectLead && onSelectLead(r.lead)}
                            className={`w-full text-left p-3 transition-all hover:opacity-80 ${typeStyles[r.type]}`}
                        >
                            <div className="flex items-start gap-2">
                                <span className="text-sm mt-0.5">{r.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{r.label}</p>
                                    <p className="text-sm font-medium text-foreground truncate">{r.lead.nombre}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">#{r.lead.lead_id} · {r.lead.evento || 'Sin evento'}</p>
                                </div>
                                <ArrowUpRight className="h-3 w-3 text-muted-foreground mt-1 shrink-0" />
                            </div>
                        </button>
                    ))
                )}
            </CardContent>
        </Card>
    )
}

/* Recent Leads list */
function RecentLeadsList({ leads, allLeads, onSelectLead, onLeadAdded }) {
    const [isNewLeadOpen, setIsNewLeadOpen] = useState(false)
    const navigate = useNavigate()
    const recent = useMemo(() => {
        return [...leads]
            .sort((a, b) => {
                const da = parseLeadDate(a.fecha_primer_mensaje)
                const db = parseLeadDate(b.fecha_primer_mensaje)
                const ta = da ? da.getTime() : 0
                const tb = db ? db.getTime() : 0
                return tb - ta
            })
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
                <Button variant="outline" size="sm" onClick={() => setIsNewLeadOpen(true)} className="rounded-none border-foreground text-xs uppercase tracking-widest hover:bg-secondary">
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

            <NewLeadDialog
                leads={allLeads || leads}
                open={isNewLeadOpen}
                onClose={() => setIsNewLeadOpen(false)}
                onSuccess={() => {
                    setIsNewLeadOpen(false)
                    if (onLeadAdded) onLeadAdded()
                }}
            />
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
        { name: 'Activos', value: activos, fill: '#A6E3B8' }, // Pastel Green
        { name: 'Perdidos', value: perdidos, fill: '#FFA6A6' }, // Pastel Red
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
                    <span className="flex items-center gap-2"><span className="h-3 w-3 bg-[#A6E3B8]" />Activos</span>
                    <span className="flex items-center gap-2"><span className="h-3 w-3 bg-[#FFA6A6] dark:bg-slate-700" />Perdidos</span>
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
function LeadsTable({ leads, allLeads, loading, onSelectLead, onLeadAdded }) {
    const [visibleCount, setVisibleCount] = useState(15)
    const [isNewLeadOpen, setIsNewLeadOpen] = useState(false)
    const navigate = useNavigate()

    const rows = useMemo(() => {
        return [...leads]
            .sort((a, b) => {
                const da = parseLeadDate(a.fecha_primer_mensaje)
                const db = parseLeadDate(b.fecha_primer_mensaje)
                const ta = da ? da.getTime() : 0
                const tb = db ? db.getTime() : 0
                return tb - ta
            })
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
                <CardTitle className="font-heading text-lg tracking-wider text-card-foreground">RECENT LEADS</CardTitle>
                <div className="flex gap-2">
                    <Button size="sm" onClick={() => navigate('/admin/import-leads')} className="flex items-center gap-2 rounded-full px-4 border border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-600 dark:hover:bg-emerald-900/50">
                        <UploadCloud className="h-4 w-4" />
                        Importar Excel
                    </Button>
                    <Button size="sm" onClick={() => setIsNewLeadOpen(true)} className="flex items-center gap-2 rounded-full px-4">
                        <Plus className="h-4 w-4" />
                        Nuevo Lead
                    </Button>
                </div>
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
                                    <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400">{lead.canal_normalizado || normalizeCanal(lead.canal_de_contacto)}</td>
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

            <NewLeadDialog
                leads={allLeads || leads}
                open={isNewLeadOpen}
                onClose={() => setIsNewLeadOpen(false)}
                onSuccess={() => {
                    setIsNewLeadOpen(false)
                    if (onLeadAdded) onLeadAdded()
                }}
            />
        </Card>
    )
}

/* ═══════════════════════════════════════
   LEAD DETAIL SHEET
   ═══════════════════════════════════════ */
function LeadDetailSheet({ leads, allLeads, lead, open, onClose, onSave, onDelete }) {
    const [isEditing, setIsEditing] = useState(false)
    const [editData, setEditData] = useState({})
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isCustomVendedora, setIsCustomVendedora] = useState(false)

    // Default system users plus any dynamically discovered from ALL leads (not filtered)
    const vendedoras = useMemo(() => {
        const defaults = ['Sin Información']
        const source = allLeads || leads || []
        const dbVendedoras = source.map(l => l.vendedora).filter(v => v && !isSinInfo(v))
        return Array.from(new Set([...defaults, ...dbVendedoras]))
    }, [allLeads, leads])

    useEffect(() => {
        if (open && lead) {
            setIsEditing(false)
            setEditData({ ...lead })
            setIsCustomVendedora(false)
        }
    }, [open, lead])

    if (!lead) return null

    const handleSave = async () => {
        setIsSaving(true)
        const updatedLead = { ...editData }

        // Convert internal YYYY-MM-DD back to DD/MM/YYYY for consistency
        if (updatedLead.fecha_evento && updatedLead.fecha_evento.includes('-')) {
            const parts = updatedLead.fecha_evento.split('-')
            updatedLead.fecha_evento = `${parts[2]}/${parts[1]}/${parts[0]}`
        }

        if (onSave) await onSave(lead.lead_id, updatedLead)
        setIsSaving(false)
        setIsEditing(false)
    }

    const fields = [
        { label: 'Lead ID', key: 'lead_id', icon: '🆔', readonly: true },
        { label: 'Nombre', key: 'nombre', icon: '👤' },
        { label: 'Teléfono', key: 'telefono', icon: '📱' },
        { label: 'Canal Original', key: 'canal_de_contacto', icon: '📨' },
        { label: 'Cómo nos encontró', key: 'como_nos_encontro', icon: '🔍' },
        { label: 'Canal Normalizado (IA)', key: 'canal_normalizado', icon: '✨', readonly: true },
        { label: 'Evento Original', key: 'evento', icon: '🎉' },
        { label: 'Evento Normalizado (IA)', key: 'evento_normalizado', icon: '✨', readonly: true },
        { label: 'Fecha Evento', key: 'fecha_evento', icon: '📅' },
        { label: 'Fase', key: 'fase_embudo', icon: '📊' },
        { label: 'Primer Mensaje', key: 'fecha_primer_mensaje', icon: '💬', readonly: true },
        { label: 'Vendedora', key: 'vendedora', icon: '👩‍💼' },
        { label: 'Salón', key: 'salon', icon: '🏛️' },
    ]

    const displayNombre = isEditing ? editData.nombre : lead.nombre

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent className="w-full border-border bg-card sm:max-w-md overflow-y-auto">
                <SheetHeader className="mb-6">
                    <div className="flex items-center justify-between mt-6">
                        <SheetTitle className="font-heading text-xl tracking-wider text-foreground">DETALLE DEL LEAD</SheetTitle>
                        {!isEditing ? (
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={isDeleting}
                                    onClick={async () => {
                                        if (window.confirm('¿Estás seguro de que deseas eliminar este lead? Esta acción no se puede deshacer.')) {
                                            setIsDeleting(true);
                                            if (onDelete) await onDelete(lead.lead_id);
                                            setIsDeleting(false);
                                        }
                                    }}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)} disabled={isSaving} className="text-muted-foreground">
                                    <X className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={handleSave} disabled={isSaving} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50">
                                    <Check className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </SheetHeader>
                <div className="space-y-4 px-2">
                    <div className="flex items-center gap-4 border border-border bg-secondary/30 p-4">
                        <Avatar className="h-14 w-14 rounded-none">
                            <AvatarFallback className="bg-primary/10 text-lg font-heading tracking-widest text-primary rounded-none">
                                {displayNombre?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-heading text-lg tracking-wider text-foreground">{displayNombre}</p>
                            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">#{lead.lead_id}</p>
                        </div>
                    </div>
                    <div className="space-y-0 border-t border-border pt-4 pb-8">
                        {fields.map(({ label, key, icon, value, readonly }) => {
                            const val = value !== undefined ? value : (isEditing ? editData[key] : lead[key])
                            const missing = isSinInfo(val)
                            const isEditable = isEditing && !readonly

                            return (
                                <div key={key || label} className="flex items-start gap-4 p-3 border-b border-border/50 hover:bg-secondary/30 transition-colors group">
                                    <span className="text-base mt-1 opacity-70 group-hover:opacity-100 transition-opacity">{icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                                        {isEditable ? (
                                            key === 'vendedora' ? (
                                                (() => {
                                                    const isOther = isCustomVendedora || (val !== '' && !vendedoras.includes(val));
                                                    return (
                                                        <div className="flex flex-col gap-1 w-full mt-1">
                                                            <Select
                                                                value={isCustomVendedora ? 'Otro' : (val || 'Sin Información')}
                                                                onValueChange={(v) => {
                                                                    if (v === 'Otro') {
                                                                        setIsCustomVendedora(true)
                                                                        setEditData(p => ({ ...p, [key]: '' }))
                                                                    } else {
                                                                        setIsCustomVendedora(false)
                                                                        setEditData(p => ({ ...p, [key]: v }))
                                                                    }
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-8 text-sm bg-background border-border rounded-none">
                                                                    <SelectValue placeholder="Selecciona..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {vendedoras.map(v => (
                                                                        <SelectItem key={v} value={v}>{v}</SelectItem>
                                                                    ))}
                                                                    <SelectItem value="Otro">Otro</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            {isOther && (
                                                                <Input
                                                                    value={val}
                                                                    onChange={(e) => setEditData(p => ({ ...p, [key]: e.target.value }))}
                                                                    className="h-8 text-sm bg-white dark:bg-slate-950 mt-1 w-full"
                                                                    placeholder="Escribe el nombre de la vendedora..."
                                                                />
                                                            )}
                                                        </div>
                                                    )
                                                })()
                                            ) : key === 'fase_embudo' ? (
                                                <Select value={val} onValueChange={(v) => setEditData(p => ({ ...p, [key]: v }))}>
                                                    <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border rounded-none w-full">
                                                        <SelectValue placeholder="Selecciona..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Atendiendo">Atendiendo</SelectItem>
                                                        <SelectItem value="+24HRS (NO CONTESTA)">+24HRS (NO CONTESTA)</SelectItem>
                                                        <SelectItem value="ENVIADO CON VENDEDORA">ENVIADO CON VENDEDORA</SelectItem>
                                                        <SelectItem value="Venta Perdido">Venta Perdido</SelectItem>
                                                        <SelectItem value="Otros">Otros</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Input
                                                    type={key === 'fecha_evento' ? 'date' : 'text'}
                                                    value={
                                                        key === 'fecha_evento' && val && val.includes('/')
                                                            ? val.split('/').reverse().join('-')
                                                            : (val || '')
                                                    }
                                                    onChange={(e) => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                                                    className="mt-1 h-8 text-sm bg-background w-full rounded-none"
                                                />
                                            )
                                        ) : (
                                            missing
                                                ? <Badge variant="outline" className="rounded-none text-[10px] uppercase tracking-widest border-border text-muted-foreground">Sin Información</Badge>
                                                : <p className="text-sm font-medium text-foreground break-words">{val}</p>
                                        )}
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
   NEW LEAD DIALOG
   ═══════════════════════════════════════ */
function NewLeadDialog({ leads, open, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        nombre: '', telefono: '', canal_de_contacto: '', evento: '', fecha_evento: '', como_nos_encontro: '', fase_embudo: 'NUEVO', vendedora: '', salon: ''
    })
    const [isSaving, setIsSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState(null)
    const [isCustomVendedora, setIsCustomVendedora] = useState(false)

    // Default system users plus any dynamically discovered from existant leads
    const vendedoras = useMemo(() => {
        const defaults = ['Sin Información']
        const dbVendedoras = (leads || []).map(l => l.vendedora).filter(v => v && !isSinInfo(v))
        return Array.from(new Set([...defaults, ...dbVendedoras]))
    }, [leads])

    const handleSave = async () => {
        if (!formData.nombre) {
            setErrorMsg("El nombre es requerido");
            return;
        }
        setIsSaving(true)
        setErrorMsg(null)

        // Use current local timestamp formatted simply as fallback for fecha_primer_mensaje
        const now = new Date();
        const fallbackDate = now.toISOString()

        const newLead = { ...formData, fecha_primer_mensaje: fallbackDate }

        // Convert internal YYYY-MM-DD back to DD/MM/YYYY for consistency
        if (newLead.fecha_evento && newLead.fecha_evento.includes('-')) {
            const parts = newLead.fecha_evento.split('-')
            newLead.fecha_evento = `${parts[2]}/${parts[1]}/${parts[0]}`
        }

        const { success, error } = await createLead(newLead)
        setIsSaving(false)
        if (success) {
            setFormData({ nombre: '', telefono: '', canal_de_contacto: '', evento: '', fecha_evento: '', como_nos_encontro: '', fase_embudo: 'NUEVO', vendedora: '', salon: '' })
            setIsCustomVendedora(false)
            if (onSuccess) onSuccess()
        } else {
            setErrorMsg("Error al guardar el lead: " + (error?.message || "Desconocido"))
        }
    }

    const fields = [
        { label: 'Nombre *', key: 'nombre' },
        { label: 'Teléfono', key: 'telefono' },
        { label: 'Canal Original', key: 'canal_de_contacto' },
        { label: 'Cómo nos encontró', key: 'como_nos_encontro' },
        { label: 'Evento Original', key: 'evento' },
        { label: 'Fecha Evento', key: 'fecha_evento', placeholder: 'ej. 15/10/2026' },
        { label: 'Fase', key: 'fase_embudo' },
        { label: 'Vendedora', key: 'vendedora' },
        { label: 'Salón', key: 'salon' },
    ]

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent className="w-full border-border bg-card sm:max-w-md overflow-y-auto">
                <SheetHeader className="mb-6 mt-4 border-b border-border pb-4">
                    <SheetTitle className="font-heading text-xl tracking-wider text-foreground">AGREGAR NUEVO LEAD</SheetTitle>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Llena los datos manualmente. La IA normalizará canales.</p>
                </SheetHeader>

                {errorMsg && (
                    <div className="mb-6 p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-sm">
                        {errorMsg}
                    </div>
                )}

                <div className="space-y-5 pb-8 px-2">
                    {fields.map(({ label, key, placeholder, type }) => {
                        if (key === 'vendedora') {
                            const isOther = isCustomVendedora || (formData[key] !== '' && !vendedoras.includes(formData[key]))
                            return (
                                <div key={key} className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</label>
                                    <Select
                                        value={isCustomVendedora ? 'Otro' : (formData[key] || 'Sin Información')}
                                        onValueChange={(v) => {
                                            if (v === 'Otro') {
                                                setIsCustomVendedora(true)
                                                setFormData(p => ({ ...p, [key]: '' }))
                                            } else {
                                                setIsCustomVendedora(false)
                                                setFormData(p => ({ ...p, [key]: v }))
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="bg-background border-border rounded-none focus:ring-1 focus:ring-primary">
                                            <SelectValue placeholder="Selecciona..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vendedoras.map(v => (
                                                <SelectItem key={v} value={v}>{v}</SelectItem>
                                            ))}
                                            <SelectItem value="Otro">Otro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {isOther && (
                                        <Input
                                            value={formData[key]}
                                            onChange={(e) => setFormData(p => ({ ...p, [key]: e.target.value }))}
                                            className="bg-background border-border rounded-none mt-1 focus-visible:ring-1 focus-visible:ring-primary w-full"
                                            placeholder="Escribe el nombre de la vendedora..."
                                        />
                                    )}
                                </div>
                            )
                        }

                        if (key === 'fase_embudo') {
                            return (
                                <div key={key} className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</label>
                                    <Select value={formData[key]} onValueChange={(v) => setFormData(p => ({ ...p, [key]: v }))}>
                                        <SelectTrigger className="bg-background border-border rounded-none focus:ring-1 focus:ring-primary">
                                            <SelectValue placeholder="Selecciona..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Atendiendo">Atendiendo</SelectItem>
                                            <SelectItem value="+24HRS (NO CONTESTA)">+24HRS (NO CONTESTA)</SelectItem>
                                            <SelectItem value="ENVIADO CON VENDEDORA">ENVIADO CON VENDEDORA</SelectItem>
                                            <SelectItem value="Venta Perdido">Venta Perdido</SelectItem>
                                            <SelectItem value="Otros">Otros</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )
                        }

                        return (
                            <div key={key} className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</label>
                                <Input
                                    type={key === 'fecha_evento' ? 'date' : 'text'}
                                    value={
                                        // HTML type="date" requires YYYY-MM-DD
                                        key === 'fecha_evento' && formData[key] && formData[key].includes('/')
                                            ? formData[key].split('/').reverse().join('-')
                                            : formData[key]
                                    }
                                    placeholder={placeholder || ''}
                                    onChange={(e) => {
                                        let val = e.target.value;
                                        // Keep standard YYYY-MM-DD internally, convert on save
                                        setFormData(p => ({ ...p, [key]: val }))
                                    }}
                                    className="bg-background rounded-none border-border block w-full focus-visible:ring-1 focus-visible:ring-primary"
                                />
                            </div>
                        )
                    })}
                    <div className="pt-6 flex justify-end gap-3 border-t border-border">
                        <Button variant="ghost" onClick={onClose} disabled={isSaving} className="rounded-none text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs uppercase tracking-widest">
                            {isSaving ? 'Guardando...' : 'Guardar Lead'}
                        </Button>
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
        return fields.map(f => {
            const val = l => f === 'canal_de_contacto' ? (l.canal_normalizado || l.canal_de_contacto) :
                f === 'evento' ? (l.evento_normalizado || l.evento) : l[f]
            const missingCount = leads.filter(l => isSinInfo(val(l))).length
            return {
                field: labels[f],
                missing: missingCount,
                total: leads.length,
                pct: leads.length ? Math.round((missingCount / leads.length) * 100) : 0,
            }
        }).sort((a, b) => b.pct - a.pct)
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
    const { leads: apiLeads, loading, error, refresh } = useLeads()
    const [selectedLead, setSelectedLead] = useState(null)
    const [vendedoraView, setVendedoraView] = useState('stacked')

    // Add delete handler
    const handleDeleteLead = async (leadId) => {
        const { success } = await deleteLead(leadId)
        if (success) {
            setSelectedLead(null)
            refresh(true)
        } else {
            alert('Error al eliminar el lead.')
        }
    }

    const [aiProvider, setAiProvider] = useState(0) // 0 = Gemini, 1 = OpenAI

    // Optional: Refresh periodically
    useEffect(() => {
        const interval = setInterval(() => refresh(false), 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [refresh])

    // Context / computed
    const filteredLeads = useFilteredLeads(apiLeads || [])
    const { filters, isExportOpen, setIsExportOpen } = useFilters()

    const handleSelectLead = useCallback((lead) => {
        setSelectedLead(lead)
    }, [])

    const handleSaveLead = async (leadId, modifications) => {
        try {
            // Remove system fields to prevent DB conflict
            const { lead_id, fecha_primer_mensaje, ...updates } = modifications

            const { error: updateError } = await supabase
                .from('leads')
                .update(updates)
                .eq('lead_id', leadId)

            if (updateError) throw updateError

            await refresh(true)

            if (selectedLead && selectedLead.lead_id === leadId) {
                setSelectedLead(prev => ({ ...prev, ...updates }))
            }
        } catch (err) {
            console.error('Error updating lead:', err)
            alert('Error al guardar el lead: ' + err.message)
        }
    }

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
                            <RemindersCard leads={filteredLeads} onSelectLead={handleSelectLead} />
                        </div>
                        <div className="lg:col-span-4">
                            <RecentLeadsList leads={filteredLeads} allLeads={apiLeads} onSelectLead={handleSelectLead} onLeadAdded={() => refresh(true)} />
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
                allLeads={apiLeads}
                loading={hasInitialLoading}
                onSelectLead={setSelectedLead}
                onLeadAdded={() => refresh(true)}
            />

            {/* DETAIL SHEET */}
            <LeadDetailSheet
                leads={filteredLeads}
                allLeads={apiLeads}
                lead={selectedLead}
                open={!!selectedLead}
                onClose={() => setSelectedLead(null)}
                onSave={handleSaveLead}
                onDelete={handleDeleteLead}
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
