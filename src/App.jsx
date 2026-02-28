import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { FilterProvider } from '@/contexts/FilterContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import { useLeads } from '@/hooks/useLeads'
import { ThemeProvider } from '@/contexts/ThemeContext'

function AppRoutes() {
  const { refresh, loading } = useLeads()

  // Fetch leads on mount
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={
          <FilterProvider>
            <DashboardLayout
              onRefresh={() => refresh(true)}
              refreshing={loading}
            />
          </FilterProvider>
        }>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/*" element={<Dashboard />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
