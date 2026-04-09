import { pdf } from '@react-pdf/renderer'

import EventSummaryDocument from '@/components/events/EventSummaryDocument'
import { triggerDownload } from '@/lib/eventModuleUtils'

export async function downloadEventSummaryPdf({ event, metrics, guests }) {
  const blob = await pdf(
    <EventSummaryDocument event={event} metrics={metrics} guests={guests} />
  ).toBlob()

  triggerDownload(`${event.name || 'evento'}-resumen.pdf`, blob)
}
