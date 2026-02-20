import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { isSinInfo, parseLeadDate } from '@/lib/leadUtils'
import {
    Users, UserCheck, UserX, PhoneOff, CalendarOff,
    Clock, PhoneMissed, HelpCircle, MapPin, TrendingUp, TrendingDown,
} from 'lucide-react'
import { isToday, subDays, isAfter } from 'date-fns'

const kpiDefs = [
    { key: 'total', label: 'Total Leads', icon: Users, color: 'emerald', hero: true },
    { key: 'today', label: 'Nuevos (hoy)', icon: TrendingUp, color: 'blue' },
    { key: 'week', label: 'Nuevos (7 días)', icon: TrendingUp, color: 'cyan' },
    { key: 'activos', label: 'Activos', icon: UserCheck, color: 'emerald' },
    { key: 'perdidos', label: 'Perdidos', icon: UserX, color: 'red' },
    { key: 'noContesta', label: '+24HRS No Contesta', icon: Clock, color: 'amber' },
    { key: 'sinTel', label: 'Sin Teléfono', icon: PhoneMissed, color: 'orange' },
    { key: 'sinFecha', label: 'Sin Fecha Evento', icon: CalendarOff, color: 'orange' },
    { key: 'origenDesc', label: '% Origen Desconocido', icon: HelpCircle, color: 'slate', pct: true },
    { key: 'salonIndeciso', label: '% Salón Indeciso', icon: MapPin, color: 'slate', pct: true },
]

function computeKpis(leads) {
    const total = leads.length
    if (!total) return {}

    const now = new Date()
    const sevenAgo = subDays(now, 7)

    let todayCount = 0
    let weekCount = 0
    let activos = 0
    let perdidos = 0
    let noContesta = 0
    let sinTel = 0
    let sinFecha = 0
    let origenDesc = 0
    let salonIndeciso = 0

    leads.forEach((l) => {
        const d = parseLeadDate(l.fecha_primer_mensaje)
        if (d && isToday(d)) todayCount++
        if (d && isAfter(d, sevenAgo)) weekCount++

        const fase = (l.fase_embudo || '').toLowerCase()
        if (fase.includes('perdido')) perdidos++
        else activos++

        if (fase.includes('+24hrs') || fase.includes('no contesta')) noContesta++
        if (isSinInfo(l.telefono)) sinTel++
        if (isSinInfo(l.fecha_evento)) sinFecha++
        if (isSinInfo(l.como_nos_encontro)) origenDesc++

        const salon = (l.salon || '').toLowerCase()
        if (isSinInfo(l.salon) || salon.includes('no est')) salonIndeciso++
    })

    return {
        total,
        today: todayCount,
        week: weekCount,
        activos,
        perdidos,
        noContesta,
        sinTel,
        sinFecha,
        origenDesc: total ? Math.round((origenDesc / total) * 100) : 0,
        salonIndeciso: total ? Math.round((salonIndeciso / total) * 100) : 0,
    }
}

export default function KpiCards({ leads, loading }) {
    const kpis = useMemo(() => computeKpis(leads), [leads])

    if (loading) {
        return (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
                    <Card key={i} className="rounded-2xl border-slate-200 bg-white shadow-sm">
                        <CardContent className="p-4">
                            <Skeleton className="mb-2 h-4 w-20 bg-slate-100" />
                            <Skeleton className="mb-1 h-8 w-14 bg-slate-100" />
                            <Skeleton className="h-3 w-16 bg-slate-100" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {kpiDefs.map((def) => {
                const val = kpis[def.key] ?? 0
                const Icon = def.icon
                const isHero = def.hero

                return (
                    <Card
                        key={def.key}
                        className={`relative overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-md ${isHero
                                ? 'border-emerald-200 bg-gradient-to-br from-emerald-700 to-emerald-900 text-white'
                                : 'border-slate-200 bg-white'
                            }`}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-1">
                                <p className={`text-xs font-medium truncate ${isHero ? 'text-emerald-100' : 'text-slate-500'}`}>
                                    {def.label}
                                </p>
                                <Icon className={`h-4 w-4 flex-shrink-0 ${isHero ? 'text-emerald-200' : 'text-slate-300'}`} />
                            </div>
                            <p className={`text-2xl font-bold tabular-nums ${isHero ? 'text-white' : 'text-slate-900'}`}>
                                {def.pct ? `${val}%` : val}
                            </p>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
