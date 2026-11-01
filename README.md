# PackLens

Extensión de Firefox para analizar el **packaging** y el **SEO** de videos de YouTube: miniatura, título, descripción, tags, competencia y keywords. El análisis ocurre en tu navegador.

[English summary](#english-summary)

- **Packaging Score**: miniatura + título, con desglose y recomendaciones.
- **SEO Score**: descripción, tags y colocación de la keyword.
- **Inspector de competencia**: tags reales, visitas/hora y datos del video.
- **Outliers de canal**: qué videos rompieron la mediana del canal.
- **Keyword research**: dificultad, interés, top 10 y recomendaciones, con modo API o sin clave.
- **Aplicar a Studio**: añade los tags que falten y aplica títulos recomendados con confirmación.
- **Studio**: botón flotante y atajo `Alt+Shift+P` para abrir el panel.

## Estado

**v0.2.1** — núcleo gratuito y open source. Las funciones avanzadas que dependan de servidores, OAuth o IA gestionada pueden distribuirse por separado (ver [Open core](#open-core)).

## Instalación

### Desde el código

Requisitos: Firefox 142+, Node.js 20+.

```bash
npm install
npm run build
```

Carga la extensión:

1. Abre `about:debugging#/runtime/this-firefox`.
2. **Cargar complemento temporal…**
3. Selecciona `dist/manifest.json`.

O arranca Firefox con recarga:

```bash
npm start
```

La extensión se instala como temporal: desaparece al reiniciar Firefox. Para una instalación permanente hay que firmarla en [addons.mozilla.org](https://addons.mozilla.org/developers/) (unlisted/autodistribución).

### Desde una release

Descarga el ZIP de la release y cárgalo con `about:debugging` o fírmalo en AMO. El ZIP de GitHub no está firmado.

## Abrir el panel

- **Botón flotante** en la esquina inferior derecha de YouTube Studio.
- **Atajo `Alt+Shift+P`** desde cualquier pestaña. Se puede cambiar en `about:addons` → engranaje → **Administrar atajos de extensiones**.
- Icono de PackLens en la barra de herramientas.

Firefox exige un gesto de usuario para abrir un sidebar; si el botón no puede abrirlo, muestra un aviso con el atajo.

## Keyword research y API key

El modo **API** usa la YouTube Data API v3 con tu propia clave. Es gratuita y no requiere tarjeta.

1. Entra en [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto.
2. Habilita [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com).
3. Crea una API key en [Credenciales](https://console.cloud.google.com/apis/credentials) y restríngela a YouTube Data API v3.
4. Pégala en **Ajustes** de PackLens.

Cuota orientativa (modelo de 2026): **100 llamadas a `search.list` al día** en un cupo propio + **10.000 unidades al día** para `videos.list`/`channels.list`. La cuota se reinicia a medianoche del Pacífico.

El modo **Sin clave** es experimental: lee la página de resultados de YouTube con tu sesión. Las visitas son redondeadas, no hay suscriptores y YouTube puede limitarlo. No lo uses de forma masiva.

Los tags sugeridos salen de frases repetidas en los títulos del top 10; no son los tags reales de los competidores.

## Privacidad y permisos

- Sin telemetría, sin cuentas y sin servidor propio.
- Permisos: `storage` y `scripting`.
- Hosts: `www.youtube.com`, `studio.youtube.com`, `*.ytimg.com`, `www.googleapis.com`.
- La API key se guarda en `storage.sync` de tu perfil y solo se envía a `googleapis.com`.
- El modo sin clave hace peticiones a `youtube.com` con tus cookies.
- Nada de código remoto, `eval` ni `<all_urls>`.

Lee [PRIVACY.md](PRIVACY.md) para el detalle.

## Desarrollo

```bash
npm run build      # dist/
npm start          # compila y abre Firefox
npm test           # tests
npm run typecheck  # TypeScript
npm run lint       # web-ext lint
npm run package    # ZIP sin firmar en web-ext-artifacts/
```

Estructura:

```
src/background/   router de mensajes, lectura del player, cuota, API
src/content/      panel de /watch, panel de canal, Studio
src/core/         scoring, métricas, tags, keywords, recomendaciones
src/sidebar/      panel lateral (Preact)
src/options/      ajustes
src/ui/           tema
```

Documentación: [arquitectura](docs/architecture.md), [scoring](docs/scoring.md), [keywords](docs/keyword-research.md), [Studio](docs/studio-dom.md), [roadmap](docs/roadmap.md).

El manifest público usa el add-on ID `packlens@packlens.app`. Si haces un fork, cámbialo antes de firmar.

## Open core

Este repositorio contiene el **núcleo gratuito completo y funcional**. Funciones que impliquen costes recurrentes o integraciones sensibles (por ejemplo YouTube Analytics con OAuth, IA gestionada o monitorización con alertas) pueden distribuirse como módulos separados y no forman parte de este código.

El núcleo no está capado artificialmente: si una función está aquí, funciona sin cuenta ni licencia.

## Contribuir

Lee [CONTRIBUTING.md](CONTRIBUTING.md). Se usa DCO (`git commit -s`). No incluyas claves, datos personales ni código propietario.

## Licencia y marca

- Código: **Mozilla Public License 2.0** ([LICENSE](LICENSE)).
- El nombre **PackLens** y el logo son marcas; la licencia no concede su uso. Los forks deben usar otro nombre y otro icono. Ver [TRADEMARK.md](TRADEMARK.md).

## English summary

PackLens is an open-source Firefox extension (MPL-2.0) that analyses YouTube packaging and SEO: thumbnail, title, description, tags, competitor tags, channel outliers and keyword research. Everything runs locally. Keyword research can use your own free YouTube Data API key or an experimental session-based mode. It can apply suggested tags and titles to YouTube Studio with confirmation. No telemetry, no server, no remote code.

---

Hecho con cariño para creadores que quieren dejar de perder puntos por descuido.
