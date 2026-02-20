import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function DashboardLayout({ onRefresh, refreshing, searchValue, onSearchChange }) {
    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar />
            <div className="flex flex-1 flex-col">
                <Topbar
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    searchValue={searchValue}
                    onSearchChange={onSearchChange}
                />
                <main className="flex-1 overflow-auto px-6 pb-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
