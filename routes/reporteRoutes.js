const express = require('express');
const Venta = require('../models/Venta');
const Producto = require('../models/Producto');

const router = express.Router();

const ZONA_HORARIA = 'America/Lima';
const VENTAS_VALIDAS = { $match: { estado: { $ne: 'ANULADA' } } };

// Ventas agrupadas por mes (?anio=2026)
router.get('/reportes/ventas-por-mes', async (req, res) => {
  const anio = Number(req.query.anio) || new Date().getFullYear();
  const reporte = await Venta.aggregate([
    VENTAS_VALIDAS,
    { $addFields: { anio: { $year: { date: '$fecha', timezone: ZONA_HORARIA } } } },
    { $match: { anio } },
    {
      $group: {
        _id: { $month: { date: '$fecha', timezone: ZONA_HORARIA } },
        cantidad_ventas: { $sum: 1 },
        total_vendido: { $sum: '$total' },
        ticket_promedio: { $avg: '$total' }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        mes: '$_id',
        cantidad_ventas: 1,
        total_vendido: { $round: ['$total_vendido', 2] },
        ticket_promedio: { $round: ['$ticket_promedio', 2] }
      }
    }
  ]);
  res.json({ anio, meses: reporte });
});

// Productos más vendidos (?limite=5)
router.get('/reportes/productos-mas-vendidos', async (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 5, 50);
  const reporte = await Venta.aggregate([
    VENTAS_VALIDAS,
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.producto_id',
        unidades_vendidas: { $sum: '$items.cantidad' },
        ingresos: { $sum: '$items.subtotal' },
        numero_ventas: { $sum: 1 }
      }
    },
    { $sort: { unidades_vendidas: -1, ingresos: -1 } },
    { $limit: limite },
    { $lookup: { from: 'productos', localField: '_id', foreignField: '_id', as: 'producto' } },
    { $unwind: '$producto' },
    {
      $project: {
        _id: 0,
        producto_id: '$_id',
        codigo: '$producto.codigo',
        nombre: '$producto.nombre',
        marca: '$producto.marca',
        categoria: '$producto.categoria',
        unidades_vendidas: 1,
        numero_ventas: 1,
        ingresos: { $round: ['$ingresos', 2] },
        stock_actual: '$producto.stock'
      }
    }
  ]);
  res.json(reporte);
});

// Stock crítico: productos con stock <= stock_minimo y el proveedor a quien pedir
router.get('/reportes/stock-critico', async (req, res) => {
  const reporte = await Producto.aggregate([
    { $match: { activo: true, $expr: { $lte: ['$stock', '$stock_minimo'] } } },
    { $lookup: { from: 'proveedores', localField: 'proveedor_id', foreignField: '_id', as: 'proveedor' } },
    { $unwind: { path: '$proveedor', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        codigo: 1,
        nombre: 1,
        categoria: 1,
        stock: 1,
        stock_minimo: 1,
        // Sugerencia: reponer hasta el doble del mínimo
        reponer: { $subtract: [{ $multiply: ['$stock_minimo', 2] }, '$stock'] },
        proveedor: '$proveedor.razon_social',
        contacto: '$proveedor.contacto'
      }
    },
    { $sort: { stock: 1 } }
  ]);
  res.json(reporte);
});

// Ventas por categoría de producto
router.get('/reportes/ventas-por-categoria', async (req, res) => {
  const reporte = await Venta.aggregate([
    VENTAS_VALIDAS,
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.categoria',
        unidades: { $sum: '$items.cantidad' },
        ingresos: { $sum: '$items.subtotal' }
      }
    },
    { $sort: { ingresos: -1 } },
    { $project: { _id: 0, categoria: '$_id', unidades: 1, ingresos: { $round: ['$ingresos', 2] } } }
  ]);
  res.json(reporte);
});

// Clientes que más compran (?limite=5)
router.get('/reportes/mejores-clientes', async (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 5, 50);
  const reporte = await Venta.aggregate([
    VENTAS_VALIDAS,
    {
      $group: {
        _id: '$cliente_id',
        compras: { $sum: 1 },
        total_comprado: { $sum: '$total' },
        ultima_compra: { $max: '$fecha' }
      }
    },
    { $sort: { total_comprado: -1 } },
    { $limit: limite },
    { $lookup: { from: 'clientes', localField: '_id', foreignField: '_id', as: 'cliente' } },
    { $unwind: '$cliente' },
    {
      $project: {
        _id: 0,
        cliente_id: '$_id',
        nombre: '$cliente.nombre',
        email: '$cliente.email',
        compras: 1,
        total_comprado: { $round: ['$total_comprado', 2] },
        ultima_compra: 1
      }
    }
  ]);
  res.json(reporte);
});

module.exports = router;
