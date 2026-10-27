import { defineConfig } from 'vite';
import path from 'node:path';
import { spectraApiPlugin } from './src/server/api-middleware.js';

export default defineConfig({
  plugins: [spectraApiPlugin()],
  server: {
    port: 5173,
    strictPort: false,
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
