const mongoose = require('mongoose');

// Resumen de una compra, copiado desde la venta (patrón "subset").
const CompraResumenSchema = new mongoose.Schema({
  venta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Venta', required: true },
  numero: String,
  fecha: Date,
  total: Number,
  estado: String
}, { _id: false });

const ClienteSchema = new mongoose.Schema({
  tipo_documento: { type: String, required: true, enum: ['DNI', 'RUC', 'CE'] },
  numero_documento: { type: String, required: true, match: /^\d{8,12}$/ },
  nombre: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^\S+@\S+\.\S+$/ },
  telefono: String,
  direccion: {
    calle: String,
    distrito: String,
    ciudad: String
  },
  // Solo las últimas compras (máx. 10); el historial completo está en la colección ventas.
  historial_compras: { type: [CompraResumenSchema], default: [] }
}, {
  timestamps: { createdAt: 'fecha_registro', updatedAt: 'fecha_actualizacion' }
});

// Deben coincidir con database/02_indices.js
ClienteSchema.index({ tipo_documento: 1, numero_documento: 1 }, { unique: true });

ClienteSchema.statics.MAX_HISTORIAL = 10;

module.exports = mongoose.model('Cliente', ClienteSchema, 'clientes');
