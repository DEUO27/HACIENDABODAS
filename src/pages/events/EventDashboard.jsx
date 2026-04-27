import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
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
import { buildConfirmationTimeline, computeGuestMetrics, exportGuestsSpreadsheet, formatDateTime } from '@/lib/eventModuleUtils'
import { listDeliveries, listGuests } from '@/lib/eventService'
import { supabase } from '@/lib/supabase'

export default function EventDashboard() {
  const { events, event, eventId } = useEvent()
  const [guests, setGuests] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const [guestsData, deliveriesData] = await Promise.all([
        listGuests(eventId),
        listDeliveries(eventId),
      ])

      setGuests(guestsData)
      setDeliveries(deliveriesData)
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, reloadGuests, reloadDeliveries])

  const metrics = useMemo(() => computeGuestMetrics(guests), [guests])
  const timeline = useMemo(() => buildConfirmationTimeline(guests), [guests])
  const scheduleCount = useMemo(() => guests.filter((guest) => guest.delivery_status === 'scheduled').length, [guests])

  const statusChartData = useMemo(() => ([
    { name: 'Confirmados', value: metrics.confirmed, color: '#10b981' },
    { name: 'Rechazados', value: metrics.declined, color: '#f43f5e' },
    { name: 'Pendientes', value: metrics.pending, color: '#f59e0b' },
  ]), [metrics.confirmed, metrics.declined, metrics.pending])

  const latestResponses = useMemo(() => {
    return [...guests]
      .filter((guest) => guest.responded_at)
      .sort((left, right) => new Date(right.responded_at).getTime() - new Date(left.responded_at).getTime())
      .slice(0, 8)
  }, [guests])

  const recentDeliveries = useMemo(() => deliveries.slice(0, 8), [deliveries])
  const handleDownloadSummaryPdf = useCallback(async () => {
    const { downloadEventSummaryPdf } = await import('@/lib/eventDashboardPdf')
    await downloadEventSummaryPdf({ event, metrics, guests })
  }, [event, guests, metrics])

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

      <EventMetricsGrid metrics={metrics} scheduleCount={scheduleCount} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-none border-border bg-card shadow-sm xl:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Timeline de confirmaciones</CardTitle>
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
                  <Bar dataKey="confirmed" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="declined" fill="#f43f5e" radius={[0, 0, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Distribucion RSVP</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {loading ? (
              <div className="h-full animate-pulse bg-secondary/40" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusChartData} dataKey="value" innerRadius={58} outerRadius={94}>
                    {statusChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-none border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Ultimas respuestas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invitado</TableHead>
                  <TableHead>RSVP</TableHead>
                  <TableHead>Respondio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestResponses.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell className="font-medium text-foreground">{guest.full_name}</TableCell>
                    <TableCell><AttendancePill status={guest.attendance_status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(guest.responded_at)}</TableCell>
                  </TableRow>
                ))}
                {!latestResponses.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                      Aun no hay respuestas confirmadas en este evento.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Historial de entregas</CardTitle>
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
                      Aun no existe historial de envios para este evento.
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
