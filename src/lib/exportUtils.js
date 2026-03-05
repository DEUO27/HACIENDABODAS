import { toPng } from 'html-to-image'
import { isSinInfo, parseLeadDate } from './leadUtils'
import { isToday, subDays, isAfter } from 'date-fns'

/**
 * Capture all chart elements with [data-export-id] as high-res PNG images.
 * 
 * Problem: Recharts ResponsiveContainer needs a parent with real width.
 * Hidden tab panels (forceMount + data-[state=inactive]:hidden) have display:none,
 * so ResponsiveContainer renders at 0 width.
 * 
 * Fix: Temporarily make hidden panels visible with opacity:0 in normal document flow
 * so they get proper width from their parent. This lets ResponsiveContainer compute
 * correct dimensions.
 */
export async function captureCharts() {
    const images = {}

    // 1. Find hidden tab panels and make them visible but invisible (opacity 0)
    const hiddenPanels = document.querySelectorAll('[data-state="inactive"][data-slot="tabs-content"]')
    const restorations = []

    hiddenPanels.forEach(panel => {
        restorations.push({
            el: panel,
            prevDisplay: panel.style.display,
            prevOpacity: panel.style.opacity,
            prevPointerEvents: panel.style.pointerEvents,
            prevMaxHeight: panel.style.maxHeight,
            prevOverflow: panel.style.overflow,
            wasHidden: panel.hasAttribute('hidden')
        })
        // Remove native hidden attribute if present (Radix uses this)
        panel.removeAttribute('hidden')
        // Make visible in flow (not absolute!) so ResponsiveContainer gets parent width
        panel.style.display = 'block'
        panel.style.opacity = '0'
        panel.style.pointerEvents = 'none'
        // Don't constrain height — charts need room to fully render
    })

    // Force explicit dimensions on chart containers so Recharts NEVER calculates 0
    const chartNodes = document.querySelectorAll('[data-export-id]')
    const nodeRestorations = []

    chartNodes.forEach(node => {
        nodeRestorations.push({
            el: node,
            prevWidth: node.style.width,
        })
        // 800px guarantees consistent, high-res layout for the PDF
        node.style.width = '800px'
    })

    // Trigger a window resize so Recharts ResponsiveObserver fires
    window.dispatchEvent(new Event('resize'))

    // Wait for Recharts to re-render with correct widths
    await new Promise(r => setTimeout(r, 1500))

    // 2. Now make them fully visible for capture (toPng needs painted pixels)
    hiddenPanels.forEach(panel => {
        panel.style.opacity = '1'
    })

    // Small delay for paint
    await new Promise(r => setTimeout(r, 300))

    // 3. Capture each chart
    for (let i = 0; i < chartNodes.length; i++) {
        const node = chartNodes[i]
        const id = node.getAttribute('data-export-id')
        try {
            const dataUrl = await toPng(node, {
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                skipFonts: true,
                style: {
                    margin: '0',
                    transform: 'none',
                }
            })
            images[id] = dataUrl
        } catch (err) {
            console.error(`Failed to capture chart: ${id}`, err)
        }
    }

    // 4. Restore hidden tabs and dimensions
    restorations.forEach(({ el, prevDisplay, prevOpacity, prevPointerEvents, wasHidden }) => {
        el.style.display = prevDisplay
        el.style.opacity = prevOpacity
        el.style.pointerEvents = prevPointerEvents
        if (wasHidden) el.setAttribute('hidden', '')
    })

    nodeRestorations.forEach(({ el, prevWidth }) => {
        el.style.width = prevWidth
    })

    console.log(`[PDF Export] Captured ${Object.keys(images).length} charts:`, Object.keys(images))
    return images
}

export function prepareKpiData(leads) {
    const total = leads.length
    if (!total) return {
        total: 0, todayCount: 0, weekCount: 0, activos: 0, perdidos: 0,
        noContesta: 0, pctSinTel: 0, pctSinFecha: 0,
        topOrigenName: 'N/A', topOrigenPct: 0,
        topVendedoraName: 'N/A', topVendedoraCount: 0,
        canalBreakdown: [],
    }

    const now = new Date()
    const sevenAgo = subDays(now, 7)

    let todayCount = 0
    let weekCount = 0
    let activos = 0
    let perdidos = 0
    let noContesta = 0
    let sinTel = 0
    let sinFecha = 0

    const origenes = {}
    const vendedoras = {}
    const canales = {}

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

        const o = isSinInfo(l.como_nos_encontro) ? 'Sin Info' : l.como_nos_encontro
        origenes[o] = (origenes[o] || 0) + 1

        const v = isSinInfo(l.vendedora) ? 'Sin Asignar' : l.vendedora
        vendedoras[v] = (vendedoras[v] || 0) + 1

        // Canal breakdown
        const canal = l.canal_normalizado || (isSinInfo(l.canal_de_contacto) ? 'Sin Info' : l.canal_de_contacto) || 'Sin Info'
        canales[canal] = (canales[canal] || 0) + 1
    })

    const topOrigen = Object.entries(origenes).sort((a, b) => b[1] - a[1])[0]
    const topVendedora = Object.entries(vendedoras).sort((a, b) => b[1] - a[1])[0]

    const canalBreakdown = Object.entries(canales)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }))

    return {
        total,
        todayCount,
        weekCount,
        activos,
        perdidos,
        noContesta,
        pctSinTel: Math.round((sinTel / total) * 100),
        pctSinFecha: Math.round((sinFecha / total) * 100),
        topOrigenName: topOrigen ? topOrigen[0] : 'N/A',
        topOrigenPct: topOrigen ? Math.round((topOrigen[1] / total) * 100) : 0,
        topVendedoraName: topVendedora ? topVendedora[0] : 'N/A',
        topVendedoraCount: topVendedora ? topVendedora[1] : 0,
        canalBreakdown,
    }
}

export function getCriticalLeads(leads) {
    let critical = leads.filter(l => (l.fase_embudo || '').toLowerCase().includes('+24hrs'))

    const others = leads
        .filter(l => !(l.fase_embudo || '').toLowerCase().includes('+24hrs'))
        .sort((a, b) => (b.fecha_primer_mensaje || '').localeCompare(a.fecha_primer_mensaje || ''))

    critical = [...critical, ...others]
    return critical.slice(0, 100)
}

export function maskPhone(phone) {
    if (isSinInfo(phone)) return 'Sin Info'
    const str = String(phone).replace(/\s/g, '')
    if (str.length <= 4) return str
    return '*'.repeat(str.length - 4) + str.slice(-4)
}

/**
 * Prepares narrative executive summary data from filteredLeads.
 * Returns: { headline, bullets[], alerts[] }
 */
export function prepareExecutiveSummary(leads, kpis) {
    const total = leads.length
    if (!total) return { headline: 'No hay leads para analizar.', bullets: [], alerts: [] }

    // ── Phase breakdown ──
    const fases = {}
    const vendedoraCarga = {}
    const vendedora24h = {}
    const canales = {}

    leads.forEach(l => {
        const fase = isSinInfo(l.fase_embudo) ? 'Sin fase' : l.fase_embudo
        fases[fase] = (fases[fase] || 0) + 1

        const v = isSinInfo(l.vendedora) ? 'Sin Asignar' : l.vendedora
        vendedoraCarga[v] = (vendedoraCarga[v] || 0) + 1

        if ((l.fase_embudo || '').toLowerCase().includes('+24hrs')) {
            vendedora24h[v] = (vendedora24h[v] || 0) + 1
        }

        const cVal = l.canal_normalizado || l.canal_de_contacto
        const canal = isSinInfo(cVal) ? 'Sin Info' : cVal
        canales[canal] = (canales[canal] || 0) + 1
    })

    // Top phase
    const sortedFases = Object.entries(fases).sort((a, b) => b[1] - a[1])
    const topFase = sortedFases[0]
    const topFaseName = topFase[0]
    const topFasePct = Math.round((topFase[1] / total) * 100)

    // Top vendedora by load
    const sortedVendedoras = Object.entries(vendedoraCarga).sort((a, b) => b[1] - a[1])
    const topVendedora = sortedVendedoras[0]

    // Top vendedora by +24h
    const sorted24h = Object.entries(vendedora24h).sort((a, b) => b[1] - a[1])
    const topVend24h = sorted24h.length > 0 ? sorted24h[0] : null

    // Top canal
    const sortedCanales = Object.entries(canales).sort((a, b) => b[1] - a[1])
    const topCanal = sortedCanales[0]
    const topCanalPct = Math.round((topCanal[1] / total) * 100)

    // ── Headline ──
    const pct24h = kpis.noContesta ? Math.round((kpis.noContesta / total) * 100) : 0
    let headline = `El embudo está concentrado en "${topFaseName}" (${topFasePct}%).`
    if (pct24h >= 10) {
        headline += ` Hay un ${pct24h}% de leads +24H sin respuesta.`
    }

    // ── Bullets ──
    const bullets = []

    // Volumen
    bullets.push(`Volumen: ${total} leads en el periodo. ${kpis.weekCount} nuevos en los últimos 7 días, ${kpis.todayCount} hoy.`)

    // Pipeline
    const pctActivos = Math.round((kpis.activos / total) * 100)
    const pctPerdidos = Math.round((kpis.perdidos / total) * 100)
    bullets.push(`Pipeline: Fase principal "${topFaseName}" con ${topFase[1]} leads (${topFasePct}%). Activos: ${pctActivos}%, Perdidos: ${pctPerdidos}%, +24H: ${pct24h}%.`)

    // Equipo
    let equipoBullet = `Equipo: ${topVendedora[0]} lidera con ${topVendedora[1]} leads asignados.`
    if (topVend24h) {
        equipoBullet += ` Mayor backlog +24H: ${topVend24h[0]} con ${topVend24h[1]} leads.`
    }
    bullets.push(equipoBullet)

    // Adquisición
    bullets.push(`Adquisición: Origen #1 "${kpis.topOrigenName}" (${kpis.topOrigenPct}%), Canal #1 "${topCanal[0]}" (${topCanalPct}%).`)

    // Calidad
    const worstField = kpis.pctSinTel >= kpis.pctSinFecha
        ? { name: 'Teléfono', pct: kpis.pctSinTel }
        : { name: 'Fecha de Evento', pct: kpis.pctSinFecha }
    bullets.push(`Calidad: Campo con mayor falta de info: ${worstField.name} (${worstField.pct}% faltante).`)

    // ── Alerts ──
    const alerts = []
    if (pct24h >= 10) alerts.push(`Alto % en +24H: ${pct24h}% de los leads no han sido respondidos`)
    if (kpis.pctSinTel >= 20) alerts.push(`${kpis.pctSinTel}% de leads sin teléfono registrado`)
    if (kpis.pctSinFecha >= 25) alerts.push(`${kpis.pctSinFecha}% de leads sin fecha de evento`)
    const sinInfoOrigen = leads.filter(l => isSinInfo(l.como_nos_encontro)).length
    const pctSinOrigen = Math.round((sinInfoOrigen / total) * 100)
    if (pctSinOrigen >= 15) alerts.push(`Origen desconocido elevado: ${pctSinOrigen}% sin fuente identificada`)

    return { headline, bullets, alerts: alerts.slice(0, 3) }
}

/**
 * Prepares Insights & Next Actions from leads + kpis.
 * Returns: { insights[], actions[] }
 */
export function prepareInsightsAndActions(leads, kpis) {
    const total = leads.length
    if (!total) return { insights: ['Datos insuficientes para generar insights.'], actions: ['Recopilar más leads antes de analizar.'] }

    const fases = {}
    const vendedoraCarga = {}
    const vendedora24h = {}
    const vendedoraPerdidos = {}
    const canales = {}
    const origenes = {}

    leads.forEach(l => {
        const fase = isSinInfo(l.fase_embudo) ? 'Sin fase' : l.fase_embudo
        fases[fase] = (fases[fase] || 0) + 1

        const v = isSinInfo(l.vendedora) ? 'Sin Asignar' : l.vendedora
        vendedoraCarga[v] = (vendedoraCarga[v] || 0) + 1

        const faseL = (l.fase_embudo || '').toLowerCase()
        if (faseL.includes('+24hrs')) vendedora24h[v] = (vendedora24h[v] || 0) + 1
        if (faseL.includes('perdido')) vendedoraPerdidos[v] = (vendedoraPerdidos[v] || 0) + 1

        const cVal = l.canal_normalizado || l.canal_de_contacto
        const canal = isSinInfo(cVal) ? 'Sin Info' : cVal
        canales[canal] = (canales[canal] || 0) + 1

        const origen = isSinInfo(l.como_nos_encontro) ? 'Sin Info' : l.como_nos_encontro
        origenes[origen] = (origenes[origen] || 0) + 1
    })

    // ── Top entities ──
    const topFase = Object.entries(fases).sort((a, b) => b[1] - a[1])[0]
    const topVendedora = Object.entries(vendedoraCarga).sort((a, b) => b[1] - a[1])[0]
    const topVend24h = Object.entries(vendedora24h).sort((a, b) => b[1] - a[1])[0]
    const pct24h = kpis.noContesta ? Math.round((kpis.noContesta / total) * 100) : 0

    // Data quality - worst field
    const fields = [
        { key: 'telefono', label: 'Teléfono' },
        { key: 'fecha_evento', label: 'Fecha Evento' },
        { key: 'canal_de_contacto', label: 'Canal', val: l => l.canal_normalizado || l.canal_de_contacto },
        { key: 'como_nos_encontro', label: 'Origen' },
        { key: 'vendedora', label: 'Vendedora' },
        { key: 'salon', label: 'Salón' },
        { key: 'evento', label: 'Evento', val: l => l.evento_normalizado || l.evento },
    ]
    let worstField = { label: 'N/A', pct: 0 }
    fields.forEach(({ key, label, val }) => {
        const valueFn = val || (l => l[key])
        const missing = leads.filter(l => isSinInfo(valueFn(l))).length
        const pct = Math.round((missing / total) * 100)
        if (pct > worstField.pct) worstField = { label, pct }
    })

    // Vendedora balance
    const vendedoraValues = Object.values(vendedoraCarga)
    const maxCarga = Math.max(...vendedoraValues)
    const minCarga = Math.min(...vendedoraValues)
    const isUnbalanced = vendedoraValues.length > 1 && maxCarga > minCarga * 3

    // Canal with most perdidos
    const canalPerdidos = {}
    leads.forEach(l => {
        if ((l.fase_embudo || '').toLowerCase().includes('perdido')) {
            const cVal = l.canal_normalizado || l.canal_de_contacto
            const canal = isSinInfo(cVal) ? 'Sin Info' : cVal
            canalPerdidos[canal] = (canalPerdidos[canal] || 0) + 1
        }
    })
    const topCanalPerdido = Object.entries(canalPerdidos).sort((a, b) => b[1] - a[1])[0]

    // ── INSIGHTS ──
    const insights = []
    insights.push(`Fase dominante: ${topFase[0]} con ${topFase[1]} leads (${Math.round((topFase[1] / total) * 100)}%)`)
    insights.push(`Origen principal: ${kpis.topOrigenName} con ${kpis.topOrigenPct}%`)
    insights.push(`% +24H sin respuesta: ${pct24h}% (${kpis.noContesta} leads)`)
    insights.push(`Campo más incompleto: ${worstField.label} con ${worstField.pct}% faltante`)
    if (topVendedora) insights.push(`Vendedora con mayor carga: ${topVendedora[0]} (${topVendedora[1]} leads activos)`)

    // ── ACTIONS ──
    const actions = []

    if (pct24h >= 5) {
        actions.push('Priorizar seguimiento: contactar primero leads +24H más recientes (últimas 48h).')
    }
    if (topVend24h && topVend24h[1] >= 3) {
        actions.push(`Revisar carga de ${topVend24h[0]}: tiene ${topVend24h[1]} leads +24H pendientes.`)
    }
    if (kpis.pctSinTel >= 15) {
        actions.push('Hacer teléfono obligatorio o agregar mensaje automático pidiendo teléfono en el primer contacto.')
    }
    if (kpis.pctSinFecha >= 15) {
        actions.push('Solicitar fecha de evento lo antes posible en la conversación para cualificar mejor.')
    }
    const sinInfoOrigen = leads.filter(l => isSinInfo(l.como_nos_encontro)).length
    const pctSinOrigen = Math.round((sinInfoOrigen / total) * 100)
    if (pctSinOrigen >= 15) {
        actions.push(`Estandarizar captura del origen (${pctSinOrigen}% desconocido): usar Select en formulario, evitar texto libre.`)
    }
    if (isUnbalanced) {
        actions.push(`Reasignar leads para balancear carga: ${topVendedora[0]} tiene ${maxCarga} vs mínimo ${minCarga}.`)
    }
    if (topCanalPerdido && topCanalPerdido[1] >= 3) {
        actions.push(`Revisar segmentación en canal "${topCanalPerdido[0]}": ${topCanalPerdido[1]} leads perdidos provienen de ahí.`)
    }
    if (kpis.perdidos > kpis.activos) {
        actions.push('Los perdidos superan a los activos. Revisar tiempos de respuesta y propuesta de valor.')
    }

    // Guarantee at least something if all is healthy
    if (actions.length === 0) {
        actions.push('Los indicadores están en rangos saludables. Mantener las prácticas actuales de seguimiento.')
    }

    return { insights, actions: actions.slice(0, 8) }
}
