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

export const DEFAULT_WHATSAPP_TEMPLATE = `Hola {nombre}, te compartimos la invitacion de {evento} para el dia {fecha}. Confirma aqui: {link_confirmacion}`

export const MESSAGE_BLUEPRINT_CATALOG = [
  {
    key: 'invitation_main',
    label: 'Invitacion principal',
    description: 'Primer envio para compartir la invitacion y abrir el RSVP.',
    referenceBody: DEFAULT_WHATSAPP_TEMPLATE,
  },
  {
    key: 'rsvp_reminder',
    label: 'Recordatorio RSVP',
    description: 'Seguimiento amable para invitados que aun no responden.',
    referenceBody: 'Hola {nombre}, solo queremos recordarte la invitacion de {evento} para el dia {fecha}. Puedes confirmar aqui: {link_confirmacion}',
  },
  {
    key: 'last_call',
    label: 'Ultimo recordatorio',
    description: 'Ultimo aviso antes de cerrar la lista final del evento.',
    referenceBody: 'Hola {nombre}, estamos cerrando la lista final de {evento} para el dia {fecha}. Si aun no confirmas, este es tu ultimo recordatorio: {link_confirmacion}',
  },
]

const MESSAGE_BLUEPRINT_MAP = MESSAGE_BLUEPRINT_CATALOG.reduce((accumulator, blueprint) => {
  accumulator[blueprint.key] = blueprint
  return accumulator
}, {})

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
  return MESSAGE_BLUEPRINT_MAP[messageKey] || MESSAGE_BLUEPRINT_MAP.invitation_main
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

export function resolveAudienceGuests(guests, audience) {
  switch (audience?.type) {
    case 'group':
      return guests.filter((guest) => guest.guest_group && guest.guest_group === audience.value)
    case 'tag':
      return guests.filter((guest) => (guest.tags || []).includes(audience.value))
    case 'manual':
      return guests.filter((guest) => (audience.guestIds || []).includes(guest.id))
    case 'pending':
    default:
      return guests.filter((guest) => guest.attendance_status === 'pending')
  }
}

export function getAudienceSummary(audience, guests) {
  if (audience?.type === 'group') return `Grupo: ${audience.value || 'Sin grupo'}`
  if (audience?.type === 'tag') return `Tag: ${audience.value || 'Sin tag'}`
  if (audience?.type === 'manual') return `Seleccion manual (${resolveAudienceGuests(guests, audience).length})`
  return 'Todos los pendientes'
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

export function getGuestCompanionCounts(guest) {
  const response = guest?.rsvp_response || {}
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

export function computeGuestMetrics(guests) {
  const metrics = {
    total: guests.length,
    sent: 0,
    confirmed: 0,
    declined: 0,
    pending: 0,
    adultCompanions: 0,
    childCompanions: 0,
    totalAttendees: 0,
  }

  guests.forEach((guest) => {
    if (['accepted', 'sent', 'delivered', 'read'].includes(guest.delivery_status)) metrics.sent += 1
    if (guest.attendance_status === 'confirmed') {
      const companions = getGuestCompanionCounts(guest)
      metrics.confirmed += 1
      metrics.adultCompanions += companions.adultPlusOnes
      metrics.childCompanions += companions.childPlusOnes
    } else if (guest.attendance_status === 'declined') metrics.declined += 1
    else metrics.pending += 1
  })

  metrics.totalAttendees = metrics.confirmed + metrics.adultCompanions + metrics.childCompanions

  return metrics
}

export function buildConfirmationTimeline(guests) {
  const counts = new Map()

  guests.forEach((guest) => {
    if (!guest.responded_at || guest.attendance_status === 'pending') return

    const key = guest.responded_at.slice(0, 10)
    const current = counts.get(key) || { date: key, confirmed: 0, declined: 0 }

    if (guest.attendance_status === 'confirmed') current.confirmed += 1
    if (guest.attendance_status === 'declined') current.declined += 1

    counts.set(key, current)
  })

  return Array.from(counts.values()).sort((left, right) => left.date.localeCompare(right.date))
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
    const companions = getGuestCompanionCounts(guest)

    return {
      Nombre: guest.full_name,
      Telefono: guest.phone || '',
      Grupo: guest.guest_group || '',
      Mesa: guest.table_name || '',
      Etiquetas: (guest.tags || []).join(', '),
      RSVP: getTemplateAttendanceLabel(guest.attendance_status),
      Envio: getTemplateDeliveryLabel(guest.delivery_status),
      'Acompanantes permitidos': guest.plus_ones_allowed || 0,
      'Adultos acompanantes': companions.adultPlusOnes,
      'Ninos acompanantes': companions.childPlusOnes,
      Comentario: guest.rsvp_response?.comment || '',
      Restricciones: guest.rsvp_response?.dietary_restrictions || '',
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
