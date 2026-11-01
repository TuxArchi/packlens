# Checklist de lanzamiento — PackLens 0.3.0

## Antes de publicar

- [x] Email de soporte confirmado: `packlens@proton.me`.
- [ ] Mismo email configurado en Lemon Squeezy y AMO.
- [ ] Lemon Squeezy en **live mode**.
- [ ] Payout y datos fiscales completos.
- [ ] Compra real de prueba completada.
- [ ] La license key live activa, valida y desactiva Pro en Firefox.
- [ ] Checkout URLs live confirmadas (mensual y anual).
- [ ] Landing, privacidad, términos y reembolsos revisados.
- [ ] ZIP `packlens-0.3.0.zip` con ID `packlens@packlens.app`.
- [ ] `web-ext lint` sin errores.
- [ ] Tests, typecheck y build en verde.
- [ ] AMO: ficha, capturas, privacidad y notas para revisor.
- [ ] ZIP subido a AMO y firmado.

## Release

- [ ] Crear tag `v0.3.0`.
- [ ] Ejecutar el workflow de release.
- [ ] Verificar `packlens-0.3.0.zip` y `SHA256SUMS`.
- [ ] Verificar que la landing apunta a la release v0.3.0.
- [ ] Adjuntar el `.xpi` firmado de AMO a la release (opcional).

## Día del lanzamiento

- [ ] Publicar el release de GitHub.
- [ ] Publicar o actualizar la ficha de AMO.
- [ ] Comprobar la landing en móvil y escritorio.
- [ ] Publicar el anuncio con el enlace de descarga.
- [ ] Probar una compra real desde el enlace público.

## Después

- [ ] Revisar issues y soporte durante las primeras 48 h.
- [ ] Revisar activaciones, cancelaciones y reembolsos.
- [ ] Corregir cualquier fallo de Studio o licencia.
- [ ] Planificar v0.3.1 (watchlist) y v0.4.0 (OAuth).

## Enlaces

- Landing: https://tuxarchi.github.io/packlens/
- Privacidad: https://tuxarchi.github.io/packlens/privacy.html
- Términos: https://tuxarchi.github.io/packlens/terms.html
- Reembolsos: https://tuxarchi.github.io/packlens/refund.html
- Repo: https://github.com/TuxArchi/packlens
- Issues: https://github.com/TuxArchi/packlens/issues
