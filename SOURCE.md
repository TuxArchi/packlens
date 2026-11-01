# PackLens — source code

This archive contains the source code for **PackLens 0.3.1**, a Firefox extension
for YouTube packaging, SEO and performance.

- Repository: https://github.com/TuxArchi/packlens
- Version: 0.3.1
- Add-on ID: `packlens@packlens.app`
- License: MPL-2.0
- Build: Node.js 22

## Build instructions

```bash
npm ci
npm run build
```

The submitted extension package is the contents of `dist/`.

Optional checks:

```bash
npm test
npm run typecheck
npm run lint
npm run package
```

`npm run package` builds and creates the unsigned ZIP with `web-ext`.

## What is included

- `src/` — extension source:
  - `background/` — message router, license, YouTube API, audit, performance.
  - `content/` — watch page, channel page and YouTube Studio extractors.
  - `core/` — scoring, SEO, tags, keywords, CSV, audit, performance and license.
  - `sidebar/` — Preact panel.
  - `options/` — settings and license UI.
  - `ui/` — shared theme.
- `public/` — manifest, locales and icons.
- `tests/` — Vitest tests.
- `scripts/build.mjs` — Vite build.
- `package.json` / `package-lock.json` — dependencies and reproducible install.
- `docs/` — technical docs, landing and legal pages.
- `release-notes/` — release notes.

`node_modules/`, `dist/`, `web-ext-artifacts/`, `.git/` and release binaries are
not part of the source archive. They are generated or ignored.

## Architecture notes

- The background script is built as an IIFE from `src/background/index.ts`.
- Content scripts are built from `src/content/*.tsx` / `src/content/studio.ts`.
- Sidebar and options pages are Vite HTML entries built with Preact.
- The manifest is copied from `public/manifest.json`.
- No remote code, no `eval`, no dynamic script loading and no telemetry.

## Permissions

- `storage` — settings, cache, quota, license state and panel window ID.
- `scripting` — read `getPlayerResponse()` from the YouTube main world.
- `alarms` — validate the Pro license every 24 hours.
- Hosts:
  - `www.youtube.com`, `studio.youtube.com` — page/content integration.
  - `*.ytimg.com` — thumbnail analysis.
  - `www.googleapis.com` — YouTube Data API with the user's own key.
  - `api.lemonsqueezy.com` — license activation/validation/deactivation.

## Privacy

- The license key is sent only to Lemon Squeezy.
- The YouTube API key, keywords, video IDs and channel IDs are sent only to Google.
- The Studio CSV is processed locally.
- No AI providers, telemetry, analytics or advertising.
- Full policy: https://tuxarchi.github.io/packlens/privacy.html

## Tests

`npm test` runs the pure-logic tests for scoring, SEO, tags, CSV, license,
performance, audit, title/description generators and locales.

## License

MPL-2.0. See `LICENSE` and `NOTICE`.
