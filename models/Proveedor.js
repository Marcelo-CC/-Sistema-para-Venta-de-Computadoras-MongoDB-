const mongoose = require('mongoose');

// Contacto y dirección se embeben: pertenecen solo al proveedor y siempre se leen con él.
const ProveedorSchema = new mongoose.Schema({
  ruc: { type: String, required: true, unique: true, match: /^\d{11}$/ },
  razon_social: { type: String, required: true, trim: true },
  contacto: {
    nombre: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    telefono: String
  },
  direccion: {
    calle: String,
    distrito: String,
    ciudad: String
  },
  marcas: [String],
  activo: { type: Boolean, default: true }
}, {
  timestamps: { createdAt: 'fecha_registro', updatedAt: 'fecha_actualizacion' }
});

module.exports = mongoose.model('Proveedor', ProveedorSchema, 'proveedores');
