import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function DashboardLayout({ onRefresh, refreshing }) {
    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
            <Sidebar />
            <div className="flex flex-1 flex-col">
                <Topbar onRefresh={onRefresh} refreshing={refreshing} />
                <main className="flex-1 overflow-auto px-6 pb-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
