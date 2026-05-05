import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { FilterProvider } from '@/contexts/FilterContext'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import PasswordChangeGate from '@/components/PasswordChangeGate'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useLeads } from '@/hooks/useLeads'
import { EventProvider, useEvent } from '@/contexts/EventContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { listEvents } from '@/lib/eventService'

const Login = lazy(() => import('@/pages/Login'))
const SetPassword = lazy(() => import('@/pages/SetPassword'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const ImportAdmin = lazy(() => import('@/pages/ImportAdmin'))
const Unauthorized = lazy(() => import('@/pages/Unauthorized'))
const EventsIndex = lazy(() => import('@/pages/events/EventsIndex'))
const EventGuests = lazy(() => import('@/pages/events/EventGuests'))
const EventDashboard = lazy(() => import('@/pages/events/EventDashboard'))
const EventMessaging = lazy(() => import('@/pages/events/EventMessaging'))
const EventRsvpDesign = lazy(() => import('@/pages/events/EventRsvpDesign'))
const EventAccounts = lazy(() => import('@/pages/events/EventAccounts'))
const RsvpPage = lazy(() => import('@/pages/events/RsvpPage'))
const MessageBlueprintSettings = lazy(() => import('@/pages/settings/MessageBlueprintSettings'))
const UserManagement = lazy(() => import('@/pages/settings/UserManagement'))

function FullScreenSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

function RoleHome() {
  const { user, role, loading: authLoading } = useAuth()
  const [eventId, setEventId] = useState(null)
  const [loading, setLoading] = useState(role === 'esposos')

  useEffect(() => {
    let active = true

    async function resolveCoupleEvent() {
      if (role !== 'esposos') {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const events = await listEvents()
        if (!active) return
        setEventId(events[0]?.id || null)
      } finally {
        if (active) setLoading(false)
      }
    }

    resolveCoupleEvent()

    return () => {
      active = false
    }
  }, [role])

  if (authLoading) {
    return <FullScreenSpinner />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role === 'admin') return <Navigate to="/dashboard" replace />
  if (role === 'planner') return <Navigate to="/eventos" replace />

  if (loading) {
    return <FullScreenSpinner />
  }

  if (eventId) {
    return <Navigate to={`/eventos/${eventId}/dashboard`} replace />
  }

  return <Navigate to="/unauthorized" replace />
}

function EventAccessGuard() {
  const { loading, event } = useEvent()

  if (loading) {
    return <FullScreenSpinner />
  }

  if (!event) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}

function AppRoutes() {
  const { role } = useAuth()
  const { refresh, loading } = useLeads()

  useEffect(() => {
    if (role === 'admin') {
      refresh()
    }
  }, [refresh, role])

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/rsvp/:token" element={<RsvpPage />} />
      <Route element={<ProtectedRoute allowedRoles={['admin', 'planner', 'esposos']} />}>
        <Route element={<PasswordChangeGate />}>
          <Route element={(
            <FilterProvider>
              <DashboardLayout
                onRefresh={role === 'admin' ? () => refresh(true) : undefined}
                refreshing={role === 'admin' ? loading : false}
              />
            </FilterProvider>
          )}>
            <Route index element={<RoleHome />} />
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/*" element={<Dashboard />} />
              <Route path="/admin/import-leads" element={<ImportAdmin />} />
              <Route path="/configuracion/mensajes" element={<MessageBlueprintSettings />} />
              <Route path="/configuracion/usuarios" element={<UserManagement />} />
            </Route>
            <Route path="/eventos" element={<EventsIndex />} />
            <Route path="/eventos/:eventId" element={<EventProvider><EventAccessGuard /></EventProvider>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<EventDashboard />} />
              <Route path="invitados" element={<EventGuests />} />
              <Route path="envios" element={<EventMessaging />} />
              <Route path="diseno-rsvp" element={<EventRsvpDesign />} />
              <Route element={<ProtectedRoute allowedRoles={['admin', 'planner']} />}>
                <Route path="cuentas" element={<EventAccounts />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<RoleHome />} />
      </Routes>
    </Suspense>
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
