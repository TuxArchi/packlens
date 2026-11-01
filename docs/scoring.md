# Cómo se calculan los scores

Todo es local y determinista. **Son heurísticas**: sirven para detectar problemas objetivos, no para predecir el algoritmo ni garantizar posicionamiento.

## Packaging Score

`65 % miniatura + 35 % título`

### Miniatura

| Regla | Peso | Qué mide |
|---|---|---|
| Contraste tonal | 25 | Diferencia entre percentiles 5 y 95 de luminancia |
| Densidad visual | 25 | Proporción de píxeles sobre un borde Sobel fuerte |
| Fuerza del color | 20 | Colorfulness de Hasler–Süsstrunk |
| Legibilidad móvil | 30 | Contraste que sobrevive al reducir a 168 px de ancho |

La imagen se normaliza a 480 px de ancho cuando es posible. Un rango tonal alto, una densidad de bordes media y color saturado puntúan mejor.

### Título

| Regla | Peso | Qué mide |
|---|---|---|
| Longitud | 25 | Ideal 30–60 caracteres |
| Mayúsculas | 20 | Palabras completas en mayúsculas (salvo siglas) |
| Signos y emojis | 20 | Repeticiones de `!!`/`??`, exceso de emojis |
| Número de palabras | 15 | Ideal 4–12 |
| Dato concreto | 20 | Número, año o paréntesis |

## SEO Score

`50 % descripción + 30 % tags + 20 % título`

### Descripción

| Regla | Peso | Qué mide |
|---|---|---|
| Longitud | 25 | 200+ palabras ideal |
| Primeras dos líneas | 20 | Keyword en los primeros ~150 caracteres |
| Keyword | 20 | 2–4 apariciones; 0 o 6+ penalizan |
| Enlaces/timestamps | 15 | Al menos un enlace o tres timestamps |
| Hashtags | 10 | 3–5 al final |
| CTA | 10 | Suscríbete, descarga, comenta… |

### Tags

| Regla | Peso | Qué mide |
|---|---|---|
| Cantidad | 30 | 15–30 |
| Keyword exacta | 25 | La keyword como tag |
| Long-tail | 20 | Tres tags de 2+ palabras |
| Duplicados | 10 | 0 ideal |
| Presupuesto | 15 | ≤500 caracteres; aviso por encima de 400 |

### Título

| Regla | Peso | Qué mide |
|---|---|---|
| Keyword presente | 50 | Coincidencia completa o parcial |
| Longitud | 50 | 30–60 ideal |

### Keyword principal

Se detecta, por orden: la keyword manual guardada para el video, el primer tag, o las dos primeras palabras con contenido del título. Se puede editar en la pestaña SEO.

## Outliers de canal

Se leen los primeros 30 videos de la pestaña `/videos` y se calcula la mediana de visitas. El outlier de cada video es `visitas / mediana`.

- `1x` = rinde como la mediana.
- `3x` = rompió el patrón.
- Los contadores son los compactos de YouTube (`114K`), así que el ratio es aproximado.

## Dificultad de keyword

**Modo API**: 55 % suscriptores (escala logarítmica), 30 % visitas (log), 15 % coincidencia de la keyword en títulos.

**Modo sin clave**: 70 % visitas, 20 % coincidencia en títulos, 10 % recencia. No hay suscriptores; se marca como aproximada.

**Interés**: mediana de visitas (log) + proporción de resultados recientes.

No es volumen de búsqueda: ese dato no existe públicamente.
