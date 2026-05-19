import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Download, RefreshCw } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import EventMetricsGrid from '@/components/events/EventMetricsGrid'
import EventShellHeader from '@/components/events/EventShellHeader'
import { AttendancePill, DeliveryPill } from '@/components/events/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  buildConfirmationTimeline,
  computeGuestMetrics,
  exportGuestsSpreadsheet,
  formatDateTime,
} from '@/lib/eventModuleUtils'
import { listDeliveries, listEventRsvpResponses, listGuests } from '@/lib/eventService'
import { supabase } from '@/lib/supabase'

export default function EventDashboard() {
  const { events, event, eventId } = useEvent()
  const [guests, setGuests] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [rsvpResponses, setRsvpResponses] = useState([])
  const [selectedStage, setSelectedStage] = useState('confirmacion_1')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const isFinalStage = selectedStage === 'confirmacion_2'
  const stageLabel = isFinalStage ? 'Confirmacion Final' : 'Confirmacion Inicial'
  const stageShortLabel = isFinalStage ? 'Final' : 'Inicial'

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const [guestsData, deliveriesData, responsesData] = await Promise.all([
        listGuests(eventId),
        listDeliveries(eventId),
        listEventRsvpResponses(eventId),
      ])

      setGuests(guestsData)
      setDeliveries(deliveriesData)
      setRsvpResponses(responsesData)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible cargar el dashboard del evento.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  const reloadGuests = useCallback(async () => {
    try {
      setGuests(await listGuests(eventId))
    } catch (err) {
      console.error('[realtime-guests]', err)
    }
  }, [eventId])

  const reloadDeliveries = useCallback(async () => {
    try {
      setDeliveries(await listDeliveries(eventId))
    } catch (err) {
      console.error('[realtime-deliveries]', err)
    }
  }, [eventId])

  const reloadRsvpResponses = useCallback(async () => {
    try {
      setRsvpResponses(await listEventRsvpResponses(eventId))
    } catch (err) {
      console.error('[realtime-rsvp-responses]', err)
    }
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    loadData()
  }, [eventId, loadData])

  useEffect(() => {
    if (!eventId) return undefined

    const channel = supabase
      .channel(`event-dashboard-${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'guests',
        filter: `event_id=eq.${eventId}`,
      }, () => reloadGuests())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_deliveries',
        filter: `event_id=eq.${eventId}`,
      }, () => reloadDeliveries())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rsvp_responses',
        filter: `event_id=eq.${eventId}`,
      }, () => reloadRsvpResponses())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, reloadGuests, reloadDeliveries, reloadRsvpResponses])

  const metrics = useMemo(() => computeGuestMetrics(guests), [guests])
  const timeline = useMemo(() => {
    const dateMap = new Map()
    buildConfirmationTimeline(rsvpResponses).forEach((entry) => {
      if (entry.stage !== selectedStage) return
      const current = dateMap.get(entry.date) || { date: entry.date, confirmed: 0, declined: 0 }
      current.confirmed += entry.confirmed
      current.declined += entry.declined
      dateMap.set(entry.date, current)
    })
    return Array.from(dateMap.values()).sort((left, right) => left.date.localeCompare(right.date))
  }, [rsvpResponses, selectedStage])
  const scheduleCount = useMemo(() => guests.filter((guest) => guest.delivery_status === 'scheduled').length, [guests])

  const stageChartData = useMemo(() => {
    const stageMetrics = isFinalStage ? metrics.stage2 : metrics.stage1
    return [
      { name: 'Confirmados', value: stageMetrics?.confirmed || 0, color: '#10b981' },
      { name: 'Rechazados', value: stageMetrics?.declined || 0, color: '#f43f5e' },
      { name: 'Pendientes', value: stageMetrics?.pending || 0, color: '#f59e0b' },
    ]
  }, [isFinalStage, metrics.stage1, metrics.stage2])

  const guestNameById = useMemo(() => {
    const map = new Map()
    guests.forEach((guest) => map.set(guest.id, guest.full_name))
    return map
  }, [guests])

  const latestResponses = useMemo(() => {
    return [...rsvpResponses]
      .filter((response) => response.responded_at && response.stage === selectedStage)
      .sort((left, right) => new Date(right.responded_at).getTime() - new Date(left.responded_at).getTime())
      .slice(0, 8)
  }, [rsvpResponses, selectedStage])

  const recentDeliveries = useMemo(() => {
    const allowedKeys = selectedStage === 'confirmacion_1'
      ? ['confirmacion_1', 'recordatorio']
      : ['confirmacion_2']
    return deliveries.filter((delivery) => allowedKeys.includes(delivery.message_key)).slice(0, 8)
  }, [deliveries, selectedStage])
  const handleDownloadSummaryPdf = useCallback(async () => {
    const { downloadEventSummaryPdf } = await import('@/lib/eventDashboardPdf')
    await downloadEventSummaryPdf({ event, metrics, guests })
  }, [event, guests, metrics])

  const stageToggle = (
    <div className="inline-flex border border-border bg-card">
      <button
        type="button"
        onClick={() => setSelectedStage('confirmacion_1')}
        aria-pressed={selectedStage === 'confirmacion_1'}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
          selectedStage === 'confirmacion_1'
            ? 'bg-foreground text-background'
            : 'bg-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
        }`}
      >
        <Check className={`h-3 w-3 transition-opacity ${selectedStage === 'confirmacion_1' ? 'opacity-100' : 'opacity-0'}`} />
        Inicial
      </button>
      <button
        type="button"
        onClick={() => setSelectedStage('confirmacion_2')}
        aria-pressed={selectedStage === 'confirmacion_2'}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
          selectedStage === 'confirmacion_2'
            ? 'bg-foreground text-background'
            : 'bg-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
        }`}
      >
        <Check className={`h-3 w-3 transition-opacity ${selectedStage === 'confirmacion_2' ? 'opacity-100' : 'opacity-0'}`} />
        Final
      </button>
    </div>
  )

  return (
    <div className="space-y-6 py-6">
      <EventShellHeader
        events={events}
        currentEvent={event}
        activeTab="dashboard"
        actions={(
          <>
            <Button variant="outline" className="rounded-none" onClick={loadData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refrescar
            </Button>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => exportGuestsSpreadsheet({ guests, eventName: event?.name, format: 'xlsx' })}
              disabled={!guests.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button
              className="rounded-none"
              onClick={handleDownloadSummaryPdf}
              disabled={!event}
            >
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </>
        )}
      />

      {errorMessage && (
        <div className="rounded-none border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      <EventMetricsGrid metrics={metrics} scheduleCount={scheduleCount} selectedStage={selectedStage} stageToggle={stageToggle} />

      <Card className="rounded-none border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">{`Timeline de confirmaciones — ${stageLabel}`}</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {loading ? (
            <div className="h-full animate-pulse bg-secondary/40" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="confirmed" name={`${stageShortLabel} confirmados`} fill={isFinalStage ? '#0284c7' : '#10b981'} radius={[0, 0, 0, 0]} />
                <Bar dataKey="declined" name={`${stageShortLabel} rechazados`} fill={isFinalStage ? '#f43f5e' : '#fca5a5'} radius={[0, 0, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-none border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">{`Distribucion ${stageLabel}`}</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          {loading ? (
            <div className="h-full animate-pulse bg-secondary/40" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stageChartData} dataKey="value" innerRadius={58} outerRadius={94}>
                  {stageChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-none border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">{`Ultimas respuestas — ${stageLabel}`}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invitado</TableHead>
                  <TableHead>Respuesta</TableHead>
                  <TableHead>Respondio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestResponses.map((response) => (
                  <TableRow key={response.id}>
                    <TableCell className="font-medium text-foreground">{guestNameById.get(response.guest_id) || 'Invitado'}</TableCell>
                    <TableCell><AttendancePill status={response.response_status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(response.responded_at)}</TableCell>
                  </TableRow>
                ))}
                {!latestResponses.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                      {`Aun no hay respuestas de ${stageLabel} en este evento.`}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">{`Historial de entregas — ${stageLabel}`}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invitado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Programado</TableHead>
                  <TableHead>Enviado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDeliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="font-medium text-foreground">{delivery.guests?.full_name || 'Invitado'}</TableCell>
                    <TableCell><DeliveryPill status={delivery.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{delivery.scheduled_at ? formatDateTime(delivery.scheduled_at) : 'Ahora'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{delivery.sent_at ? formatDateTime(delivery.sent_at) : 'Sin enviar'}</TableCell>
                  </TableRow>
                ))}
                {!recentDeliveries.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      {`Aun no existe historial de envios de ${stageLabel} en este evento.`}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
