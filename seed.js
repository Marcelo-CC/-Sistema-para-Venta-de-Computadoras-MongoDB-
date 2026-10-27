// seed.js — Carga los datos de prueba de database/json/ usando los modelos de Mongoose.
// Uso: npm run seed
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;

const Proveedor = require('./models/Proveedor');
const Producto = require('./models/Producto');
const Cliente = require('./models/Cliente');
const Venta = require('./models/Venta');

// El orden importa: primero los documentos a los que otros hacen referencia.
const colecciones = [
  ['proveedores', Proveedor],
  ['productos', Producto],
  ['clientes', Cliente],
  ['ventas', Venta]
];

// Los .json usan Extended JSON ({ "$oid": ... }, { "$date": ... }), igual que mongoimport.
const leerJson = (nombre) =>
  EJSON.parse(fs.readFileSync(path.join(__dirname, 'database', 'json', `${nombre}.json`), 'utf8'));

const seedData = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Conectado a ${mongoose.connection.name}`);

  for (const [nombre, Modelo] of colecciones) {
    await Modelo.deleteMany({});
    const docs = await Modelo.insertMany(leerJson(nombre));
    await Modelo.createIndexes();
    console.log(`  ${nombre}: ${docs.length} documentos`);
  }

  console.log('Datos insertados correctamente.');
};

seedData()
  .catch((err) => {
    console.error('Error al cargar los datos:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
