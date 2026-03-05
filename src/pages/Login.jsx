import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { LogIn, UserPlus, AlertCircle, CheckCircle2, Sparkles, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export default function Login() {
    const { signIn, signUp } = useAuth()
    const { theme, setTheme } = useTheme()
    const navigate = useNavigate()

    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')
    const [loginError, setLoginError] = useState('')
    const [loginLoading, setLoginLoading] = useState(false)

    const [signupEmail, setSignupEmail] = useState('')
    const [signupPassword, setSignupPassword] = useState('')
    const [signupConfirm, setSignupConfirm] = useState('')
    const [signupRole, setSignupRole] = useState('esposos')
    const [signupError, setSignupError] = useState('')
    const [signupSuccess, setSignupSuccess] = useState('')
    const [signupLoading, setSignupLoading] = useState(false)

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoginError('')
        setLoginLoading(true)
        try {
            await signIn(loginEmail, loginPassword)
            navigate('/dashboard', { replace: true })
        } catch (err) {
            setLoginError(err.message || 'Error al iniciar sesión')
        } finally {
            setLoginLoading(false)
        }
    }

    const handleSignup = async (e) => {
        e.preventDefault()
        setSignupError('')
        setSignupSuccess('')
        if (signupPassword !== signupConfirm) {
            setSignupError('Las contraseñas no coinciden')
            return
        }
        if (signupPassword.length < 6) {
            setSignupError('La contraseña debe tener al menos 6 caracteres')
            return
        }
        setSignupLoading(true)
        try {
            await signUp(signupEmail, signupPassword, signupRole)
            setSignupSuccess('¡Cuenta creada! Revisa tu correo para confirmar.')
            setSignupEmail('')
            setSignupPassword('')
            setSignupConfirm('')
            setSignupRole('esposos')
        } catch (err) {
            setSignupError(err.message || 'Error al crear cuenta')
        } finally {
            setSignupLoading(false)
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
                        ACCEDE O CREA TU CUENTA PARA GESTIONAR LEADS
                    </CardDescription>
                </CardHeader>
                <CardContent className="pb-8">
                    <Tabs defaultValue="login" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 rounded-none bg-secondary p-1 mb-8">
                            <TabsTrigger
                                value="login"
                                className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] uppercase tracking-widest font-semibold text-muted-foreground transition-all"
                            >
                                INICIAR SESIÓN
                            </TabsTrigger>
                            <TabsTrigger
                                value="signup"
                                className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] uppercase tracking-widest font-semibold text-muted-foreground transition-all"
                            >
                                CREAR CUENTA
                            </TabsTrigger>
                        </TabsList>

                        {/* LOGIN */}
                        <TabsContent value="login" className="mt-0">
                            <form onSubmit={handleLogin} className="space-y-6">
                                {loginError && (
                                    <Alert variant="destructive" className="rounded-none border-l-4 border-l-red-500 border-y-0 border-r-0 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription className="text-xs">{loginError}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-1.5">
                                    <Label htmlFor="login-email" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Correo electrónico</Label>
                                    <Input
                                        id="login-email"
                                        type="email"
                                        placeholder="tu@email.com"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        required
                                        className="rounded-none border-border bg-background h-10 focus-visible:ring-1 focus-visible:ring-primary transition-colors"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="login-password" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contraseña</Label>
                                    <Input
                                        id="login-password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        required
                                        className="rounded-none border-border bg-background h-10 focus-visible:ring-1 focus-visible:ring-primary transition-colors"
                                    />
                                </div>

                                <div>
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
                                    <div className="text-center mt-3">
                                        <button type="button" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                                            ¿OLVIDASTE TU CONTRASEÑA?
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </TabsContent>

                        {/* SIGNUP */}
                        <TabsContent value="signup" className="mt-0">
                            <form onSubmit={handleSignup} className="space-y-6">
                                {signupError && (
                                    <Alert variant="destructive" className="rounded-none border-l-4 border-l-red-500 border-y-0 border-r-0 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription className="text-xs">{signupError}</AlertDescription>
                                    </Alert>
                                )}
                                {signupSuccess && (
                                    <Alert className="rounded-none border-l-4 border-l-emerald-500 border-y-0 border-r-0 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <AlertDescription className="text-xs">{signupSuccess}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-1.5">
                                    <Label htmlFor="signup-email" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Correo electrónico</Label>
                                    <Input
                                        id="signup-email"
                                        type="email"
                                        placeholder="tu@email.com"
                                        value={signupEmail}
                                        onChange={(e) => setSignupEmail(e.target.value)}
                                        required
                                        className="rounded-none border-border bg-background h-10 focus-visible:ring-1 focus-visible:ring-primary transition-colors"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="signup-password" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contraseña</Label>
                                    <Input
                                        id="signup-password"
                                        type="password"
                                        placeholder="MÍN. 6 CARACTERES"
                                        value={signupPassword}
                                        onChange={(e) => setSignupPassword(e.target.value)}
                                        required
                                        className="rounded-none border-border bg-background h-10 focus-visible:ring-1 focus-visible:ring-primary transition-colors"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="signup-confirm" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Confirmar contraseña</Label>
                                    <Input
                                        id="signup-confirm"
                                        type="password"
                                        placeholder="REPITE TU CONTRASEÑA"
                                        value={signupConfirm}
                                        onChange={(e) => setSignupConfirm(e.target.value)}
                                        required
                                        className="rounded-none border-border bg-background h-10 focus-visible:ring-1 focus-visible:ring-primary transition-colors"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="signup-role" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Rol</Label>
                                    <Select value={signupRole} onValueChange={setSignupRole}>
                                        <SelectTrigger className="rounded-none border-border bg-background h-10 focus:ring-1 focus:ring-primary transition-colors">
                                            <SelectValue placeholder="SELECCIONA TU ROL" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-none border-border bg-background">
                                            <SelectItem value="admin" className="focus:bg-secondary focus:text-foreground rounded-none text-xs">🛡️ ADMINISTRADOR</SelectItem>
                                            <SelectItem value="esposos" className="focus:bg-secondary focus:text-foreground rounded-none text-xs">💍 ESPOSOS</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1.5">
                                        {signupRole === 'admin'
                                            ? 'Acceso completo al dashboard y gestión de leads'
                                            : 'Acceso a tu información de evento'}
                                    </p>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={signupLoading}
                                    className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-lg tracking-widest uppercase h-12"
                                >
                                    {signupLoading ? (
                                        <span className="flex items-center gap-3">
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                            CREANDO...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-3">
                                            <UserPlus className="h-4 w-4" />
                                            CREAR CUENTA
                                        </span>
                                    )}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
