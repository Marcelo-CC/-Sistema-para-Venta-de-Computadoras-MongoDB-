require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const productoRoutes = require('./routes/productoRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const proveedorRoutes = require('./routes/proveedorRoutes');
const ventaRoutes = require('./routes/ventaRoutes');
const reporteRoutes = require('./routes/reporteRoutes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Rutas
app.get('/api', (req, res) => {
  res.json({ api: 'Venta de Computadoras', estado: 'ok', mongodb: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado' });
});
app.use('/api', productoRoutes);
app.use('/api', clienteRoutes);
app.use('/api', proveedorRoutes);
app.use('/api', ventaRoutes);
app.use('/api', reporteRoutes);

app.use((req, res) => {
  res.status(404).json({ mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// Manejo central de errores (Express 5 envía aquí los errores de las rutas async)
app.use((err, req, res, next) => {
  if (err.name === 'CastError') {
    return res.status(400).json({ mensaje: `Valor inválido para ${err.path}: ${err.value}` });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      mensaje: 'Datos inválidos',
      errores: Object.values(err.errors).map((e) => e.message)
    });
  }
  if (err.code === 11000) {
    return res.status(409).json({ mensaje: 'Registro duplicado', campos: err.keyValue });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'JSON mal formado' });
  }
  console.error(err);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
});

// Conectar a MongoDB y levantar el servidor
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB conectado');
    app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}/api`));
  })
  .catch((err) => {
    console.error('No se pudo conectar a MongoDB:', err.message);
    process.exit(1);
  });
