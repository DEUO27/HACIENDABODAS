import { downloadGuestTemplateSpreadsheet, triggerBrowserDownload } from '@/lib/excelUtils'

const ATTENDANCE_STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  declined: 'Rechazado',
}

const DELIVERY_STATUS_LABELS = {
  draft: 'Borrador',
  queued: 'En cola',
  scheduled: 'Programado',
  accepted: 'Aceptado por WhatsApp',
  sent: 'Enviado',
  delivered: 'Entregado',
  read: 'Leido',
  failed: 'Fallido',
  canceled: 'Cancelado',
}

const DELIVERY_DISPLAY_META = {
  pending: {
    label: 'Pendiente',
    className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
  },
  scheduled: {
    label: 'Programado',
    className: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900',
  },
  accepted: {
    label: 'Aceptado por WhatsApp',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900',
  },
  sent: {
    label: 'Enviado',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900',
  },
  delivered: {
    label: 'Entregado',
    className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-900',
  },
  read: {
    label: 'Leido',
    className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900',
  },
  failed: {
    label: 'Error',
    className: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900',
  },
  responded: {
    label: 'Respondio',
    className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900',
  },
}

const ATTENDANCE_STATUS_CLASSES = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900',
  confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900',
  declined: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900',
}

const DELIVERY_STATUS_CLASSES = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
  queued: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900',
  scheduled: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900',
  accepted: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900',
  sent: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900',
  delivered: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-900',
  read: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900',
  failed: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900',
  canceled: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
}

export const DEFAULT_WHATSAPP_TEMPLATE = `Hola {nombre}, te compartimos la invitacion de {evento} para el dia {fecha}. Confirma tu asistencia aqui: {link_confirmacion}`

export const RSVP_STAGES = ['confirmacion_1', 'confirmacion_2']

export const DEFAULT_RSVP_STAGE = 'confirmacion_1'

export const MESSAGE_BLUEPRINT_CATALOG = [
  {
    key: 'confirmacion_1',
    label: 'Confirmacion Inicial',
    shortLabel: 'Inicial',
    stage: 'confirmacion_1',
    description: 'Primer envio: invitacion inicial que abre el RSVP de cada invitado.',
    referenceBody: DEFAULT_WHATSAPP_TEMPLATE,
  },
  {
    key: 'recordatorio',
    label: 'Recordatorio',
    shortLabel: 'Recordatorio',
    stage: 'confirmacion_1',
    description: 'Reenvio para invitados que aun no responden la Inicial. Usa el mismo link y la misma pagina de RSVP.',
    referenceBody: 'Hola {nombre}, te recordamos la invitacion de {evento} para el dia {fecha}. Aun no nos confirmas: {link_confirmacion}',
  },
  {
    key: 'confirmacion_2',
    label: 'Confirmacion Final',
    shortLabel: 'Final',
    stage: 'confirmacion_2',
    description: 'Segundo envio (mas cerca del evento): re-confirmacion final de asistencia.',
    referenceBody: 'Hola {nombre}, estamos cerrando la lista final de {evento} el {fecha}. Re-confirma tu asistencia aqui: {link_confirmacion}',
  },
]

const MESSAGE_BLUEPRINT_MAP = MESSAGE_BLUEPRINT_CATALOG.reduce((accumulator, blueprint) => {
  accumulator[blueprint.key] = blueprint
  return accumulator
}, {})

export function isValidRsvpStage(stage) {
  return RSVP_STAGES.includes(stage)
}

export function normalizeRsvpStage(stage) {
  return isValidRsvpStage(stage) ? stage : DEFAULT_RSVP_STAGE
}

function stableHash(value) {
  let hash = 0

  if (!value) return '0'

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash).toString(16)
}

export function normalizeGuestName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function normalizeGuestPhone(value) {
  const rawValue = String(value || '').trim()
  const digits = rawValue.replace(/\D/g, '')

  if (!digits) return ''
  if (rawValue.startsWith('+') && digits.startsWith('521') && digits.length === 13) return `+${digits}`
  if (digits.length === 10) return `+52${digits}`
  if (digits.length === 12 && digits.startsWith('52')) return `+${digits}`
  if (digits.length === 13 && digits.startsWith('521')) return `+${digits}`
  if (rawValue.startsWith('+')) return rawValue

  return `+${digits}`
}

export function normalizeGuestEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function parseTagsInput(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }

  return String(value || '')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function slugifyEventName(value) {
  const normalized = normalizeGuestName(value)
  return normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `evento-${Date.now()}`
}

export function buildGuestDedupeKey({ fullName, phone, email }) {
  const normalizedName = normalizeGuestName(fullName)
  const normalizedPhone = normalizeGuestPhone(phone)
  const normalizedEmail = normalizeGuestEmail(email)

  return stableHash(`${normalizedName}|${normalizedPhone}|${normalizedEmail}`)
}

export function normalizeAttendanceStatus(value) {
  const normalized = String(value || '').trim().toLowerCase()

  if (!normalized) return 'pending'
  if (['confirmado', 'confirmed', 'si', 'asiste'].includes(normalized)) return 'confirmed'
  if (['cancelado', 'rechazado', 'declined', 'no', 'no asiste'].includes(normalized)) return 'declined'

  return 'pending'
}

export function normalizeDeliveryStatus(value) {
  const normalized = String(value || '').trim().toLowerCase()

  if (!normalized) return 'draft'
  if (['entregado', 'delivered'].includes(normalized)) return 'delivered'
  if (['pendiente', 'sin enviar', 'borrador'].includes(normalized)) return 'draft'
  if (Object.keys(DELIVERY_STATUS_LABELS).includes(normalized)) return normalized
  return 'draft'
}

export function getAttendanceMeta(status) {
  const normalized = normalizeAttendanceStatus(status)
  return {
    value: normalized,
    label: ATTENDANCE_STATUS_LABELS[normalized],
    className: ATTENDANCE_STATUS_CLASSES[normalized],
  }
}

export function getDeliveryMeta(status) {
  const normalized = normalizeDeliveryStatus(status)
  return {
    value: normalized,
    label: DELIVERY_STATUS_LABELS[normalized],
    className: DELIVERY_STATUS_CLASSES[normalized],
  }
}

export function getMessageBlueprintMeta(messageKey) {
  return MESSAGE_BLUEPRINT_MAP[messageKey] || MESSAGE_BLUEPRINT_MAP[DEFAULT_RSVP_STAGE]
}

function getGuestAttendanceForStage(guest, stage) {
  if (stage === 'confirmacion_2') return guest?.attendance_status_2 || 'pending'
  return guest?.attendance_status_1 || 'pending'
}

export function getDeliveryDisplayMeta(status) {
  return DELIVERY_DISPLAY_META[status] || DELIVERY_DISPLAY_META.pending
}

export function getAudienceOptions(guests) {
  return {
    groups: [...new Set(guests.map((guest) => guest.guest_group).filter(Boolean))].sort(),
    tags: [...new Set(guests.flatMap((guest) => guest.tags || []).filter(Boolean))].sort(),
  }
}

export function resolveAudienceGuests(guests, audience, options = {}) {
  const stage = normalizeRsvpStage(options.stage)

  switch (audience?.type) {
    case 'group':
      return guests.filter((guest) => guest.guest_group && guest.guest_group === audience.value)
    case 'tag':
      return guests.filter((guest) => (guest.tags || []).includes(audience.value))
    case 'manual':
      return guests.filter((guest) => (audience.guestIds || []).includes(guest.id))
    case 'pending':
    default:
      return guests.filter((guest) => getGuestAttendanceForStage(guest, stage) === 'pending')
  }
}

export function getAudienceSummary(audience, guests, options = {}) {
  const stage = normalizeRsvpStage(options.stage)
  const stageLabel = stage === 'confirmacion_2' ? 'Confirmacion Final' : 'Confirmacion Inicial'

  if (audience?.type === 'group') return `Grupo: ${audience.value || 'Sin grupo'}`
  if (audience?.type === 'tag') return `Tag: ${audience.value || 'Sin tag'}`
  if (audience?.type === 'manual') return `Seleccion manual (${resolveAudienceGuests(guests, audience, { stage }).length})`
  return `Pendientes de ${stageLabel}`
}

export function getDeliveryDisplayStatus(delivery) {
  if (delivery?.guests?.responded_at) return 'responded'
  if (delivery?.status === 'failed') return 'failed'
  if (delivery?.status === 'scheduled') return 'scheduled'
  if (delivery?.status === 'accepted') return 'accepted'
  if (delivery?.status === 'delivered') return 'delivered'
  if (delivery?.status === 'read') return 'read'
  if (delivery?.status === 'sent') return 'sent'
  return 'pending'
}

export function formatEventDate(value, locale = 'es-MX') {
  if (!value) return 'Sin fecha'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value, locale = 'es-MX') {
  if (!value) return 'Sin fecha'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/$/, '')
}

export function getPublicAppUrl(fallbackOrigin = '') {
  const configuredUrl = normalizeBaseUrl(import.meta.env.VITE_PUBLIC_APP_URL)

  if (configuredUrl) {
    return configuredUrl
  }

  if (import.meta.env.DEV) {
    return normalizeBaseUrl(fallbackOrigin)
  }

  console.warn('[missing_public_app_url] VITE_PUBLIC_APP_URL no esta configurada.')
  return ''
}

export function buildRsvpPublicUrl(baseUrl, token) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const normalizedToken = String(token || '').replace(/^\/+/, '')

  if (!normalizedBaseUrl) {
    return normalizedToken ? `/rsvp/${normalizedToken}` : ''
  }

  return `${normalizedBaseUrl}/rsvp/${normalizedToken}`
}

export function renderMessageTemplate(template, variables) {
  return String(template || DEFAULT_WHATSAPP_TEMPLATE).replace(/\{([a-z_]+)\}/gi, (_, key) => {
    return variables[key] ?? ''
  })
}

function parseNonNegativeInteger(value) {
  const parsed = Number.parseInt(String(value ?? 0), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function readCompanionCountsFromResponse(response) {
  if (!response) return { adultPlusOnes: 0, childPlusOnes: 0, totalPlusOnes: 0 }
  const adultPlusOnes = 'adult_plus_ones' in response
    ? parseNonNegativeInteger(response.adult_plus_ones)
    : parseNonNegativeInteger(response.plus_ones)
  const childPlusOnes = parseNonNegativeInteger(response.child_plus_ones)

  return {
    adultPlusOnes,
    childPlusOnes,
    totalPlusOnes: adultPlusOnes + childPlusOnes,
  }
}

export function getStageResponse(guest, stage) {
  const normalizedStage = normalizeRsvpStage(stage)
  if (normalizedStage === 'confirmacion_2') return guest?.rsvp_response_stage_2 || null
  return guest?.rsvp_response_stage_1 || null
}

export function getStageCompanionCounts(guest, stage) {
  return readCompanionCountsFromResponse(getStageResponse(guest, stage))
}

export function getGuestFinalStage(guest) {
  if (getGuestAttendanceForStage(guest, 'confirmacion_2') !== 'pending') return 'confirmacion_2'
  return 'confirmacion_1'
}

export function getGuestFinalAttendance(guest) {
  return getGuestAttendanceForStage(guest, getGuestFinalStage(guest))
}

export function getGuestCompanionCounts(guest) {
  return getStageCompanionCounts(guest, getGuestFinalStage(guest))
}

function emptyStageMetrics() {
  return {
    confirmed: 0,
    declined: 0,
    pending: 0,
    adultCompanions: 0,
    childCompanions: 0,
    totalAttendees: 0,
  }
}

function accumulateStageMetrics(stageMetrics, attendance, companions) {
  if (attendance === 'confirmed') {
    stageMetrics.confirmed += 1
    stageMetrics.adultCompanions += companions.adultPlusOnes
    stageMetrics.childCompanions += companions.childPlusOnes
  } else if (attendance === 'declined') {
    stageMetrics.declined += 1
  } else {
    stageMetrics.pending += 1
  }
}

export function computeGuestMetrics(guests) {
  const metrics = {
    total: guests.length,
    sent: 0,
    stage1: emptyStageMetrics(),
    stage2: emptyStageMetrics(),
    final: emptyStageMetrics(),
  }

  guests.forEach((guest) => {
    if (['accepted', 'sent', 'delivered', 'read'].includes(guest.delivery_status)) metrics.sent += 1

    const stage1Attendance = getGuestAttendanceForStage(guest, 'confirmacion_1')
    const stage2Attendance = getGuestAttendanceForStage(guest, 'confirmacion_2')

    accumulateStageMetrics(metrics.stage1, stage1Attendance, getStageCompanionCounts(guest, 'confirmacion_1'))
    accumulateStageMetrics(metrics.stage2, stage2Attendance, getStageCompanionCounts(guest, 'confirmacion_2'))

    const finalStage = getGuestFinalStage(guest)
    const finalAttendance = getGuestAttendanceForStage(guest, finalStage)
    accumulateStageMetrics(metrics.final, finalAttendance, getStageCompanionCounts(guest, finalStage))
  })

  metrics.stage1.totalAttendees = metrics.stage1.confirmed + metrics.stage1.adultCompanions + metrics.stage1.childCompanions
  metrics.stage2.totalAttendees = metrics.stage2.confirmed + metrics.stage2.adultCompanions + metrics.stage2.childCompanions
  metrics.final.totalAttendees = metrics.final.confirmed + metrics.final.adultCompanions + metrics.final.childCompanions

  return metrics
}

export function buildConfirmationTimeline(rsvpResponses) {
  const counts = new Map()

  ;(rsvpResponses || []).forEach((response) => {
    if (!response?.responded_at) return

    const stage = normalizeRsvpStage(response.stage)
    const key = `${response.responded_at.slice(0, 10)}|${stage}`
    const current = counts.get(key) || {
      date: response.responded_at.slice(0, 10),
      stage,
      confirmed: 0,
      declined: 0,
    }

    if (response.response_status === 'confirmed') current.confirmed += 1
    if (response.response_status === 'declined') current.declined += 1

    counts.set(key, current)
  })

  return Array.from(counts.values()).sort((left, right) => {
    if (left.date === right.date) return left.stage.localeCompare(right.stage)
    return left.date.localeCompare(right.date)
  })
}

export function triggerDownload(filename, blob) {
  triggerBrowserDownload(filename, blob)
}

function getTemplateAttendanceLabel(status) {
  const normalized = normalizeAttendanceStatus(status)
  if (normalized === 'confirmed') return 'Confirmado'
  if (normalized === 'declined') return 'Cancelado'
  return 'Pendiente'
}

function getTemplateDeliveryLabel(status) {
  const normalized = normalizeDeliveryStatus(status)
  if (['accepted', 'sent', 'delivered', 'read'].includes(normalized)) return 'Entregado'
  return 'Sin enviar'
}

export async function exportGuestsSpreadsheet({ guests, eventName, format = 'xlsx' }) {
  const rows = guests.map((guest) => {
    const stage1Response = getStageResponse(guest, 'confirmacion_1')
    const stage2Response = getStageResponse(guest, 'confirmacion_2')
    const finalCompanions = getGuestCompanionCounts(guest)

    return {
      Nombre: guest.full_name,
      Telefono: guest.phone || '',
      Grupo: guest.guest_group || '',
      Mesa: guest.table_name || '',
      Etiquetas: (guest.tags || []).join(', '),
      'Confirmacion Inicial': getTemplateAttendanceLabel(getGuestAttendanceForStage(guest, 'confirmacion_1')),
      'Confirmacion Final': getTemplateAttendanceLabel(getGuestAttendanceForStage(guest, 'confirmacion_2')),
      Envio: getTemplateDeliveryLabel(guest.delivery_status),
      'Acompanantes permitidos': guest.plus_ones_allowed || 0,
      'Adultos acompanantes (final)': finalCompanions.adultPlusOnes,
      'Ninos acompanantes (final)': finalCompanions.childPlusOnes,
      'Comentario Inicial': stage1Response?.comment || '',
      'Comentario Final': stage2Response?.comment || '',
      'Restricciones Inicial': stage1Response?.dietary_restrictions || '',
      'Restricciones Final': stage2Response?.dietary_restrictions || '',
      Fuente: guest.source === 'import' ? 'importado' : guest.source || 'manual',
    }
  })

  const safeName = slugifyEventName(eventName || 'evento')
  await downloadGuestTemplateSpreadsheet({
    rows,
    eventName: eventName || 'Evento',
    filename: `${safeName}-invitados.${format === 'csv' ? 'csv' : 'xlsx'}`,
    format,
  })
}
