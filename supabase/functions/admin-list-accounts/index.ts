import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { listAllAuthUsers } from '../_shared/accounts.ts'
import { assertAdmin } from '../_shared/auth.ts'
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
    const { adminClient } = await assertAdmin(req)

    const [authUsers, profilesResult, membershipsResult] = await Promise.all([
      listAllAuthUsers(),
      adminClient
        .from('user_profiles')
        .select('*'),
      adminClient
        .from('event_memberships')
        .select(`
          event_id,
          user_id,
          membership_role,
          spouse_slot,
          events:event_id (
            id,
            name,
            event_date,
            status
          )
        `),
    ])

    if (profilesResult.error) throw profilesResult.error
    if (membershipsResult.error) throw membershipsResult.error

    const profilesByUserId = new Map((profilesResult.data || []).map((profile) => [profile.user_id, profile]))
    const assignmentsByUserId = new Map<string, any[]>()

    for (const membership of membershipsResult.data || []) {
      const assignments = assignmentsByUserId.get(membership.user_id) || []
      assignments.push({
        eventId: membership.event_id,
        membershipRole: membership.membership_role,
        spouseSlot: membership.spouse_slot,
        event: membership.events || null,
      })
      assignmentsByUserId.set(membership.user_id, assignments)
    }

    const accounts = authUsers
      .map((user) => {
        const profile = profilesByUserId.get(user.id) || null
        return {
          userId: user.id,
          email: user.email || profile?.email || '',
          fullName: profile?.full_name || user.user_metadata?.full_name || '',
          globalRole: profile?.global_role || user.app_metadata?.role || 'esposos',
          invitationStatus: user.email_confirmed_at ? 'confirmed' : 'pending',
          lastSignInAt: user.last_sign_in_at,
          createdAt: user.created_at,
          assignments: assignmentsByUserId.get(user.id) || [],
        }
      })
      .sort((left, right) => left.email.localeCompare(right.email))

    return jsonResponse({ accounts })
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

    console.error('[admin-list-accounts]', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error.' }, 500)
  }
})
