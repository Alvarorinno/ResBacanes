const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads temp dir exists
const uploadsDir = path.join(__dirname, 'uploads_tmp');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json());

const { authMiddleware } = require('./middleware/auth');

// Public routes
app.use('/api/auth', require('./routes/auth'));

// Protected routes
app.use('/api/upload', authMiddleware, require('./routes/upload'));
app.use('/api/eerr', authMiddleware, require('./routes/eerr'));
app.use('/api/proveedores', authMiddleware, require('./routes/proveedores'));
app.use('/api/honorarios', authMiddleware, require('./routes/honorarios'));
app.use('/api/presupuesto', authMiddleware, require('./routes/presupuesto'));
app.use('/api/people', authMiddleware, require('./routes/people'));
app.use('/api/flujo-caja', authMiddleware, require('./routes/flujocaja'));

// Serve frontend build in production
const frontendBuild = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, '../frontend/dist');

if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Resultados Bacanes backend running on http://localhost:${PORT}`);
});
