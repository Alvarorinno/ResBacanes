import { useEffect, useState } from 'react'
import axios from 'axios'

const CLP = (v) => {
  if (!v) return '—'
  return `$${Math.round(v).toLocaleString('es-CL')}`
}

const monthAbbr = { ENERO: 'Ene', FEBRERO: 'Feb', MARZO: 'Mar', ABRIL: 'Abr', MAYO: 'May',
  JUNIO: 'Jun', JULIO: 'Jul', AGOSTO: 'Ago', SEPTIEMBRE: 'Sep', OCTUBRE: 'Oct',
  NOVIEMBRE: 'Nov', DICIEMBRE: 'Dic' }

const areaColors = {
  default: 'bg-slate-700',
}
const areaColorList = ['bg-emerald-700', 'bg-blue-700', 'bg-purple-700', 'bg-orange-700', 'bg-red-700']

export default function Honorarios() {
  const [data, setData] = useState({ areas: [], months: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/honorarios')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const personTotal = (persona) =>
    data.months.reduce((s, m) => s + (persona.months[m] || 0), 0)

  const areaTotal = (area, month) =>
    area.personas.reduce((s, p) => s + (p.months[month] || 0), 0)

  const areaGrandTotal = (area) =>
    data.months.reduce((s, m) => s + areaTotal(area, m), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Costo Honorarios</h2>
        <p className="text-slate-500 text-sm mt-1">Detalle de honorarios por área y persona</p>
      </div>

      {data.areas.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-700 text-sm">
          Sin datos. Carga un archivo Excel primero.
        </div>
      )}

      {data.areas.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-xs min-w-max">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="text-left px-4 py-2.5 font-semibold sticky left-0 bg-slate-800 w-48">Área / Nombre</th>
                {data.months.map(m => (
                  <th key={m} className="text-right px-3 py-2.5 font-semibold min-w-[88px]">
                    {monthAbbr[m] || m}
                  </th>
                ))}
                <th className="text-right px-3 py-2.5 font-semibold min-w-[96px] bg-slate-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.areas.map((area, aIdx) => [
                // Area header
                <tr key={`area-${aIdx}`} className={`${areaColorList[aIdx % areaColorList.length]}`}>
                  <td colSpan={data.months.length + 2} className="px-4 py-1.5 text-white font-semibold text-xs uppercase tracking-widest sticky left-0">
                    {area.area || 'Sin área'}
                  </td>
                </tr>,

                // Personas
                ...area.personas.map((persona, pIdx) => (
                  <tr key={`${aIdx}-${pIdx}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-1 pl-8 text-slate-700 sticky left-0 bg-white hover:bg-slate-50 whitespace-nowrap">{persona.nombre}</td>
                    {data.months.map(m => (
                      <td key={m} className="text-right px-3 py-1 text-slate-600 tabular-nums">
                        {CLP(persona.months[m])}
                      </td>
                    ))}
                    <td className="text-right px-3 py-1 font-semibold text-slate-700 bg-slate-50/50 tabular-nums">
                      {CLP(personTotal(persona))}
                    </td>
                  </tr>
                )),

                // Area subtotal
                <tr key={`area-total-${aIdx}`} className="bg-slate-100 border-b-2 border-slate-300">
                  <td className="px-4 py-1.5 font-bold text-slate-700 sticky left-0 bg-slate-100 whitespace-nowrap">
                    Subtotal {area.area}
                  </td>
                  {data.months.map(m => (
                    <td key={m} className="text-right px-3 py-1.5 font-bold text-slate-700 tabular-nums">
                      {CLP(areaTotal(area, m))}
                    </td>
                  ))}
                  <td className="text-right px-3 py-1.5 font-bold text-slate-800 bg-slate-200 tabular-nums">
                    {CLP(areaGrandTotal(area))}
                  </td>
                </tr>,
              ])}

              {/* Grand total */}
              <tr className="bg-slate-800 text-white">
                <td className="px-4 py-2 font-bold sticky left-0 bg-slate-800 whitespace-nowrap">TOTAL HONORARIOS</td>
                {data.months.map(m => (
                  <td key={m} className="text-right px-3 py-2 font-bold tabular-nums">
                    {CLP(data.areas.reduce((s, a) => s + areaTotal(a, m), 0))}
                  </td>
                ))}
                <td className="text-right px-3 py-2 font-bold bg-slate-700 tabular-nums">
                  {CLP(data.areas.reduce((s, a) => s + areaGrandTotal(a), 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
