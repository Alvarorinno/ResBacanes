import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const CLP = (v) => {
  if (v === null || v === undefined) return '$0'
  const abs = Math.abs(v)
  const formatted = `$${Math.round(abs).toLocaleString('es-CL')}`
  return v < 0 ? `(${formatted})` : formatted
}

// Elimina el código contable del inicio (ej: "4201-01-0001 REMUNERACIONES" → "REMUNERACIONES")
function cleanConcepto(concepto) {
  return concepto.replace(/^\d{4}[-–]\d{2}[-–]?\d{0,4}\s+/, '').trim()
}

const PEOPLE_CONCEPTS = ['remuneraciones', 'honorarios', 'sueldos', 'planilla']

export default function EERRResumen() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    axios.get('/api/eerr/summary')
      .then(r => setRows(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const ingresos = rows.filter(r => r.category === 'ingresos' && r.amount !== 0)
  const gastos = rows.filter(r => r.category === 'gastos' && r.amount !== 0)
  const gastosTotal = rows.find(r => r.category === 'gastos_total')

  const totalIngresos = ingresos.reduce((s, r) => s + r.amount, 0)
  const totalGastos = gastosTotal?.amount ?? gastos.reduce((s, r) => s + r.amount, 0)
  const resultadoAmt = totalIngresos - totalGastos

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
    </div>
  )

  const pct = (amt) => totalIngresos ? `${((amt / totalIngresos) * 100).toFixed(1)}%` : '—'

  const SectionHeader = ({ label, color }) => (
    <tr className={color}>
      <td colSpan={3} className="px-5 py-1.5 text-white font-semibold text-xs uppercase tracking-widest">
        {label}
      </td>
    </tr>
  )

  const isPeopleConcept = (concepto) =>
    PEOPLE_CONCEPTS.some(k => concepto.toLowerCase().includes(k))

  const DataRow = ({ concepto, amount }) => {
    const isPeople = isPeopleConcept(concepto)
    return (
      <tr
        className={`border-b border-slate-100 transition-colors ${isPeople ? 'hover:bg-blue-50 cursor-pointer group' : 'hover:bg-slate-50/60'}`}
        onClick={isPeople ? () => navigate('/people') : undefined}
        title={isPeople ? 'Ver detalle en People →' : undefined}
      >
        <td className="px-5 py-1.5 text-slate-600 pl-9 text-xs">
          {cleanConcepto(concepto)}
          {isPeople && (
            <span className="ml-2 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium">
              Ver People →
            </span>
          )}
        </td>
        <td className="px-5 py-1.5 text-right text-slate-700 text-xs tabular-nums">{CLP(amount)}</td>
        <td className="px-5 py-1.5 text-right text-slate-400 text-xs tabular-nums">{pct(amount)}</td>
      </tr>
    )
  }

  const TotalRow = ({ label, amount, colorClass, bgClass }) => (
    <tr className={`${bgClass} border-b`}>
      <td className={`px-5 py-2 font-bold text-xs ${colorClass}`}>{label}</td>
      <td className={`px-5 py-2 text-right font-bold text-xs tabular-nums ${colorClass}`}>{CLP(amount)}</td>
      <td className={`px-5 py-2 text-right font-bold text-xs tabular-nums ${colorClass}`}>{pct(amount)}</td>
    </tr>
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Estado de Resultados — Resumen</h2>
        <p className="text-slate-500 text-sm mt-1">Totales acumulados del período</p>
      </div>

      {rows.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-700 text-sm">
          Sin datos. Carga un archivo Excel primero.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-5 py-2.5 font-semibold text-slate-500 uppercase text-xs tracking-wide">Concepto</th>
              <th className="text-right px-5 py-2.5 font-semibold text-slate-500 uppercase text-xs tracking-wide">Monto</th>
              <th className="text-right px-5 py-2.5 font-semibold text-slate-500 uppercase text-xs tracking-wide w-24">% Ing.</th>
            </tr>
          </thead>
          <tbody>
            <SectionHeader label="Ingresos" color="bg-emerald-600" />
            {ingresos.map((r, i) => <DataRow key={i} concepto={r.concepto} amount={r.amount} />)}
            <TotalRow label="TOTAL INGRESOS" amount={totalIngresos} colorClass="text-emerald-800" bgClass="bg-emerald-50 border-emerald-200" />

            <SectionHeader label="Gastos" color="bg-red-500" />
            {gastos.map((r, i) => <DataRow key={i} concepto={r.concepto} amount={r.amount} />)}
            <TotalRow label="TOTAL GASTOS" amount={totalGastos} colorClass="text-red-800" bgClass="bg-red-50 border-red-200" />

            <SectionHeader label="Resultado" color="bg-slate-700" />
            <tr className={resultadoAmt >= 0 ? 'bg-emerald-50' : 'bg-red-50'}>
              <td className={`px-5 py-3 font-bold text-sm ${resultadoAmt >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                {resultadoAmt >= 0 ? 'GANANCIA' : 'PÉRDIDA'}
              </td>
              <td className={`px-5 py-3 text-right font-bold text-sm tabular-nums ${resultadoAmt >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                {CLP(resultadoAmt)}
              </td>
              <td className={`px-5 py-3 text-right font-bold text-sm tabular-nums ${resultadoAmt >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {pct(resultadoAmt)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
