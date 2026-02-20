import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { FilterProvider } from '@/contexts/FilterContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import { useLeads } from '@/hooks/useLeads'

function AppRoutes() {
  const { refresh, loading } = useLeads()
  const [searchValue, setSearchValue] = useState('')

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={
          <FilterProvider>
            <DashboardLayout
              onRefresh={() => refresh(true)}
              refreshing={loading}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
            />
          </FilterProvider>
        }>
          <Route path="/dashboard" element={<Dashboard searchValue={searchValue} />} />
          <Route path="/dashboard/*" element={<Dashboard searchValue={searchValue} />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
