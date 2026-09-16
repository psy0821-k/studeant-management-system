import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/use-auth'

function ProtectedRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
