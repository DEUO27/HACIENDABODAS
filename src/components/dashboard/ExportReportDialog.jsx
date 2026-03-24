import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Loader2, Download, CheckCircle2, AlertTriangle, FileText, Sparkles, BarChart3, FileDown, Database } from 'lucide-react'
import { captureCharts, prepareKpiData } from '@/lib/exportUtils'
import { buildAIPayload, fetchAISummary } from '@/lib/aiSummaryService'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { pdf } from '@react-pdf/renderer'
import { PdfDocument } from '@/lib/pdfReportGenerator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const STEPS = [
    { key: 'preparing', label: 'Preparando informacion', icon: Database },
    { key: 'capturing', label: 'Capturando graficas', icon: BarChart3 },
    { key: 'ai-summary', label: 'Generando resumen IA', icon: Sparkles },
    { key: 'building', label: 'Armando PDF', icon: FileText },
    { key: 'downloading', label: 'Descargando archivo', icon: FileDown },
]

export default function ExportReportDialog({
    open,
    onOpenChange,
    filteredLeads,
    allLeadsCount,
    activeFiltersState
}) {
    const [isGenerating, setIsGenerating] = useState(false)
    const [step, setStep] = useState('idle')
    const [errorMsg, setErrorMsg] = useState(null)
    const [aiFallback, setAiFallback] = useState(false)
    const [aiProvider, setAiProvider] = useState('gemini')

    const handleExport = async () => {
        setIsGenerating(true)
        setErrorMsg(null)
        setAiFallback(false)

        try {
            // STEP 1: Prepare KPIs and Data
            setStep('preparing')
            const kpis = prepareKpiData(filteredLeads)

            // Format dates
            const now = new Date()
            const generatedAt = format(now, "dd/MM/yyyy HH:mm:ss")
            const dateRangeString = activeFiltersState.dateRange === 'all'
                ? 'Rango: Todo el historial'
                : `Rango: ${activeFiltersState.dateRange}`

            // Stringify filters
            const filtersList = []
            if (activeFiltersState.search) filtersList.push(`Busqueda: "${activeFiltersState.search}"`)
            if (activeFiltersState.vendedoras.length) filtersList.push(`Vendedoras: ${activeFiltersState.vendedoras.join(', ')}`)
            if (activeFiltersState.fases.length) filtersList.push(`Fases: ${activeFiltersState.fases.join(', ')}`)
            if (activeFiltersState.canales.length) filtersList.push(`Canales: ${activeFiltersState.canales.join(', ')}`)
            if (activeFiltersState.solo24h) filtersList.push('+24Hrs Sin Respuesta')
            const activeFiltersText = filtersList.length > 0 ? filtersList.join(' | ') : 'Todos los leads (Sin filtros aplicados)'

            await new Promise(r => setTimeout(r, 300))

            // STEP 2: Capture DOM charts FIRST (fast, needs user to be on the page)
            setStep('capturing')
            const images = await captureCharts()

            if (Object.keys(images).length === 0) {
                console.warn("No charts were captured. Proceeding without charts.")
            }

            await new Promise(r => setTimeout(r, 300))

            // STEP 3: Call Gemini AI for summary (slow network request)
            setStep('ai-summary')
            let summary = { chart_insights: {} }

            try {
                const payloadBuilder = buildAIPayload(filteredLeads, kpis, dateRangeString)
                const payload = { ...payloadBuilder, provider: aiProvider }
                const aiResult = await fetchAISummary(payload)

                console.log('[PDF Export] AI chart_insights received:', aiResult.chart_insights)

                summary = {
                    chart_insights: aiResult.chart_insights || {},
                }
                console.log('[PDF Export] AI summary generated successfully:', aiResult.model)
            } catch (aiError) {
                console.warn('[PDF Export] AI summary failed, proceeding without chart insights:', aiError)
                summary = { chart_insights: {} }
                setAiFallback(true)
            }

            await new Promise(r => setTimeout(r, 300))

            // STEP 4: Build PDF Document
            setStep('building')
            const blob = await pdf(
                <PdfDocument
                    kpis={kpis}
                    images={images}
                    dateRangeString={dateRangeString}
                    generatedAt={generatedAt}
                    activeFiltersText={activeFiltersText}
                    summary={summary}
                />
            ).toBlob()

            // STEP 5: Download
            setStep('downloading')
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Reporte_Leads_${format(now, 'yyyyMMdd')}.pdf`
            document.body.appendChild(a)
            a.click()
            URL.revokeObjectURL(url)
            document.body.removeChild(a)

            setStep('done')
            setTimeout(() => {
                onOpenChange(false)
                setStep('idle')
                setIsGenerating(false)
                setAiFallback(false)
            }, 2500)

        } catch (error) {
            console.error(error)
            setErrorMsg(error.message || "Un error desconocido ha ocurrido.")
            setStep('error')
            setIsGenerating(false)
        }
    }

    const currentStepIndex = STEPS.findIndex(s => s.key === step)

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!isGenerating) onOpenChange(val)
        }}>
            <DialogContent className="sm:max-w-[460px] rounded-none border-border bg-card">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-heading text-2xl tracking-wider text-slate-900 dark:text-slate-100">
                        <FileText className="h-6 w-6 text-primary" />
                        Exportar Reporte Ejecutivo
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 dark:text-slate-400">
                        Generar un PDF ejecutivo con analisis IA, graficas y datos ({filteredLeads.length} leads).
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {step === 'idle' || step === 'error' ? (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Motor de Inteligencia Artificial</Label>
                                <Select value={aiProvider} onValueChange={setAiProvider}>
                                    <SelectTrigger className="w-full rounded-none border-border bg-card text-foreground">
                                        <SelectValue placeholder="Selecciona motor IA" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-none border-border bg-card text-foreground">
                                        <SelectItem value="gemini" className="focus:bg-secondary">Google Gemini 3 Flash</SelectItem>
                                        <SelectItem value="openai" className="focus:bg-secondary">OpenAI GPT-4o-mini</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* AI info badge */}
                            <div className="rounded-none bg-primary/5 p-3 flex items-start gap-2 border border-primary/20">
                                <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-heading tracking-widest text-foreground uppercase">Resumen con IA</p>
                                    <p className="text-xs text-muted-foreground mt-1">El reporte incluira insights ejecutivos usando {aiProvider === 'openai' ? 'OpenAI GPT-4o-mini' : 'Google Gemini 3 Flash'}.</p>
                                </div>
                            </div>

                            {step === 'error' && (
                                <div className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 flex items-start gap-2 border border-red-200 dark:border-red-800/50">
                                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">Error en la generacion</p>
                                        <p className="text-xs text-red-600 dark:text-red-400">{errorMsg}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : step === 'done' ? (
                        <div className="flex flex-col items-center justify-center space-y-3 py-6">
                            <CheckCircle2 className="h-12 w-12 text-primary animate-in zoom-in" />
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Reporte generado correctamente
                            </p>
                            {aiFallback && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-full">
                                    Resumen generado sin IA (modo fallback)
                                </p>
                            )}
                        </div>
                    ) : (
                        /* Progress Steps */
                        <div className="space-y-2.5 py-2">
                            {STEPS.map((s, i) => {
                                const isActive = s.key === step
                                const isDone = currentStepIndex > i
                                const isPending = currentStepIndex < i
                                const Icon = s.icon

                                return (
                                    <div key={s.key} className={`flex items-center gap-3 px-3 py-2 rounded-none transition-all ${isActive ? 'bg-primary/5 border border-primary/20' :
                                        isDone ? 'bg-secondary' :
                                            'opacity-40'
                                        }`}>
                                        {isDone ? (
                                            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                                        ) : isActive ? (
                                            <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
                                        ) : (
                                            <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        )}
                                        <span className={`text-sm tracking-wide ${isActive ? 'font-medium text-foreground' :
                                            isDone ? 'text-muted-foreground' :
                                                'text-muted-foreground'
                                            }`}>
                                            {s.label}
                                        </span>
                                    </div>
                                )
                            })}

                            {aiFallback && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg mt-2">
                                    IA no disponible - usando resumen automatico
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {step === 'idle' || step === 'error' ? (
                        <>
                            <Button variant="outline" className="rounded-none border-border text-muted-foreground hover:bg-secondary uppercase tracking-widest text-xs" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 uppercase tracking-widest text-xs" onClick={handleExport}>
                                <Sparkles className="mr-2 h-4 w-4" /> Generar Reporte PDF
                            </Button>
                        </>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog >
    )
}

