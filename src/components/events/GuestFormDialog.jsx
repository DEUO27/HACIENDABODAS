import { useMemo, useState } from 'react'

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
import { buildGuestDedupeKey, parseTagsInput } from '@/lib/eventModuleUtils'

const defaultState = {
  full_name: '',
  phone: '',
  email: '',
  guest_group: '',
  table_name: '',
  tags: '',
  attendance_status: 'pending',
  delivery_status: 'draft',
  plus_ones_allowed: 0,
  notes: '',
}

export default function GuestFormDialog({
  open,
  onOpenChange,
  initialValue = null,
  onSubmit,
  saving = false,
}) {
  const [form, setForm] = useState(() => (initialValue ? {
    full_name: initialValue.full_name || '',
    phone: initialValue.phone || '',
    email: initialValue.email || '',
    guest_group: initialValue.guest_group || '',
    table_name: initialValue.table_name || '',
    tags: (initialValue.tags || []).join(', '),
    attendance_status: initialValue.attendance_status || 'pending',
    delivery_status: initialValue.delivery_status || 'draft',
    plus_ones_allowed: initialValue.plus_ones_allowed || 0,
    notes: initialValue.notes || '',
  } : defaultState))

  const dedupePreview = useMemo(() => {
    return buildGuestDedupeKey({
      fullName: form.full_name,
      phone: form.phone,
      email: form.email,
    })
  }, [form.email, form.full_name, form.phone])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-none">
        <DialogHeader>
          <DialogTitle>{initialValue ? 'Editar invitado' : 'Nuevo invitado'}</DialogTitle>
          <DialogDescription>
            Gestiona los datos del invitado, su segmentacion y el estado operativo dentro del evento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Nombre completo</span>
            <Input value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Telefono</span>
            <Input
              type="tel"
              inputMode="tel"
              placeholder="+52 81 2764 7007"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Email</span>
            <Input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Grupo</span>
            <Input value={form.guest_group} onChange={(event) => setForm((current) => ({ ...current, guest_group: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Mesa</span>
            <Input value={form.table_name} onChange={(event) => setForm((current) => ({ ...current, table_name: event.target.value }))} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Etiquetas</span>
            <Input
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              placeholder="VIP, familia, staff"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">RSVP</span>
            <select
              value={form.attendance_status}
              onChange={(event) => setForm((current) => ({ ...current, attendance_status: event.target.value }))}
              className="h-9 w-full rounded-none border border-border bg-background px-3 text-sm"
            >
              <option value="pending">Pendiente</option>
              <option value="confirmed">Confirmado</option>
              <option value="declined">Rechazado</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Envio</span>
            <select
              value={form.delivery_status}
              onChange={(event) => setForm((current) => ({ ...current, delivery_status: event.target.value }))}
              className="h-9 w-full rounded-none border border-border bg-background px-3 text-sm"
            >
              <option value="draft">Borrador</option>
              <option value="queued">En cola</option>
              <option value="scheduled">Programado</option>
              <option value="sent">Enviado</option>
              <option value="failed">Fallido</option>
              <option value="canceled">Cancelado</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Acompanantes permitidos</span>
            <Input
              type="number"
              min="0"
              value={form.plus_ones_allowed}
              onChange={(event) => setForm((current) => ({ ...current, plus_ones_allowed: event.target.value }))}
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Notas</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="min-h-24 w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>
          <div className="md:col-span-2 rounded-none border border-dashed border-border bg-secondary/30 px-3 py-2">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Dedupe key</p>
            <p className="mt-1 break-all font-mono text-xs text-foreground">{dedupePreview}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            className="rounded-none"
            onClick={() => onSubmit?.({ ...form, tags: parseTagsInput(form.tags) })}
            disabled={saving || !form.full_name.trim()}
          >
            {saving ? 'Guardando...' : initialValue ? 'Guardar cambios' : 'Crear invitado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
