import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { corsHeaders } from '../_shared/cors.ts'
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

function parseNonNegativeInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? 0), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      token,
      responseStatus,
      plusOnes = 0,
      adultPlusOnes = null,
      childPlusOnes = 0,
      comment = '',
      dietaryRestrictions = '',
    } = await req.json()

    if (!token || !responseStatus) {
      return jsonResponse({ error: 'Token y respuesta son obligatorios.' }, 400)
    }

    const tokenHash = await sha256(token)
    const { data: tokenRow, error: tokenError } = await adminClient
      .from('rsvp_tokens')
      .select(`
        id,
        guest_id,
        guests!inner (
          id,
          full_name,
          plus_ones_allowed
        )
      `)
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (tokenError) throw tokenError
    if (!tokenRow) {
      return jsonResponse({ ok: false, code: 'invalid_token', message: 'El enlace no es valido.' }, 404)
    }

    const safeAdultPlusOnes = responseStatus === 'confirmed'
      ? parseNonNegativeInteger(adultPlusOnes ?? plusOnes)
      : 0
    const safeChildPlusOnes = responseStatus === 'confirmed'
      ? parseNonNegativeInteger(childPlusOnes)
      : 0
    const safePlusOnes = safeAdultPlusOnes + safeChildPlusOnes

    if (safePlusOnes > Number(tokenRow.guests.plus_ones_allowed || 0)) {
      return jsonResponse({
        ok: false,
        code: 'too_many_plus_ones',
        message: 'El numero de acompanantes excede el limite permitido.',
      }, 400)
    }

    const { data: result, error: consumeError } = await adminClient.rpc('consume_rsvp_token', {
      p_token_hash: tokenHash,
      p_response_status: responseStatus,
      p_plus_ones: safePlusOnes,
      p_adult_plus_ones: safeAdultPlusOnes,
      p_child_plus_ones: safeChildPlusOnes,
      p_comment: String(comment || ''),
      p_dietary_restrictions: String(dietaryRestrictions || ''),
    })

    if (consumeError) throw consumeError

    if (!result?.ok) {
      return jsonResponse({
        ok: false,
        code: result?.code || 'invalid_state',
        message: 'No fue posible registrar la confirmacion.',
      }, 409)
    }

    return jsonResponse({
      ok: true,
      attendanceStatus: result.attendance_status,
      plusOnes: result.plus_ones,
      adultPlusOnes: result.adult_plus_ones,
      childPlusOnes: result.child_plus_ones,
      respondedAt: result.responded_at,
      guestName: tokenRow.guests.full_name,
    })
  } catch (error) {
    console.error('[rsvp-submit]', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error.' }, 500)
  }
})
