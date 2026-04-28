import {
  buildGuestDedupeKey,
  normalizeAttendanceStatus,
  normalizeDeliveryStatus,
  normalizeGuestEmail,
  normalizeGuestPhone,
  parseTagsInput,
} from '@/lib/eventModuleUtils'
import { readSpreadsheetRows } from '@/lib/excelUtils'

function normalizeLookupText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function getRowValue(row, keywords) {
  const entries = Object.entries(row || {})
  const found = entries.find(([key]) => {
    const normalizedKey = normalizeLookupText(key)
    return keywords.some((keyword) => normalizedKey.includes(normalizeLookupText(keyword)))
  })
  return found ? found[1] : ''
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value || '').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export async function readGuestFile(fileBuffer) {
  return readSpreadsheetRows(fileBuffer)
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
    const comment = String(getRowValue(row, ['nota', 'notes', 'comentario']) || '').trim()
    const restrictions = String(getRowValue(row, ['restriccion', 'restricciones', 'alergia', 'dietary']) || '').trim()
    const notes = [comment, restrictions ? `Restricciones: ${restrictions}` : ''].filter(Boolean).join('\n')
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
