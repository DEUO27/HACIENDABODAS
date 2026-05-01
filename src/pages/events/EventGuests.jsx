import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Link2, Mail, Pencil, Plus, Trash2, UploadCloud } from 'lucide-react'

import EventShellHeader from '@/components/events/EventShellHeader'
import GuestFormDialog from '@/components/events/GuestFormDialog'
import GuestImportDialog from '@/components/events/GuestImportDialog'
import { AttendancePill, DeliveryPill } from '@/components/events/StatusPill'
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
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useEvent } from '@/contexts/EventContext'
import { exportGuestsSpreadsheet, formatDateTime, getGuestCompanionCounts, getPublicAppUrl } from '@/lib/eventModuleUtils'
import {
  deleteGuest,
  importGuests,
  issueRsvpToken,
  listGuests,
  upsertGuest,
} from '@/lib/eventService'
import { supabase } from '@/lib/supabase'

const emptyFilters = {
  search: '',
  attendance: 'all',
  delivery: 'all',
  group: 'all',
  table: 'all',
  tag: 'all',
}

export default function EventGuests() {
  const { events, event, eventId } = useEvent()
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(emptyFilters)
  const [currentPage, setCurrentPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [generatingLinkGuestId, setGeneratingLinkGuestId] = useState(null)
  const [linkPreview, setLinkPreview] = useState({
    open: false,
    guest: null,
    url: '',
    copied: false,
  })

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      setGuests(await listGuests(eventId))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible cargar invitados.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    loadData()
  }, [eventId, loadData])

  useEffect(() => {
    if (!eventId) return undefined

    const channel = supabase
      .channel(`event-guests-${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'guests',
        filter: `event_id=eq.${eventId}`,
      }, () => loadData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, loadData])

  const optionSets = useMemo(() => {
    return {
      groups: [...new Set(guests.map((guest) => guest.guest_group).filter(Boolean))].sort(),
      tables: [...new Set(guests.map((guest) => guest.table_name).filter(Boolean))].sort(),
      tags: [...new Set(guests.flatMap((guest) => guest.tags || []).filter(Boolean))].sort(),
    }
  }, [guests])

  const filteredGuests = useMemo(() => {
    return guests.filter((guest) => {
      const searchNeedle = filters.search.trim().toLowerCase()

      if (searchNeedle) {
        const haystack = [
          guest.full_name,
          guest.phone,
          guest.email,
          guest.guest_group,
          guest.table_name,
          ...(guest.tags || []),
        ].join(' ').toLowerCase()

        if (!haystack.includes(searchNeedle)) return false
      }

      if (filters.attendance !== 'all' && guest.attendance_status !== filters.attendance) return false
      if (filters.delivery !== 'all' && guest.delivery_status !== filters.delivery) return false
      if (filters.group !== 'all' && guest.guest_group !== filters.group) return false
      if (filters.table !== 'all' && guest.table_name !== filters.table) return false
      if (filters.tag !== 'all' && !(guest.tags || []).includes(filters.tag)) return false

      return true
    })
  }, [filters, guests])

  const PAGE_SIZE = 50
  const totalPages = Math.ceil(filteredGuests.length / PAGE_SIZE)
  const paginatedGuests = filteredGuests.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  async function handleGuestSubmit(payload) {
    setSaving(true)
    setErrorMessage('')

    try {
      await upsertGuest(eventId, payload, editingGuest?.id)
      setDialogOpen(false)
      setEditingGuest(null)
      setNotice(editingGuest ? 'Invitado actualizado.' : 'Invitado creado.')
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible guardar el invitado.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteGuest(guest) {
    const confirmed = window.confirm(`Eliminar a ${guest.full_name}? Esta accion no se puede deshacer.`)
    if (!confirmed) return

    try {
      await deleteGuest(guest.id)
      setNotice('Invitado eliminado.')
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible eliminar el invitado.')
    }
  }

  async function handleGenerateLink(guest) {
    try {
      setGeneratingLinkGuestId(guest.id)
      setErrorMessage('')
      const publicAppUrl = getPublicAppUrl(window.location.origin)

      if (!publicAppUrl) {
        setErrorMessage('Configura VITE_PUBLIC_APP_URL para generar links RSVP publicos fuera de localhost.')
        return
      }

      const result = await issueRsvpToken({
        guestId: guest.id,
        eventId,
        baseUrl: publicAppUrl,
      })

      let copied = false

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(result.url)
          copied = true
        } catch {
          copied = false
        }
      }

      setLinkPreview({
        open: true,
        guest,
        url: result.url,
        copied,
      })
      setNotice(copied ? `Link RSVP listo para ${guest.full_name}.` : `Link RSVP generado para ${guest.full_name}.`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible generar el link RSVP.')
    } finally {
      setGeneratingLinkGuestId(null)
    }
  }

  async function handleCopyPreviewLink() {
    if (!linkPreview.url) return

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(linkPreview.url)
      }

      setLinkPreview((current) => ({ ...current, copied: true }))
      setNotice('Link RSVP copiado.')
    } catch {
      setErrorMessage('No fue posible copiar el link RSVP.')
    }
  }

  async function handleImportReady(rows) {
    try {
      const result = await importGuests(rows)
      setNotice(`Importacion completada. Insertados: ${result.inserted}.`)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible importar invitados.')
    }
  }

  return (
    <div className="space-y-6 py-6">
      <EventShellHeader
        events={events}
        currentEvent={event}
        activeTab="invitados"
        actions={(
          <>
            <Button variant="outline" className="rounded-none" onClick={() => setImportOpen(true)}>
              <UploadCloud className="mr-2 h-4 w-4" />
              Importar
            </Button>
            <Button
              className="rounded-none"
              onClick={() => {
                setEditingGuest(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo invitado
            </Button>
          </>
        )}
      />

      {notice && (
        <div className="rounded-none border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-none border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      <Card className="rounded-none border-border bg-card shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Guest List</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Carga, organiza y consulta la lista maestra del evento con filtros operativos y acceso a links RSVP.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => exportGuestsSpreadsheet({ guests: filteredGuests, eventName: event?.name, format: 'csv' })}
              disabled={!filteredGuests.length}
            >
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => exportGuestsSpreadsheet({ guests: filteredGuests, eventName: event?.name, format: 'xlsx' })}
              disabled={!filteredGuests.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button asChild variant="outline" className="rounded-none">
              <Link to={`/eventos/${eventId}/envios`}>
                <Mail className="mr-2 h-4 w-4" />
                Ir a envios
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-6">
            <Input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Buscar por nombre, tel, email..."
              className="rounded-none md:col-span-2"
            />
            <select
              value={filters.attendance}
              onChange={(event) => setFilters((current) => ({ ...current, attendance: event.target.value }))}
              className="h-9 rounded-none border border-border bg-background px-3 text-sm"
            >
              <option value="all">RSVP: todos</option>
              <option value="pending">Pendientes</option>
              <option value="confirmed">Confirmados</option>
              <option value="declined">Rechazados</option>
            </select>
            <select
              value={filters.delivery}
              onChange={(event) => setFilters((current) => ({ ...current, delivery: event.target.value }))}
              className="h-9 rounded-none border border-border bg-background px-3 text-sm"
            >
              <option value="all">Envio: todos</option>
              <option value="draft">Borrador</option>
              <option value="scheduled">Programado</option>
              <option value="accepted">Aceptado por WhatsApp</option>
              <option value="sent">Enviado</option>
              <option value="delivered">Entregado</option>
              <option value="read">Leido</option>
              <option value="failed">Fallido</option>
            </select>
            <select
              value={filters.group}
              onChange={(event) => setFilters((current) => ({ ...current, group: event.target.value }))}
              className="h-9 rounded-none border border-border bg-background px-3 text-sm"
            >
              <option value="all">Grupo: todos</option>
              {optionSets.groups.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
            <select
              value={filters.table}
              onChange={(event) => setFilters((current) => ({ ...current, table: event.target.value }))}
              className="h-9 rounded-none border border-border bg-background px-3 text-sm"
            >
              <option value="all">Mesa: todas</option>
              {optionSets.tables.map((tableName) => (
                <option key={tableName} value={tableName}>{tableName}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1 uppercase tracking-[0.2em]">
              {filteredGuests.length} invitados
            </Badge>
            <select
              value={filters.tag}
              onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value }))}
              className="h-8 rounded-none border border-border bg-background px-3 text-xs uppercase tracking-widest"
            >
              <option value="all">Tag: todos</option>
              {optionSets.tags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse bg-secondary/40" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invitado</TableHead>
                  <TableHead>Grupo / Mesa</TableHead>
                  <TableHead>Etiquetas</TableHead>
                  <TableHead>RSVP</TableHead>
                  <TableHead>Acompanantes</TableHead>
                  <TableHead>Envio</TableHead>
                  <TableHead>Ultima respuesta</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedGuests.map((guest) => {
                  const companions = getGuestCompanionCounts(guest)
                  const hasResponse = Boolean(guest.rsvp_response)

                  return (
                    <TableRow key={guest.id}>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{guest.full_name}</p>
                          <p className="text-xs text-muted-foreground">{guest.phone || guest.email || 'Sin contacto'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>{guest.guest_group || 'Sin grupo'}</p>
                          <p>{guest.table_name || 'Sin mesa'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1">
                          {(guest.tags || []).length
                            ? guest.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest">
                                  {tag}
                                </Badge>
                              ))
                            : <span className="text-xs text-muted-foreground">Sin tags</span>}
                        </div>
                      </TableCell>
                      <TableCell className="align-top"><AttendancePill status={guest.attendance_status} /></TableCell>
                      <TableCell className="align-top">
                        {hasResponse ? (
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p>Adultos: {companions.adultPlusOnes}</p>
                            <p>Ninos: {companions.childPlusOnes}</p>
                            <p className="font-medium text-foreground">Total: {companions.totalPlusOnes}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Permitidos: {guest.plus_ones_allowed || 0}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-top"><DeliveryPill status={guest.delivery_status} /></TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">
                        {guest.responded_at ? formatDateTime(guest.responded_at) : 'Sin respuesta'}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none"
                            onClick={() => handleGenerateLink(guest)}
                            disabled={generatingLinkGuestId === guest.id}
                          >
                            <Link2 className="mr-2 h-4 w-4" />
                            {generatingLinkGuestId === guest.id ? 'Generando...' : 'Link'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none"
                            onClick={() => {
                              setEditingGuest(guest)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-none" onClick={() => handleDeleteGuest(guest)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}

                {!paginatedGuests.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      No hay invitados que coincidan con los filtros actuales.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredGuests.length)} de {filteredGuests.length}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <GuestFormDialog
        key={`${editingGuest?.id || 'new'}-${dialogOpen ? 'open' : 'closed'}`}
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) setEditingGuest(null)
        }}
        initialValue={editingGuest}
        onSubmit={handleGuestSubmit}
        saving={saving}
      />

      <GuestImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        eventId={eventId}
        existingGuests={guests}
        onImportReady={handleImportReady}
      />

      <Dialog
        open={linkPreview.open}
        onOpenChange={(nextOpen) => setLinkPreview((current) => ({ ...current, open: nextOpen }))}
      >
        <DialogContent className="max-w-2xl rounded-none">
          <DialogHeader>
            <DialogTitle>Link RSVP listo</DialogTitle>
            <DialogDescription>
              Comparte este enlace con {linkPreview.guest?.full_name || 'tu invitado'} o abre una vista previa antes de enviarlo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">URL publica</span>
              <Input readOnly value={linkPreview.url} className="rounded-none" />
            </label>

            {linkPreview.copied && (
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
                Copiado al portapapeles
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => {
                if (!linkPreview.url) return
                window.open(linkPreview.url, '_blank', 'noopener,noreferrer')
              }}
              disabled={!linkPreview.url}
            >
              Abrir vista previa
            </Button>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={handleCopyPreviewLink}
              disabled={!linkPreview.url}
            >
              Copiar de nuevo
            </Button>
            <Button
              className="rounded-none"
              onClick={() => linkPreview.guest && handleGenerateLink(linkPreview.guest)}
              disabled={!linkPreview.guest || generatingLinkGuestId === linkPreview.guest.id}
            >
              {linkPreview.guest && generatingLinkGuestId === linkPreview.guest.id ? 'Regenerando...' : 'Regenerar link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
