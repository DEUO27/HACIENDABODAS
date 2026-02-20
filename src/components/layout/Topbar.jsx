import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
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
import { Search, Mail, Bell, LogOut, Settings, ChevronDown, RefreshCw, Download } from 'lucide-react'

export default function Topbar({ onRefresh, refreshing, searchValue, onSearchChange }) {
    const { user, role, signOut } = useAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await signOut()
        navigate('/login', { replace: true })
    }

    const initials = user?.email?.slice(0, 2)?.toUpperCase() || 'HB'

    return (
        <div className="sticky top-0 z-20 bg-slate-50">
            {/* Top bar */}
            <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
                {/* Spacer for mobile hamburger */}
                <div className="w-8 lg:hidden" />

                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder="Search leads"
                        value={searchValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="h-9 rounded-xl border-slate-200 bg-slate-50 pl-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    {/* Notifications */}
                    <Button variant="ghost" size="icon" className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                        <Mail className="h-4.5 w-4.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                        <Bell className="h-4.5 w-4.5" />
                    </Button>

                    {/* User dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-slate-50">
                                <Avatar className="h-8 w-8 border border-slate-200">
                                    <AvatarFallback className="bg-emerald-100 text-xs font-bold text-emerald-700">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="hidden md:block text-left">
                                    <p className="text-sm font-semibold text-slate-800 leading-tight">
                                        {user?.email?.split('@')[0] || 'Usuario'}
                                    </p>
                                    <p className="text-xs text-slate-400">{user?.email || ''}</p>
                                </div>
                                <ChevronDown className="hidden md:block h-3.5 w-3.5 text-slate-400" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl border-slate-200 bg-white shadow-lg">
                            <DropdownMenuLabel>
                                <p className="text-sm font-semibold text-slate-800">{user?.email}</p>
                                <p className="text-xs text-slate-400">
                                    {role === 'admin' ? 'Administrador' : 'Esposos'}
                                </p>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="cursor-pointer rounded-lg text-slate-600">
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleLogout}
                                className="cursor-pointer rounded-lg text-red-600 focus:bg-red-50 focus:text-red-600"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                Cerrar sesión
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Page header */}
            <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                    <p className="text-sm text-slate-500">Gestiona y analiza todos tus leads en un solo lugar.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={onRefresh}
                        disabled={refreshing}
                        variant="outline"
                        className="rounded-full border-slate-200 px-5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button className="rounded-full bg-emerald-700 px-5 text-sm font-medium text-white hover:bg-emerald-800">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>
        </div>
    )
}
