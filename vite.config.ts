/// <reference types="vitest" />
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { pluginGravador } from './scripts/vite-plugin-gravador';

export default defineConfig({
  // Gravador de gestos: página e plugin só existem em `npm run dev` (gravador.html fica fora do build)
  plugins: [pluginGravador()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tutor: resolve(__dirname, 'tutor.html'),
        configuracoes: resolve(__dirname, 'configuracoes.html')
      }
    }
  },
  test: {
    environment: 'happy-dom'
  }
});

