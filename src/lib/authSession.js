import { supabase } from '@/lib/supabase'

export const SESSION_EXPIRED_REASON = 'session-expired'
export const SESSION_EXPIRED_MESSAGE = 'Tu sesion expiro. Vuelve a iniciar sesion.'

function getSupabaseProjectRef() {
  try {
    const hostname = new URL(import.meta.env.VITE_SUPABASE_URL || '').hostname
    return hostname.split('.')[0] || ''
  } catch {
    return ''
  }
}

function clearStorageKeys(storage, matcher) {
  try {
    Object.keys(storage).forEach((key) => {
      if (matcher(key)) {
        storage.removeItem(key)
      }
    })
  } catch {
    // Ignore storage cleanup failures in restricted environments.
  }
}

export function clearSupabaseAuthStorage() {
  if (typeof window === 'undefined') return

  const projectRef = getSupabaseProjectRef()
  const matchesAuthKey = (key) => {
    const normalizedKey = String(key || '')
    return normalizedKey.includes('auth-token') && (!projectRef || normalizedKey.includes(projectRef))
  }

  clearStorageKeys(window.localStorage, matchesAuthKey)
  clearStorageKeys(window.sessionStorage, matchesAuthKey)
}

export function isSessionAuthError(message, status) {
  const normalized = String(message || '').toLowerCase()

  return (
    status === 401 ||
    normalized.includes('invalid jwt') ||
    normalized.includes('jwt expired') ||
    normalized.includes('unauthorized')
  )
}

export function getSessionReasonMessage(reason) {
  if (reason === SESSION_EXPIRED_REASON) return SESSION_EXPIRED_MESSAGE
  return SESSION_EXPIRED_MESSAGE
}

export async function forceSignOutAndRedirect(reason = SESSION_EXPIRED_REASON, { redirect = true } = {}) {
  if (reason) {
    console.warn('[forced_signout]', reason)
  }

  try {
    await supabase.auth.signOut()
  } catch {
    // Continue with local cleanup even if remote sign-out fails.
  }

  clearSupabaseAuthStorage()

  if (!redirect || typeof window === 'undefined') return

  const loginUrl = new URL('/login', window.location.origin)
  if (reason) {
    loginUrl.searchParams.set('reason', reason)
  }

  const currentLocation = `${window.location.pathname}${window.location.search}`
  const targetLocation = `${loginUrl.pathname}${loginUrl.search}`

  if (currentLocation !== targetLocation) {
    window.location.assign(loginUrl.toString())
  }
}
