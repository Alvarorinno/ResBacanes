import { useEffect, useState } from 'react'
import axios from 'axios'
import KPICard from '../components/KPICard'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer
} from 'recharts'

const CLP = (v) => {
  if (v === null || v === undefined) return '$0'
  const abs = Math.abs(v)
  const formatted = abs >= 1_000_000
    ? `$${(abs / 1_000_000).toFixed(1)}M`
    : `$${Math.round(abs).toLocaleString('es-CL')}`
  return v < 0 ? `-${formatted}` : formatted
}

const PCT = (v) => `${v !== undefined && v !== null ? v.toFixed(1) : '0.0'}%`

const MONTHS_ORDER = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

const monthAbbr = { ENERO: 'Ene', FEBRERO: 'Feb', MARZO: 'Mar', ABRIL: 'Abr', MAYO: 'May',
  JUNIO: 'Jun', JULIO: 'Jul', AGOSTO: 'Ago', SEPTIEMBRE: 'Sep', OCTUBRE: 'Oct',
  NOVIEMBRE: 'Nov', DICIEMBRE: 'Dic' }

export default function Dashboard() {
  const [kpis, setKpis] = useState(null)
  const [monthly, setMonthly] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      axios.get('/api/eerr/kpis'),
      axios.get('/api/eerr/monthly'),
    ]).then(([kpiRes, monthlyRes]) => {
      setKpis(kpiRes.data)
      buildMonthlyChart(monthlyRes.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  function buildMonthlyChart(rows) {
    const byMonth = {}
    for (const r of rows) {
      if (!byMonth[r.month_name]) byMonth[r.month_name] = { month: monthAbbr[r.month_name] || r.month_name }
      const c = r.concepto.toUpperCase()
      if (c.includes('TOTAL VENTAS')) byMonth[r.month_name].ventas = r.amount
      if (c.includes('TOTAL OTROS')) byMonth[r.month_name].otros = r.amount
      if (c.includes('TOTAL EGRESOS')) byMonth[r.month_name].egresos = r.amount
      if (c.includes('GANANCIA') || c.includes('PERDIDA') || c.includes('PÉRDIDA')) byMonth[r.month_name].resultado = r.amount
    }
    const sorted = Object.entries(byMonth)
      .sort(([a], [b]) => MONTHS_ORDER.indexOf(a) - MONTHS_ORDER.indexOf(b))
      .map(([, v]) => v)
    setMonthly(sorted)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    )
  }

  const noData = !kpis || Object.keys(kpis).length === 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <p className="text-slate-500 text-sm mt-1">Resumen ejecutivo de resultados financieros</p>
      </div>

      {noData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-700 text-sm">
          <strong>Sin datos cargados.</strong> Ve a <a href="/carga-datos" className="underline font-semibold">Carga de Datos</a> para subir un archivo Excel.
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title="Margen Bruto"
          value={CLP(kpis?.margenBruto)}
          subtitle="Ingresos − Costo de Venta"
          color="emerald"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
        />
        <KPICard
          title="% Margen Bruto"
          value={PCT(kpis?.pctMargenBruto)}
          subtitle="Margen / Total Ingresos"
          color="emerald"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
        />
        <KPICard
          title="Sueldos vs Ventas"
          value={PCT(kpis?.sueldosVsVentas)}
          subtitle="Remuneraciones / Ventas"
          color={kpis?.sueldosVsVentas > 70 ? 'red' : 'orange'}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <KPICard
          title="Costos vs Ventas"
          value={PCT(kpis?.costosVsVentas)}
          subtitle="Total Gastos / Ingresos"
          color={kpis?.costosVsVentas > 100 ? 'red' : 'orange'}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <KPICard
          title="Resultado Neto"
          value={CLP(kpis?.resultado)}
          subtitle="Ganancia / Pérdida acumulada"
          color={kpis?.resultado >= 0 ? 'emerald' : 'red'}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>}
        />
        <KPICard
          title="% Resultado"
          value={PCT(kpis?.pctResultado)}
          subtitle="Resultado / Ingresos"
          color={kpis?.pctResultado >= 0 ? 'blue' : 'red'}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>}
        />
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Ingresos</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{CLP(kpis?.totalIngresos)}</p>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full">
            <div className="h-1.5 bg-emerald-400 rounded-full w-full" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Gastos</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{CLP(kpis?.totalGastos)}</p>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full">
            <div
              className="h-1.5 bg-red-400 rounded-full"
              style={{ width: kpis?.totalIngresos ? `${Math.min(100, (kpis.totalGastos / kpis.totalIngresos) * 100)}%` : '0%' }}
            />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Remuneraciones</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{CLP(kpis?.totalRemuneraciones)}</p>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full">
            <div
              className="h-1.5 bg-orange-400 rounded-full"
              style={{ width: kpis?.totalGastos ? `${Math.min(100, (kpis.totalRemuneraciones / kpis.totalGastos) * 100)}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Charts */}
      {monthly.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Ingresos vs Egresos por Mes</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthly} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `$${(v/1e6).toFixed(0)}M`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`$${Math.round(v).toLocaleString('es-CL')}`, '']} />
                <Legend />
                <Bar dataKey="ventas" name="Ventas" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="egresos" name="Egresos" fill="#f87171" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Resultado Mensual</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthly} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `$${(v/1e6).toFixed(0)}M`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`$${Math.round(v).toLocaleString('es-CL')}`, '']} />
                <Legend />
                <Line
                  type="monotone" dataKey="resultado" name="Resultado"
                  stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
