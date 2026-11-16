import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: '_app',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
        rules: resolve(__dirname, 'rules/index.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
        notFound: resolve(__dirname, '404.html'),
      },
    },
  },
  server: { watch: { ignored: ['**/.taste-skill/**', '**/.scratch/**', '**/dist/**', '**/.impeccable/**'] } },
  test: { include: ['tests/**/*.test.ts'] },
});
