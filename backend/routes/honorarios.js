const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

const MONTHS_ORDER = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

router.get('/', (req, res) => {
  const db = getDb();
  const { upload_id } = req.query;

  let uploadId = upload_id;
  if (!uploadId) {
    const latest = db.prepare("SELECT id FROM uploads ORDER BY uploaded_at DESC LIMIT 1").get();
    if (!latest) return res.json({ rows: [], areas: [], months: [] });
    uploadId = latest.id;
  }

  const rows = db.prepare('SELECT * FROM honorarios WHERE upload_id = ? ORDER BY area, nombre, month_name').all(uploadId);

  const months = [...new Set(rows.map(r => r.month_name))].sort(
    (a, b) => MONTHS_ORDER.indexOf(a) - MONTHS_ORDER.indexOf(b)
  );

  // Build pivot: area -> nombre -> { month: amount }
  const pivot = {};
  for (const r of rows) {
    if (!pivot[r.area]) pivot[r.area] = {};
    if (!pivot[r.area][r.nombre]) pivot[r.area][r.nombre] = { nombre: r.nombre, area: r.area, months: {} };
    pivot[r.area][r.nombre].months[r.month_name] = r.monto;
  }

  const areas = Object.keys(pivot).map(area => ({
    area,
    personas: Object.values(pivot[area]),
  }));

  res.json({ rows, areas, months });
});

module.exports = router;
