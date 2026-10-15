// Builds ./dist: a folder you can upload to any static host (Netlify Drop, Cloudflare Pages, GitHub Pages, ...).
// It contains the app plus the face/posture analysis files, so no server is needed.
// Optional AI features need the local server and are hidden automatically on a static host.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const copy = (from, to) => fs.cpSync(from, to, { recursive: true });

fs.rmSync(dist, { recursive: true, force: true });
copy(path.join(root, 'public'), dist);

const mp = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision');
if (!fs.existsSync(mp)) { console.error('Run "npm install" first.'); process.exit(1); }
fs.mkdirSync(path.join(dist, 'vendor', 'mediapipe'), { recursive: true });
copy(path.join(mp, 'vision_bundle.mjs'), path.join(dist, 'vendor', 'mediapipe', 'vision_bundle.mjs'));
fs.mkdirSync(path.join(dist, 'vendor', 'mediapipe', 'wasm'), { recursive: true });
for (const f of fs.readdirSync(path.join(mp, 'wasm'))) if (!/module_internal/.test(f)) copy(path.join(mp, 'wasm', f), path.join(dist, 'vendor', 'mediapipe', 'wasm', f)); // the module variant is not used

const models = path.join(root, 'models');
if (fs.existsSync(models) && fs.readdirSync(models).some((f) => f.endsWith('.task'))) copy(models, path.join(dist, 'models'));
else console.warn('No local models found; the app will fetch them from Google\'s model host instead.');

// Netlify / Cloudflare: cache the heavy files
fs.writeFileSync(path.join(dist, '_headers'), '/vendor/*\n  Cache-Control: public, max-age=31536000, immutable\n/models/*\n  Cache-Control: public, max-age=31536000, immutable\n/js/*\n  Cache-Control: no-cache\n/css/*\n  Cache-Control: no-cache\n');

const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`Built ${dist} (${(size(dist) / 1048576).toFixed(1)} MB). Upload this folder to your host.`);
