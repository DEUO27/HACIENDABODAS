import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, LogIn, Moon, Sun } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { getSessionReasonMessage, SESSION_EXPIRED_REASON } from '@/lib/authSession'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Login() {
  const { signIn } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const sessionNotice = useMemo(() => {
    const reason = new URLSearchParams(location.search).get('reason')
    if (reason === SESSION_EXPIRED_REASON) {
      return getSessionReasonMessage(reason)
    }
    return ''
  }, [location.search])

  async function handleLogin(event) {
    event.preventDefault()
    setLoginError('')
    setLoginLoading(true)

    try {
      await signIn(loginEmail, loginPassword)
      navigate('/', { replace: true })
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Error al iniciar sesion.')
    } finally {
      setLoginLoading(false)
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
            ACCESO PRIVADO A CRM Y EVENTOS
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {!loginError && sessionNotice && (
              <Alert className="rounded-none border-l-4 border-l-amber-500 border-y-0 border-r-0 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{sessionNotice}</AlertDescription>
              </Alert>
            )}

            {loginError && (
              <Alert variant="destructive" className="rounded-none border-l-4 border-l-red-500 border-y-0 border-r-0 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{loginError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Correo electronico</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="tu@email.com"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                required
                className="rounded-none border-border bg-background h-10 focus-visible:ring-1 focus-visible:ring-primary transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contrasena</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="********"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                required
                className="rounded-none border-border bg-background h-10 focus-visible:ring-1 focus-visible:ring-primary transition-colors"
              />
            </div>

            <div className="space-y-4">
              <Button
                type="submit"
                disabled={loginLoading}
                className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-lg tracking-widest uppercase h-12"
              >
                {loginLoading ? (
                  <span className="flex items-center gap-3">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    ENTRANDO...
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <LogIn className="h-4 w-4" />
                    ENTRAR
                  </span>
                )}
              </Button>

              <div className="border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                Si te invitaron como planner o esposos, revisa el correo de acceso que te enviaron para definir tu contrasena.
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
