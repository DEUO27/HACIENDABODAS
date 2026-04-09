import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { corsHeaders } from '../_shared/cors.ts'
import { buildDefaultRsvpPageConfig, normalizePublishedRsvpPageConfig } from '../_shared/rsvp-page.ts'
import { adminClient } from '../_shared/supabase.ts'
import { sha256 } from '../_shared/token.ts'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token } = await req.json()

    if (!token) {
      return jsonResponse({ error: 'Token requerido.' }, 400)
    }

    const tokenHash = await sha256(token)
    const { data: tokenRow, error } = await adminClient
      .from('rsvp_tokens')
      .select(`
        id,
        event_id,
        guest_id,
        expires_at,
        used_at,
        revoked_at,
        guests!inner (
          id,
          full_name,
          plus_ones_allowed,
          attendance_status
        ),
        events!inner (
          id,
          name,
          event_date,
          venue,
          timezone
        )
      `)
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (error) throw error
    if (!tokenRow) {
      return jsonResponse({ valid: false, code: 'invalid_token', message: 'El enlace no es valido.' }, 404)
    }

    if (tokenRow.revoked_at) {
      return jsonResponse({ valid: false, code: 'revoked_token', message: 'Este enlace fue reemplazado por uno mas reciente.' }, 410)
    }

    if (tokenRow.used_at) {
      const { data: response } = await adminClient
        .from('rsvp_responses')
        .select('response_status, plus_ones, comment, dietary_restrictions, responded_at')
        .eq('guest_id', tokenRow.guest_id)
        .maybeSingle()

      return jsonResponse({
        valid: false,
        code: 'used_token',
        message: 'Este enlace ya fue utilizado.',
        response,
      }, 409)
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() < Date.now()) {
      return jsonResponse({ valid: false, code: 'expired_token', message: 'El enlace ya expiro.' }, 410)
    }

    const { data: pageRow, error: pageError } = await adminClient
      .from('event_rsvp_pages')
      .select('theme_key, published_config, published_at, status')
      .eq('event_id', tokenRow.event_id)
      .maybeSingle()

    if (pageError) throw pageError

    const eventPayload = {
      id: tokenRow.events.id,
      name: tokenRow.events.name,
      eventDate: tokenRow.events.event_date,
      event_date: tokenRow.events.event_date,
      venue: tokenRow.events.venue,
      timezone: tokenRow.events.timezone,
    }

    const hasPublishedPage = Boolean(pageRow?.published_at || pageRow?.status === 'published')
    const pageConfig = hasPublishedPage
      ? normalizePublishedRsvpPageConfig(pageRow?.published_config, tokenRow.events)
      : buildDefaultRsvpPageConfig(tokenRow.events)
    const themeKey = pageConfig.layout.template_key || 'editorial'

    return jsonResponse({
      valid: true,
      guest: {
        id: tokenRow.guests.id,
        fullName: tokenRow.guests.full_name,
        plusOnesAllowed: tokenRow.guests.plus_ones_allowed,
        attendanceStatus: tokenRow.guests.attendance_status,
      },
      event: {
        ...eventPayload,
      },
      expiresAt: tokenRow.expires_at,
      themeKey,
      pageConfig,
    })
  } catch (error) {
    console.error('[rsvp-resolve-token]', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error.' }, 500)
  }
})
