const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

const MONTHS_ORDER = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

const MES_ABBR = {
  ENERO: 'Ene', FEBRERO: 'Feb', MARZO: 'Mar', ABRIL: 'Abr',
  MAYO: 'May', JUNIO: 'Jun', JULIO: 'Jul', AGOSTO: 'Ago',
  SEPTIEMBRE: 'Sep', OCTUBRE: 'Oct', NOVIEMBRE: 'Nov', DICIEMBRE: 'Dic',
};

// GET /api/flujo-caja?year=YYYY
router.get('/', (req, res) => {
  const db = getDb();
  const year = req.query.year || new Date().getFullYear();

  const actualUpload = db.prepare(
    "SELECT id FROM uploads WHERE type = 'actual' ORDER BY uploaded_at DESC LIMIT 1"
  ).get();

  const budgetUpload = db.prepare(
    "SELECT id FROM uploads WHERE type = 'budget' AND (period LIKE ? OR period = ?) ORDER BY uploaded_at DESC LIMIT 1"
  ).get(`${year}%`, `${year}`);

  // Aggregate ingresos and gastos per month from actual upload
  const actualRows = actualUpload
    ? db.prepare(`
        SELECT month_name, section, SUM(amount) as total
        FROM eerr_detalle
        WHERE upload_id = ? AND is_subtotal = 0
        GROUP BY month_name, section
      `).all(actualUpload.id)
    : [];

  // Aggregate ingresos and gastos per month from budget upload
  const budgetRows = budgetUpload
    ? db.prepare(`
        SELECT month_name, section, SUM(amount) as total
        FROM eerr_detalle
        WHERE upload_id = ? AND is_subtotal = 0
        GROUP BY month_name, section
      `).all(budgetUpload.id)
    : [];

  // Build map: month -> { ventas, costos }
  const actualMap = {};
  for (const r of actualRows) {
    if (!actualMap[r.month_name]) actualMap[r.month_name] = { ventas: 0, costos: 0 };
    const s = (r.section || '').toUpperCase();
    if (s.includes('INGRESO') || s.includes('VENTA')) {
      actualMap[r.month_name].ventas += r.total;
    } else if (s.includes('GASTO') || s.includes('COSTO') || s.includes('REMUNERACION') || s.includes('HONORARIO')) {
      actualMap[r.month_name].costos += r.total;
    }
  }

  const budgetMap = {};
  for (const r of budgetRows) {
    if (!budgetMap[r.month_name]) budgetMap[r.month_name] = { ventas: 0, costos: 0 };
    const s = (r.section || '').toUpperCase();
    if (s.includes('INGRESO') || s.includes('VENTA')) {
      budgetMap[r.month_name].ventas += r.total;
    } else if (s.includes('GASTO') || s.includes('COSTO') || s.includes('REMUNERACION') || s.includes('HONORARIO')) {
      budgetMap[r.month_name].costos += r.total;
    }
  }

  const actualMonths = new Set(Object.keys(actualMap));

  // Build 12-month array: real if in actual, projected if only in budget
  const result = MONTHS_ORDER.map(m => {
    const abbr = MES_ABBR[m];
    if (actualMonths.has(m) && (actualMap[m].ventas !== 0 || actualMap[m].costos !== 0)) {
      return { mes: abbr, tipo: 'real', ventas: actualMap[m].ventas, costos: actualMap[m].costos };
    } else if (budgetMap[m] && (budgetMap[m].ventas !== 0 || budgetMap[m].costos !== 0)) {
      return { mes: abbr, tipo: 'proyectado', ventas: budgetMap[m].ventas, costos: budgetMap[m].costos };
    }
    return null;
  }).filter(Boolean);

  res.json({ data: result });
});

module.exports = router;
