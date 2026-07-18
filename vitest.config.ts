import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/unit/**/*.test.ts', 'test/contract/**/*.test.ts', 'test/contract/**/*.test.tsx'],
    globals: false,
  },
});
