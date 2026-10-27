import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spectraApiMiddleware } from './api-middleware.js';
import { getCalibration } from '@spectra/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workbenchDir = path.resolve(__dirname, '../../');
const distDir = path.join(workbenchDir, 'dist');
const publicDir = path.join(workbenchDir, 'public');
const workspaceRoot = path.resolve(workbenchDir, '../../');
const clipsDir = path.join(workspaceRoot, 'benchmark', 'clips');

const PORT = parseInt(process.env.PORT || '4173', 10);
const HOST = process.env.HOST || '0.0.0.0';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveFile(res: http.ServerResponse, filePath: string): boolean {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  const mime = getMimeType(filePath);
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': stat.size,
    'Cache-Control': filePath.includes('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  });
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  return true;
}

const apiMiddleware = spectraApiMiddleware();

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. API Routes
  if (pathname.startsWith('/api/')) {
    apiMiddleware(req, res, (err?: unknown) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Not found: ${pathname}` }));
      }
    });
    return;
  }

  // 2. Benchmark Assets Fallback (serve directly from benchmark/clips if not in public)
  if (pathname.startsWith('/benchmark-assets/')) {
    const assetName = path.basename(pathname);
    const publicAssetPath = path.join(publicDir, 'benchmark-assets', assetName);
    if (serveFile(res, publicAssetPath)) return;

    const clipAssetPath = path.join(clipsDir, assetName);
    if (serveFile(res, clipAssetPath)) return;
  }

  // 3. Static Assets from dist/ or public/
  const safeRelativePath = pathname.replace(/^\/+/, '');
  const distCandidate = path.join(distDir, safeRelativePath);
  if (pathname !== '/' && serveFile(res, distCandidate)) {
    return;
  }

  const publicCandidate = path.join(publicDir, safeRelativePath);
  if (pathname !== '/' && serveFile(res, publicCandidate)) {
    return;
  }

  // 4. Single-Page Application (SPA) Fallback to dist/index.html
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (serveFile(res, indexHtmlPath)) {
    return;
  }

  // 5. If dist/index.html hasn't been built yet, friendly guidance
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>SPECTRA V3.0 Workbench</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #09090B; color: #E4E4E7; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #121216; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 32px; max-width: 480px; text-align: center; }
          h1 { color: #818CF8; margin-top: 0; }
          code { background: rgba(255,255,255,0.06); padding: 4px 8px; border-radius: 6px; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>SPECTRA V3.0 — The Visual Referee</h1>
          <p>Production server is running, but static assets have not been built yet.</p>
          <p>Run: <code>pnpm -r build</code> or <code>pnpm --filter @spectra/workbench build</code></p>
        </div>
      </body>
    </html>
  `);
});

server.listen(PORT, HOST, () => {
  const cal = getCalibration();
  console.log(`================================================================================`);
  console.log(` SPECTRA V3.0 — The Visual Referee for AI Agents (Production Cloud Server)`);
  console.log(`================================================================================`);
  console.log(` Server running at: http://${HOST}:${PORT}`);
  console.log(` Static bundle:    ${distDir}`);
  console.log(` Active Calibration:`);
  console.log(`   - sigma_noise:   ${((cal.sigma_noise ?? 0.0045) * 100).toFixed(2)}%`);
  console.log(`   - 3sigma thresh: ${(3 * (cal.sigma_noise ?? 0.0045) * 100).toFixed(2)}%`);
  console.log(`   - delta limit:   ${((cal.delta ?? 0.041) * 100).toFixed(2)}%`);
  console.log(` Active Endpoints:`);
  console.log(`   - GET  /api/status`);
  console.log(`   - POST /api/verify-live`);
  console.log(`   - POST /api/compile-voice`);
  console.log(`   - POST /api/save-invariant`);
  console.log(`================================================================================`);
});

export { server };
