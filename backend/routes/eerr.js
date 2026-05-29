const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// GET /api/eerr/summary?upload_id=X
router.get('/summary', (req, res) => {
  const db = getDb();
  const { upload_id } = req.query;

  let rows;
  if (upload_id) {
    rows = db.prepare('SELECT * FROM eerr_summary WHERE upload_id = ? ORDER BY id').all(upload_id);
  } else {
    // Latest upload
    const latest = db.prepare("SELECT id FROM uploads WHERE type = 'actual' ORDER BY uploaded_at DESC LIMIT 1").get();
    if (!latest) return res.json([]);
    rows = db.prepare('SELECT * FROM eerr_summary WHERE upload_id = ? ORDER BY id').all(latest.id);
  }
  res.json(rows);
});

// GET /api/eerr/detalle?upload_id=X&year=Y
router.get('/detalle', (req, res) => {
  const db = getDb();
  const { upload_id, year } = req.query;

  let uploadId = upload_id;
  if (!uploadId) {
    const latest = db.prepare("SELECT id FROM uploads WHERE type = 'actual' ORDER BY uploaded_at DESC LIMIT 1").get();
    if (!latest) return res.json([]);
    uploadId = latest.id;
  }

  let rows;
  if (year) {
    rows = db.prepare('SELECT * FROM eerr_detalle WHERE upload_id = ? AND year = ? ORDER BY sort_order, month_name').all(uploadId, year);
  } else {
    rows = db.prepare('SELECT * FROM eerr_detalle WHERE upload_id = ? ORDER BY sort_order, month_name').all(uploadId);
  }
  res.json(rows);
});

// GET /api/eerr/kpis?upload_id=X
router.get('/kpis', (req, res) => {
  const db = getDb();
  const { upload_id } = req.query;

  let uploadId = upload_id;
  if (!uploadId) {
    const latest = db.prepare("SELECT id FROM uploads WHERE type = 'actual' ORDER BY uploaded_at DESC LIMIT 1").get();
    if (!latest) return res.json({});
    uploadId = latest.id;
  }

  const rows = db.prepare('SELECT concepto, category, amount FROM eerr_summary WHERE upload_id = ?').all(uploadId);

  const kpis = {};
  let totalIngresos = 0;
  let totalGastos = 0;
  let costoVenta = 0;
  let totalVentas = 0;
  let totalRemuneraciones = 0;
  let gastosAdmin = 0;
  let resultado = 0;

  for (const r of rows) {
    const c = r.concepto.toUpperCase();
    if (r.category === 'ingresos') totalIngresos += r.amount;
    if (r.category === 'gastos') totalGastos += r.amount;
    if (c.includes('COSTO DE VENTA')) costoVenta = r.amount;
    if (c === 'VENTAS' || c.includes('TOTAL VENTAS')) totalVentas += r.amount;
    // Sueldos puros: base + extras + gratificaciones + leyes sociales
    // Excluye honorarios (contratistas) y locomoción/colación (beneficios)
    if (c.includes('4201-01-0001') || c.includes('4201-01-0002') ||
        c.includes('4201-14') || c.includes('4201-03 LEYES')) {
      totalRemuneraciones += r.amount;
    }
    if (c.includes('GASTOS ADMIN') || c.includes('LEGALES') || c.includes('ARRIENDOS')) {
      gastosAdmin += r.amount;
    }
    if (r.category === 'resultado') resultado = r.amount;
  }

  if (totalVentas === 0) {
    // Try to get from detalle subtotals
    const ventasRow = rows.find(r => r.concepto.toUpperCase() === 'VENTAS');
    if (ventasRow) totalVentas = ventasRow.amount;
  }

  // Calculate resultado from ingresos - gastos if not captured directly
  if (resultado === 0 && totalIngresos > 0) {
    resultado = totalIngresos - totalGastos;
  }

  const margenBruto = totalIngresos - costoVenta;
  const pctMargenBruto = totalIngresos > 0 ? (margenBruto / totalIngresos) * 100 : 0;
  // Denominador correcto: Total Ingresos (ventas + provision + otros), no solo línea VENTAS
  const baseVentas = totalIngresos > 0 ? totalIngresos : totalVentas;
  const sueldosVsVentas = baseVentas > 0 ? (totalRemuneraciones / baseVentas) * 100 : 0;
  const costosVsVentas = totalIngresos > 0 ? (totalGastos / totalIngresos) * 100 : 0;
  const pctResultado = totalIngresos > 0 ? (resultado / totalIngresos) * 100 : 0;

  res.json({
    totalIngresos,
    totalGastos,
    costoVenta,
    totalVentas,
    totalRemuneraciones,
    gastosAdmin,
    resultado,
    margenBruto,
    pctMargenBruto,
    sueldosVsVentas,
    costosVsVentas,
    pctResultado,
  });
});

// GET /api/eerr/monthly?upload_id=X - monthly aggregates from detalle
router.get('/monthly', (req, res) => {
  const db = getDb();
  const { upload_id } = req.query;

  let uploadId = upload_id;
  if (!uploadId) {
    const latest = db.prepare("SELECT id FROM uploads WHERE type = 'actual' ORDER BY uploaded_at DESC LIMIT 1").get();
    if (!latest) return res.json([]);
    uploadId = latest.id;
  }

  const rows = db.prepare(`
    SELECT month_name, section, concepto, is_subtotal, SUM(amount) as amount
    FROM eerr_detalle
    WHERE upload_id = ? AND is_subtotal = 1
    GROUP BY month_name, concepto
    ORDER BY sort_order
  `).all(uploadId);

  res.json(rows);
});

module.exports = router;
