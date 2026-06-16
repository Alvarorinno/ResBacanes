const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

const MONTHS_ORDER = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

// GET /api/presupuesto/comparison?year=YYYY
router.get('/comparison', (req, res) => {
  const db = getDb();
  const { year } = req.query;
  const targetYear = year || new Date().getFullYear();

  const actualUpload = db.prepare(
    "SELECT id FROM uploads WHERE type = 'actual' AND period LIKE ? ORDER BY uploaded_at DESC LIMIT 1"
  ).get(`${targetYear}%`);

  const budgetUpload = db.prepare(
    "SELECT id FROM uploads WHERE type = 'budget' AND (period LIKE ? OR period = ?) ORDER BY uploaded_at DESC LIMIT 1"
  ).get(`${targetYear}%`, String(targetYear));

  const result = { actual: [], budget: [], months: [] };

  if (actualUpload) {
    result.actual = db.prepare(
      'SELECT * FROM eerr_detalle WHERE upload_id = ? ORDER BY sort_order, month_name'
    ).all(actualUpload.id);
  }

  if (budgetUpload) {
    result.budget = db.prepare(
      'SELECT * FROM eerr_detalle WHERE upload_id = ? ORDER BY sort_order, month_name'
    ).all(budgetUpload.id);
  }

  const allMonths = new Set([
    ...result.actual.map(r => r.month_name),
    ...result.budget.map(r => r.month_name),
  ]);
  result.months = [...allMonths].sort((a, b) => MONTHS_ORDER.indexOf(a) - MONTHS_ORDER.indexOf(b));

  res.json(result);
});

module.exports = router;
