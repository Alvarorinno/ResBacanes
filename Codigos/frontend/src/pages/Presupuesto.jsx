import { useEffect, useState } from 'react'
import axios from 'axios'

const CLP = (v) => {
  if (v === null || v === undefined || v === 0) return '—'
  const abs = Math.abs(v)
  const formatted = `$${Math.round(abs).toLocaleString('es-CL')}`
  return v < 0 ? `(${formatted})` : formatted
}

const PCT = (v) => {
  if (v === null || v === undefined || !isFinite(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

const MONTHS_ORDER = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const monthAbbr = { ENERO: 'Ene', FEBRERO: 'Feb', MARZO: 'Mar', ABRIL: 'Abr', MAYO: 'May',
  JUNIO: 'Jun', JULIO: 'Jul', AGOSTO: 'Ago', SEPTIEMBRE: 'Sep', OCTUBRE: 'Oct',
  NOVIEMBRE: 'Nov', DICIEMBRE: 'Dic' }

const SECTION_CONFIG = {
  ventas:               { label: 'Ingresos — Ventas',    header: 'bg-emerald-700', subtotal: 'bg-emerald-50 text-emerald-800' },
  otros_ingresos:       { label: 'Otros Ingresos',        header: 'bg-emerald-600', subtotal: 'bg-emerald-50 text-emerald-800' },
  gastos_operacionales: { label: 'Gastos Operacionales',  header: 'bg-red-700',     subtotal: 'bg-red-50 text-red-800' },
  remuneraciones:       { label: 'Remuneraciones',         header: 'bg-red-600',     subtotal: 'bg-red-50 text-red-800' },
  administracion:       { label: 'Administración',         header: 'bg-red-500',     subtotal: 'bg-red-50 text-red-800' },
  gastos_financieros:   { label: 'Gastos Financieros',    header: 'bg-red-400',     subtotal: 'bg-red-50 text-red-800' },
  resultado:            { label: 'Resultado',              header: 'bg-slate-700',   subtotal: 'bg-slate-100 text-slate-800' },
}
const SECTION_ORDER = ['ventas', 'otros_ingresos', 'gastos_operacionales', 'remuneraciones', 'administracion', 'gastos_financieros', 'resultado']
const INGRESO_SECTIONS = ['ventas', 'otros_ingresos']
const GASTO_SECTIONS   = ['gastos_operacionales', 'remuneraciones', 'administracion', 'gastos_financieros']

function cleanLabel(s) {
  return s.replace(/^\d{4}[-–]\d{2}[-–]?\d{0,4}\s+/, '').trim()
}

function buildPivot(rows) {
  const pivot = {}
  for (const r of rows) {
    const key = `${r.section}|||${r.concepto}`
    if (!pivot[key]) pivot[key] = { concepto: r.concepto, section: r.section, is_subtotal: r.is_subtotal, sort_order: r.sort_order, parent: r.parent_concepto, months: {} }
    pivot[key].months[r.month_name] = r.amount
  }
  return Object.values(pivot).sort((a, b) => a.sort_order - b.sort_order || a.concepto.localeCompare(b.concepto))
}

function rowYTD(row, months) {
  return months.reduce((s, m) => s + (row?.months?.[m] || 0), 0)
}

export default function Presupuesto() {
  const [data, setData] = useState({ actual: [], budget: [], months: [] })
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [showMonthly, setShowMonthly] = useState(false)
  const [collapsed, setCollapsed] = useState({})

  useEffect(() => {
    setLoading(true)
    axios.get(`/api/presupuesto/comparison?year=${year}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [year])

  const toggle = (sec) => setCollapsed(c => ({ ...c, [sec]: !c[sec] }))

  const actualPivot = buildPivot(data.actual)
  const budgetPivot = buildPivot(data.budget)
  const months = data.months

  // Build nested pivot by section
  const bySection = {}
  for (const sec of SECTION_ORDER) {
    const aRows = actualPivot.filter(r => r.section === sec)
    const bRows = budgetPivot.filter(r => r.section === sec)
    const allConcepts = [...new Set([...aRows.map(r => r.concepto), ...bRows.map(r => r.concepto)])]
    bySection[sec] = allConcepts.map(concepto => ({
      concepto,
      is_subtotal: aRows.find(r => r.concepto === concepto)?.is_subtotal || bRows.find(r => r.concepto === concepto)?.is_subtotal || false,
      parent: aRows.find(r => r.concepto === concepto)?.parent || bRows.find(r => r.concepto === concepto)?.parent || null,
      sort_order: aRows.find(r => r.concepto === concepto)?.sort_order || bRows.find(r => r.concepto === concepto)?.sort_order || 0,
      actual: aRows.find(r => r.concepto === concepto),
      budget: bRows.find(r => r.concepto === concepto),
    })).sort((a, b) => a.sort_order - b.sort_order)
  }

  // Totals for banners
  let totalActualIngresos = 0, totalBudgetIngresos = 0
  let totalActualGastos = 0, totalBudgetGastos = 0
  for (const sec of INGRESO_SECTIONS) {
    for (const row of (bySection[sec] || [])) {
      if (row.is_subtotal) {
        totalActualIngresos += rowYTD(row.actual, months)
        const bRaw = rowYTD(row.budget, months)
        const bChildren = (bySection[sec] || []).filter(c => !c.is_subtotal && c.parent === row.concepto).reduce((s, c) => s + rowYTD(c.budget, months), 0)
        totalBudgetIngresos += bRaw !== 0 ? bRaw : bChildren
      }
    }
  }
  for (const sec of GASTO_SECTIONS) {
    for (const row of (bySection[sec] || [])) {
      if (row.is_subtotal) {
        totalActualGastos += rowYTD(row.actual, months)
        const bRaw = rowYTD(row.budget, months)
        const bChildren = (bySection[sec] || []).filter(c => !c.is_subtotal && c.parent === row.concepto).reduce((s, c) => s + rowYTD(c.budget, months), 0)
        totalBudgetGastos += bRaw !== 0 ? bRaw : bChildren
      }
    }
  }
  const totalActualRes = totalActualIngresos - totalActualGastos
  const totalBudgetRes = totalBudgetIngresos - totalBudgetGastos

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
    </div>
  )

  const noData = data.actual.length === 0 && data.budget.length === 0

  const varCell = (a, b) => {
    const v = a - b
    const pct = b !== 0 ? (v / Math.abs(b)) * 100 : null
    return { v, pct }
  }

  // ── YTD compact view ────────────────────────────────────────────────────────

  const renderYTD = () => (
    <table className="w-full">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-64">Concepto</th>
          <th className="text-right px-5 py-2.5 text-xs font-semibold text-emerald-600 uppercase tracking-wide">Real</th>
          <th className="text-right px-5 py-2.5 text-xs font-semibold text-blue-600 uppercase tracking-wide">Ppto</th>
          <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Var $</th>
          <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">% Var</th>
        </tr>
      </thead>
      <tbody>
        {SECTION_ORDER.map(sec => {
          const cfg = SECTION_CONFIG[sec]
          const rows = bySection[sec] || []
          if (!cfg || rows.length === 0) return null
          const isCollapsed = collapsed[sec]
          const subtotals = rows.filter(r => r.is_subtotal)
          const children = rows.filter(r => !r.is_subtotal)

          return [
            <tr key={`${sec}-hdr`} className={`${cfg.header} cursor-pointer select-none`} onClick={() => toggle(sec)}>
              <td colSpan={5} className="px-5 py-1.5 text-white font-semibold text-xs uppercase tracking-widest">
                <span className="mr-2 text-[10px]">{isCollapsed ? '▶' : '▼'}</span>
                {cfg.label}
              </td>
            </tr>,
            ...(!isCollapsed ? subtotals.flatMap(sub => {
              const subChildren = children.filter(c => c.parent === sub.concepto)
              const aYTD = rowYTD(sub.actual, months)
              // Budget subtotals may be 0 in Excel — sum children instead
              const bYTDraw = rowYTD(sub.budget, months)
              const bYTDfromChildren = subChildren.reduce((s, c) => s + rowYTD(c.budget, months), 0)
              const bYTD = bYTDraw !== 0 ? bYTDraw : bYTDfromChildren
              const { v, pct } = varCell(aYTD, bYTD)
              return [
                <tr key={sub.concepto} className={`border-b border-slate-200 ${cfg.subtotal}`}>
                  <td className="px-5 py-1.5 text-xs font-semibold">{cleanLabel(sub.concepto)}</td>
                  <td className="text-right px-5 py-1.5 text-xs font-semibold tabular-nums">{CLP(aYTD)}</td>
                  <td className="text-right px-5 py-1.5 text-xs font-semibold tabular-nums text-blue-700">{CLP(bYTD)}</td>
                  <td className={`text-right px-5 py-1.5 text-xs font-semibold tabular-nums ${v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-slate-400'}`}>{v !== 0 ? CLP(v) : '—'}</td>
                  <td className={`text-right px-5 py-1.5 text-xs font-semibold tabular-nums ${v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-slate-400'}`}>{PCT(pct)}</td>
                </tr>,
                ...subChildren.map(child => {
                  const ca = rowYTD(child.actual, months)
                  const cb = rowYTD(child.budget, months)
                  const { v: cv, pct: cp } = varCell(ca, cb)
                  return (
                    <tr key={child.concepto} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="px-5 py-1 pl-9 text-xs text-slate-500">{cleanLabel(child.concepto)}</td>
                      <td className="text-right px-5 py-1 text-xs text-slate-700 tabular-nums">{CLP(ca)}</td>
                      <td className="text-right px-5 py-1 text-xs text-slate-500 tabular-nums">{CLP(cb)}</td>
                      <td className={`text-right px-5 py-1 text-xs tabular-nums ${cv > 0 ? 'text-emerald-600' : cv < 0 ? 'text-red-500' : 'text-slate-400'}`}>{cv !== 0 ? CLP(cv) : '—'}</td>
                      <td className={`text-right px-5 py-1 text-xs tabular-nums ${cv > 0 ? 'text-emerald-600' : cv < 0 ? 'text-red-500' : 'text-slate-400'}`}>{PCT(cp)}</td>
                    </tr>
                  )
                }),
              ]
            }) : []),

            ...(sec === 'otros_ingresos' ? [
              <tr key="banner-ingresos" className="bg-emerald-100 border-y-2 border-emerald-400">
                <td className="px-5 py-2 text-xs font-bold text-emerald-900 uppercase tracking-wide">TOTAL INGRESOS</td>
                <td className="text-right px-5 py-2 text-xs font-bold text-emerald-900 tabular-nums">{CLP(totalActualIngresos)}</td>
                <td className="text-right px-5 py-2 text-xs font-bold text-emerald-900 tabular-nums">{CLP(totalBudgetIngresos)}</td>
                {(() => { const { v, pct } = varCell(totalActualIngresos, totalBudgetIngresos); return [
                  <td key="v" className={`text-right px-5 py-2 text-xs font-bold tabular-nums ${v >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{v !== 0 ? CLP(v) : '—'}</td>,
                  <td key="p" className={`text-right px-5 py-2 text-xs font-bold tabular-nums ${v >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{PCT(pct)}</td>,
                ]})()}
              </tr>
            ] : []),

            ...(sec === 'gastos_financieros' ? [
              <tr key="banner-gastos" className="bg-red-100 border-y-2 border-red-400">
                <td className="px-5 py-2 text-xs font-bold text-red-900 uppercase tracking-wide">TOTAL GASTOS</td>
                <td className="text-right px-5 py-2 text-xs font-bold text-red-900 tabular-nums">{CLP(totalActualGastos)}</td>
                <td className="text-right px-5 py-2 text-xs font-bold text-red-900 tabular-nums">{CLP(totalBudgetGastos)}</td>
                {(() => { const { v, pct } = varCell(totalActualGastos, totalBudgetGastos); return [
                  <td key="v" className={`text-right px-5 py-2 text-xs font-bold tabular-nums ${v <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{v !== 0 ? CLP(v) : '—'}</td>,
                  <td key="p" className={`text-right px-5 py-2 text-xs font-bold tabular-nums ${v <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{PCT(pct)}</td>,
                ]})()}
              </tr>
            ] : []),

            ...(sec === 'resultado' ? [
              <tr key="banner-resultado" className="bg-slate-200 border-y-2 border-slate-400">
                <td className="px-5 py-2.5 text-sm font-bold text-slate-800 uppercase tracking-wide">
                  {totalActualRes >= 0 ? 'GANANCIA' : 'PÉRDIDA'}
                </td>
                <td className={`text-right px-5 py-2.5 text-sm font-bold tabular-nums ${totalActualRes >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{CLP(totalActualRes)}</td>
                <td className={`text-right px-5 py-2.5 text-sm font-bold tabular-nums ${totalBudgetRes >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{CLP(totalBudgetRes)}</td>
                {(() => { const { v, pct } = varCell(totalActualRes, totalBudgetRes); return [
                  <td key="v" className={`text-right px-5 py-2.5 text-sm font-bold tabular-nums ${v >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{v !== 0 ? CLP(v) : '—'}</td>,
                  <td key="p" className={`text-right px-5 py-2.5 text-sm font-bold tabular-nums ${v >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{PCT(pct)}</td>,
                ]})()}
              </tr>
            ] : []),
          ]
        })}
      </tbody>
    </table>
  )

  // ── Monthly detail view ──────────────────────────────────────────────────────

  const renderMonthly = () => {
    // flat list of all concepts in order
    const allRows = SECTION_ORDER.flatMap(sec => bySection[sec] || [])
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-slate-800 w-56">Concepto</th>
              {months.map(m => (
                <th key={m} colSpan={3} className="text-center px-2 py-3 font-semibold border-l border-slate-600">
                  {monthAbbr[m] || m}
                </th>
              ))}
              <th colSpan={3} className="text-center px-2 py-3 font-semibold border-l border-slate-600 bg-slate-700">Total</th>
            </tr>
            <tr className="bg-slate-700 text-slate-300 text-xs">
              <th className="px-4 py-1.5 sticky left-0 bg-slate-700"></th>
              {months.map(m => (
                <>
                  <th key={`${m}-r`} className="text-right px-2 py-1.5 border-l border-slate-600 text-emerald-300">Real</th>
                  <th key={`${m}-b`} className="text-right px-2 py-1.5 text-blue-300">Ppto</th>
                  <th key={`${m}-v`} className="text-right px-2 py-1.5 text-slate-400">Var</th>
                </>
              ))}
              <th className="text-right px-2 py-1.5 border-l border-slate-600 text-emerald-300">Real</th>
              <th className="text-right px-2 py-1.5 text-blue-300">Ppto</th>
              <th className="text-right px-2 py-1.5 text-slate-400">Var</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, i) => {
              const isSubtotal = row.is_subtotal
              const totalA = rowYTD(row.actual, months)
              const totalB = rowYTD(row.budget, months)
              const totalV = totalA - totalB
              return (
                <tr key={i} className={`border-b border-slate-100 ${isSubtotal ? 'bg-slate-50 font-semibold' : 'hover:bg-slate-50'}`}>
                  <td className={`px-4 py-2 sticky left-0 bg-inherit ${isSubtotal ? 'text-slate-800' : 'text-slate-600 pl-8'}`}>
                    {cleanLabel(row.concepto)}
                  </td>
                  {months.map(m => {
                    const a = row.actual?.months?.[m] || 0
                    const b = row.budget?.months?.[m] || 0
                    const v = a - b
                    return (
                      <>
                        <td key={`${m}-r`} className="text-right px-2 py-2 border-l border-slate-100 text-slate-700">{CLP(a)}</td>
                        <td key={`${m}-b`} className="text-right px-2 py-2 text-slate-500">{CLP(b)}</td>
                        <td key={`${m}-v`} className={`text-right px-2 py-2 ${v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                          {v !== 0 ? CLP(v) : '—'}
                        </td>
                      </>
                    )
                  })}
                  <td className="text-right px-2 py-2 border-l border-slate-100 text-slate-700 font-medium">{CLP(totalA)}</td>
                  <td className="text-right px-2 py-2 text-slate-500 font-medium">{CLP(totalB)}</td>
                  <td className={`text-right px-2 py-2 font-medium ${totalV > 0 ? 'text-emerald-600' : totalV < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    {totalV !== 0 ? CLP(totalV) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Presupuesto vs Real</h2>
          <p className="text-slate-500 text-sm mt-1">Comparación acumulada presupuesto contra resultados reales</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMonthly(v => !v)}
            className={`px-3 py-2 text-xs rounded-lg border font-medium transition-colors ${showMonthly ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
          >
            {showMonthly ? 'Ver resumen' : 'Ver por mes'}
          </button>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {noData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-700 text-sm">
          No hay datos de presupuesto o reales para {year}. Sube archivos de tipo <strong>Presupuesto</strong> y <strong>Real</strong> en Carga de Datos.
        </div>
      )}

      {!noData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {showMonthly ? renderMonthly() : renderYTD()}
        </div>
      )}
    </div>
  )
}
