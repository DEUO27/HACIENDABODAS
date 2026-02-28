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
        <div className="relative flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="absolute right-4 top-4 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Card className="w-full max-w-md rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
                <CardHeader className="space-y-1 text-center pb-2">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 dark:bg-emerald-600 shadow-lg shadow-emerald-600/20 dark:shadow-emerald-900/20">
                        <Sparkles className="h-7 w-7 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">Hacienda Bodas</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                        Accede o crea tu cuenta para gestionar leads
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="login" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100 dark:bg-slate-800 mb-4">
                            <TabsTrigger
                                value="login"
                                className="rounded-lg data-[state=active]:bg-emerald-700 data-[state=active]:text-white text-slate-500 dark:text-slate-400 dark:data-[state=active]:bg-emerald-600"
                            >
                                Iniciar Sesión
                            </TabsTrigger>
                            <TabsTrigger
                                value="signup"
                                className="rounded-lg data-[state=active]:bg-emerald-700 data-[state=active]:text-white text-slate-500 dark:text-slate-400 dark:data-[state=active]:bg-emerald-600"
                            >
                                Crear Cuenta
                            </TabsTrigger>
                        </TabsList>

                        {/* LOGIN */}
                        <TabsContent value="login">
                            <form onSubmit={handleLogin} className="space-y-4">
                                {loginError && (
                                    <Alert variant="destructive" className="rounded-xl border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>{loginError}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="login-email" className="text-slate-700 dark:text-slate-300">Correo electrónico</Label>
                                    <Input
                                        id="login-email"
                                        type="email"
                                        placeholder="tu@email.com"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        required
                                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="login-password" className="text-slate-700 dark:text-slate-300">Contraseña</Label>
                                    <Input
                                        id="login-password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        required
                                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={loginLoading}
                                    className="w-full rounded-full bg-emerald-700 dark:bg-emerald-600 font-semibold text-white shadow-lg shadow-emerald-600/20 dark:shadow-emerald-900/20 hover:bg-emerald-800 dark:hover:bg-emerald-700"
                                >
                                    {loginLoading ? (
                                        <span className="flex items-center gap-2">
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            Entrando...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <LogIn className="h-4 w-4" />
                                            Entrar
                                        </span>
                                    )}
                                </Button>

                                <div className="text-center">
                                    <button type="button" className="text-sm text-emerald-700 dark:text-emerald-500 hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors">
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>
                            </form>
                        </TabsContent>

                        {/* SIGNUP */}
                        <TabsContent value="signup">
                            <form onSubmit={handleSignup} className="space-y-4">
                                {signupError && (
                                    <Alert variant="destructive" className="rounded-xl border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>{signupError}</AlertDescription>
                                    </Alert>
                                )}
                                {signupSuccess && (
                                    <Alert className="rounded-xl border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <AlertDescription>{signupSuccess}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="signup-email" className="text-slate-700 dark:text-slate-300">Correo electrónico</Label>
                                    <Input
                                        id="signup-email"
                                        type="email"
                                        placeholder="tu@email.com"
                                        value={signupEmail}
                                        onChange={(e) => setSignupEmail(e.target.value)}
                                        required
                                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="signup-password" className="text-slate-700 dark:text-slate-300">Contraseña</Label>
                                    <Input
                                        id="signup-password"
                                        type="password"
                                        placeholder="Mínimo 6 caracteres"
                                        value={signupPassword}
                                        onChange={(e) => setSignupPassword(e.target.value)}
                                        required
                                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="signup-confirm" className="text-slate-700 dark:text-slate-300">Confirmar contraseña</Label>
                                    <Input
                                        id="signup-confirm"
                                        type="password"
                                        placeholder="Repite tu contraseña"
                                        value={signupConfirm}
                                        onChange={(e) => setSignupConfirm(e.target.value)}
                                        required
                                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="signup-role" className="text-slate-700 dark:text-slate-300">Rol</Label>
                                    <Select value={signupRole} onValueChange={setSignupRole}>
                                        <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">
                                            <SelectValue placeholder="Selecciona tu rol" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                                            <SelectItem value="admin" className="focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-slate-100">🛡️ Administrador</SelectItem>
                                            <SelectItem value="esposos" className="focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-slate-100">💍 Esposos</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">
                                        {signupRole === 'admin'
                                            ? 'Acceso completo al dashboard y gestión de leads'
                                            : 'Acceso a tu información de evento'}
                                    </p>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={signupLoading}
                                    className="w-full rounded-full bg-emerald-700 dark:bg-emerald-600 font-semibold text-white shadow-lg shadow-emerald-600/20 dark:shadow-emerald-900/20 hover:bg-emerald-800 dark:hover:bg-emerald-700"
                                >
                                    {signupLoading ? (
                                        <span className="flex items-center gap-2">
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            Creando cuenta...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <UserPlus className="h-4 w-4" />
                                            Crear Cuenta
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
