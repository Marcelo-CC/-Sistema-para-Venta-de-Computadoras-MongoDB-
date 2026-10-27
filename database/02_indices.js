// 02_indices.js
// Índices para las búsquedas más frecuentes. Son los mismos que declaran los modelos de Mongoose.
// Uso: mongosh "mongodb://localhost:27017" database/02_indices.js

db = db.getSiblingDB('venta_computadoras');

// ---------- productos ----------
db.productos.createIndex({ codigo: 1 }, { unique: true });         // SKU interno
db.productos.createIndex({ codigo_barras: 1 }, { unique: true });  // lector de código de barras en caja
db.productos.createIndex({ categoria: 1, precio: 1 });             // GET /productos/categoria/:tipo ordenado por precio
db.productos.createIndex({ marca: 1 });                            // filtro por marca
db.productos.createIndex({ proveedor_id: 1 });                     // productos de un proveedor / $lookup
db.productos.createIndex(                                          // búsqueda por texto (?q=gaming)
  { nombre: 'text', marca: 'text', etiquetas: 'text' },
  { weights: { nombre: 10, marca: 5, etiquetas: 2 }, default_language: 'spanish' }
);

// ---------- clientes ----------
db.clientes.createIndex({ email: 1 }, { unique: true });                              // login / búsqueda por correo
db.clientes.createIndex({ tipo_documento: 1, numero_documento: 1 }, { unique: true }); // búsqueda por DNI/RUC

// ---------- proveedores ----------
db.proveedores.createIndex({ ruc: 1 }, { unique: true });

// ---------- ventas ----------
db.ventas.createIndex({ numero: 1 }, { unique: true });             // B001-000001 no se repite
db.ventas.createIndex({ fecha: -1 });                               // reportes por fecha
db.ventas.createIndex({ cliente_id: 1, fecha: -1 });                // historial de un cliente
db.ventas.createIndex({ estado: 1, fecha: -1 });                    // ventas pendientes / anuladas
db.ventas.createIndex({ 'items.producto_id': 1 });                  // índice multikey sobre el arreglo embebido

for (const c of ['productos', 'clientes', 'proveedores', 'ventas']) {
  print(`\n${c}:`);
  db.getCollection(c).getIndexes().forEach((i) => print(`  ${i.name}  ${JSON.stringify(i.key)}${i.unique ? '  (único)' : ''}`));
}

// Comprobar que una consulta usa el índice (stage IXSCAN en vez de COLLSCAN):
// db.productos.find({ codigo_barras: '7750000000028' }).explain('executionStats').queryPlanner.winningPlan
