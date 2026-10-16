import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tutor: resolve(__dirname, 'tutor.html'),
        configuracoes: resolve(__dirname, 'configuracoes.html')
      }
    }
  }
});
