import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { isSinInfo, parseLeadDate, normalizeCanal } from '@/lib/leadUtils'
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

/* ─ PALETTE ─ */
const COLORS = [
    '#059669', '#0891b2', '#2563eb', '#7c3aed', '#d97706',
    '#dc2626', '#db2777', '#ea580c', '#65a30d', '#4f46e5',
    '#0d9488', '#e11d48',
]

/* ─ SHARED ─ */
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-sm">
            <p className="font-medium text-slate-600 mb-1">{label}</p>
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
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
                <Skeleton className="mb-4 h-5 w-40 bg-slate-100" />
                <Skeleton className={`w-full rounded-xl bg-slate-100`} style={{ height }} />
            </CardContent>
        </Card>
    )
}

function ChartCard({ title, subtitle, children, className = '' }) {
    return (
        <Card className={`rounded-2xl border-slate-200 bg-white shadow-sm ${className}`}>
            <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-800">{title}</CardTitle>
                {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
            </CardHeader>
            <CardContent className="pt-2">{children}</CardContent>
        </Card>
    )
}

/* ─── 1. LEADS POR DÍA (Area/Line) ─── */
export function LeadsByDayChart({ leads, loading }) {
    const data = useMemo(() => {
        const counts = {}
        leads.forEach((l) => {
            const d = parseLeadDate(l.fecha_primer_mensaje)
            if (!d) return
            const key = format(d, 'yyyy-MM-dd')
            counts[key] = (counts[key] || 0) + 1
        })
        return Object.entries(counts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({
                date: format(new Date(date), 'dd MMM', { locale: es }),
                leads: count,
            }))
    }, [leads])

    if (loading) return <ChartSkeleton />

    return (
        <ChartCard title="Leads por día" subtitle="Basado en fecha de primer mensaje">
            <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="gradientLeads" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#059669" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="leads" stroke="#059669" strokeWidth={2} fill="url(#gradientLeads)" />
                </AreaChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* ─── 2. LEADS POR FASE (Horizontal Bar) ─── */
export function LeadsByFaseChart({ leads, loading }) {
    const data = useMemo(() => {
        const counts = {}
        leads.forEach((l) => {
            const fase = isSinInfo(l.fase_embudo) ? 'Sin fase' : l.fase_embudo
            counts[fase] = (counts[fase] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    }, [leads])

    if (loading) return <ChartSkeleton height={Math.max(250, data.length * 35)} />

    return (
        <ChartCard title="Leads por fase del embudo" subtitle="Ordenado por volumen descendente">
            <ResponsiveContainer width="100%" height={Math.max(250, data.length * 38)}>
                <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={140} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Leads" fill="#059669" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* ─── 3. TOP ORÍGENES (Bar) ─── */
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
        <ChartCard title="Top orígenes" subtitle={`Cómo nos encontró — Top ${topN}`}>
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-20} textAnchor="end" height={60} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Leads" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={28} />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* ─── 4. LEADS POR CANAL (Donut) ─── */
export function LeadsByCanalChart({ leads, loading }) {
    const data = useMemo(() => {
        const counts = {}
        leads.forEach((l) => {
            const canal = normalizeCanal(l.canal_de_contacto)
            counts[canal] = (counts[canal] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    }, [leads])

    if (loading) return <ChartSkeleton height={280} />

    return (
        <ChartCard title="Leads por canal" subtitle="Canal de contacto">
            <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine
                    >
                        {data.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                </PieChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* ─── 5. LEADS POR VENDEDORA (Bar, optional stacked by fase) ─── */
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
            <ChartCard title="Leads por vendedora" subtitle="Desglose por fase del embudo">
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.rows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-15} textAnchor="end" height={60} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {data.fases.map((f, i) => (
                            <Bar key={f} dataKey={f} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === data.fases.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>
        )
    }

    return (
        <ChartCard title="Leads por vendedora" subtitle="Total de leads asignados">
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-15} textAnchor="end" height={60} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Leads" fill="#0891b2" radius={[6, 6, 0, 0]} barSize={28} />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* ─── 6. LEADS POR EVENTO (Bar) ─── */
export function LeadsByEventoChart({ leads, loading }) {
    const data = useMemo(() => {
        const counts = {}
        leads.forEach((l) => {
            const ev = isSinInfo(l.evento) ? 'Sin evento' : l.evento
            counts[ev] = (counts[ev] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    }, [leads])

    if (loading) return <ChartSkeleton />

    return (
        <ChartCard title="Leads por tipo de evento" subtitle="Distribución por evento">
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-15} textAnchor="end" height={60} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Leads" fill="#7c3aed" radius={[6, 6, 0, 0]} barSize={28} />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* ─── 7. LEADS POR HORA (Bar) ─── */
export function LeadsByHourChart({ leads, loading }) {
    const data = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: `${String(i).padStart(2, '0')}:00`,
            value: 0,
        }))
        leads.forEach((l) => {
            const d = parseLeadDate(l.fecha_primer_mensaje)
            if (d) hours[d.getHours()].value += 1
        })
        return hours
    }, [leads])

    if (loading) return <ChartSkeleton />

    return (
        <ChartCard title="Leads por hora del día" subtitle="Basado en primer mensaje">
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Leads" fill="#d97706" radius={[6, 6, 0, 0]} barSize={14} />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}

/* ─── 8. DATA QUALITY (Horizontal Bar — % missing per field) ─── */
export function DataQualityChart({ leads, loading }) {
    const data = useMemo(() => {
        if (!leads.length) return []
        const fields = [
            { key: 'telefono', label: 'Teléfono' },
            { key: 'fecha_evento', label: 'Fecha Evento' },
            { key: 'canal_de_contacto', label: 'Canal' },
            { key: 'como_nos_encontro', label: 'Origen' },
            { key: 'vendedora', label: 'Vendedora' },
            { key: 'salon', label: 'Salón' },
            { key: 'evento', label: 'Evento' },
        ]
        const total = leads.length
        return fields.map(({ key, label }) => {
            const missing = leads.filter((l) => isSinInfo(l[key])).length
            return { name: label, value: parseFloat(((missing / total) * 100).toFixed(1)), missing, total }
        }).sort((a, b) => b.value - a.value)
    }, [leads])

    if (loading) return <ChartSkeleton />

    return (
        <ChartCard title="Data Quality" subtitle="% de campos con información faltante">
            <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
                <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} unit="%" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={90} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="% Faltante" fill="#dc2626" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    )
}
