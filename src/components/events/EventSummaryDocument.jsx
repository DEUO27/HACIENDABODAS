import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import { formatEventDate } from '@/lib/eventModuleUtils'

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    color: '#1f2937',
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 20,
    marginBottom: 8,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 11,
    marginBottom: 20,
    color: '#6b7280',
  },
  section: {
    marginBottom: 16,
    padding: 14,
    border: '1 solid #e5e7eb',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    color: '#6b7280',
  },
  value: {
    fontWeight: 700,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '1 solid #e5e7eb',
    paddingBottom: 6,
    marginBottom: 6,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #f3f4f6',
    paddingVertical: 6,
  },
  colName: {
    width: '42%',
  },
  colStatus: {
    width: '18%',
  },
  colDelivery: {
    width: '18%',
  },
  colResponse: {
    width: '22%',
  },
})

export default function EventSummaryDocument({ event, metrics, guests }) {
  const visibleGuests = guests.slice(0, 20)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{event.name}</Text>
        <Text style={styles.subtitle}>
          {formatEventDate(event.event_date)} · {event.venue || 'Sin sede definida'}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen operativo</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Total invitados</Text>
            <Text style={styles.value}>{metrics.total}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Invitaciones enviadas</Text>
            <Text style={styles.value}>{metrics.sent}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Confirmados</Text>
            <Text style={styles.value}>{metrics.confirmed}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Rechazados</Text>
            <Text style={styles.value}>{metrics.declined}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Pendientes</Text>
            <Text style={styles.value}>{metrics.pending}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Muestra de invitados</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colName}>Invitado</Text>
            <Text style={styles.colStatus}>RSVP</Text>
            <Text style={styles.colDelivery}>Envio</Text>
            <Text style={styles.colResponse}>Respondio</Text>
          </View>
          {visibleGuests.map((guest) => (
            <View key={guest.id} style={styles.tableRow}>
              <Text style={styles.colName}>{guest.full_name}</Text>
              <Text style={styles.colStatus}>{guest.attendance_status}</Text>
              <Text style={styles.colDelivery}>{guest.delivery_status}</Text>
              <Text style={styles.colResponse}>{guest.responded_at ? guest.responded_at.slice(0, 10) : 'Sin respuesta'}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
