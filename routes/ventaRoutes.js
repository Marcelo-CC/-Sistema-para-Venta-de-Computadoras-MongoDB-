const express = require('express');
const Venta = require('../models/Venta');
const Producto = require('../models/Producto');
const Cliente = require('../models/Cliente');

const router = express.Router();

const SERIES = { BOLETA: 'B001', FACTURA: 'F001' };
const redondear = (n) => Math.round(n * 100) / 100;

// Obtener ventas (filtros opcionales: ?estado=&desde=AAAA-MM-DD&hasta=AAAA-MM-DD&cliente=<id>)
router.get('/ventas', async (req, res) => {
  const { estado, desde, hasta, cliente } = req.query;
  const filtro = {};
  if (estado) filtro.estado = estado.toUpperCase();
  if (cliente) filtro.cliente_id = cliente;
  if (desde || hasta) {
    filtro.fecha = {};
    if (desde) filtro.fecha.$gte = new Date(`${desde}T00:00:00-05:00`);
    if (hasta) filtro.fecha.$lte = new Date(`${hasta}T23:59:59.999-05:00`);
  }
  res.json(await Venta.find(filtro).sort({ fecha: -1 }));
});

// Obtener una venta con los datos actuales del cliente y de los productos
router.get('/ventas/:id', async (req, res) => {
  const venta = await Venta.findById(req.params.id)
    .populate('cliente_id', 'nombre email telefono')
    .populate('items.producto_id', 'marca stock activo');
  if (!venta) return res.status(404).json({ mensaje: 'Venta no encontrada' });
  res.json(venta);
});

// Registrar una venta
// Body: { cliente_id, tipo_comprobante, metodo_pago, vendedor, items: [{ producto_id, cantidad, descuento? }] }
router.post('/ventas', async (req, res) => {
  const { cliente_id, tipo_comprobante, metodo_pago, vendedor, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ mensaje: 'La venta debe tener al menos un ítem' });
  }
  if (items.some((it) => !Number.isInteger(it.cantidad) || it.cantidad < 1)) {
    return res.status(400).json({ mensaje: 'Cada ítem necesita una cantidad entera mayor a 0' });
  }
  if (!SERIES[tipo_comprobante]) {
    return res.status(400).json({ mensaje: 'tipo_comprobante debe ser BOLETA o FACTURA' });
  }

  const cliente = await Cliente.findById(cliente_id);
  if (!cliente) return res.status(404).json({ mensaje: 'Cliente no encontrado' });
  if (tipo_comprobante === 'FACTURA' && cliente.tipo_documento !== 'RUC') {
    return res.status(400).json({ mensaje: 'Solo se emite FACTURA a clientes con RUC' });
  }

  // Descuenta stock producto por producto. El filtro { stock: { $gte: cantidad } } hace que
  // la actualización sea atómica: si otro cliente compró las últimas unidades, no se descuenta.
  // Si algo falla, se devuelve lo ya descontado (en MongoDB Atlas o con replica set
  // esto mismo puede hacerse con session.withTransaction()).
  const descontados = [];
  const devolverStock = () => Promise.all(descontados.map(({ producto_id, cantidad }) =>
    Producto.updateOne({ _id: producto_id }, { $inc: { stock: cantidad } })));

  let venta;
  try {
    const lineas = [];
    for (const it of items) {
      const producto = await Producto.findOneAndUpdate(
        { _id: it.producto_id, activo: true, stock: { $gte: it.cantidad } },
        { $inc: { stock: -it.cantidad } },
        { new: true }
      );
      if (!producto) {
        await devolverStock();
        const existe = await Producto.findById(it.producto_id).select('nombre stock activo');
        if (!existe || !existe.activo) {
          return res.status(404).json({ mensaje: `Producto ${it.producto_id} no encontrado o inactivo` });
        }
        return res.status(409).json({ mensaje: `Stock insuficiente para ${existe.nombre} (disponible: ${existe.stock})` });
      }
      descontados.push({ producto_id: producto._id, cantidad: it.cantidad });

      const descuento = Number(it.descuento) || 0;
      lineas.push({
        producto_id: producto._id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        categoria: producto.categoria,
        cantidad: it.cantidad,
        precio_unitario: producto.precio,
        descuento,
        subtotal: redondear(it.cantidad * producto.precio - descuento)
      });
    }

    const subtotal = redondear(lineas.reduce((s, l) => s + l.subtotal, 0));
    const igv = redondear(subtotal * Venta.IGV);

    venta = await Venta.create({
      numero: await siguienteNumero(SERIES[tipo_comprobante]),
      tipo_comprobante,
      cliente_id: cliente._id,
      cliente: {
        nombre: cliente.nombre,
        tipo_documento: cliente.tipo_documento,
        numero_documento: cliente.numero_documento
      },
      items: lineas,
      subtotal,
      igv,
      total: redondear(subtotal + igv),
      metodo_pago,
      vendedor
    });
  } catch (error) {
    await devolverStock();
    throw error;
  }

  // Guarda el resumen en el cliente y conserva solo las últimas N compras
  await Cliente.updateOne({ _id: cliente._id }, {
    $push: {
      historial_compras: {
        $each: [{ venta_id: venta._id, numero: venta.numero, fecha: venta.fecha, total: venta.total, estado: venta.estado }],
        $slice: -Cliente.MAX_HISTORIAL
      }
    }
  });

  res.status(201).json(venta);
});

// Confirmar el pago de una venta pendiente
router.patch('/ventas/:id/pagar', async (req, res) => {
  const venta = await cambiarEstado(req.params.id, 'PENDIENTE', 'PAGADA');
  if (!venta) return res.status(409).json({ mensaje: 'La venta no existe o no está PENDIENTE' });
  res.json(venta);
});

// Anular una venta y devolver las unidades al inventario
router.patch('/ventas/:id/anular', async (req, res) => {
  const venta = await cambiarEstado(req.params.id, { $ne: 'ANULADA' }, 'ANULADA');
  if (!venta) return res.status(409).json({ mensaje: 'La venta no existe o ya está ANULADA' });

  await Producto.bulkWrite(venta.items.map((it) => ({
    updateOne: { filter: { _id: it.producto_id }, update: { $inc: { stock: it.cantidad } } }
  })));
  res.json(venta);
});

// Cambia el estado solo si coincide con el estado esperado y lo replica en el historial del cliente
async function cambiarEstado(id, estadoActual, nuevoEstado) {
  const venta = await Venta.findOneAndUpdate(
    { _id: id, estado: estadoActual },
    { estado: nuevoEstado },
    { new: true }
  );
  if (venta) {
    await Cliente.updateOne(
      { _id: venta.cliente_id, 'historial_compras.venta_id': venta._id },
      { $set: { 'historial_compras.$.estado': nuevoEstado } }
    );
  }
  return venta;
}

// B001-000007 → B001-000008. El índice único en "numero" impide duplicados.
async function siguienteNumero(serie) {
  const ultima = await Venta.findOne({ numero: new RegExp(`^${serie}-`) }).sort({ numero: -1 }).select('numero');
  const correlativo = ultima ? Number(ultima.numero.split('-')[1]) + 1 : 1;
  return `${serie}-${String(correlativo).padStart(6, '0')}`;
}

module.exports = router;
