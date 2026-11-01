# Contribuir a PackLens

Gracias por querer ayudar. Este repositorio es el **núcleo gratuito** de PackLens.

## Antes de empezar

- Busca un issue existente antes de abrir uno nuevo.
- Para cambios grandes, abre primero una propuesta y espera confirmación.
- No incluyas claves de API, tokens, datos personales ni código propietario.

## Entorno

Requisitos: Firefox 142+, Node.js 20+.

```bash
npm install
npm run build
npm test
npm run typecheck
npm run lint
```

Para probar la extensión:

```bash
npm start
```

O carga `dist/manifest.json` desde `about:debugging#/runtime/this-firefox`.

## Flujo de trabajo

1. Haz un fork y crea una rama: `feat/mi-cambio` o `fix/mi-arreglo`.
2. Añade o actualiza tests si tocas el núcleo (`src/core`).
3. Ejecuta `npm test`, `npm run typecheck` y `npm run lint`.
4. Abre un pull request explicando el problema y la solución.
5. Firma tus commits con DCO:

```bash
git commit -s -m "fix: ..."
```

El `Signed-off-by` certifica que puedes contribuir con ese código bajo MPL-2.0 (ver <https://developercertificate.org/>).

## Estilo

- TypeScript estricto; evita `any` salvo en bordes de APIs externas.
- Cambios pequeños y enfocados.
- Mensajes de commit claros (`feat:`, `fix:`, `docs:`, `test:`).
- Nada de telemetría ni dependencias que pidan permisos innecesarios.
- Los selectores de YouTube Studio son frágiles: documenta cualquier cambio en `docs/studio-dom.md`.

## Qué no se acepta

- Código que introduzca claves o secretos.
- Cambios que rompan la privacidad local (envío de datos a servidores sin discusión previa).
- Funciones que dependan de un backend propietario dentro del núcleo.
- Rebrandings que usen la marca PackLens (ver `TRADEMARK.md`).

## Licencia de las contribuciones

Al enviar un pull request aceptas que tu contribución se distribuya bajo **MPL-2.0** y que el proyecto pueda incluirla en el núcleo abierto.
