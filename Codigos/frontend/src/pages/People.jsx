import { useEffect, useState } from 'react'
import axios from 'axios'

const CLP = (v) => {
  if (!v || v === 0) return '—'
  const abs = Math.abs(v)
  const formatted = `$${Math.round(abs).toLocaleString('es-CL')}`
  return v < 0 ? `(${formatted})` : formatted
}

const monthAbbr = {
  ENERO: 'Ene', FEBRERO: 'Feb', MARZO: 'Mar', ABRIL: 'Abr', MAYO: 'May',
  JUNIO: 'Jun', JULIO: 'Jul', AGOSTO: 'Ago', SEPTIEMBRE: 'Sep', OCTUBRE: 'Oct',
  NOVIEMBRE: 'Nov', DICIEMBRE: 'Dic',
}

export default function People() {
  const [data, setData] = useState({ months: [], people: {}, eerr_totals: {} })
  const [loading, setLoading] = useState(true)
  const [activeMonth, setActiveMonth] = useState(null)

  useEffect(() => {
    axios.get('/api/people')
      .then(r => {
        const d = r.data || {}
        const safe = {
          months: Array.isArray(d.months) ? d.months : [],
          people: d.people && typeof d.people === 'object' ? d.people : {},
          eerr_totals: d.eerr_totals && typeof d.eerr_totals === 'object' ? d.eerr_totals : {},
        }
        setData(safe)
        if (safe.months.length > 0) setActiveMonth(safe.months[0])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
    </div>
  )

  const noData = data.months.length === 0

  const monthPeople  = activeMonth ? (data.people[activeMonth] || []) : []
  const eerrTotal    = activeMonth ? (data.eerr_totals[activeMonth] || 0) : 0
  const planillaTotal = monthPeople.reduce((s, p) => s + p.costo_total, 0)
  const ajuste       = eerrTotal - planillaTotal  // diferencia → "Honorarios"

  // KPI totals across all months
  const totalPlanilla = Object.values(data.eerr_totals).reduce((s, v) => s + v, 0)
  const totalPersonas = activeMonth ? monthPeople.length : 0

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">People</h2>
          <p className="text-slate-500 text-sm mt-1">Costo de personas por mes</p>
        </div>
        {/* Month tabs */}
        {!noData && (
          <div className="flex gap-1.5 flex-wrap justify-end">
            {data.months.map(m => (
              <button
                key={m}
                onClick={() => setActiveMonth(m)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  activeMonth === m
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {monthAbbr[m] || m}
              </button>
            ))}
          </div>
        )}
      </div>

      {noData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-700 text-sm">
          Sin datos. Sube el archivo de <strong>Remuneraciones</strong> en Carga de Datos.
        </div>
      )}

      {!noData && activeMonth && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 opacity-80">Costo Total {monthAbbr[activeMonth]}</p>
              <p className="text-2xl font-bold mt-1 text-blue-700 tabular-nums">{CLP(eerrTotal)}</p>
              <p className="text-xs mt-1 text-blue-500">Según EERR Remuneraciones</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 opacity-80">Planilla</p>
              <p className="text-2xl font-bold mt-1 text-slate-700 tabular-nums">{CLP(planillaTotal)}</p>
              <p className="text-xs mt-1 text-slate-400">{totalPersonas} persona{totalPersonas !== 1 ? 's' : ''} en nómina</p>
            </div>
            <div className={`rounded-xl p-4 border ${ajuste > 0 ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide opacity-80 ${ajuste > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>Ajuste Honorarios</p>
              <p className={`text-2xl font-bold mt-1 tabular-nums ${ajuste > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>{ajuste > 0 ? CLP(ajuste) : '—'}</p>
              <p className={`text-xs mt-1 ${ajuste > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                {ajuste > 0 ? 'Honorarios ajustado a sueldos' : 'Planilla cuadra con EERR'}
              </p>
            </div>
          </div>

          {/* People table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <div className="w-2 h-5 rounded-full bg-blue-600" />
              <h3 className="text-sm font-bold text-slate-700">
                Nómina — {monthAbbr[activeMonth] || activeMonth}
              </h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="text-left px-5 py-2.5 font-semibold">Nombre</th>
                  <th className="text-left px-5 py-2.5 font-semibold">Cargo</th>
                  <th className="text-right px-5 py-2.5 font-semibold">Sueldo Base</th>
                  <th className="text-right px-5 py-2.5 font-semibold bg-slate-700">Costo Total</th>
                </tr>
              </thead>
              <tbody>
                {monthPeople.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-2 font-medium text-slate-700 whitespace-nowrap">{p.nombre}</td>
                    <td className="px-5 py-2 text-slate-500">{p.cargo}</td>
                    <td className="px-5 py-2 text-right text-slate-600 tabular-nums">{CLP(p.sueldo_base)}</td>
                    <td className="px-5 py-2 text-right font-semibold text-slate-700 tabular-nums bg-slate-50/50">{CLP(p.costo_total)}</td>
                  </tr>
                ))}

                {/* Ajuste Honorarios row */}
                {ajuste > 0 && (
                  <tr className="border-b border-orange-200 bg-orange-50">
                    <td className="px-5 py-2 font-semibold text-orange-800 whitespace-nowrap italic">Honorarios</td>
                    <td className="px-5 py-2 text-orange-500 text-[11px]">Honorarios relacionados</td>
                    <td className="px-5 py-2 text-right text-orange-400 tabular-nums">—</td>
                    <td className="px-5 py-2 text-right font-semibold text-orange-700 tabular-nums bg-orange-100">{CLP(ajuste)}</td>
                  </tr>
                )}

                {/* Total row */}
                <tr className="bg-blue-700 text-white">
                  <td className="px-5 py-2 font-bold" colSpan={2}>
                    TOTAL {monthAbbr[activeMonth] || activeMonth}
                  </td>
                  <td className="px-5 py-2 text-right font-bold tabular-nums">
                    {CLP(monthPeople.reduce((s, p) => s + p.sueldo_base, 0))}
                  </td>
                  <td className="px-5 py-2 text-right font-bold tabular-nums bg-blue-800">
                    {CLP(eerrTotal > 0 ? eerrTotal : planillaTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
