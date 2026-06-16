import { useEffect, useState } from 'react'
import axios from 'axios'

const CLP = (v) => {
  if (!v && v !== 0) return '—'
  return `$${Math.round(Math.abs(v)).toLocaleString('es-CL')}`
}

export default function Proveedores() {
  const [data, setData] = useState({ rows: [], summary: [], totals: {} })
  const [view, setView] = useState('resumen') // 'resumen' | 'detalle'
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/proveedores')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filteredSummary = data.summary.filter(r =>
    r.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    r.rut?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredRows = data.rows.filter(r =>
    r.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    r.rut?.toLowerCase().includes(search.toLowerCase()) ||
    r.documento?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Proveedores</h2>
        <p className="text-slate-500 text-sm mt-1">Cuentas por pagar y movimientos de proveedores</p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Debe</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{CLP(data.totals.debe)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Haber</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{CLP(data.totals.haber)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Saldo Neto</p>
          <p className={`text-xl font-bold mt-1 ${(data.totals.saldo || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {CLP(data.totals.saldo)}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setView('resumen')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'resumen' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Resumen
          </button>
          <button
            onClick={() => setView('detalle')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'detalle' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Detalle
          </button>
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre, RUT..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 max-w-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {data.rows.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-700 text-sm">
          Sin datos. Carga un archivo Excel primero.
        </div>
      )}

      {/* Resumen table */}
      {view === 'resumen' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">RUT</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Nombre</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Facturas</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Debe</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Haber</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummary.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{r.rut}</td>
                  <td className="px-4 py-2.5 text-slate-800 font-medium">{r.nombre}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{r.facturas}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">{CLP(r.debe)}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600">{CLP(r.haber)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${r.saldo >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {CLP(r.saldo)}
                  </td>
                </tr>
              ))}
              {filteredSummary.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle table */}
      {view === 'detalle' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['RUT', 'Nombre', 'Fecha', 'Documento', 'Vencimiento', 'Debe', 'Haber', 'Saldo'].map(h => (
                  <th key={h} className={`px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide ${h === 'RUT' || h === 'Nombre' || h === 'Fecha' || h === 'Documento' || h === 'Vencimiento' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-500 font-mono text-xs">{r.rut}</td>
                  <td className="px-4 py-2 text-slate-800">{r.nombre}</td>
                  <td className="px-4 py-2 text-slate-500">{r.fecha}</td>
                  <td className="px-4 py-2 text-slate-500">{r.documento}</td>
                  <td className="px-4 py-2 text-slate-500">{r.vencimiento}</td>
                  <td className="px-4 py-2 text-right text-slate-700">{CLP(r.debe)}</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{CLP(r.haber)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${r.saldo >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {CLP(r.saldo)}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
