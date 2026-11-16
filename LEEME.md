# FITYA tienda por WhatsApp

Tienda online donde el cliente arma su pedido y lo envía directo a tu WhatsApp, con un panel para cargar productos y ver métricas.

**index.html** es la tienda.
**admin.html** es el panel (productos, fotos, categorías, datos de la tienda y métricas).

## 1. Subir a GitHub Pages

1. Crea un repositorio nuevo en GitHub, por ejemplo `fitya`.
2. Sube todo el contenido de esta carpeta.
3. Entra a Settings, luego Pages. En Source elige "Deploy from a branch", rama `main`, carpeta `/ (root)` y guarda.
4. En un par de minutos la tienda queda en `https://TUUSUARIO.github.io/fitya/` y el panel en `https://TUUSUARIO.github.io/fitya/admin.html`

Para usar fitya.com.bo: en Settings, Pages, escribe el dominio en Custom domain y en tu proveedor del dominio crea un registro CNAME que apunte a `TUUSUARIO.github.io`.

## 2. Modo demo

Apenas la subes, ya funciona en **modo demo**: la tienda muestra el catálogo y los pedidos llegan a WhatsApp, pero lo que cambies en el panel y las métricas solo se guardan en tu navegador. Sirve para probar todo antes de conectar la base de datos.

## 3. Conectar Supabase (para guardar en la nube y ver métricas reales)

Supabase es gratis para una tienda de este tamaño.

1. Crea una cuenta en supabase.com y un proyecto nuevo (elige la región São Paulo, es la más cercana).
2. En el proyecto entra a **SQL Editor**, pega todo el archivo `supabase/esquema.sql` y presiona Run.
3. En el mismo lugar pega `supabase/semilla.sql` y presiona Run. Eso carga los 50 productos, las categorías y los datos de la tienda.
4. Entra a **Authentication**, luego Users, y crea tu usuario con correo y contraseña (Add user, marca Auto Confirm). Ese es tu acceso al panel.
5. En **Authentication**, Sign In / Providers, desactiva "Allow new users to sign up" para que nadie más pueda crearse una cuenta.
6. Entra a **Project Settings**, luego API. Copia el Project URL y la clave `anon public`.
7. Abre `js/config.js` en GitHub y pega esos dos valores:

```
supabaseUrl: "https://xxxx.supabase.co",
supabaseClave: "eyJhbGciOi...",
```

Guarda el cambio (Commit). Desde ese momento el panel te pide correo y contraseña, los cambios se ven en la tienda para todos y las métricas cuentan las visitas reales.

La clave anon es pública a propósito: la base solo deja leer el catálogo y registrar métricas. Editar productos y ver las métricas exige iniciar sesión.

## 4. Números de WhatsApp

En el panel, Datos de la tienda, Números de WhatsApp, cargas todos los números que reciben pedidos. El primero es el principal y recibe todo por defecto.

Si un producto lo atiende otra persona, entra a ese producto y en "Los pedidos de este producto van a" eliges su número, o "Otro número" para escribir uno que solo use ese producto.

Si un cliente mezcla productos de números distintos, la tienda le divide el pedido en partes y le muestra un botón para enviar cada parte a su WhatsApp. En las métricas ves cuántos pedidos llegaron a cada número.

Si ya tenías Supabase conectado con la versión anterior, corre una vez `supabase/actualizar.sql` en el SQL Editor.

## 5. Qué mide el panel

**Visitas**: personas distintas que entraron a la tienda.
**Productos vistos**: cuántas veces abrieron el detalle de un producto.
**Agregados al pedido**: unidades que pusieron en el carrito.
**Pedidos por WhatsApp**: pedidos que tocaron "Enviar pedido por WhatsApp" (el cliente igual tiene que tocar enviar en WhatsApp).
**Consultas directas**: clics en "Comprar ahora" o preguntas sueltas por WhatsApp.
**Conversión**: pedidos sobre visitas.

También ves los productos más vistos y cuáles se agregan más, las categorías más vistas y lo que la gente busca. Las búsquedas sin resultados te dicen qué productos te están pidiendo y no tienes.

## 6. Fotos

Lo más fácil es subirlas desde el panel: Productos, editar, arrastrar las fotos. Se achican solas. La primera es la principal.

También puedes ponerlas en la carpeta `img/productos/` con el id del producto como nombre, en jpg. Por ejemplo `img/productos/creatinascitec300.jpg`.

Si un producto no tiene foto, la tienda muestra su presentación en grande (300 g, 960 g) con el color de su categoría.

## Archivos

`index.html` y `admin.html`: las dos páginas.
`css/`: estilos. `js/`: funcionamiento. `datos/catalogo.js`: catálogo inicial del modo demo.
`supabase/`: base de datos. `fuentes/`: tipografía Archivo (licencia libre OFL).

## Google Analytics 4 (opcional)

1. En analytics.google.com crea una propiedad GA4 y un flujo de datos web con la dirección de tu tienda.
2. Copia el ID de medición, que empieza con G- (por ejemplo G-ABC123XYZ9).
3. Pégalo en el panel, en Datos de la tienda, sección Google Analytics, y guarda. También puedes ponerlo en js/config.js, en gaId.

Eventos que se envían (solo desde la tienda, nunca desde el panel):

| Acción del cliente | Evento en GA4 |
| --- | --- |
| Abre un producto | view_item |
| Agrega al pedido | add_to_cart |
| Busca algo | search |
| Toca Enviar pedido por WhatsApp | generate_lead (con el total y los productos) |
| Consulta por WhatsApp, Comprar ahora o sin stock | consulta_whatsapp |

Para ver los pedidos como conversión, en GA4 ve a Administrar, Eventos, y marca generate_lead como evento clave. Los eventos tardan hasta 24 horas en aparecer en los informes; en Informes, Tiempo real los ves al instante.

Las métricas del panel de FITYA siguen funcionando igual, con o sin Google Analytics.

## Combos

En el panel, en Combos, creas paquetes de 2 o más productos con un precio especial. En la tienda aparecen en la categoría Combos y en Ofertas, con lo que el cliente ahorra. Al pedirlos, el mensaje de WhatsApp lista lo que incluye cada combo. Si un producto del combo se queda sin stock, el combo aparece como agotado.

Si ya conectaste Supabase, corre una vez supabase/actualizar.sql en el SQL Editor para crear la tabla de combos. Si lo conectas ahora, esquema.sql ya la trae. Los combos de ejemplo y los productos de OVO están en semilla.sql.

## Productos de OVO

Los precios son los de cliente final del catálogo oficial de OVOPROT (precio referencial). Los precios de distribuidor y farmacia no se publican en la tienda.
