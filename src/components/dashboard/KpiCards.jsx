import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { GlowingCards, GlowingCard } from '@/components/ui/glowing-cards'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { isSinInfo, parseLeadDate } from '@/lib/leadUtils'
import {
    Users, UserCheck, UserX, PhoneOff, CalendarOff,
    Clock, PhoneMissed, HelpCircle, MapPin, TrendingUp, TrendingDown,
} from 'lucide-react'
import { isToday, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns'

const kpiDefs = [
    { key: 'total', label: 'Total Leads (30 Días)', icon: Users, color: 'emerald', hero: true },
    { key: 'today', label: 'Nuevos (hoy)', icon: TrendingUp, color: 'blue' },
    { key: 'week', label: 'Nuevos (7 días)', icon: TrendingUp, color: 'cyan' },
    { key: 'activos', label: 'Activos', icon: UserCheck, color: 'emerald' },
    { key: 'noContesta', label: 'Seguimientos (NO CONTESTA)', icon: Clock, color: 'amber' },
]

function computeKpis(leads) {
    const total = leads.length
    if (!total) return {}

    const now = new Date()
    const todayBegin = startOfDay(now)
    const sevenAgo = subDays(todayBegin, 7)
    const end = endOfDay(now)
    
    // Create interval objects exactly like FilterContext
    const weekInterval = { start: sevenAgo, end }

    let todayCount = 0
    let weekCount = 0
    let activos = 0
    let perdidos = 0
    let noContesta = 0

    leads.forEach((l) => {
        const d = parseLeadDate(l.fecha_primer_mensaje)
        if (d && isToday(d)) todayCount++
        if (d && isWithinInterval(d, weekInterval)) weekCount++

        const fase = (l.fase_embudo || '').toLowerCase()
        if (fase.includes('perdido')) perdidos++
        else activos++

        if (fase.includes('+24hrs') || fase.includes('no contesta')) noContesta++
    })

    return {
        total,
        today: todayCount,
        week: weekCount,
        activos,
        perdidos,
        noContesta,
    }
}

export default function KpiCards({ leads, loading }) {
    const kpis = useMemo(() => computeKpis(leads), [leads])

    if (loading) {
        return (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
                    <Card key={i} className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
                        <CardContent className="p-4">
                            <Skeleton className="mb-2 h-4 w-20 bg-slate-100 dark:bg-slate-800" />
                            <Skeleton className="mb-1 h-8 w-14 bg-slate-100 dark:bg-slate-800" />
                            <Skeleton className="h-3 w-16 bg-slate-100 dark:bg-slate-800" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    const hexColors = {
        emerald: '#C4C5B9', // pastel sage green
        blue: '#CFC4BD',    // pastel taupe
        cyan: '#B4BCAE',    // pastel olive
        red: '#E8DCD1',     // lighter beige
        amber: '#D8CDC4',   // pastel warm gray
        orange: '#E2D4C8',  // pastel beige
        slate: '#A9AFA3',   // muted green-gray
    }

    return (
        <GlowingCards className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {kpiDefs.map((def) => {
                const val = kpis[def.key] ?? 0
                const Icon = def.icon
                const isHero = def.hero
                const glowColor = hexColors[def.color] || hexColors.slate

                return (
                    <GlowingCard
                        key={def.key}
                        glowColor={glowColor}
                        className={`relative overflow-hidden rounded-none border shadow-sm transition-all hover:shadow-md ${isHero
                            ? 'bg-primary border-primary-foreground text-primary-foreground'
                            : 'border-border bg-card text-foreground'
                            }`}
                    >
                        <CardContent className="p-6 flex-1">
                            <div className="flex items-center justify-between mb-4">
                                <p className={`text-xs uppercase tracking-widest font-medium truncate ${isHero ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                    {def.label}
                                </p>
                                <Icon className={`h-5 w-5 flex-shrink-0 stroke-[1.5] ${isHero ? 'text-primary-foreground/60' : 'text-muted-foreground'}`} />
                            </div>
                            <p className={`font-numbers text-4xl tabular-nums ${isHero ? 'text-primary-foreground' : 'text-foreground'}`}>
                                {def.pct ? `${val}%` : val}
                            </p>
                        </CardContent>
                    </GlowingCard>
                )
            })}
        </GlowingCards>
    )
}
