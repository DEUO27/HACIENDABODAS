import * as XLSX from 'xlsx'

import {
  buildGuestDedupeKey,
  normalizeAttendanceStatus,
  normalizeDeliveryStatus,
  normalizeGuestEmail,
  normalizeGuestPhone,
  parseTagsInput,
} from '@/lib/eventModuleUtils'

function getRowValue(row, keywords) {
  const entries = Object.entries(row || {})
  const found = entries.find(([key]) => keywords.some((keyword) => key.toLowerCase().includes(keyword)))
  return found ? found[1] : ''
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value || '').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export async function readGuestFile(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' })
}

export function processGuestRows(rows, { eventId, existingDedupeKeys = new Set() }) {
  const validGuests = []
  const invalidRows = []
  const duplicateRows = []
  const seenKeys = new Set()

  rows.forEach((row, index) => {
    const fullName = String(getRowValue(row, ['nombre', 'name', 'invitado']) || '').trim()
    const phone = normalizeGuestPhone(getRowValue(row, ['telefono', 'phone', 'cel']))
    const email = normalizeGuestEmail(getRowValue(row, ['email', 'correo', 'mail']))
    const guestGroup = String(getRowValue(row, ['grupo', 'group', 'familia']) || '').trim()
    const tableName = String(getRowValue(row, ['mesa', 'table']) || '').trim()
    const tags = parseTagsInput(getRowValue(row, ['tag', 'etiqueta', 'labels']))
    const notes = String(getRowValue(row, ['nota', 'notes', 'comentario']) || '').trim()
    const attendanceStatus = normalizeAttendanceStatus(getRowValue(row, ['confirm', 'rsvp', 'estado']))
    const deliveryStatus = normalizeDeliveryStatus(getRowValue(row, ['envio', 'delivery']))
    const plusOnesAllowed = parseInteger(getRowValue(row, ['acompan', 'plus', 'guest']))

    if (!fullName && !phone && !email) {
      invalidRows.push({ ...row, _index: index, _error: 'Fila sin nombre, telefono o email util' })
      return
    }

    const dedupeKey = buildGuestDedupeKey({ fullName, phone, email })

    if (seenKeys.has(dedupeKey)) {
      duplicateRows.push({ ...row, _index: index, _error: 'Duplicado dentro del archivo' })
      return
    }

    seenKeys.add(dedupeKey)

    if (existingDedupeKeys.has(dedupeKey)) {
      duplicateRows.push({ ...row, _index: index, _error: 'Duplicado contra invitados ya existentes' })
      return
    }

    validGuests.push({
      event_id: eventId,
      full_name: fullName || email || phone || `Invitado ${index + 1}`,
      phone,
      email,
      guest_group: guestGroup,
      table_name: tableName,
      tags,
      attendance_status: attendanceStatus,
      delivery_status: deliveryStatus,
      plus_ones_allowed: plusOnesAllowed,
      notes,
      source: 'import',
      dedupe_key: dedupeKey,
    })
  })

  return {
    validGuests,
    invalidRows,
    duplicateRows,
  }
}
