// 04_consultas.js
// Consultas CRUD de ejemplo con operadores de comparación, lógicos, arreglos y subdocumentos.
// Uso: mongosh "mongodb://localhost:27017" database/04_consultas.js
// (cada bloque también puede copiarse y pegarse directamente en mongosh)

db = db.getSiblingDB('venta_computadoras');
const ver = (titulo, cursor) => { print(`\n=== ${titulo} ===`); printjson(cursor.toArray ? cursor.toArray() : cursor); };

// ---------------------------------------------------------------- BUSCAR (find)

// 1. Laptops entre S/ 2,000 y S/ 4,000 ($gte, $lte), solo nombre y precio (proyección)
ver('Laptops entre 2000 y 4000', db.productos.find(
  { categoria: 'laptop', precio: { $gte: 2000, $lte: 4000 } },
  { _id: 0, nombre: 1, precio: 1 }
).sort({ precio: 1 }));

// 2. Productos de ciertas marcas ($in)
ver('Productos Lenovo o HP', db.productos.find(
  { marca: { $in: ['Lenovo', 'HP'] } },
  { _id: 0, nombre: 1, marca: 1 }
));

// 3. Consulta sobre un subdocumento embebido (notación de punto):
//    equipos con 16 GB de RAM o más y SSD NVMe
ver('16 GB+ de RAM y SSD NVMe', db.productos.find(
  { 'especificaciones.ram_gb': { $gte: 16 }, 'especificaciones.almacenamiento.tipo': 'SSD NVMe' },
  { _id: 0, nombre: 1, 'especificaciones.procesador': 1, 'especificaciones.ram_gb': 1 }
));

// 4. Productos que tienen GPU dedicada NVIDIA ($regex) y la especificación existe ($exists)
ver('GPU NVIDIA', db.productos.find(
  { 'especificaciones.gpu': { $exists: true, $regex: /NVIDIA/i } },
  { _id: 0, nombre: 1, 'especificaciones.gpu': 1 }
));

// 5. Búsqueda dentro de un arreglo de etiquetas
ver('Etiqueta "gaming"', db.productos.find({ etiquetas: 'gaming' }, { _id: 0, nombre: 1, etiquetas: 1 }));

// 6. Búsqueda por texto (usa el índice text de 02_indices.js)
ver('Texto "gaming laptop"', db.productos.find(
  { $text: { $search: 'gaming laptop' } },
  { _id: 0, nombre: 1, score: { $meta: 'textScore' } }
).sort({ score: { $meta: 'textScore' } }));

// 7. Stock crítico comparando dos campos del mismo documento ($expr)
ver('Stock <= stock mínimo', db.productos.find(
  { $expr: { $lte: ['$stock', '$stock_minimo'] } },
  { _id: 0, nombre: 1, stock: 1, stock_minimo: 1 }
));

// 8. Cliente por correo (índice único) y por documento
ver('Cliente por email', db.clientes.findOne({ email: 'carlos.perez@gmail.com' }, { nombre: 1, historial_compras: 1 }));
ver('Cliente por RUC', db.clientes.findOne({ tipo_documento: 'RUC', numero_documento: '20587654329' }, { nombre: 1 }));

// 9. Ventas pagadas con total mayor a S/ 5,000 ($gt, $ne / $nin)
ver('Ventas > 5000 no anuladas', db.ventas.find(
  { total: { $gt: 5000 }, estado: { $nin: ['ANULADA', 'PENDIENTE'] } },
  { _id: 0, numero: 1, 'cliente.nombre': 1, total: 1 }
));

// 10. Ventas que incluyen un producto específico (consulta sobre el arreglo embebido items)
ver('Ventas con el mouse MX Master 3S', db.ventas.find(
  { 'items.codigo': 'ACC-LOG-010' },
  { _id: 0, numero: 1, fecha: 1 }
));

// 11. Ventas del segundo semestre de 2026 ($and implícito sobre fecha)
ver('Ventas jul-dic 2026', db.ventas.find(
  { fecha: { $gte: ISODate('2026-07-01T05:00:00Z'), $lt: ISODate('2027-01-01T05:00:00Z') } },
  { _id: 0, numero: 1, fecha: 1, total: 1 }
).sort({ fecha: 1 }));

// 12. Accesorios o monitores económicos ($or)
ver('Accesorios o monitores baratos', db.productos.find(
  { $or: [{ categoria: 'accesorio' }, { categoria: 'monitor', precio: { $lt: 600 } }] },
  { _id: 0, nombre: 1, categoria: 1, precio: 1 }
));

// ---------------------------------------------------------------- ACTUALIZAR (update)

// 13. Marcar en oferta los productos gaming ($set) y registrar la fecha ($currentDate)
printjson(db.productos.updateMany(
  { etiquetas: 'gaming' },
  { $set: { en_oferta: true }, $currentDate: { fecha_actualizacion: true } }
));
// Subir 5 % el precio de un producto ($mul) — cada ejecución lo vuelve a subir:
// db.productos.updateOne({ codigo: 'LAP-ASU-002' }, { $mul: { precio: 1.05 } })

// 14. Reponer stock ($inc) y agregar una etiqueta sin duplicar ($addToSet)
printjson(db.productos.updateOne(
  { codigo: 'LAP-DEL-004' },
  { $inc: { stock: 5 }, $addToSet: { etiquetas: 'reabastecido' } }
));

// 15. Actualizar un campo dentro del subdocumento embebido
printjson(db.proveedores.updateOne(
  { ruc: '20601234562' },
  { $set: { 'contacto.telefono': '064223355' } }
));

// 16. Agregar una compra al historial del cliente y conservar solo las últimas 10 ($push + $slice)
//     (así lo hace POST /api/ventas)
// db.clientes.updateOne({ email: 'carlos.perez@gmail.com' },
//   { $push: { historial_compras: { $each: [{ venta_id: ObjectId(), numero: 'B001-999999', fecha: new Date(), total: 100, estado: 'PAGADA' }], $slice: -10 } } })

// ---------------------------------------------------------------- ELIMINAR (delete)

// 17. Baja lógica de un producto (recomendado: las ventas siguen haciendo referencia a él)
printjson(db.productos.updateOne({ codigo: 'COM-KIN-012' }, { $set: { activo: false } }));
printjson(db.productos.updateOne({ codigo: 'COM-KIN-012' }, { $set: { activo: true } })); // revertir

// 18. Eliminación física: borrar ventas anuladas de prueba (descomentar para ejecutar)
// db.ventas.deleteMany({ estado: 'ANULADA' })

// 19. Borrar toda la base de datos (descomentar para ejecutar)
// db.dropDatabase()
