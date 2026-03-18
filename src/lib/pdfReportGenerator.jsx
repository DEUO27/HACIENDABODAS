import { Document, Page, Text, View, StyleSheet, Image, Font, Svg, Path, Circle, G } from '@react-pdf/renderer';
import { logoBase64, bgBase64 } from './logoBase64';

// Using standard PDF fonts (Times-Roman and Helvetica) for stability.
// Custom TTF URLs are prone to 404s and format errors in @react-pdf/renderer.

/* ═══════════════════════════════════════
   COLOR PALETTE
   ═══════════════════════════════════════ */
const C = {
    primary: '#1A1A1A',
    primaryMid: '#333333',
    accent: '#ECD8C5',
    accentLight: '#F6F0EB',
    text: '#111111',
    textMid: '#333333',
    textLight: '#737373',
    bg: '#FDFCFB',
    white: '#FFFFFF',
    border: '#E5E7EB',
    danger: '#B45309',
    dangerBg: '#FEF3E2',
    warning: '#92400E',
    warningBg: '#FFFBEB',
    sand: '#ECD8C5',
    sage: '#E6DCCF',
    olive: '#D5C7B8',
};

/* ═══════════════════════════════════════
   STYLES
   ═══════════════════════════════════════ */
const s = StyleSheet.create({
    /* ─ Pages ─ */
    page: {
        backgroundColor: C.bg,
        paddingTop: 50,
        paddingBottom: 50,
        paddingHorizontal: 40,
        fontFamily: 'Helvetica',
        color: C.text,
    },
    coverPage: {
        position: 'relative',
        backgroundColor: '#000000', // Solid black back to help contrast
        justifyContent: 'center',
        paddingHorizontal: 40,
        fontFamily: 'Times-Roman',
        overflow: 'hidden',
    },
    coverBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.8, // Increased opacity to make image pop more
    },
    coverOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: C.primary,
        opacity: 0.6, // Lowered overlay to reveal image behind
    },
    coverInner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
    },
    /* Decorative Cover Circles */
    circle1: {
        position: 'absolute',
        top: -100,
        right: -100,
        width: 350,
        height: 350,
        backgroundColor: C.primaryMid,
        opacity: 0.15,
    },
    circle2: {
        position: 'absolute',
        bottom: -150,
        left: -100,
        width: 400,
        height: 400,
        backgroundColor: C.accent,
        opacity: 0.08,
    },
    circle3: {
        position: 'absolute',
        top: 150,
        left: -50,
        width: 150,
        height: 150,
        backgroundColor: C.olive,
        opacity: 0.06,
    },
    coverInner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
    },
    coverBrand: {
        fontSize: 11,
        letterSpacing: 6,
        color: C.accent,
        marginBottom: 20,
        textTransform: 'uppercase',
        fontFamily: 'Helvetica',
        fontWeight: 500,
    },
    coverTitle: {
        fontSize: 32,
        fontFamily: 'Times-Roman',
        fontWeight: 600,
        color: C.white,
        textAlign: 'center',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 3,
    },
    coverSubtitle: {
        fontSize: 16,
        color: C.accentLight,
        textAlign: 'center',
        marginBottom: 50,
    },
    coverStatsRow: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 50,
    },
    coverStat: {
        backgroundColor: '#272727',
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        minWidth: 110,
        borderWidth: 1,
        borderColor: '#393633',
    },
    coverStatValue: {
        fontSize: 26,
        fontFamily: 'Helvetica',
        fontWeight: 700,
        color: C.white,
    },
    coverStatLabel: {
        fontSize: 9,
        color: C.accentLight,
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    coverFiltersBox: {
        backgroundColor: '#222222',
        padding: 16,
        width: '85%',
        marginBottom: 30,
        borderWidth: 1,
        borderColor: '#33312E',
    },
    coverFiltersLabel: {
        fontSize: 9,
        color: C.accent,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    coverFiltersText: {
        fontSize: 10,
        color: C.accentLight,
        lineHeight: 1.5,
    },
    coverFooter: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    coverFooterText: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.4)',
    },

    /* ─ Header & Footer (repeated) ─ */
    header: {
        position: 'absolute',
        top: 20,
        left: 40,
        right: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    headerLeft: {
        fontSize: 10,
        fontFamily: 'Times-Roman',
        fontWeight: 600,
        color: C.primary,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    headerRight: {
        fontSize: 8,
        color: C.textLight,
    },
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 40,
        right: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: C.border,
    },
    footerText: {
        fontSize: 8,
        color: C.textLight,
    },

    /* ─ Section titles ─ */
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Times-Roman',
        fontWeight: 600,
        color: C.primary,
        marginBottom: 14,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: C.accent,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    sectionSubtitle: {
        fontSize: 11,
        fontFamily: 'Helvetica',
        fontWeight: 400,
        color: C.textMid,
        marginBottom: 12,
    },

    /* ─ KPI Cards ─ */
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    kpiCard: {
        width: '31%',
        backgroundColor: C.white,
        padding: 14,
        borderWidth: 1,
        borderColor: C.accent,
    },
    kpiCardHighlight: {
        width: '31%',
        backgroundColor: C.primary,
        padding: 14,
    },
    kpiLabel: {
        fontSize: 10,
        fontFamily: 'Helvetica',
        fontWeight: 500,
        color: C.textLight,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    kpiLabelHighlight: {
        fontSize: 10,
        fontFamily: 'Helvetica',
        fontWeight: 500,
        color: C.accentLight,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    kpiValue: {
        fontSize: 24,
        fontFamily: 'Helvetica',
        fontWeight: 700,
        color: C.text,
    },
    kpiValueHighlight: {
        fontSize: 24,
        fontFamily: 'Helvetica',
        fontWeight: 700,
        color: C.white,
    },
    kpiExtra: {
        fontSize: 8,
        color: C.textLight,
        marginTop: 2,
    },

    /* ─ Charts ─ */
    chartBox: {
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.border,
        padding: 10,
        marginBottom: 12,
    },
    chartTitle: {
        fontSize: 11,
        fontFamily: 'Times-Roman',
        fontWeight: 600,
        color: C.textMid,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    chartImage: {
        width: '100%',
        objectFit: 'contain',
    },
    chartRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    chartHalf: {
        width: '49%',
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.border,
        padding: 10,
    },

    /* ─ Insights ─ */
    insightBox: {
        backgroundColor: C.accentLight,
        borderLeftWidth: 3,
        borderLeftColor: C.accent,
        padding: 14,
        marginBottom: 16,
    },
    insightTitle: {
        fontSize: 11,
        fontFamily: 'Times-Roman',
        fontWeight: 600,
        color: C.primary,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    insightText: {
        fontSize: 10,
        fontFamily: 'Helvetica',
        fontWeight: 400,
        color: C.primaryMid,
        lineHeight: 1.5,
        marginBottom: 3,
    },

    alertBox: {
        backgroundColor: C.warningBg,
        borderLeftWidth: 3,
        borderLeftColor: C.warning,
        padding: 14,
        marginBottom: 16,
    },
    alertText: {
        fontSize: 9,
        color: '#92400e',
        lineHeight: 1.6,
    },

    /* ─ Table ─ */
    table: {
        width: '100%',
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: C.primary,
        padding: 8,
    },
    tableHeaderCell: {
        fontSize: 10,
        fontFamily: 'Helvetica',
        fontWeight: 600,
        color: C.white,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: C.white,
    },
    tableRowAlt: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: C.bg,
    },
    tableCell: {
        fontSize: 8,
        color: C.textMid,
    },
    tc1: { width: '7%' },
    tc2: { width: '18%' },
    tc3: { width: '13%' },
    tc4: { width: '16%' },
    tc5: { width: '14%' },
    tc6: { width: '20%' },
    tc7: { width: '12%' },
    badgeWarn: { color: C.warning, fontFamily: 'Helvetica', fontWeight: 700 },
    badgeDanger: { color: C.danger, fontFamily: 'Helvetica', fontWeight: 700 },
});

/* ═══════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════ */
function Header({ dateRange }) {
    return (
        <View style={s.header} fixed>
            <Text style={s.headerLeft}>Hacienda Bodas — Reporte Ejecutivo</Text>
            <Text style={s.headerRight}>{dateRange}</Text>
        </View>
    );
}

function Footer({ generatedAt }) {
    return (
        <View style={s.footer} fixed>
            <Text style={s.footerText}>Generado: {generatedAt}</Text>
            <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
    );
}

function KpiCard({ label, value, extra, highlight = false, warn = false, danger = false }) {
    const cardStyle = highlight ? s.kpiCardHighlight : s.kpiCard;
    const labelStyle = highlight ? s.kpiLabelHighlight : s.kpiLabel;
    let valueStyle = highlight ? s.kpiValueHighlight : s.kpiValue;
    if (warn) valueStyle = { ...s.kpiValue, color: C.warning };
    if (danger) valueStyle = { ...s.kpiValue, color: C.danger };
    return (
        <View style={cardStyle}>
            <Text style={labelStyle}>{label}</Text>
            <Text style={valueStyle}>{value}</Text>
            {extra && <Text style={s.kpiExtra}>{extra}</Text>}
        </View>
    );
}

/* ═══════════════════════════════════════
   NATIVE PDF DONUT CHART (no html-to-image)
   ═══════════════════════════════════════ */
const PDF_CHART_COLORS = [
    '#FFA6A6', '#A6C8FF', '#A6E3B8', '#FFD28A',
    '#D7A6FF', '#FFC2A6', '#A6EAE3', '#BAB8E8',
]

function polarToXY(cx, cy, r, angleDeg) {
    const rad = (angleDeg - 90) * (Math.PI / 180)
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function donutArcPath(cx, cy, r, innerR, startAngle, endAngle) {
    const outerStart = polarToXY(cx, cy, r, startAngle)
    const outerEnd = polarToXY(cx, cy, r, endAngle)
    const innerStart = polarToXY(cx, cy, innerR, endAngle)
    const innerEnd = polarToXY(cx, cy, innerR, startAngle)
    const largeArc = (endAngle - startAngle) > 180 ? 1 : 0
    return [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerStart.x} ${innerStart.y}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
        'Z'
    ].join(' ')
}

function PdfDonutChart({ data, width = 200, height = 200 }) {
    if (!data || data.length === 0) return null
    const cx = width / 2
    const cy = height / 2
    const r = Math.min(cx, cy) * 0.72
    const innerR = r * 0.52
    const total = data.reduce((s, d) => s + d.count, 0)
    if (total === 0) return null

    let currentAngle = 0
    const slices = data.map((d, i) => {
        const pct = d.count / total
        const startAngle = currentAngle
        const sweep = pct * 360
        currentAngle += sweep
        return { ...d, pct, startAngle, endAngle: currentAngle, color: PDF_CHART_COLORS[i % PDF_CHART_COLORS.length] }
    })

    return (
        <View style={{ alignItems: 'center', width: '100%' }}>
            {/* Donut — compact, centered */}
            <Svg width={width} height={height * 0.65}>
                {slices.map((s, i) => (
                    <Path key={i}
                        d={donutArcPath(cx, cy * 0.65, r * 0.8, innerR * 0.8, s.startAngle, s.endAngle - 0.5)}
                        fill={s.color}
                    />
                ))}
            </Svg>

            {/* Legend grid — 2 columns, all sectors shown, no clipping */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginTop: 6, paddingHorizontal: 4 }}>
                {slices.map((s, i) => (
                    <View key={i} style={{ width: '48%', flexDirection: 'row', alignItems: 'center', marginBottom: 4, marginRight: '2%' }}>
                        <View style={{ width: 9, height: 9, backgroundColor: s.color, marginRight: 5, flexShrink: 0 }} />
                        <Text style={{ fontSize: 8.5, color: '#333333', fontFamily: 'Helvetica', flex: 1 }}>
                            {s.name}
                        </Text>
                        <Text style={{ fontSize: 8.5, color: '#666666', fontFamily: 'Helvetica', fontWeight: 700, marginLeft: 4, flexShrink: 0 }}>
                            {Math.round(s.pct * 100)}%
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    )
}

function ChartBlock({ title, imageData, height = 200, insight = null }) {
    if (!imageData) return null;
    return (
        <View style={s.chartBox}>
            {title && <Text style={s.chartTitle}>{title}</Text>}
            <Image src={imageData} style={{ ...s.chartImage, height }} />
            {insight && (
                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Times-Roman', fontWeight: 600, color: C.primary, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>✦ Interpretación IA</Text>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica', fontWeight: 400, color: C.textMid, lineHeight: 1.5 }}>
                        {insight}
                    </Text>
                </View>
            )}
        </View>
    );
}

/* ═══════════════════════════════════════
   MAIN DOCUMENT
   ═══════════════════════════════════════ */
export function PdfDocument({ kpis, images, dateRangeString, generatedAt, activeFiltersText, summary }) {
    return (
        <Document>
            {/* ═══ PAGE 1: COVER ═══ */}
            <Page size="A4" style={s.coverPage}>
                <Image src={bgBase64} style={s.coverBackground} />
                <View style={s.coverOverlay} />

                {/* Decorative Circles */}
                <View style={s.circle1} />
                <View style={s.circle2} />
                <View style={s.circle3} />

                <View style={s.coverInner}>
                    <Image src={logoBase64} style={{ width: 180, marginBottom: 20 }} />
                    <Text style={s.coverBrand}>San Jose Actipan Hacienda — CRM</Text>
                    <Text style={s.coverTitle}>Reporte Ejecutivo</Text>
                    <Text style={s.coverTitle}>de Leads</Text>
                    <Text style={s.coverSubtitle}>{dateRangeString}</Text>

                    <View style={s.coverStatsRow}>
                        <View style={s.coverStat}>
                            <Text style={s.coverStatValue}>{kpis.total || 0}</Text>
                            <Text style={s.coverStatLabel}>Total Leads</Text>
                        </View>
                    </View>

                    <View style={s.coverFiltersBox}>
                        <Text style={s.coverFiltersLabel}>Filtros Aplicados</Text>
                        <Text style={s.coverFiltersText}>{activeFiltersText || 'Ninguno — todos los leads incluidos'}</Text>
                    </View>
                </View>

                <View style={s.coverFooter}>
                    <Text style={s.coverFooterText}>Generado el {generatedAt}</Text>
                </View>
            </Page>



            {/* ═══ PAGE 3: RESUMEN EJECUTIVO (KPIs) ═══ */}
            <Page size="A4" style={s.page}>
                <Header dateRange={dateRangeString} />

                <Text style={s.sectionTitle}>Resumen Ejecutivo</Text>
                <Text style={s.sectionSubtitle}>Métricas clave del periodo analizado</Text>

                <View style={s.kpiGrid}>
                    <KpiCard label="Total Leads" value={kpis.total} highlight />
                    <KpiCard label="Activos" value={kpis.activos} extra={`${kpis.total ? Math.round((kpis.activos / kpis.total) * 100) : 0}% del total`} />
                    <KpiCard label="Nuevos Hoy" value={kpis.todayCount} />
                    <KpiCard label="Nuevos (7 días)" value={kpis.weekCount} />
                    <KpiCard label="Seguimientos (NO CONTESTA)" value={kpis.noContesta} warn />
                    <KpiCard label="Top Origen" value={kpis.topOrigenName} extra={`${kpis.topOrigenPct}% de los leads`} />
                    <KpiCard label="Top Vendedora" value={kpis.topVendedoraName} extra={`${kpis.topVendedoraCount} leads`} />
                    <KpiCard label="Sin Tel / Sin Fecha" value={`${kpis.pctSinTel}% / ${kpis.pctSinFecha}%`} danger />
                </View>

                {/* Insight box */}
                <View style={s.insightBox}>
                    <Text style={s.insightTitle}>Resumen Rápido</Text>
                    <Text style={s.insightText}>
                        • De los {kpis.total} leads analizados, {kpis.activos} se mantienen activos.
                    </Text>
                    <Text style={s.insightText}>
                        • La fuente principal de leads es "{kpis.topOrigenName}" representando el {kpis.topOrigenPct}% del total.
                    </Text>
                    <Text style={s.insightText}>
                        • {kpis.topVendedoraName} lidera con {kpis.topVendedoraCount} leads asignados.
                    </Text>
                </View>

                {
                    kpis.noContesta > 0 && (
                        <View style={s.alertBox}>
                            <Text style={s.alertText}>
                                ⚠ Hay {kpis.noContesta} lead(s) que llevan más de 24 horas sin respuesta. Se recomienda dar seguimiento inmediato.
                            </Text>
                        </View>
                    )
                }

                <Footer generatedAt={generatedAt} />
            </Page >

             {/* ═══ PAGE 3: TENDENCIAS ═══ */}
            <Page size="A4" style={s.page}>
                <Header dateRange={dateRangeString} />
                <Text style={s.sectionTitle}>Tendencias de Volumen</Text>
                <ChartBlock title="Leads por Día" imageData={images.leads_by_day} height={220} insight={summary?.chart_insights?.leads_by_day} />
                <Footer generatedAt={generatedAt} />
            </Page>

             {/* ═══ PAGE 4: PIPELINE ═══ */}
            <Page size="A4" style={s.page}>
                <Header dateRange={dateRangeString} />
                <Text style={s.sectionTitle}>Pipeline y Equipo</Text>
                <ChartBlock title="Leads por Fase del Embudo" imageData={images.leads_by_fase} height={220} insight={summary?.chart_insights?.leads_by_fase} />
                <Footer generatedAt={generatedAt} />
            </Page>

            {/* ═══ PAGE 5: ADQUISICIÓN ═══ */}
            <Page size="A4" style={s.page}>
                <Header dateRange={dateRangeString} />
                <Text style={s.sectionTitle}>Canales de Adquisición</Text>
                {/* Native PDF donut chart — bypass html-to-image SVG text issues */}
                <View style={[s.chartBox, { marginTop: 8 }]}>
                    <Text style={s.chartTitle}>Leads por Canal de Contacto</Text>
                    <PdfDonutChart data={kpis.canalBreakdown || []} width={360} height={280} />
                    {summary?.chart_insights?.leads_by_canal && (
                        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                            <Text style={{ fontSize: 9, fontFamily: 'Times-Roman', fontWeight: 600, color: C.primary, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>✦ Interpretación IA</Text>
                            <Text style={{ fontSize: 9, fontFamily: 'Helvetica', fontWeight: 400, color: C.textMid, lineHeight: 1.5 }}>{summary.chart_insights.leads_by_canal}</Text>
                        </View>
                    )}
                </View>
                <Footer generatedAt={generatedAt} />
            </Page>

            {/* ═══ PAGE 6: EVENTO + DATA QUALITY ═══ */}
            <Page size="A4" style={s.page}>
                <Header dateRange={dateRangeString} />
                <Text style={s.sectionTitle}>Evento y Calidad de Datos</Text>
                <ChartBlock title="Leads por Tipo de Evento" imageData={images.leads_by_evento} height={210} insight={summary?.chart_insights?.leads_by_evento} />

            </Page>




        </Document >
    );
}
