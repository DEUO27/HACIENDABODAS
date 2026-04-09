import { supabase } from '@/lib/supabase'
import {
  buildGuestDedupeKey,
  buildRsvpPublicUrl,
  getPublicAppUrl,
  normalizeGuestEmail,
  normalizeGuestPhone,
  parseTagsInput,
  slugifyEventName,
} from '@/lib/eventModuleUtils'
import { buildDefaultRsvpPageConfig, mergeRsvpPageConfig, normalizeEventRsvpPageRecord } from '@/lib/rsvpPageConfig'
import {
  getSessionReasonMessage,
  isSessionAuthError,
  SESSION_EXPIRED_REASON,
} from '@/lib/authSession'

function getPublicHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
}

async function getActiveAccessToken(hasRetried = false) {
  const { data: sessionData } = await supabase.auth.getSession()
  const currentSession = sessionData?.session || null

  if (hasRetried && currentSession?.refresh_token) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: currentSession.refresh_token,
    })

    if (!refreshError && refreshedData?.session?.access_token) {
      return refreshedData.session.access_token
    }
  }

  if (currentSession?.access_token) {
    return currentSession.access_token
  }

  if (!hasRetried && currentSession?.refresh_token) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: currentSession.refresh_token,
    })

    if (!refreshError && refreshedData?.session?.access_token) {
      return refreshedData.session.access_token
    }
  }

  return null
}

function isHardSessionFailure(message) {
  const normalized = String(message || '').toLowerCase()
  return normalized.includes('invalid jwt') || normalized.includes('jwt expired')
}

async function invokeProtectedFunction(name, payload, hasRetried = false) {
  const accessToken = await getActiveAccessToken(hasRetried)

  if (!accessToken) {
    throw new Error(getSessionReasonMessage(SESSION_EXPIRED_REASON))
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      ...getPublicHeaders(),
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(async () => {
    const text = await response.text().catch(() => '')
    return text ? { error: text } : {}
  })

  if (!response.ok) {
    const errorDetails = typeof data?.details === 'string' && data.details.trim()
      ? data.details.trim()
      : ''

    const normalizedError = {
      status: response.status,
      message: errorDetails
        ? `${data?.error || data?.message || `No fue posible ejecutar ${name}.`}\n${errorDetails}`
        : (data?.error || data?.message || `No fue posible ejecutar ${name}.`),
    }

    if (!hasRetried && isSessionAuthError(normalizedError.message, normalizedError.status)) {
      return invokeProtectedFunction(name, payload, true)
    }

    if (isHardSessionFailure(normalizedError.message)) {
      console.warn('[invalid_jwt]', { functionName: name, stage: 'invoke' })
      throw new Error(getSessionReasonMessage(SESSION_EXPIRED_REASON))
    }

    if (isSessionAuthError(normalizedError.message, normalizedError.status)) {
      throw new Error('No fue posible autenticar esta accion en el backend. Verifica tu sesion y permisos, pero la app no cerrara tu sesion automaticamente.')
    }

    throw new Error(normalizedError.message)
  }

  return data
}

async function invokeFunction(name, payload, requiresAuth = true, hasRetried = false) {
  if (requiresAuth) {
    return invokeProtectedFunction(name, payload, hasRetried)
  }

  const headers = getPublicHeaders()

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || JSON.stringify(data) || `No fue posible ejecutar ${name}.`)
  }

  return data
}

function mapGuestRecord(record) {
  const responses = Array.isArray(record.rsvp_responses) ? record.rsvp_responses : []
  const tokens = Array.isArray(record.rsvp_tokens) ? record.rsvp_tokens : []
  const latestToken = [...tokens].sort((left, right) => {
    return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()
  })[0] || null

  return {
    ...record,
    tags: parseTagsInput(record.tags),
    rsvp_response: responses[0] || null,
    latest_token: latestToken,
    responded_at: responses[0]?.responded_at || record.responded_at || null,
  }
}

export async function listEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return data || []
}

export async function getEventById(eventId) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function createEvent(payload) {
  const insertPayload = {
    name: String(payload.name || '').trim(),
    slug: slugifyEventName(payload.slug || payload.name),
    event_date: payload.event_date || null,
    venue: String(payload.venue || '').trim(),
    timezone: payload.timezone || 'America/Mexico_City',
    status: payload.status || 'draft',
    notes: String(payload.notes || '').trim(),
    metadata: payload.metadata || {},
  }

  const { data, error } = await supabase
    .from('events')
    .insert(insertPayload)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function updateEvent(eventId, payload) {
  const { data, error } = await supabase
    .from('events')
    .update({
      name: String(payload.name || '').trim(),
      slug: slugifyEventName(payload.slug || payload.name),
      event_date: payload.event_date || null,
      venue: String(payload.venue || '').trim(),
      timezone: payload.timezone || 'America/Mexico_City',
      status: payload.status || 'draft',
      notes: String(payload.notes || '').trim(),
      metadata: payload.metadata || {},
    })
    .eq('id', eventId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function listGuests(eventId) {
  const { data, error } = await supabase
    .from('guests')
    .select(`
      *,
      rsvp_responses (
        id,
        response_status,
        plus_ones,
        comment,
        dietary_restrictions,
        responded_at
      ),
      rsvp_tokens (
        id,
        expires_at,
        used_at,
        revoked_at,
        created_at
      )
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(mapGuestRecord)
}

export async function upsertGuest(eventId, payload, guestId = null) {
  const insertPayload = {
    event_id: eventId,
    full_name: String(payload.full_name || '').trim(),
    phone: normalizeGuestPhone(payload.phone),
    email: normalizeGuestEmail(payload.email),
    guest_group: String(payload.guest_group || '').trim(),
    table_name: String(payload.table_name || '').trim(),
    tags: parseTagsInput(payload.tags),
    attendance_status: payload.attendance_status || 'pending',
    delivery_status: payload.delivery_status || 'draft',
    plus_ones_allowed: Number(payload.plus_ones_allowed || 0),
    notes: String(payload.notes || '').trim(),
    source: payload.source || 'manual',
    dedupe_key: buildGuestDedupeKey({
      fullName: payload.full_name,
      phone: payload.phone,
      email: payload.email,
    }),
  }

  const query = guestId
    ? supabase.from('guests').update(insertPayload).eq('id', guestId)
    : supabase.from('guests').insert(insertPayload)

  const { data, error } = await query.select('*').single()

  if (error) throw error
  return data
}

export async function deleteGuest(guestId) {
  const { error } = await supabase.from('guests').delete().eq('id', guestId)
  if (error) throw error
}

export async function importGuests(guests) {
  if (!guests.length) {
    return { inserted: 0 }
  }

  const { data, error } = await supabase
    .from('guests')
    .upsert(guests, {
      onConflict: 'event_id,dedupe_key',
      ignoreDuplicates: true,
    })
    .select('id')

  if (error) throw error
  return { inserted: data?.length || 0 }
}

export async function listDeliveries(eventId) {
  const { data, error } = await supabase
    .from('message_deliveries')
    .select(`
      *,
      guests (
        id,
        full_name,
        phone,
        responded_at,
        attendance_status
      )
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function listMessageBlueprints() {
  const { data, error } = await supabase
    .from('message_blueprints')
    .select('*')
    .eq('channel', 'whatsapp')
    .order('message_key', { ascending: true })

  if (error) throw error
  return data || []
}

export async function listEventAccounts(eventId) {
  const { data, error } = await supabase.rpc('list_event_accounts', {
    p_event_id: eventId,
  })

  if (error) throw error
  return data || []
}

export async function assignEventPlanner(eventId, plannerUserId) {
  const { error } = await supabase.rpc('assign_event_planner', {
    p_event_id: eventId,
    p_planner_user_id: plannerUserId,
  })

  if (error) throw error
}

export async function removeEventMembership(eventId, userId) {
  const { data, error } = await supabase.rpc('remove_event_membership', {
    p_event_id: eventId,
    p_user_id: userId,
  })

  if (error) throw error
  return Boolean(data)
}

async function getEventRsvpPageRow(eventId) {
  const { data, error } = await supabase
    .from('event_rsvp_pages')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getEventRsvpPage(eventId, eventData = null) {
  const row = await getEventRsvpPageRow(eventId)
  return normalizeEventRsvpPageRecord(row, eventData)
}

export async function upsertEventRsvpDraft(eventId, partialConfig = {}, eventData = null) {
  const existing = await getEventRsvpPageRow(eventId)
  const currentDraftConfig = mergeRsvpPageConfig(existing?.draft_config || {}, {}, eventData)
  const nextDraftConfig = mergeRsvpPageConfig(currentDraftConfig, partialConfig, eventData)

  const { data, error } = await supabase
    .from('event_rsvp_pages')
    .upsert({
      event_id: eventId,
      theme_key: nextDraftConfig.layout.template_key,
      draft_config: nextDraftConfig,
      published_config: existing?.published_config || {},
      status: existing?.status || 'draft',
      published_at: existing?.published_at || null,
    })
    .select('*')
    .single()

  if (error) throw error
  return normalizeEventRsvpPageRecord(data, eventData)
}

export async function publishEventRsvpPage(eventId, eventData = null) {
  const existing = await getEventRsvpPageRow(eventId)
  const nextPublishedConfig = mergeRsvpPageConfig(existing?.draft_config || buildDefaultRsvpPageConfig(eventData), {}, eventData)

  const { data, error } = await supabase
    .from('event_rsvp_pages')
    .upsert({
      event_id: eventId,
      theme_key: nextPublishedConfig.layout.template_key,
      draft_config: nextPublishedConfig,
      published_config: nextPublishedConfig,
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) throw error
  return normalizeEventRsvpPageRecord(data, eventData)
}

export async function restorePublishedEventRsvpDraft(eventId, eventData = null) {
  const existing = await getEventRsvpPageRow(eventId)
  const restoredConfig = existing?.published_config && Object.keys(existing.published_config).length
    ? mergeRsvpPageConfig(existing.published_config, {}, eventData)
    : buildDefaultRsvpPageConfig(eventData)

  const { data, error } = await supabase
    .from('event_rsvp_pages')
    .upsert({
      event_id: eventId,
      theme_key: restoredConfig.layout.template_key,
      draft_config: restoredConfig,
      published_config: existing?.published_config || {},
      status: existing?.status || 'draft',
      published_at: existing?.published_at || null,
    })
    .select('*')
    .single()

  if (error) throw error
  return normalizeEventRsvpPageRecord(data, eventData)
}

const RSVP_ASSET_RULES = {
  hero: {
    maxBytes: 5 * 1024 * 1024,
    folder: 'hero',
  },
  logo: {
    maxBytes: 5 * 1024 * 1024,
    folder: 'logo',
  },
  gallery: {
    maxBytes: 4 * 1024 * 1024,
    folder: 'gallery',
  },
}

const RSVP_ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export async function uploadRsvpAsset(eventId, file, kind) {
  const rule = RSVP_ASSET_RULES[kind]

  if (!rule) {
    throw new Error('Tipo de asset no soportado.')
  }

  if (!file) {
    throw new Error('Selecciona un archivo para subir.')
  }

  if (!RSVP_ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Solo se permiten imagenes PNG, JPEG o WEBP.')
  }

  if (file.size > rule.maxBytes) {
    throw new Error(`El archivo excede el tamano permitido para ${kind}.`)
  }

  const extension = String(file.name || '').split('.').pop()?.toLowerCase() || 'png'
  const objectPath = `event/${eventId}/${rule.folder}/${Date.now()}-${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from('rsvp-assets')
    .upload(objectPath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })

  if (error) throw error

  const { data } = supabase.storage.from('rsvp-assets').getPublicUrl(objectPath)

  return {
    path: objectPath,
    url: data.publicUrl,
    kind,
  }
}

export async function saveMessageBlueprint(payload) {
  const { data, error } = await supabase
    .from('message_blueprints')
    .upsert({
      channel: 'whatsapp',
      message_key: payload.message_key,
      label: String(payload.label || '').trim(),
      meta_template_name: String(payload.meta_template_name || '').trim(),
      language_code: String(payload.language_code || 'es_MX').trim(),
      reference_body: String(payload.reference_body || '').trim(),
      is_active: Boolean(payload.is_active),
    }, {
      onConflict: 'channel,message_key',
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function listAccounts() {
  const result = await invokeFunction('admin-list-accounts', {})
  return result.accounts || []
}

export async function upsertPlannerAccount(payload) {
  return invokeFunction('admin-upsert-account', payload)
}

export async function deleteAccount(userId) {
  return invokeFunction('admin-delete-account', { userId })
}

export async function upsertEventCoupleAccount(payload) {
  return invokeFunction('upsert-event-couple-account', payload)
}

export async function issueRsvpToken({ guestId, eventId, baseUrl, expiresAt = null }) {
  const resolvedBaseUrl = baseUrl || getPublicAppUrl(typeof window !== 'undefined' ? window.location.origin : '')

  if (!resolvedBaseUrl) {
    throw new Error('Configura VITE_PUBLIC_APP_URL para generar links RSVP publicos fuera de localhost.')
  }

  const rpcParams = {
    p_guest_id: guestId,
    p_event_id: eventId,
  }

  if (expiresAt) {
    rpcParams.p_expires_at = expiresAt
  }

  const { data, error } = await supabase.rpc('issue_guest_rsvp_token', rpcParams)

  if (error) throw error

  const result = Array.isArray(data) ? data[0] : data

  if (!result?.token) {
    throw new Error('No fue posible emitir el token RSVP.')
  }

  return {
    ...result,
    url: buildRsvpPublicUrl(resolvedBaseUrl, result.token),
  }
}

export async function sendMessageCampaign(payload) {
  return invokeFunction('send-whatsapp-batch', payload)
}

export async function resolveRsvpToken(token) {
  return invokeFunction('rsvp-resolve-token', { token }, false)
}

export async function submitRsvp(payload) {
  return invokeFunction('rsvp-submit', payload, false)
}
