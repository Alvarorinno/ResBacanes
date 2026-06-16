const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db');

const router = express.Router();

const upload = multer({ dest: path.join(__dirname, '../uploads_tmp/') });

const MONTHS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

function toNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[^0-9.\-]/g, '');
  return parseFloat(s) || 0;
}

function findLabel(row) {
  // The concepto label can be in any of columns 1-4; return first non-empty
  for (let i = 1; i <= 4; i++) {
    if (row[i] !== null && row[i] !== undefined && String(row[i]).trim() !== '') {
      return String(row[i]).trim();
    }
  }
  return '';
}

function lastNumericValue(row) {
  for (let i = row.length - 1; i >= 1; i--) {
    if (row[i] !== null && row[i] !== undefined && row[i] !== '' && typeof row[i] === 'number') {
      return row[i];
    }
  }
  return 0;
}

function parseEERR(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const results = [];

  const EERR_ROWS = [
    { concepto: 'VENTAS', category: 'ingresos' },
    { concepto: 'OTROS INGRESOS', category: 'ingresos' },
    { concepto: 'PROVISION VENTAS', category: 'ingresos' },
    { concepto: '4101-01 COSTO DE VENTA', category: 'gastos' },
    { concepto: '4101-20 IMPUESTOS ESPECIFICOS', category: 'gastos' },
    { concepto: '4201-01-0001 REMUNERACIONES', category: 'gastos' },
    { concepto: '4201-01-0002 REMUNERACIONES EXTRAS', category: 'gastos' },
    { concepto: '4201-14 GRATIFICACIONES', category: 'gastos' },
    { concepto: '4201-26 LOCOMOCION Y COLACION', category: 'gastos' },
    { concepto: '4201-07 HONORARIOS REMUNERACIONES', category: 'gastos' },
    { concepto: '4201-02 HONORARIOS PROFESIONALES', category: 'gastos' },
    { concepto: '4201-03 LEYES SOCIALES', category: 'gastos' },
    { concepto: '4101-12 SEGUROS', category: 'gastos' },
    { concepto: '4201-04 GASTOS DE OFICINA', category: 'gastos' },
    { concepto: '4201-08 GASTOS ADMINISTRATIVOS', category: 'gastos' },
    { concepto: '4201-10 GASTOS BANCARIOS', category: 'gastos' },
    { concepto: '4201-12 LEGALES Y NOTARIALES', category: 'gastos' },
    { concepto: '4201-30 ARRIENDOS Y GASTOS COMUNES', category: 'gastos' },
    { concepto: 'TOTAL GASTOS', category: 'gastos_total' },
  ];

  for (const row of data) {
    if (!row) continue;
    const label = findLabel(row);
    if (!label) continue;
    const labelUp = label.toUpperCase();

    for (const def of EERR_ROWS) {
      if (labelUp === def.concepto || labelUp.includes(def.concepto)) {
        const amount = lastNumericValue(row);
        results.push({ concepto: label, category: def.category, amount });
        break;
      }
    }

    // Also capture the ganancia/perdida line
    if (labelUp.includes('GANANCIA') || labelUp.includes('PÉRDIDA') || labelUp.includes('PERDIDA')) {
      if (labelUp.includes('ANTES DE IMPUESTO') || labelUp.includes('(=)')) {
        const amount = lastNumericValue(row);
        results.push({ concepto: label, category: 'resultado', amount });
      }
    }
  }
  return results;
}

function parseBudget(ws, year) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const rows = [];

  // Find header row: has "CONCEPTO" in col 0 and month names in other cols
  let headerRowIdx = -1;
  let monthCols = {};
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    let found = 0;
    for (let j = 0; j < row.length; j++) {
      const cell = row[j] ? String(row[j]).trim().toUpperCase() : '';
      if (MONTHS.includes(cell)) { monthCols[cell] = j; found++; }
    }
    if (found >= 3) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) return rows;

  // Section triggers from col 0
  const SECTION_HEADERS = [
    { match: /^INGRESOS.*VENTAS/i,     section: 'ventas' },
    { match: /^OTROS\s+INGRESOS/i,     section: 'otros_ingresos' },
    { match: /^GASTOS\s+OPERACIONALES/i, section: 'gastos_operacionales' },
    { match: /^REMUNERACIONES/i,       section: 'remuneraciones' },
    { match: /^ADMINISTRACI/i,         section: 'administracion' },
    { match: /^GASTOS\s+FINANCIEROS/i, section: 'gastos_financieros' },
    { match: /^RESULTADO/i,            section: 'resultado' },
  ];

  // Rows to skip entirely
  const SKIP = /^(CONCEPTO|TOTAL INGRESOS|TOTAL GASTOS|GANANCIA|PÉRDIDA|PERDIDA|PROYECTOS|Completar)/i;

  function isSubtotal(label) {
    const up = label.toUpperCase();
    return up.startsWith('TOTAL') || /^\d{4}\s+/.test(up);
  }

  let currentSection = null;
  let currentSubtotal = null;
  let sortOrder = 0;

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const label = row[0] ? String(row[0]).trim() : '';
    if (!label) continue;
    if (SKIP.test(label)) continue;

    // Check if this row is a section header (pure header, no amounts)
    let isSectionHeader = false;
    for (const s of SECTION_HEADERS) {
      if (s.match.test(label)) {
        // Only treat as pure header if it has no numeric amounts
        const hasAmounts = Object.values(monthCols).some(c => typeof row[c] === 'number' && row[c] !== 0);
        if (!hasAmounts) {
          currentSection = s.section;
          currentSubtotal = null;
          isSectionHeader = true;
        } else {
          currentSection = s.section;
        }
        break;
      }
    }
    if (isSectionHeader || !currentSection) continue;

    const isSub = isSubtotal(label);
    if (isSub) currentSubtotal = label;

    for (const [monthName, colIdx] of Object.entries(monthCols)) {
      const amount = toNum(row[colIdx]);
      rows.push({
        year,
        month_name: monthName,
        concepto: label,
        parent_concepto: isSub ? null : currentSubtotal,
        section: currentSection,
        amount,
        is_subtotal: isSub ? 1 : 0,
        sort_order: sortOrder,
      });
    }
    sortOrder++;
  }
  return rows;
}

function parseEERRDetalle(ws, year) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const rows = [];

  // Find month header row
  let headerRowIdx = -1;
  let monthCols = {};
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    let found = 0;
    for (let j = 0; j < row.length; j++) {
      const cell = row[j] ? String(row[j]).trim().toUpperCase() : '';
      if (MONTHS.includes(cell)) { monthCols[cell] = j; found++; }
    }
    if (found >= 3) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) return rows;

  // ── Dynamic section detection ─────────────────────────────────────────────
  // Col 1 (index 1) = section label (Ventas, GASTOS POR NATURALEZA, etc.)
  // Col 2 (index 2) = concepto (subtotals AND detail rows)
  // Subtotal = concepto starts with TOTAL or matches known group codes (4101, 4201)
  // Detail   = everything else within the current section/parent

  // Map col-1 section label keywords → section id
  const SECTION_MAP = [
    { match: /^ventas$/i,                           section: 'ventas' },
    { match: /otros\s+ingresos/i,                   section: 'otros_ingresos' },
    { match: /gastos\s+(por\s+)?naturaleza/i,        section: 'gastos_operacionales' },
    { match: /remuneraciones?/i,                     section: 'remuneraciones' },
    { match: /administra/i,                          section: 'administracion' },
    { match: /financiero/i,                          section: 'gastos_financieros' },
    { match: /resultado/i,                           section: 'resultado' },
  ];

  // Some subtotals in col2 also trigger a section change (when multiple sub-sections
  // share the same col1 heading, e.g. all gastos under "GASTOS POR NATURALEZA")
  const SUBTOTAL_SECTION_TRIGGER = [
    { match: /^TOTAL VENTAS$/i,                    section: 'ventas' },
    { match: /^TOTAL OTROS INGRESOS$/i,             section: 'otros_ingresos' },
    { match: /^4101\s+GASTOS OPERACIONALES/i,       section: 'gastos_operacionales' },
    { match: /^4201\s+TOTAL REMUNERACIONES/i,       section: 'remuneraciones' },
    { match: /^4201\s+TOTAL ADMINISTR?A/i,          section: 'administracion' },
    { match: /^4201\s+TOTAL GASTOS FINANCIEROS/i,   section: 'gastos_financieros' },
    { match: /^TOTAL EGRESOS/i,                     section: 'resultado' },
  ];

  // Patterns that signal a SUBTOTAL/parent row within a section
  // Group codes: "4101 GASTOS..." or "4201 TOTAL..." → 4 digits + SPACE → subtotal
  // Detail codes: "4201-14 GRAT..." or "4101-01 COSTO..." → 4 digits + HYPHEN → detail
  function isSubtotalConcepto(label) {
    const up = label.toUpperCase();
    if (up.startsWith('TOTAL')) return true;
    if (up.startsWith('(=)')) return true;
    if (/^\d{4}\s+/.test(up)) return true;   // "4101 " or "4201 " — group header
    return false;
  }

  // Skip pure summary rows that don't belong in the table body
  function isIgnoredRow(label) {
    const up = label.toUpperCase();
    return up.includes('ANTES DE IMPUESTO') ||
           up.includes('PROVISION IMPUESTO') ||
           up.includes('IMPUESTO DE RENTA') ||
           (up.startsWith('(=)') && !up.includes('PERDIDA') && !up.includes('PÉRDIDA') && !up.includes('GANANCIA'));
  }

  let currentSection = null;
  let currentSubtotal = null;
  let sortOrder = 0;
  const seen = new Set();

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    const col1 = row[1] ? String(row[1]).trim() : '';
    const col2 = row[2] ? String(row[2]).trim() : '';

    // Detect new section from col 1
    if (col1 && !col2) {
      for (const s of SECTION_MAP) {
        if (s.match.test(col1)) {
          currentSection = s.section;
          currentSubtotal = null;
          break;
        }
      }
      continue;
    }

    // Also detect section change from known subtotal labels in col 2
    if (col2) {
      for (const t of SUBTOTAL_SECTION_TRIGGER) {
        if (t.match.test(col2)) {
          currentSection = t.section;
          currentSubtotal = null;
          break;
        }
      }
    }

    // Need a section to assign rows to
    if (!currentSection) continue;

    const label = col2 || col1;
    if (!label) continue;
    if (isIgnoredRow(label)) continue;

    const isSub = isSubtotalConcepto(label);
    if (isSub) currentSubtotal = label;

    // Deduplicate: same concepto in same section only once
    const dedupeKey = `${currentSection}::${label}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    for (const [monthName, colIdx] of Object.entries(monthCols)) {
      const amount = toNum(row[colIdx]);
      rows.push({
        year,
        month_name: monthName,
        concepto: label,
        parent_concepto: isSub ? null : currentSubtotal,
        section: currentSection,
        amount,
        is_subtotal: isSub ? 1 : 0,
        sort_order: sortOrder,
      });
    }
    sortOrder++;
  }

  return rows;
}

function excelDateToStr(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  return String(val);
}

function parseProveedores(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const rows = [];

  // Actual column mapping (0-indexed) from Excel analysis:
  // 0: Rut, 1: Nombre, 6: Fecha, 7: Comprobante, 9: Sec, 10: Documento, 11: DocNum,
  // 13: Vencimiento, 15: Debe, 16: Haber, 18: Saldo

  // Find header row first
  let dataStartIdx = 13; // default row 14 (0-indexed 13)
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const r0 = row[0] ? String(row[0]).trim().toUpperCase() : '';
    if (r0 === 'RUT') { dataStartIdx = i + 1; break; }
  }

  let currentRut = '';
  let currentNombre = '';

  for (let i = dataStartIdx; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    const col0 = row[0] ? String(row[0]).trim() : '';
    const col1 = row[1] ? String(row[1]).trim() : '';

    // Skip total rows
    if (col1.toUpperCase().includes('TOTAL')) continue;
    if (col0.toUpperCase().includes('TOTAL')) continue;

    // If col0 has a RUT-like value, update current supplier
    if (col0 && col0.match(/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/)) {
      currentRut = col0;
      currentNombre = col1;
    }

    // Skip rows that don't have fecha (col 6) — they're header repetitions
    if (!row[6] && !row[7]) continue;

    rows.push({
      rut: currentRut,
      nombre: currentNombre,
      fecha: excelDateToStr(row[6]),
      comprobante: row[7] ? String(row[7]).trim() : '',
      sec: row[9] !== null && row[9] !== undefined ? String(row[9]).trim() : '',
      documento: row[10] ? String(row[10]).trim() : '',
      vencimiento: excelDateToStr(row[13]),
      debe: toNum(row[15]),
      haber: toNum(row[16]),
      saldo: toNum(row[18]),
    });
  }
  return rows;
}

function parseRemuneraciones(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const rows = [];
  let currentMonth = null;

  const RUT_REGEX = /^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/;

  for (const row of data) {
    if (!row) continue;
    const col0 = row[0] ? String(row[0]).trim().toUpperCase() : '';

    // Month header row
    if (MONTHS.includes(col0)) { currentMonth = col0; continue; }

    // Skip non-data rows
    if (!currentMonth || col0 === 'RUT' || !col0) continue;

    // Only process actual person rows (col0 looks like a RUT)
    if (!RUT_REGEX.test(row[0] ? String(row[0]).trim() : '')) continue;

    // Col F (5) = NOMBRES, Col D (3) = AP PATERNO
    const nombres    = row[5] ? String(row[5]).trim() : '';
    const apPaterno  = row[3] ? String(row[3]).trim() : '';
    const nombre     = `${nombres} ${apPaterno}`.trim();
    const cargo     = row[6] ? String(row[6]).trim() : '';
    const sueldoBase  = toNum(row[9]);   // Col J
    const costoTotal  = toNum(row[17]);  // Col R

    if (!nombre) continue;

    rows.push({ month_name: currentMonth, rut: String(row[0]).trim(), nombre, cargo, sueldo_base: sueldoBase, costo_total: costoTotal });
  }
  return rows;
}

function parseHonorarios(ws, year) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const rows = [];

  // Find header row with month names
  let headerRowIdx = -1;
  let monthCols = {};

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    let found = 0;
    for (let j = 0; j < row.length; j++) {
      const cell = row[j] ? String(row[j]).trim().toUpperCase() : '';
      if (MONTHS.includes(cell)) {
        monthCols[cell] = j;
        found++;
      }
    }
    if (found >= 2) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) return rows;

  let currentArea = '';
  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    const col0 = row[0] ? String(row[0]).trim() : '';
    const col1 = row[1] ? String(row[1]).trim() : '';

    // Detect area rows (col0 has area, col1 empty or also area label)
    if (col0 && !col1) {
      const up = col0.toUpperCase();
      if (up.includes('PIZZERIA') || up.includes('DJ') || up.includes('ADMINISTRACION') || up.includes('ADMINISTRACIÓN')) {
        currentArea = col0;
        continue;
      }
    }

    // Skip total rows
    if (col0.toUpperCase().includes('TOTAL') || col1.toUpperCase().includes('TOTAL')) continue;
    if (!col1) continue;

    for (const [monthName, colIdx] of Object.entries(monthCols)) {
      const amount = toNum(row[colIdx]);
      if (amount !== 0) {
        rows.push({
          area: currentArea,
          nombre: col1,
          month_name: monthName,
          year,
          monto: amount,
        });
      }
    }
  }
  return rows;
}

router.post('/', upload.single('file'), (req, res) => {
  const file = req.file;
  const { period, type } = req.body;

  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  if (!period) return res.status(400).json({ error: 'Period is required' });
  if (!type) return res.status(400).json({ error: 'Type is required' });

  try {
    const wb = XLSX.readFile(file.path);
    const year = parseInt(period.split('-')[0]) || new Date().getFullYear();

    const db = getDb();

    // Insert upload record
    const uploadInsert = db.prepare(
      'INSERT INTO uploads (filename, period, type) VALUES (?, ?, ?)'
    );
    const uploadResult = uploadInsert.run(file.originalname, period, type);
    const uploadId = uploadResult.lastInsertRowid;

    // Parse and insert EERR summary
    if (wb.SheetNames.includes('EERR')) {
      const eerrData = parseEERR(wb.Sheets['EERR']);
      const insertEerr = db.prepare(
        'INSERT INTO eerr_summary (upload_id, concepto, category, amount) VALUES (?, ?, ?, ?)'
      );
      const insertMany = db.transaction((rows) => {
        for (const r of rows) insertEerr.run(uploadId, r.concepto, r.category, r.amount);
      });
      insertMany(eerrData);
    }

    // Parse and insert EERR DETALLE
    const detalleSheet = wb.SheetNames.find(n => n.toUpperCase().includes('EERR DETALLE') || n.toUpperCase().includes('EERR_DETALLE'));
    if (detalleSheet) {
      const detalleData = type === 'budget'
        ? parseBudget(wb.Sheets[detalleSheet], year)
        : parseEERRDetalle(wb.Sheets[detalleSheet], year);
      const insertDetalle = db.prepare(
        `INSERT INTO eerr_detalle (upload_id, year, month_name, concepto, parent_concepto, section, amount, is_subtotal, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertMany = db.transaction((rows) => {
        for (const r of rows) {
          insertDetalle.run(uploadId, r.year, r.month_name, r.concepto, r.parent_concepto, r.section, r.amount, r.is_subtotal, r.sort_order);
        }
      });
      insertMany(detalleData);
    }

    // Parse and insert PROVEEDORES
    if (wb.SheetNames.find(n => n.toUpperCase().includes('PROVEEDORES'))) {
      const provSheet = wb.SheetNames.find(n => n.toUpperCase().includes('PROVEEDORES'));
      const provData = parseProveedores(wb.Sheets[provSheet]);
      const insertProv = db.prepare(
        `INSERT INTO proveedores (upload_id, rut, nombre, fecha, comprobante, sec, documento, vencimiento, debe, haber, saldo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertMany = db.transaction((rows) => {
        for (const r of rows) {
          insertProv.run(uploadId, r.rut, r.nombre, r.fecha, r.comprobante, r.sec, r.documento, r.vencimiento, r.debe, r.haber, r.saldo);
        }
      });
      insertMany(provData);
    }

    // Parse and insert REMUNERACIONES (People)
    const remSheet = wb.SheetNames.find(n => n.toUpperCase().includes('REMUNER')) || (type === 'people' ? wb.SheetNames[0] : null);
    if (remSheet && (type === 'people' || wb.SheetNames.find(n => n.toUpperCase().includes('REMUNER')))) {
      const remData = parseRemuneraciones(wb.Sheets[remSheet]);
      const insertRem = db.prepare(
        'INSERT INTO people_detalle (upload_id, month_name, rut, nombre, cargo, sueldo_base, costo_total) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      const insertMany = db.transaction((rows) => {
        for (const r of rows) insertRem.run(uploadId, r.month_name, r.rut, r.nombre, r.cargo, r.sueldo_base, r.costo_total);
      });
      insertMany(remData);
    }

    // Parse and insert HONORARIOS
    const honSheet = wb.SheetNames.find(n => n.toUpperCase().includes('HONORARIOS') || n.toUpperCase().includes('COSTO'));
    if (honSheet) {
      const honData = parseHonorarios(wb.Sheets[honSheet], year);
      const insertHon = db.prepare(
        'INSERT INTO honorarios (upload_id, area, nombre, month_name, year, monto) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const insertMany = db.transaction((rows) => {
        for (const r of rows) insertHon.run(uploadId, r.area, r.nombre, r.month_name, r.year, r.monto);
      });
      insertMany(honData);
    }

    // Clean up temp file
    fs.unlinkSync(file.path);

    res.json({ success: true, uploadId, message: 'Archivo procesado correctamente' });
  } catch (err) {
    console.error('Upload error:', err);
    // Clean up temp file on error
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ error: err.message });
  }
});

router.get('/list', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM uploads ORDER BY uploaded_at DESC').all();
  res.json(rows);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const id = req.params.id;
  db.prepare('DELETE FROM eerr_summary WHERE upload_id = ?').run(id);
  db.prepare('DELETE FROM eerr_detalle WHERE upload_id = ?').run(id);
  db.prepare('DELETE FROM proveedores WHERE upload_id = ?').run(id);
  db.prepare('DELETE FROM honorarios WHERE upload_id = ?').run(id);
  db.prepare('DELETE FROM people_detalle WHERE upload_id = ?').run(id);
  db.prepare('DELETE FROM uploads WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
