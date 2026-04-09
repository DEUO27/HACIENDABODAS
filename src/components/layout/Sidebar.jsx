import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
    LayoutDashboard,
    Users,
    GitBranch,
    BarChart3,
    Users2,
    CalendarDays,
    Settings,
    LogOut,
    Menu,
    Sun,
    Moon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const adminMenuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
    { label: 'Eventos', icon: CalendarDays, to: '/eventos' },
    { label: 'Leads', icon: Users, to: '/dashboard/leads' },
    { label: 'Pipeline', icon: GitBranch, to: '/dashboard/pipeline' },
    { label: 'Analytics', icon: BarChart3, to: '/dashboard/analytics' },
    { label: 'Team', icon: Users2, to: '/dashboard/team' },
]

const plannerMenuItems = [
    { label: 'Eventos', icon: CalendarDays, to: '/eventos' },
]

const coupleMenuItems = [
    { label: 'Mi evento', icon: CalendarDays, to: '/eventos' },
]

const adminGeneralItems = [
    { label: 'Usuarios', icon: Users2, to: '/configuracion/usuarios' },
    { label: 'Mensajes', icon: Settings, to: '/configuracion/mensajes' },
]

const sharedGeneralItems = []

function SidebarContent({ onClose }) {
    const location = useLocation()
    const navigate = useNavigate()
    const { role, signOut } = useAuth()
    const { theme, setTheme } = useTheme()
    const menuItems = role === 'admin'
        ? adminMenuItems
        : role === 'planner'
            ? plannerMenuItems
            : coupleMenuItems
    const generalItems = role === 'admin'
        ? [...adminGeneralItems, ...sharedGeneralItems]
        : sharedGeneralItems

    const isActive = (to) => {
        if (to === '/dashboard') return location.pathname === '/dashboard'
        return location.pathname.startsWith(to)
    }

    const handleLogout = async () => {
        await signOut()
        navigate('/login', { replace: true })
    }

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark')
    }

    return (
        <div className="flex h-full flex-col bg-white dark:bg-slate-950">
            <div className="flex items-center justify-center gap-0 px-5 py-8">
                <img src="/logo.png" alt="Hacienda Bodas Logo" className="h-[75px] w-auto object-contain dark:brightness-0 dark:invert" />
            </div>

            <div className="px-6 pt-2">
                <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Menu</p>
                <nav className="space-y-2">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={onClose}
                            className={cn(
                                'flex items-center gap-4 rounded-none px-3 py-3 text-sm font-medium transition-colors',
                                isActive(item.to)
                                    ? 'bg-secondary text-foreground dark:bg-secondary dark:text-foreground'
                                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                            )}
                        >
                            {isActive(item.to) && (
                                <div className="absolute left-0 h-6 w-[2px] bg-foreground" />
                            )}
                            <item.icon className={cn('h-4 w-4 stroke-[1.5]', isActive(item.to) ? 'text-foreground' : 'text-muted-foreground')} />
                            <span className="font-medium tracking-wide">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
            </div>

            <div className="px-6 pt-8">
                {generalItems.length > 0 && (
                    <>
                        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">General</p>
                        <nav className="space-y-2">
                            {generalItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    onClick={onClose}
                                    className={cn(
                                        'flex items-center gap-4 rounded-none px-3 py-3 text-sm font-medium transition-colors',
                                        isActive(item.to)
                                            ? 'bg-secondary text-foreground dark:bg-secondary dark:text-foreground'
                                            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                                    )}
                                >
                                    <item.icon className="h-4 w-4 stroke-[1.5] text-muted-foreground" />
                                    <span className="font-medium tracking-wide">{item.label}</span>
                                </NavLink>
                            ))}
                        </nav>
                    </>
                )}
                <nav className="space-y-2">
                    <button
                        onClick={toggleTheme}
                        className="flex w-full items-center gap-4 rounded-none px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                    >
                        {theme === 'dark' ? (
                            <Sun className="h-4 w-4 stroke-[1.5]" />
                        ) : (
                            <Moon className="h-4 w-4 stroke-[1.5]" />
                        )}
                        <span className="font-medium tracking-wide">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                    <button
                        onClick={() => { handleLogout(); onClose?.() }}
                        className="flex w-full items-center gap-4 rounded-none px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                    >
                        <LogOut className="h-4 w-4 stroke-[1.5]" />
                        <span className="font-medium tracking-wide">Logout</span>
                    </button>
                </nav>
            </div>

            <div className="flex-1" />
        </div>
    )
}

export default function Sidebar() {
    const [open, setOpen] = useState(false)

    return (
        <>
            <aside className="hidden lg:block lg:w-60 lg:flex-shrink-0">
                <div className="fixed left-0 top-0 z-30 h-screen w-60 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                    <SidebarContent />
                </div>
            </aside>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="fixed left-4 top-4 z-50 lg:hidden text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-60 p-0 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                    <SheetTitle className="sr-only">Navegacion</SheetTitle>
                    <SidebarContent onClose={() => setOpen(false)} />
                </SheetContent>
            </Sheet>
        </>
    )
}
