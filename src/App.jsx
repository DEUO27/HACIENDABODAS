import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { FilterProvider } from '@/contexts/FilterContext'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import ImportAdmin from '@/pages/ImportAdmin'
import Unauthorized from '@/pages/Unauthorized'
import EventsIndex from '@/pages/events/EventsIndex'
import EventGuests from '@/pages/events/EventGuests'
import EventDashboard from '@/pages/events/EventDashboard'
import EventMessaging from '@/pages/events/EventMessaging'
import EventRsvpDesign from '@/pages/events/EventRsvpDesign'
import RsvpPage from '@/pages/events/RsvpPage'
import MessageBlueprintSettings from '@/pages/settings/MessageBlueprintSettings'
import { useLeads } from '@/hooks/useLeads'
import { EventProvider } from '@/contexts/EventContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

function RoleHome() {
  const { role } = useAuth()
  return <Navigate to={role === 'admin' ? '/dashboard' : '/eventos'} replace />
}

function AppRoutes() {
  const { refresh, loading } = useLeads()

  // Fetch leads on mount
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/rsvp/:token" element={<RsvpPage />} />
      <Route element={<ProtectedRoute allowedRoles={['admin', 'esposos']} />}>
        <Route element={(
          <FilterProvider>
            <DashboardLayout
              onRefresh={() => refresh(true)}
              refreshing={loading}
            />
          </FilterProvider>
        )}>
          <Route index element={<RoleHome />} />
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/*" element={<Dashboard />} />
          <Route path="/admin/import-leads" element={<ImportAdmin />} />
            <Route path="/configuracion/mensajes" element={<MessageBlueprintSettings />} />
          </Route>
          <Route path="/eventos" element={<EventsIndex />} />
          <Route path="/eventos/:eventId" element={<EventProvider><Outlet /></EventProvider>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<EventDashboard />} />
            <Route path="invitados" element={<EventGuests />} />
            <Route path="envios" element={<EventMessaging />} />
            <Route path="diseno-rsvp" element={<EventRsvpDesign />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<RoleHome />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
