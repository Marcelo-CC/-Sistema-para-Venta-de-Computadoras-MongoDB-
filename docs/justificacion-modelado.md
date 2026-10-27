# Justificación del modelado: embeber vs. referenciar

En MongoDB, cada relación se puede modelar de dos formas:

- **Embeber**: guardar el dato dentro del documento padre como subdocumento o arreglo.
- **Referenciar**: guardar solo el `ObjectId` del otro documento y unirlo con `populate()` o `$lookup` cuando se necesita.

Para decidir se aplicaron cuatro preguntas:

1. **¿Se leen juntos?** Si casi siempre se consultan a la vez, conviene embeber.
2. **¿El hijo tiene vida propia?** Si se consulta, edita o lista por separado, conviene referenciar.
3. **¿Cuántos hijos puede haber?** Un arreglo que crece sin límite no debe embeberse, porque un documento tiene un máximo de 16 MB.
4. **¿El dato debe quedar "congelado"?** Si debe reflejar el valor de un momento (por ejemplo, el precio al vender), se copia.

## Resumen de decisiones

| Relación | Decisión | Motivo principal |
|---|---|---|
| Producto → especificaciones técnicas | **Embeber** (subdocumento) | Se leen siempre con el producto y su forma cambia según la categoría |
| Producto → proveedor | **Referenciar** (`proveedor_id`) | El proveedor tiene vida propia y abastece a muchos productos |
| Proveedor → contacto, dirección | **Embeber** | Relación 1:1, sin uso fuera del proveedor |
| Venta → ítems (detalle) | **Embeber** (arreglo `items`) | La venta y su detalle se crean, leen y anulan juntos; el número de ítems está acotado |
| Ítem → producto | **Referenciar + copiar** (`producto_id` + `nombre`, `precio_unitario`) | El comprobante debe conservar el precio con el que se vendió |
| Venta → cliente | **Referenciar + copiar** (`cliente_id` + `cliente{}`) | El cliente es independiente; la copia permite imprimir la boleta sin `$lookup` |
| Cliente → historial de compras | **Embeber un resumen acotado** (últimas 10) + referencia en `ventas.cliente_id` | Lectura rápida en el perfil sin que el documento crezca sin límite |
| Cliente → dirección | **Embeber** | Relación 1:1 |

## Detalle

### 1. Especificaciones técnicas embebidas en `productos`

Una laptop tiene procesador, RAM, GPU y batería. Un monitor tiene panel, resolución y frecuencia. Un mouse tiene DPI y conectividad. En un modelo relacional esto obliga a crear una tabla por tipo o a llenar muchas columnas con `NULL`. En MongoDB cada producto guarda en `especificaciones` solo los campos que le corresponden.

- Se muestran **siempre** en la ficha del producto, así que una sola lectura trae todo.
- Se pueden consultar e indexar con notación de punto: `{ "especificaciones.ram_gb": { $gte: 16 } }`.
- Nadie las consulta sin el producto, así que no necesitan colección propia.

### 2. Proveedor referenciado desde `productos`

- Un proveedor abastece **muchos** productos. Si se embebiera, al cambiar su teléfono habría que actualizar cada producto.
- El proveedor tiene su propio CRUD (`/api/proveedores`) y su propia consulta (`/api/proveedores/:id/productos`).
- La unión se hace solo cuando se necesita: `populate('proveedor_id')` en `GET /api/productos/:id` y `$lookup` en el reporte de stock crítico.

### 3. Ítems embebidos en `ventas`

En SQL esto serían dos tablas (`ventas` y `detalle_venta`). Aquí se embeben porque:

- Una venta **nunca se lee sin sus ítems** (boleta, factura, detalle).
- La venta se escribe en una sola operación, y en MongoDB escribir un solo documento es **atómico**: no puede quedar una venta sin detalle.
- La cantidad de ítems está **acotada** (una compra tiene pocas líneas), así que no hay riesgo de llegar a 16 MB.
- `$unwind: "$items"` permite agregar por producto o por categoría en los reportes.

Cada ítem **copia** `codigo`, `nombre`, `categoria` y `precio_unitario` (patrón *extended reference*). Si mañana sube el precio de una laptop, la boleta emitida en marzo debe seguir mostrando el precio de marzo. El `producto_id` se mantiene para poder hacer `$lookup` al stock o costo actual, como en el reporte de productos más vendidos o de margen.

### 4. Cliente referenciado y copiado en `ventas`

- `cliente_id` es la referencia: permite listar las ventas de un cliente con el índice `{ cliente_id: 1, fecha: -1 }`.
- `cliente: { nombre, tipo_documento, numero_documento }` es una copia con los datos fiscales del comprobante. Si el cliente cambia su nombre, el comprobante emitido conserva el nombre original.

### 5. Historial de compras en `clientes` (patrón *subset*)

La actividad pide un historial de compras. Embeber **todas** las ventas dentro del cliente sería un arreglo sin límite. Por eso:

- `clientes.historial_compras` guarda solo un **resumen de las últimas 10 compras** (`venta_id`, `numero`, `fecha`, `total`, `estado`). La API lo mantiene con `$push` + `$each` + `$slice: -10`, y el validador `$jsonSchema` impone `maxItems: 10`.
- El historial **completo** se obtiene de la colección `ventas` con `GET /api/clientes/:id/ventas`.
- Al anular o pagar una venta, el estado se actualiza también en el resumen con el operador posicional `historial_compras.$.estado`.

### 6. ¿Por qué no hay colecciones `categorias` ni `marcas`?

Son listas cortas de texto que casi no cambian. Se guardan como `string` en el producto, y la categoría se controla con un `enum` en Mongoose y en el `$jsonSchema`. Así se evita un `$lookup` en cada consulta del catálogo. Si más adelante necesitaran datos propios (descripción, logo), se crearían como colecciones referenciadas.

## Consistencia sin transacciones

En SQL una venta usaría una transacción con `SELECT … FOR UPDATE`. MongoDB local, en modo *standalone*, no admite transacciones de varios documentos, así que `POST /api/ventas` usa operaciones atómicas sobre un solo documento:

```js
Producto.findOneAndUpdate(
  { _id: producto_id, activo: true, stock: { $gte: cantidad } },   // solo si alcanza el stock
  { $inc: { stock: -cantidad } }
)
```

Si el filtro no encuentra el documento, otra venta ya se llevó las unidades. En ese caso la API **devuelve** el stock descontado de los ítems anteriores y responde `409`. Con MongoDB Atlas (replica set) lo mismo se podría envolver en `session.withTransaction()`.
