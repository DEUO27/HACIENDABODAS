import { useAuth } from '@/contexts/AuthContext'
import { useFilters } from '@/contexts/FilterContext'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Mail, Bell, LogOut, Settings, ChevronDown, RefreshCw, Download, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export default function Topbar({ onRefresh, refreshing }) {
    const { user, role, signOut } = useAuth()
    const { setIsExportOpen } = useFilters()
    const { theme, setTheme } = useTheme()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await signOut()
        navigate('/login', { replace: true })
    }

    const initials = user?.email?.slice(0, 2)?.toUpperCase() || 'HB'

    return (
        <div className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-950">
            {/* Top bar */}
            <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 py-3">
                {/* Spacer for mobile hamburger */}
                <div className="w-8 lg:hidden" />
                <div className="flex-1" />

                <div className="flex items-center gap-2 ml-auto">
                    {/* Notifications & Theme */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                        {theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200">
                        <Mail className="h-4.5 w-4.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200">
                        <Bell className="h-4.5 w-4.5" />
                    </Button>

                    {/* User dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                <Avatar className="h-8 w-8 border border-border rounded-none">
                                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-heading tracking-widest">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="hidden md:block text-left">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                                        {user?.email?.split('@')[0] || 'Usuario'}
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">{user?.email || ''}</p>
                                </div>
                                <ChevronDown className="hidden md:block h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-none border-border bg-card shadow-lg">
                            <DropdownMenuLabel>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.email}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                    {role === 'admin' ? 'Administrador' : 'Esposos'}
                                </p>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                            <DropdownMenuItem className="cursor-pointer rounded-none text-muted-foreground focus:bg-secondary focus:text-foreground">
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleLogout}
                                className="cursor-pointer rounded-none text-muted-foreground focus:bg-secondary focus:text-foreground"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                Cerrar sesión
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Page header */}
            <div className="flex flex-col gap-3 px-8 py-8 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-heading text-4xl text-slate-900 dark:text-slate-100">Dashboard</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gestiona y analiza todos tus leads en un solo lugar.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={onRefresh}
                        disabled={refreshing}
                        variant="outline"
                        className="rounded-none border-foreground px-6 py-5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-900/50"
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        onClick={() => setIsExportOpen(true)}
                        className="rounded-none bg-primary px-6 py-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>
        </div>
    )
}
