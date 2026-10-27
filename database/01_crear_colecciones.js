// 01_crear_colecciones.js
// Crea la base de datos y las 4 colecciones con validadores JSON Schema.
// Uso (desde la raíz del repositorio):
//   mongosh "mongodb://localhost:27017" database/01_crear_colecciones.js
// o dentro de mongosh:  load("database/01_crear_colecciones.js")
//
// ⚠️ Elimina las colecciones si ya existen.

db = db.getSiblingDB('venta_computadoras');

const direccion = {
  bsonType: 'object',
  properties: {
    calle: { bsonType: 'string' },
    distrito: { bsonType: 'string' },
    ciudad: { bsonType: 'string' }
  }
};

const esquemas = {
  proveedores: {
    bsonType: 'object',
    required: ['ruc', 'razon_social'],
    properties: {
      ruc: { bsonType: 'string', pattern: '^[0-9]{11}$', description: 'RUC de 11 dígitos' },
      razon_social: { bsonType: 'string' },
      contacto: {
        bsonType: 'object',
        properties: {
          nombre: { bsonType: 'string' },
          email: { bsonType: 'string' },
          telefono: { bsonType: 'string' }
        }
      },
      direccion,
      marcas: { bsonType: 'array', items: { bsonType: 'string' } },
      activo: { bsonType: 'bool' }
    }
  },

  productos: {
    bsonType: 'object',
    required: ['codigo', 'codigo_barras', 'nombre', 'categoria', 'marca', 'precio', 'costo', 'stock', 'proveedor_id'],
    properties: {
      codigo: { bsonType: 'string' },
      codigo_barras: { bsonType: 'string', pattern: '^[0-9]{8,14}$' },
      nombre: { bsonType: 'string' },
      categoria: { enum: ['laptop', 'desktop', 'all-in-one', 'monitor', 'accesorio', 'componente'] },
      marca: { bsonType: 'string' },
      precio: { bsonType: 'number', minimum: 0 },
      costo: { bsonType: 'number', minimum: 0 },
      stock: { bsonType: 'number', minimum: 0, description: 'El stock nunca puede ser negativo' },
      stock_minimo: { bsonType: 'number', minimum: 0 },
      especificaciones: { bsonType: 'object', description: 'Subdocumento flexible según la categoría' },
      etiquetas: { bsonType: 'array', items: { bsonType: 'string' } },
      proveedor_id: { bsonType: 'objectId', description: 'Referencia a proveedores._id' },
      activo: { bsonType: 'bool' }
    }
  },

  clientes: {
    bsonType: 'object',
    required: ['tipo_documento', 'numero_documento', 'nombre', 'email'],
    properties: {
      tipo_documento: { enum: ['DNI', 'RUC', 'CE'] },
      numero_documento: { bsonType: 'string', pattern: '^[0-9]{8,12}$' },
      nombre: { bsonType: 'string' },
      email: { bsonType: 'string', pattern: '^\\S+@\\S+\\.\\S+$' },
      telefono: { bsonType: 'string' },
      direccion,
      historial_compras: {
        bsonType: 'array',
        maxItems: 10,
        items: {
          bsonType: 'object',
          required: ['venta_id'],
          properties: {
            venta_id: { bsonType: 'objectId' },
            numero: { bsonType: 'string' },
            fecha: { bsonType: 'date' },
            total: { bsonType: 'number' },
            estado: { bsonType: 'string' }
          }
        }
      }
    }
  },

  ventas: {
    bsonType: 'object',
    required: ['numero', 'tipo_comprobante', 'fecha', 'cliente_id', 'items', 'subtotal', 'igv', 'total', 'metodo_pago', 'estado', 'vendedor'],
    properties: {
      numero: { bsonType: 'string', pattern: '^[BF][0-9]{3}-[0-9]{6}$' },
      tipo_comprobante: { enum: ['BOLETA', 'FACTURA'] },
      fecha: { bsonType: 'date' },
      cliente_id: { bsonType: 'objectId', description: 'Referencia a clientes._id' },
      cliente: {
        bsonType: 'object',
        properties: {
          nombre: { bsonType: 'string' },
          tipo_documento: { bsonType: 'string' },
          numero_documento: { bsonType: 'string' }
        }
      },
      items: {
        bsonType: 'array',
        minItems: 1,
        items: {
          bsonType: 'object',
          required: ['producto_id', 'cantidad', 'precio_unitario', 'subtotal'],
          properties: {
            producto_id: { bsonType: 'objectId' },
            codigo: { bsonType: 'string' },
            nombre: { bsonType: 'string' },
            categoria: { bsonType: 'string' },
            cantidad: { bsonType: 'number', minimum: 1 },
            precio_unitario: { bsonType: 'number', minimum: 0 },
            descuento: { bsonType: 'number', minimum: 0 },
            subtotal: { bsonType: 'number', minimum: 0 }
          }
        }
      },
      subtotal: { bsonType: 'number', minimum: 0 },
      igv: { bsonType: 'number', minimum: 0 },
      total: { bsonType: 'number', minimum: 0 },
      metodo_pago: { enum: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'YAPE'] },
      estado: { enum: ['PENDIENTE', 'PAGADA', 'ANULADA'] },
      vendedor: { bsonType: 'string' }
    }
  }
};

for (const [nombre, esquema] of Object.entries(esquemas)) {
  db.getCollection(nombre).drop();
  db.createCollection(nombre, {
    validator: { $jsonSchema: esquema },
    validationLevel: 'strict',
    validationAction: 'error'
  });
  print(`✔ Colección ${nombre} creada con validador`);
}

// Prueba: este documento debe ser rechazado (stock negativo y sin proveedor)
try {
  db.productos.insertOne({ codigo: 'X', codigo_barras: '123', nombre: 'Prueba', categoria: 'laptop', marca: 'X', precio: 1, costo: 1, stock: -5 });
} catch (e) {
  print(`✔ Validador activo — documento inválido rechazado: ${e.message}`);
}
