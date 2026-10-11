import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.APP_PORT ?? 5173);
const publicDir = fileURLToPath(new URL('./public/', import.meta.url));

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function assetPath(url = '/') {
  const pathOnly = url.split('?')[0];
  const cleanUrl = pathOnly === '/' || pathOnly === '' ? '/index.html' : pathOnly;
  const decoded = decodeURIComponent(cleanUrl);
  const safePath = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  return join(publicDir, safePath);
}

const server = http.createServer(async (req, res) => {
  try {
    const filePath = assetPath(req.url);
    let body = await readFile(filePath);
    if (filePath.endsWith('app.js')) {
      const backend = process.env.MOCKSERVER_URL ?? 'http://127.0.0.1:3333';
      const url = new URL(backend);
      if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/') throw new Error('Use a loopback backend URL');
      body = Buffer.from(body.toString().replace('http://127.0.0.1:3333', url.origin));
    }
    res.writeHead(200, {
      'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local role app running at http://127.0.0.1:${port}`);
});
