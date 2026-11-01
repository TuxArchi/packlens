# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado [SemVer](https://semver.org/lang/es/).

## [0.3.0] - 2026-11-01

### Añadido

- **Licencia Pro con Lemon Squeezy**: activación, validación diaria, desactivación, 3 dispositivos, prueba de 7 días y gracia offline de 7 días.
- **Free vs Pro** con gates en la UI y código público.
- **Generador avanzado de títulos**: 10 variantes puntuadas con patrones del top 10.
- **Optimizador de descripción**: análisis local, introducción SEO, keyword, tags al final, 3 hashtags, diff y aplicación en Studio.
- **Optimizador avanzado** con términos y hashtags de la competencia (Pro).
- **Pestaña Rendimiento**: resumen de 48 h con datos públicos y comparación con el canal.
- **Analytics CSV**: CTR, impresiones, vistas, AVD y % medio visto desde el CSV de Studio.
- **Auditoría completa del canal**: hasta 500 videos, mediana, outliers y bajo rendimiento, gratis.
- **Exportaciones Pro** de auditoría, keywords, recomendaciones y rendimiento en CSV/JSON.
- **Landing pública** con precios, privacidad, términos y reembolsos.
- **Caché del editor de Studio** para mantener los datos al cambiar de sección.
- **Fallback público** para recuperar metadatos y tags de videos publicados.

### Cambiado

- `Alt+Shift+P` vuelve a abrir y cerrar el **sidebar integrado** mediante `_execute_sidebar_action`.
- El botón flotante de Studio y el icono de la barra abren la ventana desacoplada.
- Al abrir el sidebar integrado se cierra la ventana desacoplada.
- La versión pasa a **0.3.0**.

### Corregido

- El panel dejaba de mostrar packaging, tags, SEO, keywords y rendimiento al cambiar de sección en Studio.
- Los tags no se cargaban en videos pendientes ocultos detrás de «Mostrar más».
- Los tags y el rendimiento no se recuperaban en la ventana externa para videos publicados.
- El atajo de teclado abría la ventana externa en lugar del sidebar.

### Notas

- Sin IA: los análisis y las propuestas son reglas locales.
- OAuth de YouTube Analytics queda para v0.4.0.
- El ZIP de release no está firmado; para instalación permanente hay que firmarlo en AMO.

## [0.2.3] - 2026-11-01

### Corregido

- El atajo `Alt+Shift+P` y el icono de la barra ahora abren y cierran **la misma ventana** que el botón de Studio, en lugar de togglear el sidebar integrado.
- El comando `_execute_sidebar_action` se sustituye por un comando custom `toggle-panel`.
- Al abrir la ventana se cierra el sidebar integrado si estaba abierto, para no tener dos interfaces.
- El ID de la ventana se guarda en `storage.local` (`panel-window-id`) y se valida antes de cerrarla, aunque el background se haya descargado.
- El sidebar integrado sigue disponible en el menú de Firefox, pero ya no se abre al instalar.

## [0.2.2] - 2026-11-01

### Corregido

- El botón flotante de Studio ahora abre PackLens en una **ventana propia** cuando Firefox no permite `sidebarAction.open()` desde un content script. Antes solo mostraba el aviso con el atajo.
- La ventana reutiliza y enfoca el panel si ya está abierto.
- La ventana se vincula a la pestaña de Studio mediante `?tabId=`, así que sigue el video aunque el panel no sea la pestaña activa.
- El atajo `Alt+Shift+P` sigue abriendo el sidebar real.

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
