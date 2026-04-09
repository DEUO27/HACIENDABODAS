import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Send, UsersRound } from 'lucide-react'

import EventShellHeader from '@/components/events/EventShellHeader'
import { DeliveryDisplayPill } from '@/components/events/StatusPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  buildRsvpPublicUrl,
  formatDateTime,
  formatEventDate,
  getAudienceOptions,
  getAudienceSummary,
  getDeliveryDisplayStatus,
  getMessageBlueprintMeta,
  getPublicAppUrl,
  MESSAGE_BLUEPRINT_CATALOG,
  renderMessageTemplate,
  resolveAudienceGuests,
} from '@/lib/eventModuleUtils'
import {
  listDeliveries,
  listGuests,
  listMessageBlueprints,
  sendMessageCampaign,
} from '@/lib/eventService'
import { cn } from '@/lib/utils'

const WIZARD_STEPS = [
  { id: 1, label: 'Tipo de mensaje' },
  { id: 2, label: 'Destinatarios' },
  { id: 3, label: 'Fecha y hora' },
  { id: 4, label: 'Revision' },
]

export default function EventMessaging() {
  const { events, event, eventId } = useEvent()
  const [guests, setGuests] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [blueprints, setBlueprints] = useState([])
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedMessageKey, setSelectedMessageKey] = useState('invitation_main')
  const [audience, setAudience] = useState({
    type: 'pending',
    value: '',
    guestIds: [],
  })
  const [deliveryTiming, setDeliveryTiming] = useState('now')
  const [scheduleAt, setScheduleAt] = useState('')
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const [guestsData, deliveriesData, blueprintsData] = await Promise.all([
        listGuests(eventId),
        listDeliveries(eventId),
        listMessageBlueprints(),
      ])

      setGuests(guestsData)
      setDeliveries(deliveriesData)
      setBlueprints(blueprintsData)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible cargar el modulo de envios.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    loadData()
  }, [eventId, loadData])

  const audienceOptions = useMemo(() => getAudienceOptions(guests), [guests])
  const blueprintMap = useMemo(() => {
    return blueprints.reduce((accumulator, blueprint) => {
      accumulator[blueprint.message_key] = blueprint
      return accumulator
    }, {})
  }, [blueprints])

  const selectedPreset = useMemo(() => getMessageBlueprintMeta(selectedMessageKey), [selectedMessageKey])
  const selectedBlueprint = blueprintMap[selectedMessageKey] || null
  const resolvedAudienceGuests = useMemo(() => resolveAudienceGuests(guests, audience), [audience, guests])
  const publicAppUrl = useMemo(() => getPublicAppUrl(window.location.origin), [])

  const previewGuest = resolvedAudienceGuests[0] || guests[0] || null
  const previewMessage = useMemo(() => {
    const referenceBody = selectedBlueprint?.reference_body || selectedPreset.referenceBody

    return renderMessageTemplate(referenceBody, {
      nombre: previewGuest?.full_name || 'Invitado',
      evento: event?.name || 'Tu evento',
      fecha: formatEventDate(event?.event_date),
      link_confirmacion: buildRsvpPublicUrl(publicAppUrl, '<link-personalizado>') || '/rsvp/<link-personalizado>',
    })
  }, [event, previewGuest, publicAppUrl, selectedBlueprint?.reference_body, selectedPreset.referenceBody])

  const canAdvance = useMemo(() => {
    if (currentStep === 1) {
      return Boolean(
        selectedBlueprint?.is_active &&
        selectedBlueprint?.meta_template_name &&
        selectedBlueprint?.reference_body,
      )
    }

    if (currentStep === 2) {
      return resolvedAudienceGuests.length > 0
    }

    if (currentStep === 3) {
      if (deliveryTiming === 'later') {
        return Boolean(scheduleAt)
      }
      return true
    }

    return true
  }, [currentStep, deliveryTiming, resolvedAudienceGuests.length, scheduleAt, selectedBlueprint])

  const historyRows = useMemo(() => {
    return deliveries.slice(0, 10).map((delivery) => ({
      ...delivery,
      displayStatus: getDeliveryDisplayStatus(delivery),
      preset: getMessageBlueprintMeta(delivery.message_key),
    }))
  }, [deliveries])

  function handleNext() {
    if (!canAdvance) {
      if (currentStep === 1) {
        setErrorMessage('Este tipo de mensaje aun no esta listo. Pide a tu equipo que configurelo primero.')
      } else if (currentStep === 2) {
        setErrorMessage('Selecciona al menos un invitado para continuar.')
      } else if (currentStep === 3) {
        setErrorMessage('Define la fecha y hora del envio programado.')
      }
      return
    }

    setErrorMessage('')
    setCurrentStep((step) => Math.min(step + 1, WIZARD_STEPS.length))
  }

  function handleBack() {
    setErrorMessage('')
    setCurrentStep((step) => Math.max(step - 1, 1))
  }

  async function handleSubmitCampaign() {
    if (!resolvedAudienceGuests.length) {
      setErrorMessage('No hay invitados seleccionados para este envio.')
      return
    }

    if (!publicAppUrl) {
      setErrorMessage('Configura VITE_PUBLIC_APP_URL para enviar links RSVP publicos fuera de localhost.')
      return
    }

    setSending(true)
    setErrorMessage('')

    try {
      const result = await sendMessageCampaign({
        eventId,
        messageKey: selectedMessageKey,
        audience,
        guestIds: resolvedAudienceGuests.map((guest) => guest.id),
        scheduledAt: deliveryTiming === 'later' ? new Date(scheduleAt).toISOString() : null,
        baseUrl: publicAppUrl,
      })

      if (deliveryTiming === 'later') {
        setNotice(`Se programo el envio para ${result.scheduled || 0} invitados.`)
      } else {
        setNotice(`Se enviaron ${result.sent || 0} mensajes. Fallidos: ${result.failed || 0}.`)
      }

      setAudience({
        type: 'pending',
        value: '',
        guestIds: [],
      })
      setDeliveryTiming('now')
      setScheduleAt('')
      setCurrentStep(1)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible crear el envio.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6 py-6">
      <EventShellHeader
        events={events}
        currentEvent={event}
        activeTab="envios"
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
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Crear envio</CardTitle>
              <CardDescription className="mt-2">
                Elige el mensaje, selecciona a tus invitados y revisa todo antes de enviarlo.
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1 uppercase tracking-[0.2em]">
              Paso {currentStep} de {WIZARD_STEPS.length}
            </Badge>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            {WIZARD_STEPS.map((step) => (
              <div
                key={step.id}
                className={cn(
                  'rounded-none border px-4 py-3 text-sm uppercase tracking-[0.2em]',
                  currentStep === step.id
                    ? 'border-foreground bg-secondary text-foreground'
                    : currentStep > step.id
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : 'border-border bg-background text-muted-foreground',
                )}
              >
                {step.label}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {currentStep === 1 && (
            <div className="grid gap-4 lg:grid-cols-3">
              {MESSAGE_BLUEPRINT_CATALOG.map((preset) => {
                const blueprint = blueprintMap[preset.key]
                const isReady = Boolean(blueprint?.is_active && blueprint?.meta_template_name && blueprint?.reference_body)

                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setSelectedMessageKey(preset.key)}
                    className={cn(
                      'rounded-none border p-5 text-left transition-colors',
                      selectedMessageKey === preset.key
                        ? 'border-foreground bg-secondary/50'
                        : 'border-border bg-background hover:bg-secondary/20',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-heading text-2xl tracking-wide text-foreground">{preset.label}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{preset.description}</p>
                      </div>
                      <Badge variant="outline" className="rounded-full px-3 py-1 uppercase tracking-[0.2em]">
                        {isReady ? 'Listo' : 'Pendiente'}
                      </Badge>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-4">
                {[
                  { key: 'pending', label: 'Todos los pendientes', icon: UsersRound },
                  { key: 'group', label: 'Por grupo', icon: UsersRound },
                  { key: 'tag', label: 'Por tag', icon: UsersRound },
                  { key: 'manual', label: 'Seleccion manual', icon: CheckCircle2 },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setAudience((current) => ({ ...current, type: option.key, value: '', guestIds: [] }))}
                    className={cn(
                      'rounded-none border p-4 text-left transition-colors',
                      audience.type === option.key
                        ? 'border-foreground bg-secondary/50'
                        : 'border-border bg-background hover:bg-secondary/20',
                    )}
                  >
                    <option.icon className="h-5 w-5 text-foreground" />
                    <p className="mt-4 font-medium text-foreground">{option.label}</p>
                  </button>
                ))}
              </div>

              {audience.type === 'group' && (
                <div className="max-w-sm space-y-2">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Grupo</span>
                  <select
                    value={audience.value}
                    onChange={(event) => setAudience((current) => ({ ...current, value: event.target.value }))}
                    className="h-10 w-full rounded-none border border-border bg-background px-3 text-sm"
                  >
                    <option value="">Selecciona un grupo</option>
                    {audienceOptions.groups.map((group) => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </div>
              )}

              {audience.type === 'tag' && (
                <div className="max-w-sm space-y-2">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Tag</span>
                  <select
                    value={audience.value}
                    onChange={(event) => setAudience((current) => ({ ...current, value: event.target.value }))}
                    className="h-10 w-full rounded-none border border-border bg-background px-3 text-sm"
                  >
                    <option value="">Selecciona un tag</option>
                    {audienceOptions.tags.map((tag) => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </div>
              )}

              {audience.type === 'manual' && (
                <Card className="rounded-none border-border bg-background shadow-none">
                  <CardHeader>
                    <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Seleccion manual</CardTitle>
                    <CardDescription>Marca solo a los invitados que quieras incluir en este envio.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Sel.</TableHead>
                          <TableHead>Invitado</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead>RSVP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {guests.map((guest) => (
                          <TableRow key={guest.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={audience.guestIds.includes(guest.id)}
                                onChange={(event) => {
                                  setAudience((current) => ({
                                    ...current,
                                    guestIds: event.target.checked
                                      ? [...new Set([...current.guestIds, guest.id])]
                                      : current.guestIds.filter((id) => id !== guest.id),
                                  }))
                                }}
                                className="h-4 w-4"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{guest.full_name}</p>
                                <p className="text-xs text-muted-foreground">{guest.phone || guest.email || 'Sin contacto'}</p>
                              </div>
                            </TableCell>
                            <TableCell>{guest.guest_group || 'Sin grupo'}</TableCell>
                            <TableCell>{guest.attendance_status === 'pending' ? 'Pendiente' : guest.attendance_status === 'confirmed' ? 'Confirmado' : 'Rechazado'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-none border border-border bg-secondary/20 px-4 py-3">
                <p className="text-sm font-medium text-foreground">{resolvedAudienceGuests.length} invitados seleccionados</p>
                <p className="mt-1 text-xs text-muted-foreground">{getAudienceSummary(audience, guests)}</p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setDeliveryTiming('now')
                  setScheduleAt('')
                }}
                className={cn(
                  'rounded-none border p-5 text-left transition-colors',
                  deliveryTiming === 'now'
                    ? 'border-foreground bg-secondary/50'
                    : 'border-border bg-background hover:bg-secondary/20',
                )}
              >
                <Send className="h-5 w-5 text-foreground" />
                <p className="mt-4 font-medium text-foreground">Enviar ahora</p>
                <p className="mt-2 text-sm text-muted-foreground">El mensaje se enviara en cuanto confirmes el resumen final.</p>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryTiming('later')}
                className={cn(
                  'rounded-none border p-5 text-left transition-colors',
                  deliveryTiming === 'later'
                    ? 'border-foreground bg-secondary/50'
                    : 'border-border bg-background hover:bg-secondary/20',
                )}
              >
                <CalendarClock className="h-5 w-5 text-foreground" />
                <p className="mt-4 font-medium text-foreground">Programar para despues</p>
                <p className="mt-2 text-sm text-muted-foreground">Deja el envio listo y el sistema lo disparara automaticamente en la hora elegida.</p>
              </button>

              {deliveryTiming === 'later' && (
                <div className="max-w-sm space-y-2 lg:col-span-2">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Fecha y hora</span>
                  <Input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(event) => setScheduleAt(event.target.value)}
                    className="rounded-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Zona horaria del navegador: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    {event?.timezone && event.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400">
                        (el evento esta en {event.timezone})
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="rounded-none border-border bg-background shadow-none">
                <CardHeader>
                  <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Revision final</CardTitle>
                  <CardDescription>Verifica el tipo de mensaje, la audiencia y el momento de envio.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-none border border-border p-4">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Mensaje</p>
                      <p className="mt-2 font-medium text-foreground">{selectedPreset.label}</p>
                    </div>
                    <div className="rounded-none border border-border p-4">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Audiencia</p>
                      <p className="mt-2 font-medium text-foreground">{getAudienceSummary(audience, guests)}</p>
                    </div>
                    <div className="rounded-none border border-border p-4">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Momento</p>
                      <p className="mt-2 font-medium text-foreground">
                        {deliveryTiming === 'later' ? formatDateTime(new Date(scheduleAt).toISOString()) : 'Enviar ahora'}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-none border border-border bg-secondary/20 p-4">
                    <p className="text-sm font-medium text-foreground">{resolvedAudienceGuests.length} invitados recibiran este envio.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Si todo esta correcto, confirma para generar los links RSVP y disparar la campana.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border bg-background shadow-none">
                <CardHeader>
                  <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Vista previa</CardTitle>
                  <CardDescription>Asi se vera el mensaje con datos de ejemplo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-none border border-border bg-secondary/20 p-4">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{previewMessage}</p>
                  </div>
                  <div className="rounded-none border border-border p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Ejemplo usado</p>
                    <p className="mt-2 font-medium text-foreground">{previewGuest?.full_name || 'Invitado de ejemplo'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{event?.name || 'Evento'} · {formatEventDate(event?.event_date)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              className="rounded-none"
              onClick={handleBack}
              disabled={currentStep === 1 || sending}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>

            <div className="flex gap-3">
              {currentStep < WIZARD_STEPS.length ? (
                <Button className="rounded-none" onClick={handleNext} disabled={!canAdvance || loading}>
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button className="rounded-none" onClick={() => setConfirmOpen(true)} disabled={sending || !resolvedAudienceGuests.length}>
                  <Send className="mr-2 h-4 w-4" />
                  {sending ? 'Enviando...' : `Enviar a ${resolvedAudienceGuests.length} invitados`}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-none border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Historial de envios</CardTitle>
          <CardDescription>Seguimiento simple del estado de cada envio realizado en este evento.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invitado</TableHead>
                <TableHead>Mensaje</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyRows.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{delivery.guests?.full_name || 'Invitado'}</p>
                      <p className="text-xs text-muted-foreground">{delivery.guests?.phone || delivery.recipient_phone || 'Sin telefono'}</p>
                    </div>
                  </TableCell>
                  <TableCell>{delivery.preset.label}</TableCell>
                  <TableCell><DeliveryDisplayPill status={delivery.displayStatus} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {delivery.sent_at
                      ? formatDateTime(delivery.sent_at)
                      : delivery.scheduled_at
                        ? formatDateTime(delivery.scheduled_at)
                        : 'Sin fecha'}
                  </TableCell>
                </TableRow>
              ))}
              {!historyRows.length && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    Aun no hay envios registrados para este evento.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle>Confirmar envio</DialogTitle>
            <DialogDescription>
              Estas a punto de enviar un mensaje de WhatsApp a {resolvedAudienceGuests.length} invitados.
              {deliveryTiming === 'later'
                ? ` El envio se programara para ${formatDateTime(new Date(scheduleAt).toISOString())}.`
                : ' El envio se realizara de inmediato.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-none"
              onClick={() => {
                setConfirmOpen(false)
                handleSubmitCampaign()
              }}
              disabled={sending}
            >
              <Send className="mr-2 h-4 w-4" />
              {sending ? 'Enviando...' : 'Confirmar envio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
