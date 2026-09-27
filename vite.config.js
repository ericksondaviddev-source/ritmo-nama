import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    // CSS inline en el HTML: sin hoja de estilos render-blocking (FCP)
    cssCodeSplit: false
  }
});
