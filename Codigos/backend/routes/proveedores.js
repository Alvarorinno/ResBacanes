const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const { upload_id } = req.query;

  let uploadId = upload_id;
  if (!uploadId) {
    const latest = db.prepare("SELECT id FROM uploads ORDER BY uploaded_at DESC LIMIT 1").get();
    if (!latest) return res.json({ rows: [], totals: {} });
    uploadId = latest.id;
  }

  const rows = db.prepare('SELECT * FROM proveedores WHERE upload_id = ? ORDER BY nombre, fecha').all(uploadId);

  const totals = rows.reduce((acc, r) => ({
    debe: acc.debe + r.debe,
    haber: acc.haber + r.haber,
    saldo: acc.saldo + r.saldo,
  }), { debe: 0, haber: 0, saldo: 0 });

  // Group by nombre
  const byNombre = {};
  for (const r of rows) {
    if (!byNombre[r.nombre]) {
      byNombre[r.nombre] = { nombre: r.nombre, rut: r.rut, facturas: 0, debe: 0, haber: 0, saldo: 0 };
    }
    byNombre[r.nombre].facturas++;
    byNombre[r.nombre].debe += r.debe;
    byNombre[r.nombre].haber += r.haber;
    byNombre[r.nombre].saldo += r.saldo;
  }

  res.json({ rows, summary: Object.values(byNombre), totals });
});

module.exports = router;
