// 03_insertar_datos.js
// Inserta los datos de prueba con db.collection.insertMany() leyendo los archivos de database/json/.
// Uso (desde la raíz del repositorio, para que encuentre la carpeta json):
//   mongosh "mongodb://localhost:27017" database/03_insertar_datos.js
//
// Alternativa con mongoimport (MongoDB Database Tools):
//   mongoimport --uri "mongodb://localhost:27017/venta_computadoras" --collection proveedores --file database/json/proveedores.json --jsonArray --drop
//   (repetir con productos, clientes y ventas)

db = db.getSiblingDB('venta_computadoras');
const fs = require('fs');

// Orden: primero los documentos referenciados (proveedores) y al final las ventas.
for (const nombre of ['proveedores', 'productos', 'clientes', 'ventas']) {
  // EJSON convierte { "$oid": ... } en ObjectId y { "$date": ... } en Date
  const docs = EJSON.parse(fs.readFileSync(`database/json/${nombre}.json`, 'utf8'));
  db.getCollection(nombre).deleteMany({});
  const r = db.getCollection(nombre).insertMany(docs);
  print(`✔ ${nombre}: ${Object.keys(r.insertedIds).length} documentos`);
}

/* Ejemplo equivalente escrito a mano (como en clase), con _id fijos para poder referenciarlos:

db.proveedores.insertOne({
  _id: ObjectId("66a000000000000000000001"),
  ruc: "20512345671",
  razon_social: "TecnoDistribuidora Andina S.A.C.",
  contacto: { nombre: "Rosa Quispe", email: "ventas@tecnoandina.pe", telefono: "014567890" },
  direccion: { calle: "Av. Javier Prado Este 1234", distrito: "San Isidro", ciudad: "Lima" },
  marcas: ["Lenovo", "HP", "Dell"],
  activo: true
})

db.productos.insertOne({
  codigo: "LAP-LEN-001",
  codigo_barras: "7750000000011",
  nombre: "Lenovo IdeaPad Slim 5 14\"",
  categoria: "laptop",
  marca: "Lenovo",
  precio: 3299, costo: 2650, stock: 12, stock_minimo: 4,
  especificaciones: {
    procesador: "AMD Ryzen 7 7730U", ram_gb: 16,
    almacenamiento: { tipo: "SSD NVMe", capacidad_gb: 512 },
    pantalla_pulgadas: 14, sistema_operativo: "Windows 11 Home"
  },
  etiquetas: ["oficina", "estudiantes"],
  proveedor_id: ObjectId("66a000000000000000000001"),   // referencia al proveedor
  activo: true
})
*/
