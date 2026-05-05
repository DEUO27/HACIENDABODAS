import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import {
  findAuthUserByEmail,
  getUserGlobalRole,
  resetUserTemporaryPassword,
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
    const { adminClient, user: requester } = await assertAdmin(req)
    const body = await req.json().catch(() => ({}))

    const userId = String(body.userId || '').trim()
    const email = String(body.email || '').trim().toLowerCase()

    if (!userId && !email) {
      return jsonResponse({ error: 'userId o email son obligatorios.' }, 400)
    }

    let targetUser = null

    if (userId) {
      const { data, error } = await adminClient.auth.admin.getUserById(userId)
      if (error) throw error
      targetUser = data.user || null
    } else if (email) {
      targetUser = await findAuthUserByEmail(email)
    }

    if (!targetUser) {
      return jsonResponse({ error: 'No se encontro la cuenta indicada.' }, 404)
    }

    if (requester?.id && targetUser.id === requester.id) {
      return jsonResponse({ error: 'No puedes regenerar la contrasena de tu propia cuenta desde aqui.' }, 409)
    }

    if (getUserGlobalRole(targetUser) === 'admin') {
      return jsonResponse({ error: 'No puedes regenerar la contrasena de una cuenta admin desde aqui.' }, 409)
    }

    const reset = await resetUserTemporaryPassword(
      targetUser.id,
      targetUser.user_metadata || {},
    )

    return jsonResponse({
      ok: true,
      access: {
        isNewAccount: false,
        temporaryPassword: reset.temporaryPassword,
        mustChangePassword: true,
      },
      account: {
        userId: reset.user.id,
        email: reset.user.email || targetUser.email || '',
        fullName: reset.user.user_metadata?.full_name || '',
        globalRole: getUserGlobalRole(reset.user),
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

    console.error('[admin-reset-account-password]', error)
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unexpected error.',
      details: error instanceof Error ? error.stack || error.message : String(error),
    }, 500)
  }
})
