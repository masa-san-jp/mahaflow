import { build } from 'vite';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = path.join(root, 'standalone/.tmp');

await build({
  root,
  configFile: false,
  build: {
    outDir: tmpDir,
    emptyOutDir: true,
    minify: true,
    sourcemap: false,
    rollupOptions: {
      input: path.join(root, 'standalone/main.ts'),
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'bundle.js',
        format: 'es',
      },
    },
  },
});

const bundle = readFileSync(path.join(tmpDir, 'bundle.js'), 'utf8');

// Inlining arbitrary JS inside <script> requires it never contain a literal
// "</script" (which would terminate the tag early and corrupt the page).
// Fail loudly rather than attempt an unsafe blind escape.
if (/<\/script/i.test(bundle)) {
  throw new Error('Standalone bundle contains a literal "</script" sequence; cannot inline safely.');
}

const template = readFileSync(path.join(root, 'standalone/template.html'), 'utf8');
const html = template.replace('__MAHAFLOW_STANDALONE_BUNDLE__', () => bundle);
writeFileSync(path.join(root, 'standalone/index.html'), html);

rmSync(tmpDir, { recursive: true, force: true });

console.log('Wrote standalone/index.html');
