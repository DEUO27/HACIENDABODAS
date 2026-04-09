import { adminClient, createUserClient } from './supabase.ts'

async function assertAllowedRoles(req: Request, allowedRoles: string[]) {
  const authHeader = req.headers.get('Authorization') || ''
  const accessToken = authHeader.replace('Bearer ', '').trim()

  if (!accessToken) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const userClient = createUserClient(accessToken)
  const { data, error } = await userClient.auth.getUser(accessToken)

  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  if (!allowedRoles.includes(data.user.user_metadata?.role || '')) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  return {
    user: data.user,
    adminClient,
  }
}

export async function assertAdmin(req: Request) {
  return assertAllowedRoles(req, ['admin'])
}

export async function assertEventOperator(req: Request) {
  return assertAllowedRoles(req, ['admin', 'esposos'])
}
