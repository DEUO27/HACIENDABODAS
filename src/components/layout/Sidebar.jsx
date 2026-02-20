import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
    LayoutDashboard,
    Users,
    GitBranch,
    BarChart3,
    Users2,
    Settings,
    HelpCircle,
    LogOut,
    Menu,
    Sparkles,
    Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
    { label: 'Leads', icon: Users, to: '/dashboard/leads' },
    { label: 'Pipeline', icon: GitBranch, to: '/dashboard/pipeline' },
    { label: 'Analytics', icon: BarChart3, to: '/dashboard/analytics' },
    { label: 'Team', icon: Users2, to: '/dashboard/team' },
]

const generalItems = [
    { label: 'Settings', icon: Settings, to: '/dashboard/settings' },
    { label: 'Help', icon: HelpCircle, to: '/dashboard/help' },
]

function SidebarContent({ onClose }) {
    const location = useLocation()
    const navigate = useNavigate()
    const { signOut } = useAuth()

    const isActive = (to) => {
        if (to === '/dashboard') return location.pathname === '/dashboard'
        return location.pathname.startsWith(to)
    }

    const handleLogout = async () => {
        await signOut()
        navigate('/login', { replace: true })
    }

    return (
        <div className="flex h-full flex-col bg-white">
            {/* Logo */}
            <div className="flex items-center gap-3 px-5 py-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700">
                    <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-slate-900">Hacienda</span>
            </div>

            {/* Menu */}
            <div className="px-4 pt-2">
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Menu</p>
                <nav className="space-y-1">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={onClose}
                            className={cn(
                                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                                isActive(item.to)
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            )}
                        >
                            {isActive(item.to) && (
                                <div className="absolute left-0 h-6 w-1 rounded-r-full bg-emerald-700" />
                            )}
                            <item.icon className={cn('h-5 w-5', isActive(item.to) ? 'text-emerald-700' : 'text-slate-400')} />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </div>

            {/* General */}
            <div className="px-4 pt-6">
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">General</p>
                <nav className="space-y-1">
                    {generalItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={onClose}
                            className={cn(
                                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                                isActive(item.to)
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            )}
                        >
                            <item.icon className="h-5 w-5 text-slate-400" />
                            {item.label}
                        </NavLink>
                    ))}
                    <button
                        onClick={() => { handleLogout(); onClose?.(); }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                    >
                        <LogOut className="h-5 w-5 text-slate-400" />
                        Logout
                    </button>
                </nav>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Bottom promo card */}
            <div className="p-4">
                <div className="relative overflow-hidden rounded-2xl bg-emerald-800 p-5 text-white">
                    <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-emerald-700/50" />
                    <div className="absolute -bottom-6 -right-6 h-20 w-20 rounded-full bg-emerald-600/30" />
                    <div className="relative">
                        <Download className="mb-3 h-6 w-6" />
                        <p className="text-sm font-bold">Descarga la App</p>
                        <p className="mt-1 text-xs text-emerald-200">Gestiona leads desde tu móvil</p>
                        <Button
                            size="sm"
                            className="mt-3 rounded-full bg-emerald-500 text-xs font-semibold text-white hover:bg-emerald-400"
                        >
                            Download
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function Sidebar() {
    const [open, setOpen] = useState(false)

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="hidden lg:block lg:w-60 lg:flex-shrink-0">
                <div className="fixed left-0 top-0 z-30 h-screen w-60 border-r border-slate-200 bg-white">
                    <SidebarContent />
                </div>
            </aside>

            {/* Mobile trigger + sheet */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="fixed left-4 top-4 z-50 lg:hidden text-slate-700 hover:bg-slate-100"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-60 p-0 border-slate-200 bg-white">
                    <SheetTitle className="sr-only">Navegación</SheetTitle>
                    <SidebarContent onClose={() => setOpen(false)} />
                </SheetContent>
            </Sheet>
        </>
    )
}
