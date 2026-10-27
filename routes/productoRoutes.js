const express = require('express');
const Producto = require('../models/Producto');

const router = express.Router();

// Obtener productos (filtros opcionales: ?categoria=&marca=&min=&max=&q=)
router.get('/productos', async (req, res) => {
  const { categoria, marca, min, max, q } = req.query;
  const filtro = { activo: true };

  if (categoria) filtro.categoria = categoria;
  if (marca) filtro.marca = new RegExp(`^${escapeRegex(marca)}$`, 'i');
  if (min || max) {
    filtro.precio = {};
    if (min) filtro.precio.$gte = Number(min);
    if (max) filtro.precio.$lte = Number(max);
  }
  if (q) filtro.$text = { $search: q };

  const consulta = Producto.find(filtro);
  if (q) consulta.select({ score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } });
  else consulta.sort({ categoria: 1, precio: 1 });

  res.json(await consulta);
});

// Obtener productos de una categoría
router.get('/productos/categoria/:tipo', async (req, res) => {
  const productos = await Producto.find({ categoria: req.params.tipo, activo: true }).sort({ precio: 1 });
  res.json(productos);
});

// Buscar un producto por código de barras (lector en caja)
router.get('/productos/codigo-barras/:codigo', async (req, res) => {
  const producto = await Producto.findOne({ codigo_barras: req.params.codigo });
  if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });
  res.json(producto);
});

// Obtener un producto con los datos de su proveedor
router.get('/productos/:id', async (req, res) => {
  const producto = await Producto.findById(req.params.id).populate('proveedor_id', 'ruc razon_social contacto');
  if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });
  res.json(producto);
});

// Crear un producto
router.post('/productos', async (req, res) => {
  const producto = await Producto.create(req.body);
  res.status(201).json(producto);
});

// Actualizar campos de un producto
router.patch('/productos/:id', async (req, res) => {
  const producto = await Producto.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });
  res.json(producto);
});

// Ajustar stock: { "cantidad": 10 } repone, { "cantidad": -2 } descuenta (nunca deja stock negativo)
router.patch('/productos/:id/stock', async (req, res) => {
  const cantidad = Number(req.body.cantidad);
  if (!Number.isInteger(cantidad) || cantidad === 0) {
    return res.status(400).json({ mensaje: 'cantidad debe ser un entero distinto de 0' });
  }
  const producto = await Producto.findOneAndUpdate(
    { _id: req.params.id, stock: { $gte: -cantidad } },
    { $inc: { stock: cantidad } },
    { new: true }
  );
  if (!producto) {
    const existe = await Producto.exists({ _id: req.params.id });
    if (!existe) return res.status(404).json({ mensaje: 'Producto no encontrado' });
    return res.status(409).json({ mensaje: 'Stock insuficiente para descontar esa cantidad' });
  }
  res.json(producto);
});

// Eliminar un producto (baja lógica: las ventas antiguas siguen apuntando a él)
router.delete('/productos/:id', async (req, res) => {
  const producto = await Producto.findByIdAndUpdate(req.params.id, { activo: false }, { new: true });
  if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });
  res.json({ mensaje: 'Producto dado de baja', producto });
});

function escapeRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = router;
