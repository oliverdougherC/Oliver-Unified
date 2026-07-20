import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: './',
  worker: {
    format: 'es'
  },
  build: {
    outDir: path.resolve(__dirname, '../pages/utilities/assets'),
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        'utilities-app': path.resolve(__dirname, '../utilities-src/src/main.ts')
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]'
      }
    }
  },
  resolve: {
    alias: {
      '@utilities': path.resolve(__dirname, '../utilities-src/src')
    }
  }
});
