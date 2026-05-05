import { adminClient } from './supabase.ts'

function normalizeEmail(value: string) {
  return String(value || '').trim().toLowerCase()
}

const READABLE_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function generateReadablePassword() {
  const groups = 3
  const groupSize = 4
  const totalChars = groups * groupSize
  const buffer = new Uint32Array(totalChars)
  crypto.getRandomValues(buffer)

  const chars: string[] = []
  for (let i = 0; i < totalChars; i++) {
    chars.push(READABLE_PASSWORD_ALPHABET[buffer[i] % READABLE_PASSWORD_ALPHABET.length])
  }

  const parts: string[] = []
  for (let i = 0; i < groups; i++) {
    parts.push(chars.slice(i * groupSize, (i + 1) * groupSize).join(''))
  }
  return parts.join('-')
}

export function userMustChangePassword(
  user: { user_metadata?: Record<string, unknown> } | null | undefined,
) {
  return user?.user_metadata?.must_change_password === true
}

export function getUserGlobalRole(
  user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null | undefined,
) {
  return String(user?.app_metadata?.role || user?.user_metadata?.role || '').trim()
}

export function resolveSetPasswordRedirect() {
  const baseUrl = String(
    Deno.env.get('PUBLIC_APP_URL')
    || Deno.env.get('VITE_PUBLIC_APP_URL')
    || '',
  ).trim()

  if (!baseUrl) {
    return undefined
  }

  return `${baseUrl.replace(/\/$/, '')}/set-password`
}

export async function listAllAuthUsers() {
  const users: any[] = []
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) {
      throw error
    }

    const batch = data?.users || []
    users.push(...batch)

    if (batch.length < perPage) {
      break
    }

    page += 1
  }

  return users
}

export async function findAuthUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('user_id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  if (profile?.user_id) {
    const { data, error } = await adminClient.auth.admin.getUserById(profile.user_id)

    if (error) {
      throw error
    }

    return data.user || null
  }

  const users = await listAllAuthUsers()
  return users.find((user) => normalizeEmail(user.email) === normalizedEmail) || null
}

export async function createUserWithRole({
  email,
  fullName,
  role,
}: {
  email: string
  fullName?: string
  role: 'planner' | 'esposos'
}) {
  const normalizedEmail = normalizeEmail(email)
  const temporaryPassword = generateReadablePassword()
  const { data, error } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: {
      role,
    },
    user_metadata: {
      full_name: String(fullName || '').trim(),
      must_change_password: true,
    },
  })

  if (error) {
    throw error
  }

  return { user: data.user, temporaryPassword }
}

export async function resetUserTemporaryPassword(
  userId: string,
  currentUserMetadata: Record<string, unknown> = {},
) {
  const temporaryPassword = generateReadablePassword()
  const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
    user_metadata: {
      ...currentUserMetadata,
      must_change_password: true,
    },
  })

  if (error) {
    throw error
  }

  return { user: data.user, temporaryPassword }
}

export async function updateAuthUserRoleAndName(
  userId: string,
  {
    role,
    fullName,
    currentUserMetadata = {},
    currentAppMetadata = {},
  }: {
    role: 'planner' | 'esposos'
    fullName?: string
    currentUserMetadata?: Record<string, unknown>
    currentAppMetadata?: Record<string, unknown>
  },
) {
  const nextUserMetadata = {
    ...currentUserMetadata,
  }

  if (fullName && String(fullName).trim()) {
    nextUserMetadata.full_name = String(fullName).trim()
  }

  const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...currentAppMetadata,
      role,
    },
    user_metadata: nextUserMetadata,
  })

  if (error) {
    throw error
  }

  return data.user
}

function normalizeInviteErrorMessage(message: string) {
  const normalized = String(message || '').trim()
  const lowercase = normalized.toLowerCase()

  if (lowercase.includes('redirect') || lowercase.includes('allow list') || lowercase.includes('not allowed')) {
    return 'La cuenta se guardo, pero el correo no se pudo enviar porque la URL de redireccion no esta autorizada en Supabase Auth.'
  }

  if (lowercase.includes('rate limit')) {
    return 'La cuenta se guardo, pero Supabase bloqueo temporalmente el envio del correo por limite de frecuencia.'
  }

  if (lowercase.includes('email')) {
    return `La cuenta se guardo, pero el correo de acceso no se pudo enviar: ${normalized}`
  }

  return 'La cuenta se guardo, pero no fue posible enviar el correo de acceso.'
}

export async function sendSetPasswordEmail(email: string) {
  try {
    const redirectTo = resolveSetPasswordRedirect()
    const { error } = await adminClient.auth.resetPasswordForEmail(
      normalizeEmail(email),
      redirectTo ? { redirectTo } : undefined,
    )

    if (error) {
      return {
        sent: false,
        error: normalizeInviteErrorMessage(error.message),
        rawError: error.message,
      }
    }

    return {
      sent: true,
      error: null,
      rawError: null,
    }
  } catch (error) {
    const rawError = error instanceof Error ? error.message : 'Unexpected invite error.'
    return {
      sent: false,
      error: normalizeInviteErrorMessage(rawError),
      rawError,
    }
  }
}
