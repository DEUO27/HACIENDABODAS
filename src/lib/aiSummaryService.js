/**
 * AI Summary Service
 * 
 * Builds a PII-free payload from filtered leads and calls
 * the Supabase Edge Function to get a Gemini-powered analysis.
 */
import { supabase } from './supabase'
import { isSinInfo, parseLeadDate } from './leadUtils'
import { format } from 'date-fns'

/**
 * Build PII-free aggregated payload from leads + kpis.
 * NO names, NO phone numbers, NO emails.
 */
export function buildAIPayload(leads, kpis, dateRangeString) {
    const total = leads.length

    // ── Trends: by day and by hour ──
    const byDay = {}
    const byHour = {}
    leads.forEach(l => {
        const d = parseLeadDate(l.fecha_primer_mensaje)
        if (d) {
            const dayStr = format(d, 'yyyy-MM-dd')
            const hourStr = format(d, 'HH:00')
            byDay[dayStr] = (byDay[dayStr] || 0) + 1
            byHour[hourStr] = (byHour[hourStr] || 0) + 1
        }
    })

    // Sort and keep most relevant trends (max 10 days for prompt brevity)
    const trendPorDia = Object.entries(byDay)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 10)
        .reverse()
        .map(([date, count]) => ({ date, count }))

    const trendPorHora = Object.entries(byHour)
        .sort((a, b) => b[1] - a[1]) // highest traffic hours first
        .slice(0, 5)
        .map(([hour, count]) => ({ hora: hour, count }))

    // ── Pipeline breakdown ──
    const pipeline = {}
    leads.forEach(l => {
        const fase = isSinInfo(l.fase_embudo) ? 'Sin fase' : l.fase_embudo
        pipeline[fase] = (pipeline[fase] || 0) + 1
    })
    // Convert to { fase: count, pct: % }
    const pipelineArr = Object.entries(pipeline)
        .sort((a, b) => b[1] - a[1])
        .map(([fase, count]) => ({ fase, count, pct: Math.round((count / total) * 100) }))

    // ── Acquisition: top origenes ──
    const origenes = {}
    leads.forEach(l => {
        const o = isSinInfo(l.como_nos_encontro) ? 'Sin Info' : l.como_nos_encontro
        origenes[o] = (origenes[o] || 0) + 1
    })
    const topOrigenes = Object.entries(origenes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }))

    // ── Acquisition: top canales ──
    const canales = {}
    leads.forEach(l => {
        const c = isSinInfo(l.canal_de_contacto) ? 'Sin Info' : l.canal_de_contacto
        canales[c] = (canales[c] || 0) + 1
    })
    const topCanales = Object.entries(canales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }))

    // ── Events: top tipos ──
    const eventos = {}
    leads.forEach(l => {
        const e = isSinInfo(l.evento) ? 'Sin Info' : l.evento
        eventos[e] = (eventos[e] || 0) + 1
    })
    const topEventos = Object.entries(eventos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }))

    // ── Team: vendedoras by volume ──
    const vendedoraVol = {}
    const vendedora24h = {}
    leads.forEach(l => {
        const v = isSinInfo(l.vendedora) ? 'Sin Asignar' : l.vendedora
        vendedoraVol[v] = (vendedoraVol[v] || 0) + 1
        if ((l.fase_embudo || '').toLowerCase().includes('+24hrs')) {
            vendedora24h[v] = (vendedora24h[v] || 0) + 1
        }
    })
    const porVolumen = Object.entries(vendedoraVol)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    const por24h = Object.entries(vendedora24h)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }))

    // ── Data Quality: % missing per field ──
    const fieldsToCheck = [
        { key: 'telefono', label: 'telefono' },
        { key: 'fecha_evento', label: 'fecha_evento' },
        { key: 'como_nos_encontro', label: 'origen' },
        { key: 'salon', label: 'salon' },
        { key: 'vendedora', label: 'vendedora' },
        { key: 'canal_de_contacto', label: 'canal' },
        { key: 'evento', label: 'evento' },
    ]
    const dataQuality = {}
    fieldsToCheck.forEach(({ key, label }) => {
        const missing = leads.filter(l => isSinInfo(l[key])).length
        dataQuality[label] = Math.round((missing / total) * 100)
    })

    // ── Alerts flags ──
    const pct24h = total ? Math.round((kpis.noContesta / total) * 100) : 0
    const alerts = {
        pct_no_contesta: pct24h,
        pct_no_contesta_alto: pct24h >= 10,
        pct_missing_phone: kpis.pctSinTel,
        pct_missing_phone_alto: kpis.pctSinTel >= 20,
        pct_missing_event_date: kpis.pctSinFecha,
        pct_missing_event_date_alto: kpis.pctSinFecha >= 25,
        total_perdidos: kpis.perdidos,
        pct_perdidos: total ? Math.round((kpis.perdidos / total) * 100) : 0,
    }

    // ── Critical leads (anonymized) ──
    const criticalExamples = leads
        .filter(l => (l.fase_embudo || '').toLowerCase().includes('+24hrs'))
        .slice(0, 5)
        .map(l => ({
            lead_id: l.lead_id,
            fase_embudo: l.fase_embudo,
            created_at: (l.fecha_primer_mensaje || '').split('T')[0],
            missing_fields: fieldsToCheck.filter(({ key }) => isSinInfo(l[key])).map(f => f.label),
        }))

    return {
        timeframe: dateRangeString,
        totals: {
            total_filtrados: total,
            nuevos_hoy: kpis.todayCount,
            nuevos_7d: kpis.weekCount,
            activos: kpis.activos,
            perdidos: kpis.perdidos,
        },
        trends: {
            ultimos_10_dias: trendPorDia,
            horas_pico: trendPorHora,
        },
        pipeline: pipelineArr,
        acquisition: {
            top_origenes: topOrigenes,
            top_canales: topCanales,
        },
        events: { top_eventos: topEventos },
        team: {
            por_volumen: porVolumen,
            por_24h: por24h,
        },
        data_quality: dataQuality,
        alerts,
        examples: criticalExamples,
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

    // Validate response shape
    return {
        resumen_ejecutivo: Array.isArray(data.resumen_ejecutivo) ? data.resumen_ejecutivo : [],
        top_insights: Array.isArray(data.top_insights) ? data.top_insights : [],
        next_actions: Array.isArray(data.next_actions) ? data.next_actions : [],
        chart_insights: data.chart_insights || {},
        impacto_esperado: data.impacto_esperado || '',
        nota_comparativo: data.nota_comparativo || '',
        generated_at: data.generated_at || new Date().toISOString(),
        model: data.model || 'gemini',
    }
}
