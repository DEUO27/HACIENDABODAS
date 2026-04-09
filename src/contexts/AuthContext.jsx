/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
    forceSignOutAndRedirect,
    getSessionReasonMessage,
    isSessionAuthError,
    SESSION_EXPIRED_REASON,
} from '@/lib/authSession'

const AuthContext = createContext(null)

async function validateSession(candidateSession, { allowRefresh = true } = {}) {
    if (!candidateSession?.access_token) {
        return { session: null, user: null, error: null }
    }

    let activeSession = candidateSession
    let userResult = await supabase.auth.getUser(activeSession.access_token)

    if ((userResult.error || !userResult.data?.user) && allowRefresh && activeSession.refresh_token) {
        const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession({
            refresh_token: activeSession.refresh_token,
        })

        if (!refreshError && refreshedData?.session?.access_token) {
            activeSession = refreshedData.session
            userResult = await supabase.auth.getUser(activeSession.access_token)
        }
    }

    if (userResult.error || !userResult.data?.user) {
        return {
            session: null,
            user: null,
            error: userResult.error || new Error(getSessionReasonMessage(SESSION_EXPIRED_REASON)),
        }
    }

    return {
        session: activeSession,
        user: userResult.data.user,
        error: null,
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    // Derive role from user metadata
    const role = user?.user_metadata?.role || 'esposos'

    useEffect(() => {
        let isMounted = true

        async function bootstrapSession() {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                if (isMounted) {
                    setUser(null)
                    setLoading(false)
                }
                return
            }

            const { user: validatedUser, error } = await validateSession(session)

            if (error || !validatedUser) {
                if (isSessionAuthError(error?.message, error?.status) && typeof window !== 'undefined' && window.location.pathname !== '/login') {
                    await forceSignOutAndRedirect(SESSION_EXPIRED_REASON)
                } else {
                    await forceSignOutAndRedirect(SESSION_EXPIRED_REASON, { redirect: false })
                }

                if (isMounted) {
                    setUser(null)
                    setLoading(false)
                }
                return
            }

            if (isMounted) {
                setUser(validatedUser)
                setLoading(false)
            }
        }

        bootstrapSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null)
                setLoading(false)
            }
        )

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [])

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        const { user: validatedUser, error: validationError } = await validateSession(data.session, { allowRefresh: true })

        if (validationError || !validatedUser) {
            await forceSignOutAndRedirect(SESSION_EXPIRED_REASON, { redirect: false })
            throw new Error(getSessionReasonMessage(SESSION_EXPIRED_REASON))
        }

        setUser(validatedUser)
        return validatedUser
    }

    const signUp = async (email, password, role = 'esposos') => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { role },
            },
        })
        if (error) throw error
    }

    const signOut = async () => {
        await forceSignOutAndRedirect(null, { redirect: false })
    }

    return (
        <AuthContext.Provider value={{ user, role, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within AuthProvider')
    return context
}
