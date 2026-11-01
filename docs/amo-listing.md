# Ficha para AMO — PackLens 0.3.0

Copia estos campos en la consola de [addons.mozilla.org](https://addons.mozilla.org/developers/).
No incluyas license keys ni datos personales en campos públicos.

## Nombre

```text
PackLens — Packaging y SEO para YouTube
```

## Resumen (máx. 250 caracteres)

```text
Analiza packaging, SEO, tags, keywords, auditoría de canal y rendimiento de tus videos de YouTube. Núcleo gratis y Pro opcional. Sin IA, sin telemetría y con el análisis en tu navegador.
```

## Categoría

- **Productividad** (principal).
- Alternativa: **Fotos, música y videos**.

## Tags

```text
youtube, youtube studio, seo, packaging, thumbnails, keywords, creadores, auditoría
```

## Descripción

```text
PackLens analiza el packaging y el SEO de tus videos directamente en YouTube y YouTube Studio: miniatura, título, descripción, tags, competencia, keywords y rendimiento. Todo el análisis ocurre en tu navegador, sin servidor propio, sin telemetría y sin IA.

NÚCLEO GRATIS
• Packaging Score con análisis de miniatura, título y claridad, también en videos programados.
• SEO Score de descripción, tags y título, con keyword editable.
• Generador de títulos básico: 3 borradores editables a partir de los patrones del top 10.
• Tags y competencia: compara con el top 10, detecta huecos y aplica tags en Studio.
• Keywords con API de YouTube o modo sesión.
• Auditoría completa del canal: mediana, outliers y bajo rendimiento.
• Resumen de 48 h: vistas/día, engagement, cambios de metadatos y comparación con el canal.
• Optimizador de descripción básico: estructura, tags, 3 hashtags, diff y aplicar en Studio.
• Aplicar tags y título con confirmación.

PRO OPCIONAL
• Generador avanzado de títulos con 10 variantes puntuadas, además de los 3 borradores básicos.
• Descripción avanzada con términos y hashtags de la competencia.
• Analytics CSV: CTR, impresiones, AVD y % medio visto.
• Exportaciones de auditoría, keywords y resúmenes en CSV/JSON.
• 3 dispositivos en mensual, 5 en anual, y 7 días de prueba.

PRIVACIDAD
• La license key se envía solo a Lemon Squeezy para activar/validar/desactivar.
• Las keywords y la auditoría usan tu propia API key de YouTube hacia Google.
• El CSV de Studio se procesa localmente.
• No hay telemetría, analítica ni proveedores de IA.

REQUISITOS
• Firefox 142 o superior.
• API key gratuita de YouTube Data API v3 para keywords y auditoría completa (opcional para el resto).
• No está afiliado a YouTube ni Google.

El núcleo gratuito no caduca. Pro financia el desarrollo y desbloquea las funciones avanzadas.
```

## Enlaces

- **Homepage**: `https://tuxarchi.github.io/packlens/`
- **Política de privacidad**: `https://tuxarchi.github.io/packlens/privacy.html`
- **Términos**: `https://tuxarchi.github.io/packlens/terms.html`
- **Reembolsos**: `https://tuxarchi.github.io/packlens/refund.html`
- **Soporte**: `https://github.com/TuxArchi/packlens/issues`
- **Email de soporte**: `packlens@proton.me`
- **Código**: `https://github.com/TuxArchi/packlens`

## Licencia

```text
MPL-2.0
```

## Email de soporte

```text
packlens@proton.me
```

## Notas para el revisor

```text
PackLens es una extensión de Firefox para YouTube y YouTube Studio.

PARA PROBARLA
1. Instala la extensión.
2. Abre un video en https://studio.youtube.com/ o en https://www.youtube.com/watch?v=...
3. Abre el panel con Alt+Shift+P (sidebar integrado), con el botón flotante de Studio o con el icono de la barra.
4. Free funciona sin cuenta ni API key.
5. Para probar Pro, usa la license key de prueba que se indica en el campo privado de revisión. Se pega en Ajustes → Licencia.
6. Para keywords y auditoría completa se necesita una API key de YouTube Data API v3; es opcional y el resto de la extensión funciona sin ella.

PERMISOS
• storage: preferencias, caché, cuota y estado de licencia.
• scripting: leer el player response de YouTube en el main world.
• alarms: validar la licencia cada 24 h.
• Hosts: youtube.com, studio.youtube.com, *.ytimg.com, googleapis.com y api.lemonsqueezy.com.
• No hay código remoto, eval, telemetría ni IA.
• La license key solo se envía a Lemon Squeezy; la API key y las keywords solo a Google.
```

## Capturas sugeridas

1. Panel en YouTube Studio con Packaging Score y título.
2. Pestaña Keywords con el generador avanzado de títulos.
3. Optimizador de descripción con antes/después.
4. Pestaña Rendimiento con el resumen de 48 h.
5. Analytics CSV con CTR y AVD.
6. Auditoría completa del canal.

## Checklist de publicación

- [ ] La tienda de Lemon Squeezy está en live.
- [ ] Compra real de prueba y license key live activada.
- [ ] Email de soporte confirmado.
- [ ] ZIP `packlens-0.3.0.zip` subido a AMO.
- [ ] Ficha, capturas y categorías completas.
- [ ] Política de privacidad enlazada.
- [ ] Notas para el revisor con la key de prueba.
- [ ] AMO aprueba y entrega el `.xpi` firmado.
- [ ] Tag `v0.3.0` y release en GitHub.
- [ ] Enlace de descarga de la landing apuntando a v0.3.0.
- [ ] Anuncio público.
