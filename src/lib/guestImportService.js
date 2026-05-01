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

function getCompanionCount(row, keywords) {
  return parseInteger(getRowValue(row, keywords))
}

function hasRowValue(row, keywords) {
  return String(getRowValue(row, keywords) || '').trim() !== ''
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
    const adultKeywords = ['adultos acompanantes', 'acompanantes adultos', 'adult_plus_ones']
    const childKeywords = ['ninos acompanantes', 'ni\u00f1os acompanantes', 'acompanantes ninos', 'acompanantes ni\u00f1os', 'child_plus_ones']
    const adultPlusOnes = getCompanionCount(row, adultKeywords)
    const childPlusOnes = getCompanionCount(row, childKeywords)
    const hasCompanionBreakdown = hasRowValue(row, adultKeywords) || hasRowValue(row, childKeywords)
    const legacyPlusOnes = getCompanionCount(row, ['acompanantes', 'acompan', 'plus', 'guest'])
    const explicitPlusOnesAllowed = getCompanionCount(row, ['acompanantes permitidos', 'acompanantes max', 'max acompanantes'])
    const importedResponseTotal = adultPlusOnes + childPlusOnes
    const plusOnesAllowed = Math.max(explicitPlusOnesAllowed || legacyPlusOnes, importedResponseTotal)
    const responseSeed = attendanceStatus === 'pending'
      ? null
      : {
          response_status: attendanceStatus,
          plus_ones: attendanceStatus === 'confirmed' && hasCompanionBreakdown ? importedResponseTotal : 0,
          adult_plus_ones: attendanceStatus === 'confirmed' && hasCompanionBreakdown ? adultPlusOnes : 0,
          child_plus_ones: attendanceStatus === 'confirmed' ? childPlusOnes : 0,
          comment,
          dietary_restrictions: restrictions,
        }

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
      _rsvp_response: responseSeed,
    })
  })

  return {
    validGuests,
    invalidRows,
    duplicateRows,
  }
}
