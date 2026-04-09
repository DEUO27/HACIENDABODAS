import { adminClient, createUserClient } from './supabase.ts'

function getGlobalRole(user: { app_metadata?: Record<string, unknown> } | null | undefined) {
  return String(user?.app_metadata?.role || '').trim()
}

async function authenticateRequest(req: Request) {
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

  return {
    user: data.user,
    role: getGlobalRole(data.user),
    adminClient,
  }
}

async function assertAllowedRoles(req: Request, allowedRoles: string[]) {
  const context = await authenticateRequest(req)

  if (!allowedRoles.includes(context.role)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  return context
}

export async function assertAdmin(req: Request) {
  return assertAllowedRoles(req, ['admin'])
}

export async function assertEventOperator(req: Request) {
  return assertAllowedRoles(req, ['admin', 'planner', 'esposos'])
}

export async function assertEventAccess(
  req: Request,
  eventId: string,
  options: {
    allowedGlobalRoles?: string[]
    allowedMembershipRoles?: string[]
  } = {},
) {
  const {
    allowedGlobalRoles = ['admin', 'planner', 'esposos'],
    allowedMembershipRoles = [],
  } = options

  const context = await assertAllowedRoles(req, allowedGlobalRoles)

  if (context.role === 'admin') {
    return context
  }

  let query = adminClient
    .from('event_memberships')
    .select('id, membership_role')
    .eq('event_id', eventId)
    .eq('user_id', context.user.id)

  if (allowedMembershipRoles.length) {
    query = query.in('membership_role', allowedMembershipRoles)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  return {
    ...context,
    membership: data,
  }
}
