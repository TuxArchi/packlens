# Release assets

Los binarios **no se guardan en el repositorio**. La release oficial está en:

<https://github.com/TuxArchi/packlens/releases>

El workflow `.github/workflows/release.yml` compila, testea, empaqueta y adjunta el ZIP sin firmar y `SHA256SUMS` al empujar un tag `v*`. El ZIP no está firmado; para instalación permanente hay que firmarlo en AMO.
