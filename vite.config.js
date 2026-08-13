import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const dir = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.BASE
  || (process.env.GITHUB_ACTIONS ? '/CV_Generator/' : '/');

export default defineConfig({
  root: 'app',
  base,
  publicDir: path.join(dir, 'public'),
  build: {
    outDir: path.join(dir, 'dist'),
    emptyOutDir: true,
    sourcemap: !process.env.BASE,
    assetsInlineLimit: 0
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [dir] },
    proxy: {
      '/api': 'http://127.0.0.1:3847'
    }
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': 'http://127.0.0.1:3847'
    }
  },
  test: {
    root: dir,
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    testTimeout: 60000,
    css: true
  }
});
