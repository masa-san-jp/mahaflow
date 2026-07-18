import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MahaFlow',
      fileName: 'maha-flow',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['three', 'react', 'react-dom'],
    },
    sourcemap: true,
  },
});
