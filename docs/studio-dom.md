# YouTube Studio: selectores y escritura

La UI de Studio es Polymer y cambia a menudo. Esta nota documenta lo que usa PackLens y por qué es frágil.

## Lectura

| Dato | Selector |
|---|---|
| Título | `#title-textarea #textbox` (contenteditable) |
| Descripción | `#description-textarea #textbox` |
| Tags | `#tags-container ytcp-chip-bar` → `ytcp-chip` → `#chip-text` |
| Input de tags | `#tags-container #text-input` |
| Miniatura | `ytcp-thumbnail-editor img, #thumbnail img` |
| Visibilidad | elementos con `id*="visibility"` o texto de la página |

`queryDeep()` recorre también shadow roots abiertos de elementos personalizados, porque algunas vistas nuevas los usan.

## Refresco

- `MutationObserver` sobre el documento con debounce (~650 ms).
- Un `setInterval` de 1,5 s comprueba la firma `título + tags + hash(descripción) + src(miniatura)` y solo emite `VIDEO_CHANGED` si cambió.
- El observer cubre la expansión de «Mostrar más»; el poll cubre lo que se renderice dentro de shadow roots o se pierda.

## Escribir tags

El input es nativo:

```html
<input id="text-input" class="text-input" aria-label="Etiquetas">
```

El chip bar expone `setInputText`, `handleInputKeyDown`, `clearInput` y `getInput`.

Secuencia:

1. `input.focus()`.
2. Setter nativo de `value` + evento `input`.
3. `keydown Enter` (y `keyup`).
4. Verificar que apareció un `ytcp-chip` nuevo.
5. Si falla: `bar.setInputText(tag)` + `bar.handleInputKeyDown(event)`.
6. Si falla: probar con coma.
7. Si falla: copiar al portapapeles y enfocar el input.

Solo se añaden tags que faltan y se respeta el presupuesto de 500 caracteres (`fitTags`).

## Escribir título

El título es un `contenteditable`:

1. `focus()`.
2. `document.execCommand('selectAll')`.
3. `document.execCommand('insertText', false, title)`.
4. Verificar el texto.
5. Fallback: asignar `textContent` y disparar `input`.

Siempre se pide confirmación y se muestra el título actual frente al nuevo.

## Miniatura en videos programados

`i.ytimg.com/vi/<id>/maxresdefault.jpg` devuelve 404 antes de publicar. La imagen real está en `i9.ytimg.com`, con URL firmada.

El content script carga la misma URL con `crossOrigin = 'anonymous'` (i9 envía `Access-Control-Allow-Origin: *`), la dibuja en un canvas y calcula las métricas. Si la URL caduca, el background intenta la descarga con cookies y, si falla, se puntúa solo el título.

## Botón flotante y atajo

- Botón en Shadow DOM, `z-index` alto, esquina inferior derecha.
- Intenta `OPEN_SIDEBAR` (`sidebarAction.open()`).
- Si Firefox no lo permite por el gesto de usuario, muestra un aviso con `Alt+Shift+P`.
- El atajo usa `_execute_sidebar_action` en el manifest, que sí es una acción de usuario real.

## Depurar

- Abre la consola de la página de Studio y ejecuta `document.querySelector('#tags-container')`.
- Si los selectores dejan de funcionar, actualiza este documento y añade un test si la lógica es pura.
- No automatices clics de guardado ni publiques videos: PackLens solo rellena campos.
