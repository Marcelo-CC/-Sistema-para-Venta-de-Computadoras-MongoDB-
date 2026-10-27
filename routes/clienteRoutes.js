const express = require('express');
const Cliente = require('../models/Cliente');
const Venta = require('../models/Venta');

const router = express.Router();

// Obtener todos los clientes
router.get('/clientes', async (req, res) => {
  res.json(await Cliente.find().sort({ nombre: 1 }));
});

// Buscar un cliente por documento (DNI/RUC)
router.get('/clientes/documento/:tipo/:numero', async (req, res) => {
  const cliente = await Cliente.findOne({
    tipo_documento: req.params.tipo.toUpperCase(),
    numero_documento: req.params.numero
  });
  if (!cliente) return res.status(404).json({ mensaje: 'Cliente no encontrado' });
  res.json(cliente);
});

// Obtener un cliente
router.get('/clientes/:id', async (req, res) => {
  const cliente = await Cliente.findById(req.params.id);
  if (!cliente) return res.status(404).json({ mensaje: 'Cliente no encontrado' });
  res.json(cliente);
});

// Historial completo de compras del cliente (desde la colección ventas)
router.get('/clientes/:id/ventas', async (req, res) => {
  const ventas = await Venta.find({ cliente_id: req.params.id }).sort({ fecha: -1 });
  res.json(ventas);
});

// Crear un cliente
router.post('/clientes', async (req, res) => {
  const { historial_compras, ...datos } = req.body; // el historial lo mantiene el sistema
  const cliente = await Cliente.create(datos);
  res.status(201).json(cliente);
});

// Actualizar un cliente
router.patch('/clientes/:id', async (req, res) => {
  const { historial_compras, ...datos } = req.body;
  const cliente = await Cliente.findByIdAndUpdate(req.params.id, datos, { new: true, runValidators: true });
  if (!cliente) return res.status(404).json({ mensaje: 'Cliente no encontrado' });
  res.json(cliente);
});

// Eliminar un cliente (solo si no tiene ventas registradas)
router.delete('/clientes/:id', async (req, res) => {
  if (await Venta.exists({ cliente_id: req.params.id })) {
    return res.status(409).json({ mensaje: 'El cliente tiene ventas registradas y no puede eliminarse' });
  }
  const cliente = await Cliente.findByIdAndDelete(req.params.id);
  if (!cliente) return res.status(404).json({ mensaje: 'Cliente no encontrado' });
  res.json({ mensaje: 'Cliente eliminado' });
});

module.exports = router;
