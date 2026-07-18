import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        'maha-flow': resolve(__dirname, 'src/index.ts'),
        element: resolve(__dirname, 'src/element/maha-flow.ts'),
        react: resolve(__dirname, 'src/react/MahaFlow.tsx'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['three', 'react', 'react-dom', 'react/jsx-runtime'],
    },
    sourcemap: true,
  },
});
