import { useState, useEffect } from 'react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'

const CLP = (v) => {
  if (!v && v !== 0) return '—'
  const abs = Math.abs(v)
  const formatted = abs >= 1000000
    ? `$${(abs / 1000000).toFixed(1)}M`
    : `$${Math.round(abs).toLocaleString('es-CL')}`
  return v < 0 ? `(${formatted})` : formatted
}

const CLPfull = (v) => {
  if (!v && v !== 0) return '—'
  const abs = Math.abs(v)
  const formatted = `$${Math.round(abs).toLocaleString('es-CL')}`
  return v < 0 ? `(${formatted})` : formatted
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const resultado = d.ventas - d.costos
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-bold text-slate-700 mb-2">{label} <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${d.tipo === 'real' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{d.tipo === 'real' ? 'Real' : 'Proyectado'}</span></p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4"><span className="text-slate-500">Ventas</span><span className="font-semibold text-emerald-700">{CLP(d.ventas)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-slate-500">Costos</span><span className="font-semibold text-red-600">{CLP(d.costos)}</span></div>
        <div className="border-t border-slate-100 pt-1 mt-1 flex justify-between gap-4"><span className="font-bold text-slate-700">Resultado</span><span className={`font-bold ${resultado >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{CLP(resultado)}</span></div>
      </div>
    </div>
  )
}

export default function FlujoCaja() {
  const [raw, setRaw] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/flujo-caja')
      .then(r => setRaw(r.data?.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
    </div>
  )

  if (raw.length === 0) return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-700 text-sm">
      Sin datos. Sube el archivo <strong>Real</strong> y/o <strong>Presupuesto</strong> en Carga de Datos.
    </div>
  )

  const data = raw.map((d, i) => {
    const resultado = d.ventas - d.costos
    const acumulado = raw.slice(0, i + 1).reduce((s, m) => s + (m.ventas - m.costos), 0)
    return { ...d, resultado, acumulado }
  })

  const totalReal = data.filter(d => d.tipo === 'real')
  const totalProy = data.filter(d => d.tipo === 'proyectado')

  const sumReal = totalReal.reduce((s, d) => s + d.resultado, 0)
  const sumProy = totalProy.reduce((s, d) => s + d.resultado, 0)
  const sumAnual = sumReal + sumProy

  const lastReal = data.filter(d => d.tipo === 'real').at(-1)
  const dividerMonth = lastReal?.mes

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Flujo de Caja</h2>
        <p className="text-slate-500 text-sm mt-1">Real hasta {dividerMonth} · Proyectado desde {data.find(d => d.tipo === 'proyectado')?.mes}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Resultado Real YTD</p>
          <p className="text-2xl font-bold mt-1 text-emerald-700 tabular-nums">{CLP(sumReal)}</p>
          <p className="text-xs mt-1 text-emerald-400">{totalReal.length} meses cerrados</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Proyección Resto Año</p>
          <p className="text-2xl font-bold mt-1 text-blue-700 tabular-nums">{CLP(sumProy)}</p>
          <p className="text-xs mt-1 text-blue-400">{totalProy.length} meses proyectados</p>
        </div>
        <div className={`rounded-xl p-4 border ${sumAnual >= 0 ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${sumAnual >= 0 ? 'text-slate-500' : 'text-red-500'}`}>Resultado Anual Estimado</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${sumAnual >= 0 ? 'text-slate-700' : 'text-red-700'}`}>{CLP(sumAnual)}</p>
          <p className={`text-xs mt-1 ${sumAnual >= 0 ? 'text-slate-400' : 'text-red-400'}`}>Real + Proyectado</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-700">Resultado mensual</h3>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"/> Real</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-300 inline-block border border-blue-400 border-dashed"/> Proyectado</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} barSize={28} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `$${(v/1000000).toFixed(0)}M`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={45} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <ReferenceLine y={0} stroke="#e2e8f0" />
            <Bar dataKey="resultado" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.tipo === 'real'
                    ? (d.resultado >= 0 ? '#10b981' : '#ef4444')
                    : (d.resultado >= 0 ? '#93c5fd' : '#fca5a5')}
                  stroke={d.tipo === 'proyectado' ? (d.resultado >= 0 ? '#3b82f6' : '#ef4444') : 'none'}
                  strokeWidth={d.tipo === 'proyectado' ? 1.5 : 0}
                  strokeDasharray={d.tipo === 'proyectado' ? '4 2' : '0'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table — meses en columnas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="text-xs min-w-full">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="text-left px-4 py-2.5 font-semibold sticky left-0 bg-slate-800 z-10 min-w-[110px]">Concepto</th>
              {data.map(d => (
                <th key={d.mes} className={`text-right px-3 py-2.5 font-semibold min-w-[90px] ${d.tipo === 'proyectado' ? 'bg-slate-700' : ''}`}>
                  <span>{d.mes}</span>
                  <span className={`ml-1 px-1 py-0.5 rounded-full text-[9px] font-medium ${d.tipo === 'real' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-blue-500/30 text-blue-300'}`}>
                    {d.tipo === 'real' ? 'R' : 'P'}
                  </span>
                </th>
              ))}
              <th className="text-right px-3 py-2.5 font-semibold min-w-[90px] bg-slate-700">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {/* Ventas */}
            <tr className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2 font-semibold text-emerald-700 sticky left-0 bg-white">Ventas</td>
              {data.map(d => (
                <td key={d.mes} className={`px-3 py-2 text-right tabular-nums text-slate-600 ${d.tipo === 'proyectado' ? 'bg-blue-50/40' : ''}`}>{CLPfull(d.ventas)}</td>
              ))}
              <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-700 bg-slate-50">{CLPfull(data.reduce((s, d) => s + d.ventas, 0))}</td>
            </tr>
            {/* Costos */}
            <tr className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2 font-semibold text-red-600 sticky left-0 bg-white">Costos</td>
              {data.map(d => (
                <td key={d.mes} className={`px-3 py-2 text-right tabular-nums text-slate-600 ${d.tipo === 'proyectado' ? 'bg-blue-50/40' : ''}`}>{CLPfull(d.costos)}</td>
              ))}
              <td className="px-3 py-2 text-right font-bold tabular-nums text-red-600 bg-slate-50">{CLPfull(data.reduce((s, d) => s + d.costos, 0))}</td>
            </tr>
            {/* Resultado */}
            <tr className="border-b-2 border-slate-300 bg-slate-50/60">
              <td className="px-4 py-2 font-bold text-slate-700 sticky left-0 bg-slate-50">Resultado</td>
              {data.map(d => (
                <td key={d.mes} className={`px-3 py-2 text-right font-semibold tabular-nums ${d.tipo === 'proyectado' ? 'bg-blue-50/60' : ''} ${d.resultado >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {CLPfull(d.resultado)}
                </td>
              ))}
              <td className={`px-3 py-2 text-right font-bold tabular-nums bg-slate-100 ${sumAnual >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{CLPfull(sumAnual)}</td>
            </tr>
            {/* Acumulado */}
            <tr className="bg-white">
              <td className="px-4 py-2 font-semibold text-slate-500 sticky left-0 bg-white">Acumulado</td>
              {data.map(d => (
                <td key={d.mes} className={`px-3 py-2 text-right font-bold tabular-nums ${d.tipo === 'proyectado' ? 'bg-blue-50/40' : ''} ${d.acumulado >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                  {CLPfull(d.acumulado)}
                </td>
              ))}
              <td className={`px-3 py-2 text-right font-bold tabular-nums bg-slate-50 ${sumAnual >= 0 ? 'text-slate-700' : 'text-red-600'}`}>{CLPfull(sumAnual)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
