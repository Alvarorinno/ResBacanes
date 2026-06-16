import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const ROLES = { admin: 'Administrador', viewer: 'Solo lectura' }

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function UserForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    nombre: initial?.nombre || '',
    email: initial?.email || '',
    password: '',
    role: initial?.role || 'viewer',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-slate-600 mb-1">Nombre</label>
        <input className={inputClass} value={form.nombre} onChange={e => setForm(p => ({...p, nombre: e.target.value}))} required placeholder="Nombre completo" />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Email</label>
        <input className={inputClass} type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} required placeholder="correo@ejemplo.cl" disabled={!!initial} />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">{initial ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}</label>
        <input className={inputClass} type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} required={!initial} placeholder="••••••••" />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Rol</label>
        <select className={inputClass} value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))}>
          <option value="admin">Administrador</option>
          <option value="viewer">Solo lectura</option>
        </select>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
        <button type="submit" disabled={saving} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg py-2.5 text-sm font-medium transition disabled:opacity-50">
          {saving ? 'Guardando...' : initial ? 'Guardar cambios' : 'Crear usuario'}
        </button>
      </div>
    </form>
  )
}

export default function Usuarios() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const { data } = await axios.get('/api/auth/users')
      setUsers(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function createUser(form) {
    await axios.post('/api/auth/users', form)
    load()
  }

  async function updateUser(form) {
    await axios.put(`/api/auth/users/${editing.id}`, form)
    load()
  }

  async function toggleActivo(u) {
    await axios.put(`/api/auth/users/${u.id}`, { activo: !u.activo })
    load()
  }

  async function deleteUser(u) {
    if (!confirm(`¿Eliminar al usuario ${u.nombre}?`)) return
    await axios.delete(`/api/auth/users/${u.id}`)
    load()
  }

  const roleTag = (role) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${role === 'admin' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
      {ROLES[role] || role}
    </span>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuarios</h1>
          <p className="text-slate-500 text-sm mt-1">Gestión de accesos a Resultados Bacanes</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo usuario
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Cargando...</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Nombre', 'Email', 'Rol', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-semibold text-sm">
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-800 text-sm">
                        {u.nombre}
                        {u.id === me?.id && <span className="ml-2 text-xs text-slate-400">(tú)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{u.email}</td>
                  <td className="px-5 py-4">{roleTag(u.role)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs ${u.activo ? 'text-emerald-600' : 'text-slate-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditing(u)} className="text-slate-400 hover:text-emerald-600 transition" title="Editar">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      {u.id !== me?.id && (
                        <>
                          <button onClick={() => toggleActivo(u)} className="text-slate-400 hover:text-amber-500 transition" title={u.activo ? 'Desactivar' : 'Activar'}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                          </button>
                          <button onClick={() => deleteUser(u)} className="text-slate-400 hover:text-red-500 transition" title="Eliminar">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="Crear nuevo usuario" onClose={() => setShowCreate(false)}>
          <UserForm onSave={createUser} onClose={() => setShowCreate(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title="Editar usuario" onClose={() => setEditing(null)}>
          <UserForm initial={editing} onSave={updateUser} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  )
}
