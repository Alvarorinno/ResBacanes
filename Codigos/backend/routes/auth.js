const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { authMiddleware, adminOnly, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND activo = 1').get(username.trim().toLowerCase(), username.trim().toLowerCase());
  if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const token = jwt.sign(
    { id: user.id, email: user.email, nombre: user.nombre, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, role: user.role } });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// GET /api/auth/users — admin only
router.get('/users', authMiddleware, adminOnly, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, nombre, username, email, role, activo, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

// POST /api/auth/users — admin creates user
router.post('/users', authMiddleware, adminOnly, (req, res) => {
  const { nombre, username, email, password, role } = req.body;
  if (!nombre || !username || !password) return res.status(400).json({ error: 'Nombre, usuario y contraseña son requeridos' });
  const validRoles = ['admin', 'viewer'];
  const userRole = validRoles.includes(role) ? role : 'viewer';

  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim().toLowerCase());
  if (exists) return res.status(409).json({ error: 'Ya existe un usuario con ese nombre de usuario' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (nombre, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).run(nombre.trim(), username.trim().toLowerCase(), email?.trim().toLowerCase() || null, hash, userRole);

  res.json({ id: result.lastInsertRowid, nombre, username, email, role: userRole });
});

// PUT /api/auth/users/:id — admin updates user
router.put('/users/:id', authMiddleware, adminOnly, (req, res) => {
  const { nombre, role, activo, password } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const newNombre = nombre || user.nombre;
  const validRoles = ['admin', 'viewer'];
  const newRole = validRoles.includes(role) ? role : user.role;
  const newActivo = activo !== undefined ? (activo ? 1 : 0) : user.activo;

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET nombre=?, role=?, activo=?, password_hash=? WHERE id=?')
      .run(newNombre, newRole, newActivo, hash, req.params.id);
  } else {
    db.prepare('UPDATE users SET nombre=?, role=?, activo=? WHERE id=?')
      .run(newNombre, newRole, newActivo, req.params.id);
  }

  res.json({ success: true });
});

// DELETE /api/auth/users/:id — admin deletes (can't delete self)
router.delete('/users/:id', authMiddleware, adminOnly, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  }
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
