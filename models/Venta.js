const mongoose = require('mongoose');

// Ítem embebido: guarda una copia del nombre y precio del producto al momento de la venta,
// así la boleta no cambia si luego se modifica el precio del catálogo.
const ItemSchema = new mongoose.Schema({
  producto_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true },
  codigo: String,
  nombre: String,
  categoria: String,
  cantidad: { type: Number, required: true, min: 1 },
  precio_unitario: { type: Number, required: true, min: 0 },
  descuento: { type: Number, min: 0, default: 0 },
  subtotal: { type: Number, required: true, min: 0 }
}, { _id: false });

const VentaSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true, match: /^[BF]\d{3}-\d{6}$/ },
  tipo_comprobante: { type: String, required: true, enum: ['BOLETA', 'FACTURA'] },
  fecha: { type: Date, default: Date.now },
  cliente_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  // Datos del cliente copiados para imprimir el comprobante sin hacer $lookup.
  cliente: {
    nombre: String,
    tipo_documento: String,
    numero_documento: String
  },
  items: {
    type: [ItemSchema],
    validate: [(v) => v.length > 0, 'La venta debe tener al menos un ítem']
  },
  subtotal: { type: Number, required: true, min: 0 },
  igv: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  metodo_pago: { type: String, required: true, enum: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'YAPE'] },
  estado: { type: String, enum: ['PENDIENTE', 'PAGADA', 'ANULADA'], default: 'PENDIENTE' },
  vendedor: { type: String, required: true, trim: true }
});

// Deben coincidir con database/02_indices.js
VentaSchema.index({ fecha: -1 });
VentaSchema.index({ cliente_id: 1, fecha: -1 });
VentaSchema.index({ estado: 1, fecha: -1 });
VentaSchema.index({ 'items.producto_id': 1 });

VentaSchema.statics.IGV = 0.18;

module.exports = mongoose.model('Venta', VentaSchema, 'ventas');
