import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Never inline assets as data: URLs, so the strict CSP (font-src 'self') holds for small fonts too.
  build: { assetsInlineLimit: 0 },
  server: { port: 5180, strictPort: true },
});
