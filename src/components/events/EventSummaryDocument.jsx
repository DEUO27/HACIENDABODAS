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
  sectionSubtitle: {
    fontSize: 10,
    color: '#6b7280',
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
    width: '38%',
  },
  colStage: {
    width: '17%',
  },
  colDelivery: {
    width: '14%',
  },
  colResponse: {
    width: '14%',
  },
})

function StageBlock({ title, stage }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Confirmados</Text>
        <Text style={styles.value}>{stage.confirmed || 0}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Rechazados</Text>
        <Text style={styles.value}>{stage.declined || 0}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Pendientes</Text>
        <Text style={styles.value}>{stage.pending || 0}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Adultos extra</Text>
        <Text style={styles.value}>{stage.adultCompanions || 0}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Ninos acompanantes</Text>
        <Text style={styles.value}>{stage.childCompanions || 0}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Total asistentes</Text>
        <Text style={styles.value}>{stage.totalAttendees || 0}</Text>
      </View>
    </View>
  )
}

export default function EventSummaryDocument({ event, metrics, guests }) {
  const visibleGuests = guests.slice(0, 20)
  const stage1 = metrics.stage1 || {}
  const stage2 = metrics.stage2 || {}
  const final = metrics.final || {}

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
            <Text style={styles.value}>{metrics.total || 0}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Invitaciones enviadas</Text>
            <Text style={styles.value}>{metrics.sent || 0}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Asistentes finales</Text>
            <Text style={styles.value}>{final.totalAttendees || 0}</Text>
          </View>
        </View>

        <StageBlock title="Confirmacion Inicial" stage={stage1} />
        <StageBlock title="Confirmacion Final" stage={stage2} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Muestra de invitados</Text>
          <Text style={styles.sectionSubtitle}>Estado por etapa (Inicial / Final) y ultima fecha de respuesta.</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colName}>Invitado</Text>
            <Text style={styles.colStage}>Inicial</Text>
            <Text style={styles.colStage}>Final</Text>
            <Text style={styles.colDelivery}>Envio</Text>
            <Text style={styles.colResponse}>Respondio</Text>
          </View>
          {visibleGuests.map((guest) => (
            <View key={guest.id} style={styles.tableRow}>
              <Text style={styles.colName}>{guest.full_name}</Text>
              <Text style={styles.colStage}>{guest.attendance_status_1 || 'pending'}</Text>
              <Text style={styles.colStage}>{guest.attendance_status_2 || 'pending'}</Text>
              <Text style={styles.colDelivery}>{guest.delivery_status}</Text>
              <Text style={styles.colResponse}>{guest.responded_at ? guest.responded_at.slice(0, 10) : 'Sin respuesta'}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
