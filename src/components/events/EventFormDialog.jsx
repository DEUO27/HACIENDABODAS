import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const defaultState = {
  name: '',
  event_date: '',
  venue: '',
  timezone: 'America/Mexico_City',
  status: 'draft',
  notes: '',
}

export default function EventFormDialog({
  open,
  onOpenChange,
  initialValue = null,
  onSubmit,
  saving = false,
}) {
  const [form, setForm] = useState(() => (initialValue ? {
    name: initialValue.name || '',
    event_date: initialValue.event_date || '',
    venue: initialValue.venue || '',
    timezone: initialValue.timezone || 'America/Mexico_City',
    status: initialValue.status || 'draft',
    notes: initialValue.notes || '',
  } : defaultState))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-none">
        <DialogHeader>
          <DialogTitle>{initialValue ? 'Editar evento' : 'Nuevo evento'}</DialogTitle>
          <DialogDescription>
            Configura la base del evento operativo antes de cargar invitados o habilitar RSVP.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <label className="space-y-2 sm:col-span-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Nombre</span>
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Fecha</span>
            <Input type="date" value={form.event_date} onChange={(event) => setForm((current) => ({ ...current, event_date: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Estatus</span>
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              className="h-9 w-full rounded-none border border-border bg-background px-3 text-sm"
            >
              <option value="draft">Borrador</option>
              <option value="active">Activo</option>
              <option value="archived">Archivado</option>
            </select>
          </label>
          <label className="space-y-2 sm:col-span-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Sede</span>
            <Input value={form.venue} onChange={(event) => setForm((current) => ({ ...current, venue: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Timezone</span>
            <Input value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))} />
          </label>
          <label className="space-y-2 sm:col-span-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Notas</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="min-h-24 w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            className="rounded-none"
            onClick={() => onSubmit?.(form)}
            disabled={saving || !form.name.trim()}
          >
            {saving ? 'Guardando...' : initialValue ? 'Guardar cambios' : 'Crear evento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
