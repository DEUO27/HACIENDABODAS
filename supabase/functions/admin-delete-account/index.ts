import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { getUserGlobalRole } from '../_shared/accounts.ts'
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
    const { adminClient, user: currentUser } = await assertAdmin(req)
    const body = await req.json()
    const userId = String(body.userId || '').trim()

    if (!userId) {
      return jsonResponse({ error: 'El userId es obligatorio.' }, 400)
    }

    if (userId === currentUser.id) {
      return jsonResponse({ error: 'No puedes eliminar tu propia cuenta admin desde esta pantalla.' }, 409)
    }

    const { data: authUserResponse, error: authUserError } = await adminClient.auth.admin.getUserById(userId)

    if (authUserError) {
      throw authUserError
    }

    const targetUser = authUserResponse.user

    if (!targetUser) {
      return jsonResponse({ error: 'Cuenta no encontrada.' }, 404)
    }

    const globalRole = getUserGlobalRole(targetUser) || 'esposos'

    if (globalRole === 'admin') {
      return jsonResponse({ error: 'No puedes eliminar cuentas admin desde esta pantalla.' }, 409)
    }

    const { count, error: membershipCountError } = await adminClient
      .from('event_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (membershipCountError) {
      throw membershipCountError
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteError) {
      throw deleteError
    }

    return jsonResponse({
      ok: true,
      deletedUserId: userId,
      deletedRole: globalRole,
      removedAssignments: count || 0,
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

    console.error('[admin-delete-account]', error)
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unexpected error.',
      details: error instanceof Error ? error.stack || error.message : String(error),
    }, 500)
  }
})
