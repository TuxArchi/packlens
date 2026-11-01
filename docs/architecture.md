# Arquitectura

PackLens es una extensión **Manifest V3 para Firefox**. No hay servidor: todo el análisis y el almacenamiento ocurren en el navegador.

## Componentes

| Contexto | Archivo | Responsabilidad |
|---|---|---|
| Background (event page) | `src/background/index.ts` | Router de mensajes, lectura del player, outliers, API de keywords, cuota, escritura en Studio |
| Content `/watch` | `src/content/watch.tsx` | Panel flotante con datos y tags del video |
| Content canal | `src/content/channel.tsx` | Panel de outliers |
| Content Studio | `src/content/studio.ts` | Extracción del editor, miniatura CORS, tags/título, botón flotante |
| Sidebar | `src/sidebar/` | Packaging, tags, SEO, keywords |
| Ajustes | `src/options/` | API key, preferencias, enlaces |
| Núcleo | `src/core/` | Scoring, métricas, parsers, caché, cuota |

## Flujo de datos

1. El sidebar consulta la pestaña activa y pide `GET_VIDEO_DATA` al background.
2. En `/watch`, el background ejecuta una función en el **main world** para leer `getPlayerResponse()` y devuelve título, descripción, tags, visitas, etc.
3. En Studio, el background pide `GET_STUDIO_DATA` al content script, que lee el DOM del editor.
4. El sidebar calcula los scores localmente y descarga la miniatura si hace falta.
5. Studio analiza la miniatura del editor con CORS y la envía como métricas ya calculadas.

## Mensajería

El contrato está en `src/core/messages.ts`:

- `GET_VIDEO_DATA` → `VideoData | null`
- `GET_STUDIO_DATA` → `VideoData | null`
- `READ_PLAYER_RESPONSE` → `RawVideo | null` (fallback)
- `GET_CHANNEL_OUTLIERS` → `ChannelOutliers`
- `SEARCH_KEYWORD` (`mode: api | session`) → `KeywordSearchResult`
- `GET_QUOTA` → `QuotaState`
- `OPEN_SIDEBAR`
- `EXPAND_STUDIO_TAGS`
- `ADD_STUDIO_TAGS`
- `SET_STUDIO_TITLE`

El background responde a los mensajes de la extensión; los content scripts responden a los que les envía el background por pestaña.

## Almacenamiento

| Clave | Ámbito | Contenido |
|---|---|---|
| `apiKey`, `showFloatingButton`, `keywordMode` | `storage.sync` | Ajustes |
| `quota` | `storage.local` | Búsquedas y unidades del día PT |
| `keyword-cache` | `storage.local` | Resultados API (24 h) y sesión (12 h) |
| `seo-keyword:<videoId>` | `storage.local` | Keyword principal por video |

Las cachés de tags, miniaturas y canales viven en memoria del background (se pierden al descargar el event page).

## Scoring

- `src/core/packaging.ts`: miniatura + título.
- `src/core/title-score.ts`: reglas del título.
- `src/core/seo.ts`: descripción, tags y keyword.
- `src/core/recommendations.ts`: frases, patrones y tags sugeridos.
- `src/core/title-suggestions.ts`: borradores de título.
- `src/core/keywords.ts`: dificultad, interés y métricas.
- `src/core/outliers.ts`: mediana y multiplicador.

Son funciones puras y testeables; el DOM solo se usa para leer datos y miniaturas.

## Build

`scripts/build.mjs` hace tres pasadas con Vite:

1. Páginas (sidebar y ajustes) en ESM.
2. `background.js` en IIFE.
3. `content/watch.js`, `content/channel.js` y `content/studio.js` en IIFE.

El manifest y los `_locales` viven en `public/` y se copian a `dist/`.

## Permisos

- `storage`, `scripting`.
- Hosts: `www.youtube.com`, `studio.youtube.com`, `*.ytimg.com`, `www.googleapis.com`.
- Sin `tabs` global, sin `<all_urls>`, sin código remoto.

## ID del add-on

El repositorio público usa `packlens@packlens.app`. Es permanente una vez firmado en AMO; cámbialo antes de la primera firma si vas a publicar un fork.
