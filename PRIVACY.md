# Política de privacidad

**PackLens v0.2.1** funciona entera en tu navegador. No hay servidor propio, cuentas, telemetría ni analítica.

## Qué datos se guardan

En la extensión, usando el almacenamiento de Firefox:

- **Ajustes** (`storage.sync`): API key de YouTube Data, preferencia de botón flotante y modo de búsqueda (API/sin clave).
- **Caché y cuota** (`storage.local`): resultados de keywords, contador de cuota, tags publicados y métricas de miniaturas.
- **Keyword SEO por video** (`storage.local`): la keyword que asignas a un video.

No se envían a ningún servidor de PackLens.

## Qué datos se leen

- Páginas de YouTube y YouTube Studio que abres: título, descripción, tags, miniatura, visitas y datos del canal.
- Miniaturas de `i.ytimg.com` / `i9.ytimg.com`.
- Páginas públicas de canales (`/videos`) para calcular outliers.
- YouTube Data API (`googleapis.com`) solo cuando pulsas buscar una keyword en modo API y has configurado tu clave.
- Página de resultados de YouTube (`youtube.com/results`) solo en modo sin clave, con tus cookies de sesión.

## Qué se envía fuera del navegador

- **Modo API**: la keyword que buscas y tu API key se envían a `www.googleapis.com`. La clave se guarda en tu perfil y solo se usa para esa API.
- **Modo sin clave**: la consulta se hace a `www.youtube.com` con tus cookies, como si buscaras manualmente.
- **Nada más**. No hay analítica, ni informes de errores, ni publicidad.

## Cookies

PackLens no lee ni modifica cookies directamente. En modo sin clave, la petición a `youtube.com/results` incluye las cookies que el navegador ya tiene para ese sitio, igual que una pestaña normal.

## Retención y borrado

Todo queda en tu perfil de Firefox. Puedes borrarlo eliminando la extensión o limpiando sus datos desde `about:debugging` / `about:addons`. No hay cuenta que eliminar.

## Menores

La extensión no está dirigida a menores de 13 años.

## Cambios futuros

Si en el futuro se añaden funciones opcionales con servidor (por ejemplo IA gestionada, Analytics con OAuth o alertas), esta política se actualizará antes de activarlas y se pedirá consentimiento cuando corresponda.

## Contacto

Para cuestiones de privacidad, abre un issue no sensible o usa un Security Advisory para información confidencial.
