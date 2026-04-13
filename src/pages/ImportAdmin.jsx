import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { readExcelFile, processExcelToLeads, batchInsertLeadsDB } from '@/lib/importService'

export default function ImportAdmin() {
    const navigate = useNavigate()
    const [file, setFile] = useState(null)
    const [step, setStep] = useState('upload')
    const [error, setError] = useState(null)
    const [leads, setLeads] = useState([])
    const [invalidRows, setInvalidRows] = useState([])
    const [results, setResults] = useState(null)
    const [importProgress, setImportProgress] = useState({
        processed: 0,
        total: 0,
        inserted: 0,
        skipped: 0,
        currentBatch: 0,
        totalBatches: 0,
    })

    const handleFileChange = async (e) => {
        const nextFile = e.target.files[0]
        if (!nextFile) return

        try {
            setFile(nextFile)
            setStep('preview')

            const buffer = await nextFile.arrayBuffer()
            const excelRows = await readExcelFile(buffer)
            const processed = processExcelToLeads(excelRows)

            setLeads(processed.validLeads)
            setInvalidRows(processed.invalidRows)
        } catch (err) {
            console.error('Error procesando Excel:', err)
            setError(err.message)
            setStep('error')
        }
    }

    const handleImport = async () => {
        if (!leads.length) return

        setStep('importing')
        setImportProgress({
            processed: 0,
            total: leads.length,
            inserted: 0,
            skipped: 0,
            currentBatch: 0,
            totalBatches: Math.ceil(leads.length / 200),
        })
        try {
            const result = await batchInsertLeadsDB(leads, 200, setImportProgress)
            setResults(result)
            setStep('done')
        } catch (err) {
            setError(err.message)
            setStep('error')
        }
    }

    const handleReset = () => {
        setFile(null)
        setLeads([])
        setInvalidRows([])
        setResults(null)
        setImportProgress({
            processed: 0,
            total: 0,
            inserted: 0,
            skipped: 0,
            currentBatch: 0,
            totalBatches: 0,
        })
        setError(null)
        setStep('upload')
    }

    const progressPercent = importProgress.total
        ? Math.round((importProgress.processed / importProgress.total) * 100)
        : 0
    const remainingLeads = Math.max(importProgress.total - importProgress.processed, 0)

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12 mt-4 px-4 overflow-y-auto w-full">
            <div className="flex items-start gap-4 mb-2">
                <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="mt-1 shrink-0 rounded-none text-muted-foreground hover:text-foreground hover:bg-secondary">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="font-heading text-2xl tracking-wider text-foreground mb-2">IMPORTAR LEADS (BODAS.COM)</h1>
                    <p className="text-muted-foreground text-sm">Sube un archivo Excel (.xlsx) con los nuevos leads. El sistema normalizara canales/eventos y omitira leads duplicados mediante `dedupe_key`.</p>
                </div>
            </div>

            {step === 'error' && (
                <div className="p-6 bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500 rounded-none mb-6">
                    <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-2">
                        <AlertCircle className="w-5 h-5" />
                        <h2 className="text-sm font-bold uppercase tracking-widest">Error durante la importacion</h2>
                    </div>
                    <p className="text-red-700 dark:text-red-300 text-sm mb-4">{error}</p>
                    <Button variant="outline" onClick={handleReset} className="rounded-none border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50">Intentar de nuevo</Button>
                </div>
            )}

            {step === 'done' && results && (
                <Card className="rounded-none border-border bg-card shadow-sm mt-6">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-6" />
                        <h2 className="font-heading text-2xl tracking-wider text-card-foreground mb-2">IMPORTACION EXITOSA</h2>
                        <p className="text-muted-foreground mb-8">El archivo ha sido procesado e integrado a Supabase.</p>

                        <div className="grid grid-cols-3 gap-6 w-full max-w-2xl mb-8">
                            <div className="bg-secondary/40 p-6 border border-transparent hover:border-border transition-colors">
                                <div className="font-numbers text-4xl tabular-nums text-foreground mb-1">{results.totalAttemped}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Filas procesadas</div>
                            </div>
                            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border-l-4 border-emerald-500 p-6">
                                <div className="font-numbers text-4xl tabular-nums text-emerald-600 dark:text-emerald-400 mb-1">{results.totalInserted}</div>
                                <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">Insertados (nuevos)</div>
                            </div>
                            <div className="bg-amber-50/50 dark:bg-amber-950/20 border-l-4 border-amber-500 p-6">
                                <div className="font-numbers text-4xl tabular-nums text-amber-600 dark:text-amber-400 mb-1">{results.totalSkipped}</div>
                                <div className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-widest mt-1">Optimizados (duplicados)</div>
                            </div>
                        </div>

                        <Button onClick={handleReset} variant="outline" className="rounded-none border-foreground text-xs uppercase tracking-widest hover:bg-secondary">
                            Importar otro archivo
                        </Button>
                    </CardContent>
                </Card>
            )}

            {(step === 'upload' || (step === 'preview' && !leads.length && !invalidRows.length)) && (
                <Card className="rounded-none border-border bg-card shadow-sm mt-6">
                    <CardContent className="pt-6 pb-6">
                        <div className="border-2 border-dashed border-border p-16 text-center bg-secondary/30 hover:bg-secondary/70 transition-colors relative cursor-pointer group">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <UploadCloud className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4 group-hover:text-muted-foreground transition-colors" />
                            <h3 className="font-heading text-lg tracking-wider text-card-foreground mb-1">ARRASTRA TU EXCEL AQUI</h3>
                            <p className="text-muted-foreground text-xs uppercase tracking-widest mt-2">o haz clic para buscarlo en tu equipo</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 'preview' && (leads.length > 0 || invalidRows.length > 0) && (
                <div className="space-y-6 mt-6">
                    <Card className="rounded-none border-border bg-card shadow-sm">
                        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 gap-6">
                            <div className="flex flex-col">
                                <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Archivo preparado</span>
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                                    <span className="font-medium text-foreground">{file?.name}</span>
                                </div>
                            </div>

                            <div className="flex gap-6 border-l border-border pl-6">
                                <div className="text-center pr-6 border-r border-border">
                                    <div className="font-numbers text-3xl tabular-nums text-foreground">{leads.length}</div>
                                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-1">Filas validas</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-numbers text-3xl tabular-nums text-red-500 dark:text-red-400">{invalidRows.length}</div>
                                    <div className="text-[10px] font-medium text-red-400 uppercase tracking-widest mt-1">Invalidas</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 sm:pl-6 sm:border-l border-border w-full sm:w-auto">
                                <Button variant="ghost" onClick={handleReset} className="w-full sm:w-auto rounded-none text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleImport}
                                    disabled={leads.length === 0}
                                    className="w-full sm:w-auto rounded-none bg-emerald-600 text-white hover:bg-emerald-700 text-xs uppercase tracking-widest disabled:opacity-50 transition-colors"
                                >
                                    Importar leads
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {invalidRows.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl overflow-hidden">
                            <div className="bg-red-100 dark:bg-red-900/30 px-6 py-3 border-b border-red-200 dark:border-red-800">
                                <h3 className="font-bold text-red-800 dark:text-red-400 flex items-center gap-2"><XCircle className="w-4 h-4" /> Filas invalidas (seran omitidas)</h3>
                            </div>
                            <div className="p-4 overflow-x-auto">
                                <table className="w-full text-sm text-left text-red-900 dark:text-red-200">
                                    <thead>
                                        <tr className="border-b border-red-200/50 dark:border-red-800/50">
                                            <th className="py-2 opacity-70">Fila Excel</th>
                                            <th className="py-2 opacity-70">Razon</th>
                                            <th className="py-2 opacity-70">Datos originales</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invalidRows.map((row, i) => (
                                            <tr key={i} className="border-b border-red-100 dark:border-red-800/30 last:border-0">
                                                <td className="py-2 font-mono">#{row._index + 2}</td>
                                                <td className="py-2 font-bold">{row._error}</td>
                                                <td className="py-2 opacity-70 truncate max-w-xs">{JSON.stringify(row)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <Card className="rounded-none border-border bg-card shadow-sm flex flex-col h-[500px]">
                        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
                            <CardTitle className="font-heading text-lg tracking-wider text-card-foreground">VISTA PREVIA</CardTitle>
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-2 py-1 bg-secondary/30">Muestra de max. 50 filas</span>
                        </CardHeader>
                        <CardContent className="overflow-auto flex-1 p-0">
                            <table className="w-full text-left">
                                <thead className="bg-secondary/50 sticky top-0 z-10 border-b border-border">
                                    <tr>
                                        {['Nombre', 'Contactos', 'Evento IA', 'Canal IA', 'Dedupe Key'].map((header) => (
                                            <th key={header} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {leads.slice(0, 50).map((lead, index) => (
                                        <tr key={index} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                                            <td className="px-4 py-3 text-sm font-medium text-foreground">{lead.nombre}</td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-foreground">{lead.telefono}</div>
                                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Reg: {lead.fecha_primer_mensaje}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="inline-flex py-1 px-2 text-[10px] rounded-full uppercase tracking-widest font-medium bg-indigo-100/50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                                                    {lead.evento_normalizado}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1">Orig: {lead.evento || 'N/A'}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="inline-flex py-1 px-2 text-[10px] rounded-full uppercase tracking-widest font-medium bg-blue-100/50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                                                    {lead.canal_normalizado}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1">Regla: {lead.canal_razon}</div>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground opacity-50">
                                                {lead.dedupe_key.slice(0, 8)}...
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {leads.length === 0 && (
                                <div className="p-8 text-center text-muted-foreground uppercase tracking-widest text-xs">Ninguna fila valida para mostrar.</div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {step === 'importing' && (
                <Card className="rounded-none border-border bg-card shadow-sm mt-6">
                    <CardContent className="flex flex-col items-center justify-center p-16 text-center">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
                            <RefreshCw className="relative w-12 h-12 text-blue-500 animate-spin mx-auto" />
                        </div>
                        <h3 className="font-heading text-xl tracking-wider text-card-foreground mb-2">IMPORTANDO LEADS A SUPABASE...</h3>
                        <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-8">Insertando de manera segmentada e ignorando duplicados por hash seguro. Esto puede demorar si el archivo es grande.</p>

                        <div className="w-full max-w-xl space-y-5">
                            <div className="flex items-end justify-between gap-4 text-left">
                                <div>
                                    <p className="font-numbers text-4xl tabular-nums text-foreground">
                                        {importProgress.processed}
                                        <span className="text-muted-foreground"> / {importProgress.total}</span>
                                    </p>
                                    <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                                        leads procesados
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-numbers text-3xl tabular-nums text-blue-600 dark:text-blue-400">{progressPercent}%</p>
                                    <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                                        {remainingLeads} pendientes
                                    </p>
                                </div>
                            </div>

                            <div className="h-3 overflow-hidden rounded-none bg-secondary">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-500 ease-out"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-xs uppercase tracking-widest">
                                <div className="border border-border bg-secondary/30 px-4 py-3">
                                    <p className="font-numbers text-lg tabular-nums text-foreground">{importProgress.currentBatch}</p>
                                    <p className="text-muted-foreground">lote actual</p>
                                </div>
                                <div className="border border-border bg-secondary/30 px-4 py-3">
                                    <p className="font-numbers text-lg tabular-nums text-foreground">{importProgress.totalBatches}</p>
                                    <p className="text-muted-foreground">lotes totales</p>
                                </div>
                                <div className="border border-border bg-secondary/30 px-4 py-3">
                                    <p className="font-numbers text-lg tabular-nums text-emerald-600 dark:text-emerald-400">{importProgress.inserted}</p>
                                    <p className="text-muted-foreground">nuevos</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
