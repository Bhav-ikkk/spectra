import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

function spectraApiPlugin(): Plugin {
  return {
    name: 'spectra-workbench-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const mod = await server.ssrLoadModule('/src/server/api-middleware.ts');
          const middleware = mod.spectraApiMiddleware();
          middleware(req, res, next);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), spectraApiPlugin()],
  server: {
    port: 5173,
    strictPort: false,
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    emptyOutDir: false,
    chunkSizeWarningLimit: 2500,
  },
});
