# Política de privacidad

**PackLens v0.3.0** funciona en tu navegador. No hay servidor propio de PackLens,
cuentas, telemetría, analítica ni publicidad. Esta política explica qué datos se
guardan, qué se envía fuera del navegador y por qué.

Vigente desde el 1 de noviembre de 2026.

## 1. Datos que se guardan en tu navegador

- **Ajustes** (`storage.sync`): API key de YouTube Data, preferencia del botón
  flotante y modo de búsqueda.
- **Licencia** (`storage.local`): license key, plan, ID de instancia, límite y uso
  de dispositivos, última validación y estado offline.
- **Caché y cuota** (`storage.local`): resultados de keywords, insights de
  descripciones, auditoría de canales, contadores de cuota y métricas de
  miniaturas.
- **Resúmenes de rendimiento** (`storage.local`): una foto de título, descripción,
  tags y métricas públicas por video para comparar cambios.
- **Editor de Studio** (`storage.local`): el último título, descripción y tags
  leídos del editor para mantener el panel al cambiar de sección.
- **Ventana del panel** (`storage.local`): el ID de la ventana desacoplada, si la
  usas.

Estos datos no se envían a ningún servidor de PackLens. Puedes borrarlos
eliminando la extensión o limpiando sus datos desde Firefox.

## 2. Datos que se envían fuera del navegador

- **Lemon Squeezy** (`api.lemonsqueezy.com`): la license key y el ID de instancia
  se envían para activar, validar y desactivar Pro. Lemon Squeezy gestiona el pago,
  el IVA y los datos de la compra como merchant of record. PackLens no recibe ni
  almacena datos de tarjeta.
- **Google / YouTube Data API** (`googleapis.com`): cuando usas keywords,
  auditoría de canal o estadísticas, se envían tu API key, la keyword, IDs de
  videos y IDs de canal. Google los procesa según sus propias políticas.
- **Páginas públicas de YouTube** (`youtube.com`): para leer tags publicados,
  metadatos de videos y la página de canal, la extensión hace peticiones con las
  cookies que tu navegador ya tiene para YouTube. No hay un proxy de PackLens.
- **CSV de Studio**: se lee y procesa en tu navegador. No se sube a ningún
  servidor.

## 3. Lo que no hacemos

- No usamos IA ni enviamos tus títulos, descripciones o tags a modelos externos.
- No hay telemetría, analítica de producto, informes de errores ni publicidad.
- No vendemos ni compartimos datos con terceros.
- No accedemos a tus cookies directamente; solo las peticiones que hace el
  navegador incluyen las cookies existentes del sitio.

## 4. Retención y borrado

Los datos permanecen en tu perfil de Firefox hasta que borras los datos de la
extensión o la desinstalas. La license key se conserva para validar Pro; puedes
desactivar el dispositivo desde Ajustes. Los reembolsos y la facturación se
gestionan en Lemon Squeezy.

## 5. Menores

PackLens no está dirigida a menores de 13 años.

## 6. Cambios

Si una versión futura añade OAuth, un servidor o cualquier tratamiento nuevo,
esta política se actualizará antes de activarlo.

## 7. Contacto

Para cuestiones de privacidad, abre un issue no sensible en
[GitHub Issues](https://github.com/TuxArchi/packlens/issues) o usa un Security
Advisory para información confidencial.
