// Dependency-free static server for Caddie. Everything runs in the browser; this only serves files.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ai = require('./lib/ai');
const crypto = require('node:crypto');
const analytics = require('./public/js/analytics.js');

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


// ---- JSON API (AI features). Local use only unless CADDIE_ALLOW_REMOTE=1. ----
const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function readJson(req, limit = 200000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
// ---- Analytics and admin. Events are anonymous (visitor id, event type, rating and comment) and kept in data/events.jsonl.
// Local only by default; set CADDIE_PUBLIC=1 when hosting the server for other people (the AI endpoints stay local-only).
const DATA_DIR = path.join(__dirname, 'data'), EVENTS = path.join(DATA_DIR, 'events.jsonl');
const ADMIN_USER = process.env.CADDIE_ADMIN_USER || 'caddie', ADMIN_PASS = process.env.CADDIE_ADMIN_PASSWORD || 'test';
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest();
const tokens = new Map(), attempts = new Map();
function readEvents() {
  try { return fs.readFileSync(EVENTS, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; }
}
async function handleAnalytics(req, res, urlPath) {
  const host = String(req.headers.host || '');
  const local = LOCAL.has(req.socket.remoteAddress) && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  if (process.env.CADDIE_PUBLIC !== '1' && process.env.CADDIE_ALLOW_REMOTE !== '1' && !local) return send(res, 403, { error: 'Not available.' });
  const origin = req.headers.origin;
  if (origin) { try { if (new URL(origin).host !== host) return send(res, 403, { error: 'Cross-origin request blocked.' }); } catch { return send(res, 403, { error: 'Bad origin.' }); } }
  try {
    if (urlPath === '/api/event' && req.method === 'POST') {
      const b = await readJson(req, 8000);
      if (!analytics.TYPES.includes(b.type) || typeof b.vid !== 'string' || !b.vid || b.vid.length > 64) return send(res, 400, { error: 'Bad event' });
      const ev = { t: Date.now(), vid: b.vid, type: b.type };
      if (b.type === 'rating') {
        const stars = Math.round(Number(b.stars));
        if (!(stars >= 1 && stars <= 5) || !['interview', 'presentation'].includes(b.kind)) return send(res, 400, { error: 'Bad rating' });
        ev.kind = b.kind; ev.stars = stars; ev.comment = String(b.comment || '').slice(0, 1000);
      }
      try { fs.mkdirSync(DATA_DIR, { recursive: true }); if (!fs.existsSync(EVENTS) || fs.statSync(EVENTS).size < 8 * 1024 * 1024) fs.appendFileSync(EVENTS, JSON.stringify(ev) + '\n'); } catch (e) { console.error('Could not save event:', e.message); }
      return send(res, 200, { ok: true });
    }
    if (urlPath === '/api/admin/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress || '?', now = Date.now(), a = attempts.get(ip) || { n: 0, reset: now + 60000 };
      if (now > a.reset) { a.n = 0; a.reset = now + 60000; }
      if (++a.n > 8) { attempts.set(ip, a); return send(res, 429, { error: 'Too many attempts. Try again in a minute.' }); }
      attempts.set(ip, a);
      const b = await readJson(req, 2000);
      const ok = crypto.timingSafeEqual(sha(b.username), sha(ADMIN_USER)) & crypto.timingSafeEqual(sha(b.password), sha(ADMIN_PASS));
      if (!ok) return send(res, 401, { error: 'Incorrect username or password.' });
      const token = crypto.randomBytes(24).toString('hex'); tokens.set(token, now + 8 * 3600 * 1000);
      return send(res, 200, { token });
    }
    if (urlPath === '/api/admin/stats' && req.method === 'GET') {
      const t = String(req.headers.authorization || '').replace(/^Bearer /, ''), exp = tokens.get(t);
      if (!exp || exp < Date.now()) { tokens.delete(t); return send(res, 401, { error: 'Sign in again.' }); }
      const events = readEvents();
      return send(res, 200, { source: 'server', eventCount: events.length, stats: analytics.aggregate(events) });
    }
    return send(res, 404, { error: 'Not found' });
  } catch (e) { return send(res, 400, { error: 'Bad request' }); }
}

async function handleApi(req, res, urlPath) {
  if (urlPath === '/api/event' || urlPath.startsWith('/api/admin/')) return handleAnalytics(req, res, urlPath);
  const host = String(req.headers.host || '');
  const hostOk = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  if (process.env.CADDIE_ALLOW_REMOTE !== '1' && (!LOCAL.has(req.socket.remoteAddress) || !hostOk)) return send(res, 403, { error: 'AI features are only available on this computer.' });
  const origin = req.headers.origin;
  if (origin) { try { if (new URL(origin).host !== host) return send(res, 403, { error: 'Cross-origin request blocked.' }); } catch { return send(res, 403, { error: 'Bad origin.' }); } }
  try {
    if (urlPath === '/api/status' && req.method === 'GET') return send(res, 200, ai.status());
    if (req.method !== 'POST' && req.method !== 'DELETE') return send(res, 405, { error: 'Method not allowed' });
    if (urlPath === '/api/key' && req.method === 'DELETE') { ai.removeKey(); return send(res, 200, ai.status()); }
    const body = req.method === 'POST' ? await readJson(req) : {};
    if (urlPath === '/api/key') { await ai.saveKey(body.key); return send(res, 200, ai.status()); }
    if (urlPath === '/api/followup') return send(res, 200, { followUp: await ai.followUp(body) });
    if (urlPath === '/api/questions') {
      if (!String(body.role || '').trim()) return send(res, 400, { error: 'Role is required' });
      const list = await ai.questions({ role: body.role, jd: body.jd });
      return send(res, 200, { questions: list });
    }
    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    const code = e.code === 'bad_key' ? 400 : e.code === 'no_key' ? 409 : e.code === 'rate' ? 429 : 502;
    if (code === 502) console.error('AI request failed:', e.status || '', e.message);
    return send(res, code, { error: code === 502 ? 'The AI request failed.' : e.message });
  }
}

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (urlPath.startsWith('/api/')) return void handleApi(req, res, urlPath);
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
const host = process.env.HOST || '127.0.0.1'; // this computer only, unless you choose otherwise
server.listen(port, host, () => console.log(`Caddie is running at http://localhost:${port}`));
