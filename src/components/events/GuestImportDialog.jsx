import { useState } from 'react'
import { UploadCloud } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { readGuestFile, processGuestRows } from '@/lib/guestImportService'

export default function GuestImportDialog({
  open,
  onOpenChange,
  eventId,
  existingGuests,
  onImportReady,
}) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleFileSelection(file) {
    if (!file) return

    setLoading(true)
    try {
      const rows = await readGuestFile(await file.arrayBuffer())
      const existingKeys = new Set(existingGuests.map((guest) => guest.dedupe_key))
      const processed = processGuestRows(rows, { eventId, existingDedupeKeys: existingKeys })

      setPreview({
        fileName: file.name,
        ...processed,
      })
    } finally {
      setLoading(false)
    }
  }

  function resetState(nextOpen) {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setPreview(null)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={resetState}>
      <DialogContent className="max-w-4xl rounded-none">
        <DialogHeader>
          <DialogTitle>Importar invitados</DialogTitle>
          <DialogDescription>
            Sube un Excel o CSV para cargar invitados por lote. Los duplicados existentes se omiten en el preview.
          </DialogDescription>
        </DialogHeader>

        {!preview && (
          <div className="rounded-none border-2 border-dashed border-border bg-secondary/30 p-12 text-center">
            <UploadCloud className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <p className="font-medium text-foreground">Arrastra un archivo o haz clic para cargarlo</p>
            <p className="mt-2 text-sm text-muted-foreground">Formatos soportados: .xlsx, .xls, .csv</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="mt-6 block w-full text-sm text-muted-foreground"
              onChange={(event) => handleFileSelection(event.target.files?.[0])}
            />
            {loading && <p className="mt-4 text-sm text-muted-foreground">Procesando archivo...</p>}
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-none border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Archivo</p>
                <p className="mt-2 font-medium text-foreground">{preview.fileName}</p>
              </div>
              <div className="rounded-none border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                <p className="text-xs uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Validos</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-700 dark:text-emerald-300">{preview.validGuests.length}</p>
              </div>
              <div className="rounded-none border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="text-xs uppercase tracking-widest text-amber-700 dark:text-amber-300">Omitidos</p>
                <p className="mt-2 text-3xl font-semibold text-amber-700 dark:text-amber-300">
                  {preview.invalidRows.length + preview.duplicateRows.length}
                </p>
              </div>
            </div>

            <div className="max-h-80 overflow-auto rounded-none border border-border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-secondary">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Contacto</th>
                    <th className="px-3 py-2">Grupo</th>
                    <th className="px-3 py-2">Mesa</th>
                    <th className="px-3 py-2">Etiquetas</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.validGuests.slice(0, 20).map((guest) => (
                    <tr key={guest.dedupe_key} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">{guest.full_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{guest.phone || guest.email || 'Sin contacto'}</td>
                      <td className="px-3 py-2">{guest.guest_group || 'Sin grupo'}</td>
                      <td className="px-3 py-2">{guest.table_name || 'Sin mesa'}</td>
                      <td className="px-3 py-2">{guest.tags.join(', ') || 'Sin tags'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={() => resetState(false)}>
            Cancelar
          </Button>
          {preview && (
            <Button
              className="rounded-none"
              onClick={() => {
                onImportReady?.(preview.validGuests)
                resetState(false)
              }}
              disabled={!preview.validGuests.length}
            >
              Importar {preview.validGuests.length} invitados
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
