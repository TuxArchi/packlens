# Release assets

Esta carpeta contiene el artefacto de la primera release local:

- `packlens-0.2.1.zip` — build sin firmar de `github/` (add-on ID `packlens@packlens.app`).
- `SHA256SUMS` — checksum del ZIP.

La release canónica es la de **GitHub Releases**. El workflow `.github/workflows/release.yml` genera y adjunta el ZIP y el checksum automáticamente al empujar un tag `v*`.

El ZIP no está firmado. Para instalación permanente hay que firmarlo en [addons.mozilla.org](https://addons.mozilla.org/developers/) (unlisted/autodistribución).

Verificación:

```bash
sha256sum -c SHA256SUMS
```
