import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Moon, ShieldCheck, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTheme } from '@/contexts/ThemeContext'
import { supabase } from '@/lib/supabase'

export default function SetPassword() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      const { data } = await supabase.auth.getSession()

      if (!isMounted) return

      setReady(Boolean(data.session))
      setLoading(false)
    }

    bootstrap()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      setReady(Boolean(session))
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const helperText = useMemo(() => {
    if (successMessage) {
      return successMessage
    }

    if (ready) {
      return 'Define una contrasena nueva para completar el acceso a tu cuenta.'
    }

    return 'Abre este enlace directamente desde el correo que recibiste para poder definir tu contrasena.'
  }, [ready, successMessage])

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    if (password.length < 8) {
      setErrorMessage('La contrasena debe tener al menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contrasenas no coinciden.')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) throw error

      await supabase.auth.signOut()
      setSuccessMessage('Tu acceso ya quedo listo. Inicia sesion con tu nueva contrasena.')
      setPassword('')
      setConfirmPassword('')
      setReady(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible actualizar la contrasena.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 transition-colors">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="absolute right-4 top-4 rounded-none text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      <Card className="w-full max-w-[420px] rounded-none border-border bg-card shadow-lg">
        <CardHeader className="space-y-3 text-center pb-8 pt-8 border-b border-border mb-6">
          <div className="mx-auto mb-2 flex items-center justify-center">
            <img src="/logo.png" alt="Hacienda Bodas Logo" className="h-[90px] w-auto object-contain dark:brightness-0 dark:invert" />
          </div>
          <CardDescription className="text-[10px] uppercase font-semibold tracking-widest text-muted-foreground">
            CONFIGURA EL ACCESO A TU CUENTA
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pb-8">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border">
              <ShieldCheck className="h-5 w-5 text-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{helperText}</p>
          </div>

          {errorMessage && (
            <Alert variant="destructive" className="rounded-none border-l-4 border-l-red-500 border-y-0 border-r-0 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="rounded-none border-l-4 border-l-emerald-500 border-y-0 border-r-0 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription className="text-xs">{successMessage}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : ready ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="set-password" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Nueva contrasena</Label>
                <Input
                  id="set-password"
                  type="password"
                  placeholder="MIN. 8 CARACTERES"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="rounded-none border-border bg-background h-10 focus-visible:ring-1 focus-visible:ring-primary transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="set-password-confirm" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Confirmar contrasena</Label>
                <Input
                  id="set-password-confirm"
                  type="password"
                  placeholder="REPETIR CONTRASENA"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  className="rounded-none border-border bg-background h-10 focus-visible:ring-1 focus-visible:ring-primary transition-colors"
                />
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-lg tracking-widest uppercase h-12"
              >
                {saving ? 'GUARDANDO...' : 'GUARDAR ACCESO'}
              </Button>
            </form>
          ) : (
            <Button
              className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-lg tracking-widest uppercase h-12"
              onClick={() => navigate('/login', { replace: true })}
            >
              IR A LOGIN
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
