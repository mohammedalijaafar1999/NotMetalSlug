import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 4000,
    sourcemap: false,
  },
  server: { host: true, port: 5173 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as any);
