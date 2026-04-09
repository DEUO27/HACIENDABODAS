import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getLeadTrackingDate, isSinInfo, normalizeCanal } from '@/lib/leadUtils'
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts'
import { eachDayOfInterval, format, parse, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

/* PALETTE */
const COLORS = [
    '#FFA6A6', // Pastel Red/Pink
    '#A6C8FF', // Pastel Blue
    '#A6E3B8', // Pastel Green
    '#FFD28A', // Pastel Yellow/Orange
    '#D7A6FF', // Pastel Purple
    '#FFC2A6', // Pastel Peach
    '#A6EAE3', // Pastel Teal
    '#BAB8E8', // Pastel Indigo
]

/* SHARED */
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 shadow-lg text-sm">
            <p className="font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</p>
            {payload.map((p, i) => (
                <p key={i} className="font-semibold" style={{ color: p.color || p.fill }}>
                    {p.name}: {p.value}
                </p>
            ))}
        </div>
    )
}

function ChartSkeleton({ height = 250 }) {
    return (
        <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-6">
                <Skeleton className="mb-4 h-5 w-40 bg-secondary" />
                <Skeleton className={`w-full rounded-none bg-secondary`} style={{ height }} />
            </CardContent>
        </Card>
    )
}

function ChartCard({ title, subtitle, children, className = '', exportId }) {
    return (
        <Card data-export-id={exportId} className={`rounded-none border-border bg-card shadow-sm flex flex-col pt-2 ${className}`}>
            <CardHeader className="pb-4">
                <CardTitle className="font-heading text-lg tracking-wider text-card-foreground">{title}</CardTitle>
                {subtitle && <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{subtitle}</p>}
            </CardHeader>
            <CardContent className="pt-0 flex-grow">{children}</CardContent>
        </Card>
    )
}

/* 1. LEADS POR DIA (Area/Line) */
export function LeadsByDayChart({ leads, loading }) {
    const data = useMemo(() => {
        const counts = {}
        const dates = []
        leads.forEach((l) => {
            const d = getLeadTrackingDate(l)
            if (!d) return
            dates.push(d)
            const key = format(d, 'yyyy-MM-dd')
            counts[key] = (counts[key] || 0) + 1
        })

        const today = startOfDay(new Date())
        const earliestDate = dates.length
            ? startOfDay(new Date(Math.min(...dates.map((date) => date.getTime()))))
            : today
        const earliest = earliestDate > today ? today : earliestDate

        return eachDayOfInterval({ start: earliest, end: today })
            .map((day) => {
                const date = format(day, 'yyyy-MM-dd')
                return [date, counts[date] || 0]
            })
            .map(([date, count]) => ({
                date: format(parse(date, 'yyyy-MM-dd', new Date()), 'dd MMM', { locale: es }),
                leads: count,
            }))
    }, [leads])

    if (loading) return <ChartSkeleton />

    return (
        <ChartCard title="Leads por dia" subtitle="Basado en fecha de primer mensaje" exportId="leads_by_day">
            <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="gradientLeads" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#D8CDC4" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#E2D4C8" stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="leads" stroke="#C4C5B9" strokeWidth={2} fill="url(#gradientLeads)" />
                </AreaChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* 2. LEADS POR FASE (Horizontal Bar) */
export function LeadsByFaseChart({ leads, loading }) {
    const data = useMemo(() => {
        const counts = {}
        leads.forEach((l) => {
            let fase = isSinInfo(l.fase_embudo) ? 'Sin fase' : l.fase_embudo
            if (fase.toUpperCase().includes('+24HRS')) {
                fase = 'Seguimientos (NO CONTESTA)'
            }
            counts[fase] = (counts[fase] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    }, [leads])

    if (loading) return <ChartSkeleton height={Math.max(250, data.length * 35)} />

    return (
        <ChartCard title="Leads por fase del embudo" subtitle="Ordenado por volumen descendente" exportId="leads_by_fase">
            <ResponsiveContainer width="100%" height={Math.max(250, data.length * 38)}>
                <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={140} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Leads" fill="#E2D4C8" radius={[0, 0, 0, 0]} barSize={20} />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* 3. TOP ORIGENES (Bar) */
export function TopOrigenesChart({ leads, loading, topN = 8 }) {
    const data = useMemo(() => {
        const counts = {}
        leads.forEach((l) => {
            const origen = isSinInfo(l.como_nos_encontro) ? 'Sin Info' : l.como_nos_encontro
            counts[origen] = (counts[origen] || 0) + 1
        })
        const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a)
        const top = sorted.slice(0, topN).map(([name, value]) => ({ name, value }))
        const othersCount = sorted.slice(topN).reduce((acc, [, v]) => acc + v, 0)
        if (othersCount > 0) top.push({ name: 'Otros', value: othersCount })
        return top
    }, [leads, topN])

    if (loading) return <ChartSkeleton />

    return (
        <ChartCard title="Top origenes" subtitle={`Como nos encontro - Top ${topN}`} exportId="top_origenes">
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-20} textAnchor="end" height={60} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Leads" fill="#CFC4BD" radius={[0, 0, 0, 0]} barSize={28} />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* 4. LEADS POR CANAL (Donut) */
export function LeadsByCanalChart({ leads, loading }) {
    const data = useMemo(() => {
        const counts = {}
        leads.forEach((l) => {
            const canal = l.canal_normalizado || normalizeCanal(l.canal_de_contacto)
            counts[canal] = (counts[canal] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    }, [leads])

    if (loading) return <ChartSkeleton height={280} />

    return (
        <ChartCard title="Leads por canal" subtitle="Canal de contacto" exportId="leads_by_canal">
            <ResponsiveContainer width="100%" height={280}>
                <PieChart margin={{ bottom: 20 }}>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                        label={({ cx, cy, midAngle, outerRadius, name, percent }) => {
                            const RADIAN = Math.PI / 180
                            const radius = outerRadius * 1.15
                            const x = cx + radius * Math.cos(-midAngle * RADIAN)
                            const y = cy + radius * Math.sin(-midAngle * RADIAN)
                            return (
                                <text
                                    x={x}
                                    y={y}
                                    fill="#475569"
                                    textAnchor={x > cx ? 'start' : 'end'}
                                    dominantBaseline="central"
                                    fontSize={12}
                                    fontFamily="sans-serif"
                                    fontWeight="500"
                                >
                                    {`${name} (${(percent * 100).toFixed(0)}%)`}
                                </text>
                            )
                        }}
                        labelLine
                    >
                        {data.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11, paddingTop: '20px', fontFamily: 'Inter' }} />
                </PieChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* 5. LEADS POR VENDEDORA (Bar, optional stacked by fase) */
export function LeadsByVendedoraChart({ leads, loading, stacked = false }) {
    const data = useMemo(() => {
        if (!stacked) {
            const counts = {}
            leads.forEach((l) => {
                const v = isSinInfo(l.vendedora) ? 'Sin asignar' : l.vendedora
                counts[v] = (counts[v] || 0) + 1
            })
            return Object.entries(counts)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
        }

        // Stacked by fase
        const map = {}
        const fases = new Set()
        leads.forEach((l) => {
            const v = isSinInfo(l.vendedora) ? 'Sin asignar' : l.vendedora
            const f = isSinInfo(l.fase_embudo) ? 'Sin fase' : l.fase_embudo
            fases.add(f)
            if (!map[v]) map[v] = { name: v }
            map[v][f] = (map[v][f] || 0) + 1
        })
        return {
            rows: Object.values(map).sort((a, b) => {
                const ta = Object.entries(a).filter(([k]) => k !== 'name').reduce((s, [, v]) => s + v, 0)
                const tb = Object.entries(b).filter(([k]) => k !== 'name').reduce((s, [, v]) => s + v, 0)
                return tb - ta
            }), fases: [...fases]
        }
    }, [leads, stacked])

    if (loading) return <ChartSkeleton />

    if (stacked && data.fases) {
        return (
            <ChartCard title="Leads por vendedora" subtitle="Desglose por fase del embudo" exportId="leads_by_vendedora">
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.rows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-15} textAnchor="end" height={60} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Inter' }} />
                        {data.fases.map((f, i) => (
                            <Bar key={f} dataKey={f} stackId="a" fill={COLORS[i % COLORS.length]} radius={[0, 0, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>
        )
    }

    return (
        <ChartCard title="Leads por vendedora" subtitle="Total de leads asignados" exportId="leads_by_vendedora">
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-15} textAnchor="end" height={60} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Leads" fill="#B4BCAE" radius={[0, 0, 0, 0]} barSize={28} />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* 6. LEADS POR EVENTO (Bar) */
export function LeadsByEventoChart({ leads, loading }) {
    const data = useMemo(() => {
        const counts = {}
        leads.forEach((l) => {
            const val = l.evento_normalizado || l.evento
            const ev = isSinInfo(val) ? 'Sin evento' : val
            counts[ev] = (counts[ev] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    }, [leads])

    if (loading) return <ChartSkeleton />

    return (
        <ChartCard title="Leads por tipo de evento" subtitle="Distribucion por evento" exportId="leads_by_evento">
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-15} textAnchor="end" height={60} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Leads" fill="#A9AFA3" radius={[0, 0, 0, 0]} barSize={28} />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* 7. LEADS POR HORA (Bar) */
export function LeadsByHourChart({ leads, loading }) {
    const data = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: i === 0 ? 'Sin Info' : `${String(i).padStart(2, '0')}:00`,
            value: 0,
        }))
        leads.forEach((l) => {
            const d = getLeadTrackingDate(l)
            if (d) hours[d.getHours()].value += 1
        })
        
        return hours
    }, [leads])

    if (loading) return <ChartSkeleton />

    return (
        <ChartCard title="Leads por hora del dia" subtitle="Basado en primer mensaje (Escala raiz cuadrada)" exportId="leads_by_hour">
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis scale="sqrt" domain={[0, 'auto']} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Leads" fill="#D8CDC4" radius={[0, 0, 0, 0]} barSize={14} />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* 8. DATA QUALITY (Horizontal Bar - % missing per field) */
export function DataQualityChart({ leads, loading }) {
    const data = useMemo(() => {
        if (!leads.length) return []
        const fields = [
            { key: 'telefono', label: 'Telefono' },
            { key: 'fecha_evento', label: 'Fecha Evento' },
            { key: 'canal_de_contacto', label: 'Canal', val: l => l.canal_normalizado || l.canal_de_contacto },
            { key: 'como_nos_encontro', label: 'Origen' },
            { key: 'vendedora', label: 'Vendedora' },
            { key: 'salon', label: 'Salon' },
            { key: 'evento', label: 'Evento', val: l => l.evento_normalizado || l.evento },
        ]
        const total = leads.length
        return fields.map(({ key, label, val }) => {
            const valueFn = val || (l => l[key])
            const missing = leads.filter((l) => isSinInfo(valueFn(l))).length
            return { name: label, value: parseFloat(((missing / total) * 100).toFixed(1)), missing, total }
        }).sort((a, b) => b.value - a.value)
    }, [leads])

    if (loading) return <ChartSkeleton />

    return (
        <ChartCard title="Calidad de Datos" subtitle="% de campos con informacion faltante" exportId="data_quality">
            <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
                <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={90} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="% Faltante" fill="#E8DCD1" radius={[0, 0, 0, 0]} barSize={18} />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

