# Keyword research

El panel **Buscar** analiza los 10 primeros resultados de YouTube para una keyword y genera recomendaciones. Hay dos modos.

## Modo API (recomendado)

Usa la **YouTube Data API v3** con la clave del usuario.

- `search.list` (`type=video`, `maxResults=10`) → IDs.
- `videos.list` (`snippet,statistics,contentDetails`) → título, canal, visitas, duración.
- `channels.list` (`statistics`) → suscriptores.

Cuota (modelo 2026):

- **100 llamadas a `search.list` al día**, en su propio cupo.
- **10.000 unidades al día** para el resto de endpoints; `videos.list` y `channels.list` cuestan 1 cada uno.
- Reinicio a medianoche del Pacífico.

La extensión lleva un contador local separado de búsquedas y unidades. Cada resultado se cachea 24 h; repetir una búsqueda no gasta cuota.

La clave se guarda en `storage.sync` y solo se envía a `googleapis.com`.

## Modo sin clave (experimental)

Descarga `https://www.youtube.com/results?search_query=...&hl=en` con las cookies de la sesión y parsea `ytInitialData` (`videoRenderer`).

- Sin coste de API.
- Visitas compactas (`1.2M`), no exactas.
- Sin suscriptores: la dificultad usa visitas, coincidencia en títulos y recencia.
- Resultados personalizados por la cuenta.
- YouTube puede limitar o bloquear las peticiones.
- Caché 12 h; mínimo 2 s entre búsquedas no cacheadas.

Es scraping de la página, no la vía sancionada. Para uso personal; no lo uses de forma masiva.

## Recomendaciones

Con el top 10 se calculan:

- **Frases repetidas** en los títulos (unigramas y bigramas), ponderadas por visitas.
- **Patrones**: cuántos usan número, año, la keyword al inicio y longitud media.
- **Tags sugeridos**: keyword + frases detectadas, con copia.

Los tags sugeridos son frases de títulos de competidores, no sus tags reales.

## Aplicar a Studio

- **Tags**: añade solo los que faltan, respeta los 500 caracteres y pide confirmación. Si la escritura falla, copia los tags y enfoca el campo.
- **Título**: tres borradores editables; al aplicar, muestra el título actual y el nuevo. Si falla, copia el título.

## Archivos

- `src/core/keywords.ts`: métricas.
- `src/core/recommendations.ts`: frases, patrones y tags.
- `src/core/title-suggestions.ts`: borradores de título.
- `src/core/search-page.ts`: parser del modo sin clave.
- `src/core/quota.ts`: contador y reinicio PT.
- `src/background/index.ts`: orquestación y caché.
