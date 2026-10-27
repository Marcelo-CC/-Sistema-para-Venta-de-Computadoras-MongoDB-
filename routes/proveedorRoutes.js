const express = require('express');
const Proveedor = require('../models/Proveedor');
const Producto = require('../models/Producto');

const router = express.Router();

// Obtener todos los proveedores
router.get('/proveedores', async (req, res) => {
  res.json(await Proveedor.find().sort({ razon_social: 1 }));
});

// Obtener un proveedor
router.get('/proveedores/:id', async (req, res) => {
  const proveedor = await Proveedor.findById(req.params.id);
  if (!proveedor) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
  res.json(proveedor);
});

// Obtener los productos que abastece un proveedor
router.get('/proveedores/:id/productos', async (req, res) => {
  const productos = await Producto.find({ proveedor_id: req.params.id }).sort({ nombre: 1 });
  res.json(productos);
});

// Crear un proveedor
router.post('/proveedores', async (req, res) => {
  const proveedor = await Proveedor.create(req.body);
  res.status(201).json(proveedor);
});

// Actualizar un proveedor
router.patch('/proveedores/:id', async (req, res) => {
  const proveedor = await Proveedor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!proveedor) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
  res.json(proveedor);
});

// Eliminar un proveedor (solo si no tiene productos asociados)
router.delete('/proveedores/:id', async (req, res) => {
  if (await Producto.exists({ proveedor_id: req.params.id })) {
    return res.status(409).json({ mensaje: 'El proveedor tiene productos asociados; desactívelo con PATCH { "activo": false }' });
  }
  const proveedor = await Proveedor.findByIdAndDelete(req.params.id);
  if (!proveedor) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
  res.json({ mensaje: 'Proveedor eliminado' });
});

module.exports = router;
