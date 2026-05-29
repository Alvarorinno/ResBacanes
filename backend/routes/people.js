const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

const MONTHS_ORDER = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

// GET /api/people?upload_id=X
router.get('/', (req, res) => {
  const db = getDb();
  const { upload_id } = req.query;

  let uploadId = upload_id;
  if (!uploadId) {
    const latest = db.prepare("SELECT id FROM uploads WHERE type = 'people' ORDER BY uploaded_at DESC LIMIT 1").get()
      || db.prepare("SELECT id FROM uploads WHERE type = 'actual' ORDER BY uploaded_at DESC LIMIT 1").get();
    if (!latest) return res.json({ months: [], people: {}, eerr_totals: {} });
    uploadId = latest.id;
  }

  // People rows
  const rows = db.prepare(
    'SELECT * FROM people_detalle WHERE upload_id = ? ORDER BY month_name, nombre'
  ).all(uploadId);

  // EERR remuneraciones comes from the latest 'actual' upload (not the people upload)
  const actualUpload = db.prepare("SELECT id FROM uploads WHERE type = 'actual' ORDER BY uploaded_at DESC LIMIT 1").get();
  const eerrUploadId = actualUpload ? actualUpload.id : uploadId;

  const eerrRem = db.prepare(`
    SELECT month_name, SUM(amount) as total
    FROM eerr_detalle
    WHERE upload_id = ? AND section = 'remuneraciones' AND is_subtotal = 1
    GROUP BY month_name
  `).all(eerrUploadId);

  const eerrTotals = {};
  for (const r of eerrRem) eerrTotals[r.month_name] = r.total;

  // Unique months in order
  const monthSet = new Set(rows.map(r => r.month_name));
  const months = [...monthSet].sort((a, b) => MONTHS_ORDER.indexOf(a) - MONTHS_ORDER.indexOf(b));

  // Group by month
  const people = {};
  for (const m of months) {
    people[m] = rows.filter(r => r.month_name === m);
  }

  res.json({ months, people, eerr_totals: eerrTotals });
});

module.exports = router;
