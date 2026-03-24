import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AlertTriangle, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function Unauthorized() {
    const navigate = useNavigate()
    const { signOut } = useAuth()

    const handleLogout = async () => {
        await signOut()
        navigate('/login', { replace: true })
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-[420px] text-center p-8 border border-border bg-card shadow-lg flex flex-col items-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center bg-red-50 dark:bg-red-950/20 rounded-full">
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
                <h1 className="mb-2 font-heading text-3xl tracking-widest text-foreground uppercase">ACCESO DENEGADO</h1>
                <p className="mb-8 text-[10px] uppercase font-semibold tracking-widest text-muted-foreground leading-relaxed">
                    LO SENTIMOS, TU ROL DE CUENTA NO TIENE PERMISOS PARA GESTIONAR LEADS.
                </p>
                <div className="w-full">
                    <Button
                        onClick={handleLogout}
                        className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-base tracking-widest uppercase h-12"
                    >
                        <LogOut className="mr-3 h-4 w-4" />
                        CERRAR SESION
                    </Button>
                </div>
            </div>
        </div>
    )
}
