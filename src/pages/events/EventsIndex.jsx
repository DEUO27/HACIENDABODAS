import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CalendarDays, MapPin, Plus, Pencil, Trash2 } from 'lucide-react'

import EventFormDialog from '@/components/events/EventFormDialog'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatEventDate } from '@/lib/eventModuleUtils'
import { createEvent, deleteEvent, listEvents, updateEvent } from '@/lib/eventService'

export default function EventsIndex() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      setEvents(await listEvents())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  if (role === 'esposos' && !loading) {
    const homeEvent = events[0]
    return <Navigate to={homeEvent ? `/eventos/${homeEvent.id}/dashboard` : '/unauthorized'} replace />
  }

  async function handleSubmit(payload) {
    setSaving(true)
    setErrorMessage('')
    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, payload)
      } else {
        const created = await createEvent(payload)
        navigate(`/eventos/${created.id}/dashboard`)
        return
      }

      await loadEvents()
      setDialogOpen(false)
      setEditingEvent(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEvent() {
    if (!deleteTarget) return

    setDeleteSaving(true)
    setErrorMessage('')

    try {
      await deleteEvent(deleteTarget.id)
      setDeleteTarget(null)
      await loadEvents()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible eliminar el evento.')
    } finally {
      setDeleteSaving(false)
    }
  }

  return (
    <div className="space-y-8 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.3em]">
            Eventos
          </Badge>
          <div>
            <h2 className="font-heading text-4xl text-foreground">Operacion del evento</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Administra eventos multi-sede, invitados, RSVP y envios desde un modulo separado del CRM de leads.
            </p>
          </div>
        </div>
        <Button
          className="rounded-none"
          onClick={() => {
            setEditingEvent(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo evento
        </Button>
      </div>

      {errorMessage && (
        <div className="rounded-none border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="rounded-none border-border bg-card shadow-sm">
              <CardContent className="space-y-3 p-6">
                <div className="h-6 w-40 animate-pulse bg-secondary/60" />
                <div className="h-4 w-32 animate-pulse bg-secondary/40" />
                <div className="h-16 animate-pulse bg-secondary/30" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="rounded-none border-border bg-card shadow-sm">
              <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">{event.name}</CardTitle>
                    <p className="mt-2 text-sm text-muted-foreground">{event.notes || 'Sin notas operativas registradas.'}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`rounded-full px-3 py-1 uppercase tracking-[0.2em] ${
                      event.status === 'active'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : event.status === 'archived'
                          ? 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                          : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                    }`}
                  >
                    {event.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>{formatEventDate(event.event_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{event.venue || 'Sin sede definida'}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="rounded-none">
                    <Link to={`/eventos/${event.id}/dashboard`}>Abrir dashboard</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-none">
                    <Link to={`/eventos/${event.id}/invitados`}>Guest list</Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-none"
                    onClick={() => {
                      setEditingEvent(event)
                      setDialogOpen(true)
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  {role === 'admin' && (
                    <Button
                      variant="outline"
                      className="rounded-none border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/20"
                      onClick={() => setDeleteTarget(event)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {!events.length && (
            <Card className="rounded-none border-dashed border-border bg-card shadow-sm md:col-span-2 xl:col-span-3">
              <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <p className="font-heading text-2xl text-foreground">Aun no hay eventos configurados</p>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Crea el primer evento para habilitar invitados, links RSVP y envios desde este modulo.
                </p>
                <Button className="rounded-none" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primer evento
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <EventFormDialog
        key={`${editingEvent?.id || 'new'}-${dialogOpen ? 'open' : 'closed'}`}
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) setEditingEvent(null)
        }}
        initialValue={editingEvent}
        onSubmit={handleSubmit}
        saving={saving}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
        if (!open && !deleteSaving) setDeleteTarget(null)
      }}>
        <DialogContent className="max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle>Eliminar evento</DialogTitle>
            <DialogDescription>
              Esta accion eliminara el evento y sus datos relacionados, incluyendo invitados, respuestas RSVP y configuraciones del evento. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="space-y-2 border border-border p-4 text-sm">
              <p className="font-medium text-foreground">{deleteTarget.name}</p>
              <p className="text-muted-foreground">{formatEventDate(deleteTarget.event_date)}</p>
              <p className="text-muted-foreground">{deleteTarget.venue || 'Sin sede definida'}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={deleteSaving}
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-none"
              disabled={deleteSaving}
              onClick={handleDeleteEvent}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleteSaving ? 'Eliminando...' : 'Eliminar evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
