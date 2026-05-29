import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const CLP = (v) => {
  if (v === null || v === undefined || v === 0) return '—'
  const abs = Math.abs(v)
  const formatted = `$${Math.round(abs).toLocaleString('es-CL')}`
  return v < 0 ? `(${formatted})` : formatted
}

const MONTHS_ORDER = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

const monthAbbr = {
  ENERO: 'Ene', FEBRERO: 'Feb', MARZO: 'Mar', ABRIL: 'Abr', MAYO: 'May',
  JUNIO: 'Jun', JULIO: 'Jul', AGOSTO: 'Ago', SEPTIEMBRE: 'Sep', OCTUBRE: 'Oct',
  NOVIEMBRE: 'Nov', DICIEMBRE: 'Dic',
}

// Elimina prefijos contables: "4201-01-0001 REMUNERACIONES" → "REMUNERACIONES"
function cleanLabel(s) {
  return s.replace(/^\d{4}[-–]\d{2}[-–]?\d{0,4}\s+/, '').trim()
}

const SECTION_CONFIG = {
  ventas:             { label: 'Ingresos — Ventas',      header: 'bg-emerald-700', subtotal: 'bg-emerald-50 text-emerald-800' },
  otros_ingresos:     { label: 'Otros Ingresos',          header: 'bg-emerald-600', subtotal: 'bg-emerald-50 text-emerald-800' },
  gastos_operacionales:{ label: 'Gastos Operacionales',   header: 'bg-red-700',     subtotal: 'bg-red-50 text-red-800' },
  remuneraciones:     { label: 'Remuneraciones',          header: 'bg-red-600',     subtotal: 'bg-red-50 text-red-800' },
  administracion:     { label: 'Administración',          header: 'bg-red-500',     subtotal: 'bg-red-50 text-red-800' },
  gastos_financieros: { label: 'Gastos Financieros',      header: 'bg-red-400',     subtotal: 'bg-red-50 text-red-800' },
  resultado:          { label: 'Resultado',               header: 'bg-slate-700',   subtotal: 'bg-slate-100 text-slate-800' },
}

const SECTION_ORDER = ['ventas', 'otros_ingresos', 'gastos_operacionales', 'remuneraciones', 'administracion', 'gastos_financieros', 'resultado']
const INGRESO_SECTIONS = ['ventas', 'otros_ingresos']
const GASTO_SECTIONS  = ['gastos_operacionales', 'remuneraciones', 'administracion', 'gastos_financieros']

export default function EERRDetalle() {
  const [rows, setRows] = useState([])
  const [months, setMonths] = useState([])
  const ALL_COLLAPSED = { ventas: true, otros_ingresos: true, gastos_operacionales: true, remuneraciones: true, administracion: true, gastos_financieros: true, resultado: true }
  const [collapsed, setCollapsed] = useState(ALL_COLLAPSED)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/eerr/detalle')
      .then(r => {
        setRows(r.data)
        const ms = [...new Set(r.data.map(x => x.month_name))]
          .sort((a, b) => MONTHS_ORDER.indexOf(a) - MONTHS_ORDER.indexOf(b))
        setMonths(ms)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Pivot: section → concepto → { months, is_subtotal, parent, sort_order }
  const pivot = {}
  for (const r of rows) {
    if (!pivot[r.section]) pivot[r.section] = {}
    if (!pivot[r.section][r.concepto]) {
      pivot[r.section][r.concepto] = {
        concepto: r.concepto,
        is_subtotal: r.is_subtotal,
        parent: r.parent_concepto,
        sort_order: r.sort_order,
        months: {},
      }
    }
    pivot[r.section][r.concepto].months[r.month_name] = r.amount
  }

  const rowTotal = (monthData) => months.reduce((s, m) => s + (monthData[m] || 0), 0)

  const toggle = (section) => setCollapsed(c => ({ ...c, [section]: !c[section] }))

  // Total Ingresos por mes
  const totalIngresosByMonth = {}
  let totalIngresosSum = 0
  for (const sec of INGRESO_SECTIONS) {
    if (!pivot[sec]) continue
    for (const row of Object.values(pivot[sec])) {
      if (!row.is_subtotal) continue
      for (const m of months) totalIngresosByMonth[m] = (totalIngresosByMonth[m] || 0) + (row.months[m] || 0)
      totalIngresosSum += rowTotal(row.months)
    }
  }

  // Total Gastos por mes
  const totalGastosByMonth = {}
  let totalGastosSum = 0
  for (const sec of GASTO_SECTIONS) {
    if (!pivot[sec]) continue
    for (const row of Object.values(pivot[sec])) {
      if (!row.is_subtotal) continue
      for (const m of months) totalGastosByMonth[m] = (totalGastosByMonth[m] || 0) + (row.months[m] || 0)
      totalGastosSum += rowTotal(row.months)
    }
  }

  // Resultado = Ingresos - Gastos
  const resultadoByMonth = {}
  for (const m of months) resultadoByMonth[m] = (totalIngresosByMonth[m] || 0) - (totalGastosByMonth[m] || 0)
  const resultadoSum = totalIngresosSum - totalGastosSum

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
    </div>
  )

  const cols = months.length + 2 // concepto + months + total

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">EERR — Detalle Mensual</h2>
          <p className="text-slate-500 text-sm mt-1">Desglose mensual por concepto</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCollapsed({})}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium"
          >Expandir todo</button>
          <button
            onClick={() => setCollapsed(ALL_COLLAPSED)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium"
          >Colapsar todo</button>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-700 text-sm">
          Sin datos. Carga un archivo Excel primero.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-max">
          {/* Header */}
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="text-left px-4 py-2.5 font-semibold text-xs w-56 sticky left-0 bg-slate-800">Concepto</th>
              {months.map(m => (
                <th key={m} className="text-right px-3 py-2.5 font-semibold text-xs min-w-[100px]">
                  {monthAbbr[m] || m}
                </th>
              ))}
              <th className="text-right px-3 py-2.5 font-semibold text-xs min-w-[110px] bg-slate-700">Total</th>
            </tr>
          </thead>

          <tbody>
            {SECTION_ORDER.map(section => {
              const cfg = SECTION_CONFIG[section]
              if (!cfg || !pivot[section]) return null

              const sectionRows = Object.values(pivot[section]).sort((a, b) => a.sort_order - b.sort_order)
              const subtotals = sectionRows.filter(r => r.is_subtotal)
              const children = sectionRows.filter(r => !r.is_subtotal)
              const isCollapsed = collapsed[section]

              return [
                // Section header — clickable to collapse
                <tr key={`${section}-hdr`} className={`${cfg.header} cursor-pointer select-none`} onClick={() => toggle(section)}>
                  <td colSpan={cols} className="px-4 py-1.5 text-white font-semibold text-xs uppercase tracking-widest sticky left-0">
                    <span className="mr-2 text-[10px]">{isCollapsed ? '▶' : '▼'}</span>
                    {cfg.label}
                    {section === 'remuneraciones' && (
                      <span
                        className="ml-3 text-[10px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-full transition-colors"
                        onClick={e => { e.stopPropagation(); navigate('/people') }}
                        title="Ver detalle en People"
                      >
                        Ver People →
                      </span>
                    )}
                  </td>
                </tr>,

                // Rows when expanded
                ...(!isCollapsed ? subtotals.flatMap(sub => {
                  const subChildren = children.filter(c => c.parent === sub.concepto)
                  return [
                    // Subtotal row
                    <tr key={sub.concepto} className={`border-b border-slate-200 ${cfg.subtotal}`}>
                      <td className="px-4 py-1.5 text-xs font-semibold sticky left-0 bg-inherit">
                        {cleanLabel(sub.concepto)}
                      </td>
                      {months.map(m => (
                        <td key={m} className="text-right px-3 py-1.5 text-xs font-semibold tabular-nums">
                          {CLP(sub.months[m])}
                        </td>
                      ))}
                      <td className="text-right px-3 py-1.5 text-xs font-bold tabular-nums bg-white/50">
                        {CLP(rowTotal(sub.months))}
                      </td>
                    </tr>,
                    // Child rows
                    ...subChildren.map(child => (
                      <tr key={child.concepto} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-1 pl-9 text-xs text-slate-500 sticky left-0 bg-white hover:bg-slate-50/60">
                          {cleanLabel(child.concepto)}
                        </td>
                        {months.map(m => (
                          <td key={m} className="text-right px-3 py-1 text-xs text-slate-600 tabular-nums">
                            {CLP(child.months[m])}
                          </td>
                        ))}
                        <td className="text-right px-3 py-1 text-xs text-slate-600 tabular-nums bg-slate-50/40">
                          {CLP(rowTotal(child.months))}
                        </td>
                      </tr>
                    )),
                  ]
                }) : []),

                // TOTAL INGRESOS — después de otros_ingresos
                ...(section === 'otros_ingresos' ? [
                  <tr key="total-ingresos" className="bg-emerald-100 border-y-2 border-emerald-400">
                    <td className="px-4 py-2 text-xs font-bold text-emerald-900 uppercase tracking-wide sticky left-0 bg-emerald-100">
                      TOTAL INGRESOS
                    </td>
                    {months.map(m => (
                      <td key={m} className="text-right px-3 py-2 text-xs font-bold text-emerald-900 tabular-nums">
                        {CLP(totalIngresosByMonth[m])}
                      </td>
                    ))}
                    <td className="text-right px-3 py-2 text-xs font-bold text-emerald-900 tabular-nums bg-emerald-200">
                      {CLP(totalIngresosSum)}
                    </td>
                  </tr>
                ] : []),

                // TOTAL GASTOS — después de gastos_financieros
                ...(section === 'gastos_financieros' ? [
                  <tr key="total-gastos" className="bg-red-100 border-y-2 border-red-400">
                    <td className="px-4 py-2 text-xs font-bold text-red-900 uppercase tracking-wide sticky left-0 bg-red-100">
                      TOTAL GASTOS
                    </td>
                    {months.map(m => (
                      <td key={m} className="text-right px-3 py-2 text-xs font-bold text-red-900 tabular-nums">
                        {CLP(totalGastosByMonth[m])}
                      </td>
                    ))}
                    <td className="text-right px-3 py-2 text-xs font-bold text-red-900 tabular-nums bg-red-200">
                      {CLP(totalGastosSum)}
                    </td>
                  </tr>
                ] : []),

                // RESULTADO — después de la sección resultado
                ...(section === 'resultado' ? [
                  <tr key="resultado-final" className="bg-slate-200 border-y-2 border-slate-400">
                    <td className="px-4 py-2.5 text-sm font-bold uppercase tracking-wide sticky left-0 bg-slate-200 text-slate-800">
                      {resultadoSum >= 0 ? 'GANANCIA' : 'PÉRDIDA'}
                    </td>
                    {months.map(m => (
                      <td key={m} className={`text-right px-3 py-2.5 text-sm font-bold tabular-nums ${resultadoByMonth[m] >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {CLP(resultadoByMonth[m])}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-2.5 text-sm font-bold tabular-nums bg-slate-300 ${resultadoSum >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {CLP(resultadoSum)}
                    </td>
                  </tr>
                ] : []),
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
