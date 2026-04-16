import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function DashboardLayout({ onRefresh, refreshing }) {
    const [isSidebarHidden, setIsSidebarHidden] = useState(() => {
        return globalThis?.localStorage?.getItem('hb_sidebar_hidden') === 'true'
    })

    useEffect(() => {
        globalThis?.localStorage?.setItem('hb_sidebar_hidden', isSidebarHidden ? 'true' : 'false')
    }, [isSidebarHidden])

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
            <Sidebar hidden={isSidebarHidden} />
            <div className="flex flex-1 flex-col">
                <Topbar
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    isSidebarHidden={isSidebarHidden}
                    onToggleSidebar={() => setIsSidebarHidden(prev => !prev)}
                />
                <main className="flex-1 overflow-auto px-6 pb-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
