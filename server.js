// Dependency-free static server for Caddie. Everything runs in the browser; this only serves files.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, 'public');
const MOUNTS = [
  ['/vendor/mediapipe/', path.join(__dirname, 'node_modules', '@mediapipe', 'tasks-vision')],
  ['/models/', path.join(__dirname, 'models')],
  ['/', ROOT],
];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.task': 'application/octet-stream',
};

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  for (const [prefix, dir] of MOUNTS) {
    if (!urlPath.startsWith(prefix)) continue;
    const file = path.resolve(dir, urlPath.slice(prefix.length));
    if (file !== dir && !file.startsWith(dir + path.sep)) continue;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    const ext = path.extname(file).toLowerCase();
    const heavy = ext === '.wasm' || ext === '.task';
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': heavy ? 'max-age=86400' : 'no-cache' });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Caddie is running at http://localhost:${port}`));
