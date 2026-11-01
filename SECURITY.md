# Seguridad

## Reportar una vulnerabilidad

No abras un issue público para vulnerabilidades. Usa **GitHub Security Advisories**:

`https://github.com/TuxArchi/packlens/security/advisories/new`

Sustituye `TuxArchi` por el propietario del repositorio cuando esté publicado.

Incluye:

- Versión de PackLens y de Firefox.
- Pasos para reproducirlo.
- Impacto esperado.
- Prueba de concepto, si la tienes.

## Alcance

- Ejecución de código en el contexto de la extensión.
- Fuga de la API key o de datos locales.
- Inyección de HTML/JS desde datos de YouTube.
- Evasión de los límites de escritura en Studio.

## Fuera de alcance

- Vulnerabilidades de YouTube o de Google.
- Extensiones de terceros.
- Ataques que requieran acceso físico al equipo.

## Respuesta

Se revisará lo antes posible. No hay bounty. Se pedirá divulgación coordinada antes de publicar detalles.
