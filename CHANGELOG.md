# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado [SemVer](https://semver.org/lang/es/).

## [0.2.1] - 2026-10-31

### Añadido

- Botón flotante en YouTube Studio para abrir el panel.
- Atajo global `Alt+Shift+P` (`_execute_sidebar_action`), configurable en Firefox.
- Aplicar tags recomendados a Studio: solo añade los que faltan, respeta los 500 caracteres y pide confirmación.
- Títulos recomendados: tres borradores a partir del top 10, editables, con copia y aplicación a Studio.
- Recomendaciones de keywords: frases repetidas, patrones de título y tags sugeridos.
- Modo de keywords sin clave (experimental), además del modo API.
- Ajustes: mostrar/ocultar y copiar la API key, enlaces a Google Cloud y aviso de que la API es gratuita.
- Contador de cuota separado: 100 búsquedas/día + 10.000 unidades/día, reinicio a medianoche PT.

### Corregido

- Packaging en videos programados: se analiza la miniatura del editor (`i9.ytimg.com`) con CORS.
- Tags en Studio: lectura de `#chip-text`, refresco periódico y botón para expandir «Mostrar más».
- No se intenta el fallback público en videos programados o privados.
- La caché de packaging se invalida al cambiar la miniatura.
- El panel lateral se refresca al cambiar la descripción (SEO en vivo).
- El atajo y el botón resuelven el caso en que el sidebar se cierra y no hay forma de reabrirlo.

### Notas

- El ZIP de release no está firmado. Para instalación permanente hay que firmarlo en AMO.
- El add-on ID público es `packlens@packlens.app`.

## [0.2.0] - 2026-10-31

### Añadido

- Score SEO (descripción, tags y título) con keyword editable.
- Outliers de canal a partir de la página pública.
- Keyword research con YouTube Data API, cuota y caché.
- Recomendaciones y modo sin clave.

## [0.1.1] - 2026-10-31

### Corregido

- Tags de Studio: lectura del editor, observer y fallback a la página pública.

## [0.1.0] - 2026-10-31

### Añadido

- Packaging Score, análisis de miniatura y título.
- Inspector de competencia y tags en `/watch`.
- Panel lateral, panel flotante y soporte inicial de Studio.
