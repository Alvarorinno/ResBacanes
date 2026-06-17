import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import EERRResumen from './pages/EERRResumen'
import EERRDetalle from './pages/EERRDetalle'
import Presupuesto from './pages/Presupuesto'
import Proveedores from './pages/Proveedores'
import Honorarios from './pages/Honorarios'
import CargaDatos from './pages/CargaDatos'
import Usuarios from './pages/Usuarios'
import People from './pages/People'
import FlujoCaja from './pages/FlujoCaja'

function ProtectedRoute({ children, roles = null }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return null

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="eerr-resumen" element={<EERRResumen />} />
        <Route path="eerr-detalle" element={<EERRDetalle />} />
        <Route path="people" element={<People />} />
        <Route path="flujo-caja" element={<FlujoCaja />} />
        <Route path="presupuesto" element={<ProtectedRoute roles={['admin']}><Presupuesto /></ProtectedRoute>} />
        <Route path="proveedores" element={<ProtectedRoute roles={['admin']}><Proveedores /></ProtectedRoute>} />
        <Route path="honorarios" element={<ProtectedRoute roles={['admin']}><Honorarios /></ProtectedRoute>} />
        <Route path="carga-datos" element={<ProtectedRoute roles={['admin']}><CargaDatos /></ProtectedRoute>} />
        <Route path="usuarios" element={<ProtectedRoute roles={['admin']}><Usuarios /></ProtectedRoute>} />
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
