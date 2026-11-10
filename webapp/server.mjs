import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8124);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.mef': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' blob:; media-src 'self' blob:; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function send(res, status, message, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(message);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  let pathname;
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    pathname = decodeURIComponent(url.pathname);
  } catch {
    send(res, 400, 'Bad Request');
    return;
  }

  if (pathname === '/' || pathname.endsWith('/')) pathname += 'index.html';
  if (pathname.includes('\0')) {
    send(res, 400, 'Bad Request');
    return;
  }

  let filePath;
  try {
    filePath = path.resolve(ROOT, `.${pathname}`);
  } catch {
    send(res, 400, 'Bad Request');
    return;
  }
  const withinRoot = filePath === ROOT || filePath.startsWith(ROOT + path.sep);
  if (!withinRoot) {
    send(res, 403, 'Forbidden');
    return;
  }

  try {
    fs.stat(filePath, (error, stat) => {
      if (error || !stat.isFile()) {
        send(res, 404, 'Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const cacheableAsset = /[\\/]assets[\\/](maps|thumbs)[\\/]/.test(filePath) || /[\\/]help[\\/]img[\\/]/.test(filePath);
      const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': cacheableAsset ? 'public, max-age=86400' : 'no-cache',
        ...SECURITY_HEADERS,
      };

      res.writeHead(200, headers);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        res.destroy();
      });
      stream.pipe(res);
    });
  } catch {
    send(res, 400, 'Bad Request');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `\n  Port ${PORT} is already in use. Try another port, e.g.\n` +
        `    macOS/Linux:  PORT=8125 npm start\n` +
        `    PowerShell:   $env:PORT=8125; npm start\n`
    );
    process.exitCode = 1;
    return;
  }
  throw error;
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Editor máp 2 — kompletná webová verzia');
  console.log('  ---------------------------------');
  console.log(`  Local:   http://localhost:${PORT}/`);

  const interfaces = os.networkInterfaces();
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        console.log(`  Network: http://${address.address}:${PORT}/  (${name})`);
      }
    }
  }

  console.log('');
  console.log('  Pre mobil: otvor Network adresu v prehliadači telefónu (rovnaká Wi-Fi).');
  console.log('  Ctrl+C ukončí server.');
  console.log('');
});
