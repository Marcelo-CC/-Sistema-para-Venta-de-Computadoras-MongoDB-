// 05_agregaciones.js
// Reportes con Aggregation Pipeline ($match, $group, $lookup, $unwind, $project, $sort, $limit).
// Son los mismos pipelines que usa routes/reporteRoutes.js.
// Uso: mongosh "mongodb://localhost:27017" database/05_agregaciones.js

db = db.getSiblingDB('venta_computadoras');
const ver = (titulo, resultado) => { print(`\n=== ${titulo} ===`); printjson(resultado.toArray()); };

// 1. Ventas por mes de 2026 (excluye anuladas) → GET /api/reportes/ventas-por-mes?anio=2026
ver('Ventas por mes 2026', db.ventas.aggregate([
  { $match: { estado: { $ne: 'ANULADA' } } },
  { $addFields: { anio: { $year: { date: '$fecha', timezone: 'America/Lima' } } } },
  { $match: { anio: 2026 } },
  {
    $group: {
      _id: { $month: { date: '$fecha', timezone: 'America/Lima' } },
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
]));

// 2. Top 5 productos más vendidos → GET /api/reportes/productos-mas-vendidos?limite=5
//    $unwind separa cada ítem del arreglo embebido; $lookup trae el stock actual desde productos.
ver('Productos más vendidos', db.ventas.aggregate([
  { $match: { estado: { $ne: 'ANULADA' } } },
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
  { $limit: 5 },
  { $lookup: { from: 'productos', localField: '_id', foreignField: '_id', as: 'producto' } },
  { $unwind: '$producto' },
  {
    $project: {
      _id: 0,
      codigo: '$producto.codigo',
      nombre: '$producto.nombre',
      marca: '$producto.marca',
      unidades_vendidas: 1,
      numero_ventas: 1,
      ingresos: { $round: ['$ingresos', 2] },
      stock_actual: '$producto.stock'
    }
  }
]));

// 3. Stock crítico con datos del proveedor → GET /api/reportes/stock-critico
ver('Stock crítico', db.productos.aggregate([
  { $match: { activo: true, $expr: { $lte: ['$stock', '$stock_minimo'] } } },
  { $lookup: { from: 'proveedores', localField: 'proveedor_id', foreignField: '_id', as: 'proveedor' } },
  { $unwind: { path: '$proveedor', preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 0,
      codigo: 1,
      nombre: 1,
      stock: 1,
      stock_minimo: 1,
      reponer: { $subtract: [{ $multiply: ['$stock_minimo', 2] }, '$stock'] },
      proveedor: '$proveedor.razon_social',
      telefono_proveedor: '$proveedor.contacto.telefono'
    }
  },
  { $sort: { stock: 1 } }
]));

// 4. Ingresos por categoría → GET /api/reportes/ventas-por-categoria
ver('Ventas por categoría', db.ventas.aggregate([
  { $match: { estado: { $ne: 'ANULADA' } } },
  { $unwind: '$items' },
  { $group: { _id: '$items.categoria', unidades: { $sum: '$items.cantidad' }, ingresos: { $sum: '$items.subtotal' } } },
  { $sort: { ingresos: -1 } },
  { $project: { _id: 0, categoria: '$_id', unidades: 1, ingresos: { $round: ['$ingresos', 2] } } }
]));

// 5. Mejores clientes → GET /api/reportes/mejores-clientes
ver('Mejores clientes', db.ventas.aggregate([
  { $match: { estado: { $ne: 'ANULADA' } } },
  { $group: { _id: '$cliente_id', compras: { $sum: 1 }, total_comprado: { $sum: '$total' }, ultima_compra: { $max: '$fecha' } } },
  { $sort: { total_comprado: -1 } },
  { $limit: 5 },
  { $lookup: { from: 'clientes', localField: '_id', foreignField: '_id', as: 'cliente' } },
  { $unwind: '$cliente' },
  { $project: { _id: 0, nombre: '$cliente.nombre', email: '$cliente.email', compras: 1, total_comprado: { $round: ['$total_comprado', 2] }, ultima_compra: 1 } }
]));

// 6. Ventas por vendedor y método de pago (agrupación por dos campos)
ver('Ventas por vendedor y método de pago', db.ventas.aggregate([
  { $match: { estado: 'PAGADA' } },
  { $group: { _id: { vendedor: '$vendedor', metodo_pago: '$metodo_pago' }, ventas: { $sum: 1 }, total: { $sum: '$total' } } },
  { $sort: { '_id.vendedor': 1, total: -1 } },
  { $project: { _id: 0, vendedor: '$_id.vendedor', metodo_pago: '$_id.metodo_pago', ventas: 1, total: { $round: ['$total', 2] } } }
]));

// 7. Margen bruto por producto vendido (precio de venta vs. costo actual del catálogo)
ver('Margen bruto por producto', db.ventas.aggregate([
  { $match: { estado: { $ne: 'ANULADA' } } },
  { $unwind: '$items' },
  { $lookup: { from: 'productos', localField: 'items.producto_id', foreignField: '_id', as: 'p' } },
  { $unwind: '$p' },
  {
    $group: {
      _id: '$p.nombre',
      ingresos: { $sum: '$items.subtotal' },
      costo_total: { $sum: { $multiply: ['$items.cantidad', '$p.costo'] } }
    }
  },
  { $addFields: { margen: { $subtract: ['$ingresos', '$costo_total'] } } },
  { $sort: { margen: -1 } },
  {
    $project: {
      _id: 0,
      producto: '$_id',
      ingresos: { $round: ['$ingresos', 2] },
      costo_total: 1,
      margen: { $round: ['$margen', 2] },
      margen_pct: { $round: [{ $multiply: [{ $divide: ['$margen', '$ingresos'] }, 100] }, 1] }
    }
  }
]));

// 8. Agregar un campo calculado sin modificar los documentos ($addFields), como en clase
ver('Productos con ganancia unitaria', db.productos.aggregate([
  { $addFields: { ganancia_unitaria: { $subtract: ['$precio', '$costo'] } } },
  { $project: { _id: 0, nombre: 1, precio: 1, costo: 1, ganancia_unitaria: 1 } },
  { $sort: { ganancia_unitaria: -1 } },
  { $limit: 5 }
]));
