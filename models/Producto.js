const mongoose = require('mongoose');

const CATEGORIAS = ['laptop', 'desktop', 'all-in-one', 'monitor', 'accesorio', 'componente'];

const ProductoSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true, uppercase: true, trim: true },
  codigo_barras: { type: String, required: true, unique: true, match: /^\d{8,14}$/ },
  nombre: { type: String, required: true, trim: true },
  categoria: { type: String, required: true, enum: CATEGORIAS },
  marca: { type: String, required: true, trim: true },
  precio: { type: Number, required: true, min: 0 },
  costo: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  stock_minimo: { type: Number, min: 0, default: 0 },
  // Especificaciones técnicas embebidas: cambian según la categoría
  // (una laptop tiene procesador y RAM, un monitor tiene panel y frecuencia),
  // por eso se guardan como subdocumento flexible y no como colección aparte.
  especificaciones: { type: mongoose.Schema.Types.Mixed, default: {} },
  etiquetas: [String],
  // Referencia: el proveedor tiene vida propia y abastece a muchos productos.
  proveedor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Proveedor', required: true },
  activo: { type: Boolean, default: true }
}, {
  timestamps: { createdAt: 'fecha_registro', updatedAt: 'fecha_actualizacion' },
  minimize: false
});

// Deben coincidir con database/02_indices.js
ProductoSchema.index({ categoria: 1, precio: 1 });
ProductoSchema.index({ marca: 1 });
ProductoSchema.index({ proveedor_id: 1 });
ProductoSchema.index(
  { nombre: 'text', marca: 'text', etiquetas: 'text' },
  { weights: { nombre: 10, marca: 5, etiquetas: 2 }, default_language: 'spanish' }
);

ProductoSchema.statics.CATEGORIAS = CATEGORIAS;

module.exports = mongoose.model('Producto', ProductoSchema, 'productos');
