import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function PasswordChangeGate() {
  const { user, mustChangePassword, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (user && mustChangePassword && location.pathname !== '/set-password') {
    return <Navigate to="/set-password" replace />
  }

  return <Outlet />
}
