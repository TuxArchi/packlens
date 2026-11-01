# PackLens

Extensión de Firefox para **packaging, SEO y rendimiento** de videos de YouTube.
Analiza miniatura, título, descripción, tags, competencia y resultados directamente
en YouTube y YouTube Studio. El núcleo es gratuito y open source; Pro añade
profundidad y comodidad con una licencia.

Todo el análisis ocurre en tu navegador. No hay servidor propio, telemetría ni IA.

## Estado: v0.3.0

### Free

- **Packaging Score** (0–100): miniatura, título y claridad, también en videos programados.
- **SEO Score** (0–100): descripción, tags y keyword principal editable.
- **Tags y competencia**: tags del top 10, huecos y aplicación en Studio.
- **Keywords**: dificultad, interés, top 10 y patrones, con API o modo sesión.
- **Auditoría completa del canal**: todos los videos, mediana, outliers y bajo rendimiento.
- **Resumen de 48 h**: vistas/día, engagement, cambios de metadatos y comparación con el canal.
- **Optimizador de descripción básico**: estructura, tags, 3 hashtags, diff y aplicar en Studio.
- **Aplicar tags y título** en Studio con confirmación.
- Interfaz en **español e inglés**.

### Pro

- **Generador avanzado de títulos**: 10 variantes puntuadas con patrones del top 10.
- **Optimizador avanzado de descripción**: términos y hashtags de la competencia.
- **Analytics CSV**: CTR, impresiones, AVD y % medio visto desde el CSV de Studio.
- **Exportaciones**: auditoría, keywords, recomendaciones y resúmenes en CSV/JSON.
- **3 dispositivos** y **7 días de prueba**.
- Validación diaria y **7 días de gracia offline**.

### Fuera de v0.3.0

- OAuth de YouTube Analytics (retención, fuentes de tráfico y términos de búsqueda).
- Watchlist de canales/keywords (v0.3.1).
- Cualquier función de IA.

## Free vs Pro

| Función | Free | Pro |
| --- | --- | --- |
| Packaging, SEO, tags y outliers | Sí | Sí |
| Keywords con API o sesión | Sí | Sí |
| Aplicar tags y título en Studio | Sí | Sí |
| Auditoría completa del canal | Sí | Sí |
| Resumen de 48 h | Sí | Sí |
| Optimizador de descripción básico | Sí | Sí |
| Generador avanzado de títulos | — | Sí |
| Descripción con datos de competencia | — | Sí |
| Analytics CSV | — | Sí |
| Exportaciones CSV/JSON | — | Sí |
| Dispositivos | Local | 3 |
| Prueba | — | 7 días |

## Precio y licencia

- **Pro mensual**: 99 MXN/mes.
- **Pro anual**: 998 MXN/año.
- Precio de lanzamiento. Lemon Squeezy gestiona pago, IVA y licencia.
- La license key se pega en **Ajustes → Licencia → Activar Pro**.
- La clave se guarda en `storage.local` y solo se envía a Lemon Squeezy.
- Hasta 3 dispositivos, con desactivación desde Ajustes.

El gate es una comodidad, no DRM. El código de Pro también es público.

## Instalación

### Release

1. Descarga el ZIP de la última release:
   [github.com/TuxArchi/packlens/releases/latest](https://github.com/TuxArchi/packlens/releases/latest)
2. Descomprímelo.
3. `about:debugging#/runtime/this-firefox`
4. **Cargar complemento temporal…** → `manifest.json`.

El ZIP no está firmado. Para instalación permanente hay que subirlo a AMO como
unlisted/autodistribución y abrir el `.xpi` firmado.

### Desarrollo

```bash
npm install
npm run build
```

Carga `dist/manifest.json` desde `about:debugging` o ejecuta:

```bash
npm start
```

## Atajo y ventanas

- **`Alt+Shift+P`**: abre y cierra el **sidebar integrado** de Firefox.
- **Botón flotante de Studio**: abre el panel en una **ventana propia** (el content script no puede abrir el sidebar sin gesto de usuario).
- **Icono de la barra**: abre y cierra la ventana propia.
- Al abrir el sidebar integrado se cierra la ventana propia, para dejar una sola interfaz.

## Uso básico

1. Abre un video en YouTube o en YouTube Studio.
2. Abre PackLens con el atajo, el botón de Studio o el icono.
3. Revisa **Packaging**, **Tags**, **SEO**, **Keywords** y **Rendimiento**.
4. Aplica título, tags o descripción con confirmación.
5. Si la escritura automática falla, PackLens copia el contenido para pegarlo con `Ctrl+V`.

## Keyword research

La vía recomendada es la **API oficial de YouTube Data**:

1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilita **YouTube Data API v3**.
3. Crea una **API key** y restríngela a esa API.
4. Pégala en **Ajustes**.

Cuota orientativa:

- **100 llamadas a `search.list` al día**.
- **10.000 unidades al día** para el resto de endpoints.
- Reinicio a medianoche del Pacífico.
- La cuota es de tu cuenta de Google; PackLens no la revende.

El **modo sin clave** lee `youtube.com/results` con tu sesión. Es experimental:
sin suscriptores, con visitas compactas y sujeto a los límites de YouTube.

## Cómo se calculan los scores

### Packaging

`Packaging Score = 65 % miniatura + 35 % título`

- Contraste tonal, densidad visual, color y legibilidad móvil.
- Título de 30–60 caracteres, sin gritos, con 4–12 palabras y un dato concreto.

### SEO

`SEO Score = 50 % descripción + 30 % tags + 20 % título`

- Descripción: longitud, keyword en las primeras líneas, 2–4 apariciones, enlaces o timestamps, 3 hashtags y CTA.
- Tags: cantidad, keyword, long-tail, duplicados y límite de 500 caracteres.
- Título: keyword y longitud.

### Outliers y auditoría

El **outlier** es `visitas / mediana` del canal. Un 3.2× significa que el video
rompió el patrón. La auditoría completa recorre hasta 500 videos con la API de
YouTube y muestra mediana, media, top outliers y videos por debajo.

### Rendimiento

El resumen de 48 h usa datos públicos (vistas, likes, comentarios), vistas/día
frente al ritmo del canal y cambios de título, tags o descripción. No prueba
causalidad. El CSV añade CTR, impresiones, AVD y % medio visto.

## Datos y caché

- **Video abierto**: player response para título, descripción, tags, vistas y fecha.
- **Studio**: content script del editor; caché local para mantener el panel al cambiar de sección.
- **Miniatura**: `i.ytimg.com` o imagen del editor, analizada localmente.
- **Canal**: página pública `/videos` o API para la auditoría completa.
- **CSV**: procesado en el navegador; no se sube.
- **Caché**: tags 10 min, miniatura 10 min, canal 15 min, keywords 24 h, auditoría 24 h.

## Privacidad

- **License key**: se envía a `api.lemonsqueezy.com` para activar/validar/desactivar.
- **YouTube API key**: se envía a `googleapis.com` con las consultas.
- **CSV de Studio**: local.
- **Sin IA**: no se envían títulos, descripciones ni tags a modelos externos.
- **Sin telemetría** ni analítica.

Más detalle: [PRIVACY.md](PRIVACY.md).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run build` | Genera `dist/` |
| `npm start` | Compila y abre Firefox |
| `npm test` | Tests de scoring, SEO, CSV, licencia, rendimiento y locales |
| `npm run typecheck` | Comprobación de tipos |
| `npm run lint` | Valida el paquete con `web-ext lint` |
| `npm run package` | Genera el ZIP para AMO |
| `npm run sync:public` | Sincroniza el snapshot público en `github/` |

## Estructura

```
src/
  background/   Router, licencia, API, auditoría y rendimiento
  content/      Paneles de watch/canal y extractor de Studio
  core/         Scoring, SEO, tags, keywords, CSV, auditoría, rendimiento
  sidebar/      Panel (Preact)
  options/      Ajustes y licencia
  ui/           Tema compartido
docs/           Landing, privacidad, términos y reembolsos
```

## Hoja de ruta

- **v0.3.1** — Watchlist local de canales, keywords y videos.
- **v0.4.0** — OAuth de YouTube Analytics: retención, fuentes de tráfico y términos de búsqueda.

## Licencia

MPL-2.0. Consulta [LICENSE](LICENSE).
