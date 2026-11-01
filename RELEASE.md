# Publicar PackLens

El repositorio público está listo en `github/`. No se ha creado ningún remoto ni se ha empujado nada.

## Crear el repositorio y el primer release

1. Crea un repositorio vacío en GitHub (por ejemplo `packlens`).
2. Desde esta carpeta:

```bash
cd github
git init -b main
git add .
git commit -m "PackLens v0.2.1"
git tag -a v0.2.1 -m "PackLens v0.2.1"
git remote add origin git@github.com:<tu-usuario>/packlens.git
git push -u origin main
git push origin v0.2.1
```

El workflow `Release` se dispara con el tag, compila, ejecuta los tests, genera el ZIP y crea la GitHub Release con las notas de `release-notes/0.2.1.md`.

## Si prefieres crearlo con GitHub CLI

```bash
cd github
gh repo create <tu-usuario>/packlens --public --source=. --remote=origin --push
git tag -a v0.2.1 -m "PackLens v0.2.1"
git push origin v0.2.1
```

## Antes de publicar

- Revisa `README.md`, `PRIVACY.md` y `SECURITY.md`.
- Sustituye el placeholder `<owner>` de `SECURITY.md` por tu usuario.
- Decide si quieres mantener el add-on ID `packlens@packlens.app`; una vez firmado en AMO es permanente.
- No subas `node_modules/`, `dist/` ni `web-ext-artifacts/` (ya están en `.gitignore`).
- No incluyas claves de API; el snapshot se genera con `npm run sync:public` desde el repo privado.

## Sincronizar cambios futuros

En el repo privado:

```bash
npm run sync:public
```

El script copia el código, cambia el ID público y escanea secretos. Los documentos públicos y las plantillas de `.github/` se conservan.
