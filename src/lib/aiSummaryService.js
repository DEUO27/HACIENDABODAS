/**
 * AI Summary Service
 * 
 * Builds a PII-free payload from filtered leads and calls
 * the Supabase Edge Function to get a Gemini-powered analysis.
 */
import { supabase } from './supabase'
import { getLeadTrackingDate, isSinInfo } from './leadUtils'
import { format } from 'date-fns'

/**
 * Build PII-free aggregated payload from leads + kpis.
 * NO names, NO phone numbers, NO emails.
 */
export function buildAIPayload(leads, kpis, dateRangeString) {
    const total = leads.length

    // ── Trends: leads by day ──
    const byDay = {}
    leads.forEach(l => {
        const d = getLeadTrackingDate(l)
        if (d) {
            const dayStr = format(d, 'yyyy-MM-dd')
            byDay[dayStr] = (byDay[dayStr] || 0) + 1
        }
    })

    const trendPorDia = Object.entries(byDay)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 10)
        .reverse()
        .map(([date, count]) => ({ date, count }))

    // ── Pipeline breakdown (fases del embudo) ──
    const pipeline = {}
    leads.forEach(l => {
        const fase = isSinInfo(l.fase_embudo) ? 'Sin fase' : l.fase_embudo
        pipeline[fase] = (pipeline[fase] || 0) + 1
    })
    const pipelineArr = Object.entries(pipeline)
        .sort((a, b) => b[1] - a[1])
        .map(([fase, count]) => ({ fase, count, pct: Math.round((count / total) * 100) }))

    // ── Canales de contacto ──
    const canales = {}
    leads.forEach(l => {
        const rawC = l.canal_normalizado || l.canal_de_contacto
        const c = isSinInfo(rawC) ? 'Sin Info' : rawC
        canales[c] = (canales[c] || 0) + 1
    })
    const topCanales = Object.entries(canales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }))

    // ── Tipos de evento ──
    const eventos = {}
    leads.forEach(l => {
        const rawE = l.evento_normalizado || l.evento
        const e = isSinInfo(rawE) ? 'Sin Info' : rawE
        eventos[e] = (eventos[e] || 0) + 1
    })
    const topEventos = Object.entries(eventos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }))

    // ── Seguimientos (NO CONTESTA) ──
    const pct24h = total ? Math.round((kpis.noContesta / total) * 100) : 0

    return {
        timeframe: dateRangeString,
        totals: {
            total_filtrados: total,
            nuevos_hoy: kpis.todayCount,
            nuevos_7d: kpis.weekCount,
            activos: kpis.activos,
            seguimientos_no_contesta: kpis.noContesta,
            pct_no_contesta: pct24h,
        },
        trends: {
            ultimos_10_dias: trendPorDia,
        },
        pipeline: pipelineArr,
        canales: topCanales,
        eventos: topEventos,
    }
}

/**
 * Call the Supabase Edge Function to get Gemini-powered summary.
 * Returns parsed result or throws on failure.
 */
export async function fetchAISummary(payload) {
    const { data, error } = await supabase.functions.invoke('ai-summary', {
        body: payload,
    })

    if (error) {
        console.error('[AI Summary] Edge Function error:', error)
        throw new Error(error.message || 'Edge Function call failed')
    }

    if (data?.error) {
        console.error('[AI Summary] API error:', data.error, data.details)
        const errMsg = typeof data.error === 'object' ? (data.error.message || JSON.stringify(data.error)) : data.error
        throw new Error(data.details ? `${errMsg} - ${data.details}` : errMsg)
    }

    // Only chart_insights are used in the PDF
    return {
        chart_insights: data.chart_insights || {},
        generated_at: data.generated_at || new Date().toISOString(),
        model: data.model || 'gemini',
    }
}
