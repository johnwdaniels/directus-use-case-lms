import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    /** Listen on all local addresses so http://127.0.0.1:5173 and http://localhost:5173 both work. */
    host: true,
    proxy: {
      '/directus': {
        target: 'https://directus-cms-production-2235.up.railway.app',
        changeOrigin: true,
        secure: true,
        rewrite: (pathName) => pathName.replace(/^\/directus/, ''),
      },
    },
  },
});
