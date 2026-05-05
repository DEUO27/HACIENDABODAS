import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import {
  createUserWithRole,
  findAuthUserByEmail,
  getUserGlobalRole,
  resetUserTemporaryPassword,
  updateAuthUserRoleAndName,
  userMustChangePassword,
} from '../_shared/accounts.ts'
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
    const body = await req.json()

    const email = String(body.email || '').trim().toLowerCase()
    const fullName = String(body.fullName || '').trim()

    if (!email) {
      return jsonResponse({ error: 'El correo es obligatorio.' }, 400)
    }

    let user = await findAuthUserByEmail(email)
    let action: 'created' | 'promoted' | 'updated' = 'updated'
    let temporaryPassword: string | null = null

    if (!user) {
      const created = await createUserWithRole({
        email,
        fullName,
        role: 'planner',
      })
      user = created.user
      temporaryPassword = created.temporaryPassword
      action = 'created'
    } else {
      const currentRole = getUserGlobalRole(user)

      if (currentRole === 'admin') {
        return jsonResponse({ error: 'No puedes convertir una cuenta admin a planner desde esta pantalla.' }, 409)
      }

      if (currentRole === 'esposos') {
        const { count, error: spouseCountError } = await adminClient
          .from('event_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('membership_role', 'esposos')

        if (spouseCountError) throw spouseCountError
        if ((count || 0) > 0) {
          return jsonResponse({ error: 'Esta cuenta ya esta asignada como esposos a un evento. Debes desvincularla antes de promoverla.' }, 409)
        }
      }

      const wasUnactivated = userMustChangePassword(user)

      user = await updateAuthUserRoleAndName(user.id, {
        role: 'planner',
        fullName,
        currentUserMetadata: user.user_metadata || {},
        currentAppMetadata: user.app_metadata || {},
      })
      action = currentRole === 'planner' ? 'updated' : 'promoted'

      if (wasUnactivated) {
        const reset = await resetUserTemporaryPassword(user.id, user.user_metadata || {})
        user = reset.user
        temporaryPassword = reset.temporaryPassword
      }
    }

    return jsonResponse({
      ok: true,
      action,
      access: {
        isNewAccount: action === 'created',
        temporaryPassword,
        mustChangePassword: temporaryPassword ? true : userMustChangePassword(user),
      },
      account: {
        userId: user.id,
        email: user.email || email,
        fullName: fullName || user.user_metadata?.full_name || '',
        globalRole: 'planner',
      },
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

    console.error('[admin-upsert-account]', error)
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unexpected error.',
      details: error instanceof Error ? error.stack || error.message : String(error),
    }, 500)
  }
})
