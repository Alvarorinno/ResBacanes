const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      period TEXT,
      type TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS eerr_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER,
      concepto TEXT,
      category TEXT,
      amount REAL,
      FOREIGN KEY (upload_id) REFERENCES uploads(id)
    );

    CREATE TABLE IF NOT EXISTS eerr_detalle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER,
      year INTEGER,
      month_name TEXT,
      concepto TEXT,
      parent_concepto TEXT,
      section TEXT,
      amount REAL,
      is_subtotal INTEGER DEFAULT 0,
      sort_order INTEGER,
      FOREIGN KEY (upload_id) REFERENCES uploads(id)
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER,
      rut TEXT,
      nombre TEXT,
      fecha TEXT,
      comprobante TEXT,
      sec TEXT,
      documento TEXT,
      vencimiento TEXT,
      debe REAL DEFAULT 0,
      haber REAL DEFAULT 0,
      saldo REAL DEFAULT 0,
      FOREIGN KEY (upload_id) REFERENCES uploads(id)
    );

    CREATE TABLE IF NOT EXISTS honorarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER,
      area TEXT,
      nombre TEXT,
      month_name TEXT,
      year INTEGER,
      monto REAL,
      FOREIGN KEY (upload_id) REFERENCES uploads(id)
    );

    CREATE TABLE IF NOT EXISTS people_detalle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER,
      month_name TEXT,
      rut TEXT,
      nombre TEXT,
      cargo TEXT,
      sueldo_base REAL DEFAULT 0,
      costo_total REAL DEFAULT 0,
      FOREIGN KEY (upload_id) REFERENCES uploads(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      activo INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add username column if it doesn't exist (migration for existing DBs)
  try {
    db.exec("ALTER TABLE users ADD COLUMN username TEXT");
    db.exec("UPDATE users SET username = email WHERE username IS NULL");
  } catch {}

  // Seed default users
  const bcrypt = require('bcryptjs');
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (userCount.cnt === 0) {
    const adminHash = bcrypt.hashSync('bacan2026', 10);
    const userHash = bcrypt.hashSync('usuario2026', 10);
    db.prepare("INSERT INTO users (nombre, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)").run(
      'Administrador', 'admin', 'admin@bacanes.cl', adminHash, 'admin'
    );
    db.prepare("INSERT INTO users (nombre, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)").run(
      'Usuario', 'usuario', 'usuario@bacanes.cl', userHash, 'viewer'
    );
    console.log('Usuarios creados: admin/bacan2026 y usuario/usuario2026');
  }
}

module.exports = { getDb };
