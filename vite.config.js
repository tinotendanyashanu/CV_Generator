import { defineConfig } from 'vite';

const base = process.env.BASE
  || (process.env.GITHUB_ACTIONS ? '/CV_Generator/' : '/');

export default defineConfig({
  base,
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    assetsInlineLimit: 0
  },
  server: {
    port: 5173,
    strictPort: true,
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
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    testTimeout: 60000,
    css: true
  }
});
