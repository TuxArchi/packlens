import { build } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = (...parts) => path.resolve(root, ...parts);

const shared = {
  configFile: false,
  root,
  resolve: { alias: {} },
  plugins: [preact()],
};

async function buildPages() {
  await build({
    ...shared,
    root: src('src'),
    publicDir: src('public'),
    base: './',
    build: {
      outDir: src('dist'),
      emptyOutDir: true,
      target: 'firefox115',
      rollupOptions: {
        input: {
          sidebar: src('src/sidebar/index.html'),
          options: src('src/options/index.html'),
        },
      },
    },
  });
}

async function buildScript(name, entry, outDir) {
  await build({
    ...shared,
    publicDir: false,
    build: {
      outDir,
      emptyOutDir: false,
      target: 'firefox115',
      minify: false,
      lib: {
        entry,
        formats: ['iife'],
        name: `ytpl_${name.replace(/[^a-z0-9]/gi, '_')}`,
        fileName: () => `${name}.js`,
      },
    },
  });
}

await buildPages();
await buildScript('background', src('src/background/index.ts'), src('dist'));
await buildScript('watch', src('src/content/watch.tsx'), src('dist/content'));
await buildScript('channel', src('src/content/channel.tsx'), src('dist/content'));
await buildScript('studio', src('src/content/studio.ts'), src('dist/content'));

console.log('\nBuild complete: dist/');
