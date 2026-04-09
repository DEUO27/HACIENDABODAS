import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import {
  createUserWithRole,
  findAuthUserByEmail,
  getUserGlobalRole,
  sendSetPasswordEmail,
  updateAuthUserRoleAndName,
} from '../_shared/accounts.ts'
import { assertEventAccess } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'

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
    const body = await req.json()
    const eventId = String(body.eventId || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const fullName = String(body.fullName || '').trim()
    const spouseSlot = Number(body.spouseSlot)

    if (!eventId || !email || ![1, 2].includes(spouseSlot)) {
      return jsonResponse({ error: 'eventId, email y spouseSlot son obligatorios.' }, 400)
    }

    const { adminClient } = await assertEventAccess(req, eventId, {
      allowedGlobalRoles: ['admin', 'planner'],
      allowedMembershipRoles: ['planner'],
    })

    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('id, name')
      .eq('id', eventId)
      .maybeSingle()

    if (eventError) throw eventError
    if (!event) {
      return jsonResponse({ error: 'Evento no encontrado.' }, 404)
    }

    let user = await findAuthUserByEmail(email)
    let action: 'created' | 'updated' = 'updated'

    if (!user) {
      user = await createUserWithRole({
        email,
        fullName,
        role: 'esposos',
      })
      action = 'created'
    } else {
      const currentRole = getUserGlobalRole(user)

      if (currentRole === 'admin' || currentRole === 'planner') {
        return jsonResponse({ error: 'No puedes asignar una cuenta admin o planner como esposos.' }, 409)
      }

      user = await updateAuthUserRoleAndName(user.id, {
        role: 'esposos',
        fullName,
        currentUserMetadata: user.user_metadata || {},
        currentAppMetadata: user.app_metadata || {},
      })
    }

    const { data: existingMembership, error: existingMembershipError } = await adminClient
      .from('event_memberships')
      .select('id, event_id')
      .eq('user_id', user.id)
      .eq('membership_role', 'esposos')
      .maybeSingle()

    if (existingMembershipError) throw existingMembershipError

    if (existingMembership && existingMembership.event_id !== eventId) {
      return jsonResponse({ error: 'Esta cuenta de esposos ya esta asignada a otro evento.' }, 409)
    }

    const { data: existingSlot, error: existingSlotError } = await adminClient
      .from('event_memberships')
      .select('id, user_id')
      .eq('event_id', eventId)
      .eq('membership_role', 'esposos')
      .eq('spouse_slot', spouseSlot)
      .maybeSingle()

    if (existingSlotError) throw existingSlotError

    if (existingSlot && existingSlot.user_id !== user.id) {
      const { error: removeSlotError } = await adminClient
        .from('event_memberships')
        .delete()
        .eq('id', existingSlot.id)

      if (removeSlotError) throw removeSlotError
    }

    const { error: assignError } = await adminClient
      .from('event_memberships')
      .upsert({
        event_id: eventId,
        user_id: user.id,
        membership_role: 'esposos',
        spouse_slot: spouseSlot,
      }, {
        onConflict: 'event_id,user_id',
      })

    if (assignError) throw assignError

    const inviteResult = await sendSetPasswordEmail(email)

    const { data: membershipRows, error: accountsError } = await adminClient
      .from('event_memberships')
      .select(`
        id,
        event_id,
        user_id,
        membership_role,
        spouse_slot
      `)
      .eq('event_id', eventId)

    if (accountsError) throw accountsError

    const userIds = [...new Set((membershipRows || []).map((item) => item.user_id))]
    let profiles: Array<{ user_id: string; email: string; full_name: string; global_role: string }> = []

    if (userIds.length) {
      const { data, error: profilesError } = await adminClient
        .from('user_profiles')
        .select('user_id, email, full_name, global_role')
        .in('user_id', userIds)

      if (profilesError) throw profilesError
      profiles = data || []
    }

    const profilesByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]))

    return jsonResponse({
      ok: true,
      action,
      invite: inviteResult,
      account: {
        userId: user.id,
        email: user.email || email,
        fullName: fullName || user.user_metadata?.full_name || '',
        globalRole: 'esposos',
        spouseSlot,
      },
      accounts: (membershipRows || []).map((item) => {
        const profile = profilesByUserId.get(item.user_id)
        return {
          membership_id: item.id,
          event_id: item.event_id,
          user_id: item.user_id,
          membership_role: item.membership_role,
          spouse_slot: item.spouse_slot,
          email: profile?.email || '',
          full_name: profile?.full_name || '',
          global_role: profile?.global_role || 'esposos',
        }
      }),
    })
  } catch (error) {
    if (error instanceof Response) {
      const body = await error.text()
      return new Response(body, {
        status: error.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    console.error('[upsert-event-couple-account]', error)
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unexpected error.',
      details: error instanceof Error ? error.stack || error.message : String(error),
    }, 500)
  }
})
