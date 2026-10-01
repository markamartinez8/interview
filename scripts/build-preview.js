// Builds a single static HTML page where /api/* is simulated in the browser
// (localStorage), so the UI can be previewed without the Node server.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const html = read('public/index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script src="app.js"><\/script>/, '');
const css = read('public/style.css');
const generate = read('lib/generate.js');
const app = read('public/app.js');

const shim = `
const process = { env: {} };
const { generate } = (() => {
  const module = { exports: {} };
  ${generate}
  return module.exports;
})();
(() => {
  const mem = {};
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v === null ? (mem[k] ?? null) : v; } catch { return mem[k] ?? null; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch {} },
    del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch {} },
  };
  const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  const account = () => JSON.parse(store.get('account') || 'null');
  const authed = () => store.get('session') === 'test';

  window.fetch = async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : {};
    if (url === '/api/login') {
      if (body.username === 'test' && body.password === 'test') { store.set('session', 'test'); return json(200, { username: 'test' }); }
      return json(401, { error: 'Invalid username or password' });
    }
    if (url === '/api/logout') { store.del('session'); return json(200, { ok: true }); }
    if (!authed()) return json(401, { error: 'Not authenticated' });
    if (url === '/api/me') return json(200, { username: 'test', account: account() });
    if (url === '/api/account') {
      const firstName = String(body.firstName || '').trim(), lastName = String(body.lastName || '').trim(), email = String(body.email || '').trim();
      if (!firstName) return json(400, { error: 'First name is required' });
      if (!EMAIL_RE.test(email)) return json(400, { error: 'A valid email is required' });
      const a = { firstName, lastName, email };
      store.set('account', JSON.stringify(a));
      return json(200, { account: a });
    }
    if (url === '/api/resume') {
      if (!/\\.(txt|md)$/i.test(body.filename)) return json(400, { error: 'This preview reads TXT files only. PDF and DOCX work in the full app.' });
      const text = decodeURIComponent(escape(atob(body.data))).trim();
      if (text.length < 20) return json(400, { error: 'No readable text found in that file' });
      return json(200, { text: text.slice(0, 30000) });
    }
    if (url === '/api/interviews') {
      const role = String(body.role || '').trim();
      const candidateText = [body.resumeText, body.pastedText].filter(Boolean).join('\\n\\n').trim();
      if (!role) return json(400, { error: 'Position/Role is required' });
      if (!candidateText) return json(400, { error: 'Upload a resume or paste your experience' });
      const notes = [];
      if (String(body.jobUrl || '').trim()) notes.push('The job description link was not read in this preview, so the match check used the role title only.');
      const result = await generate({ company: String(body.company || '').trim(), role, jobText: '', candidateText });
      result.notes = notes;
      return json(200, { id: Date.now(), ...result });
    }
    return json(404, { error: 'Not found' });
  };
})();
`;

const out = `<title>Interview Practice</title>
<style>
${css}
.preview-note{background:var(--card);border-bottom:1px solid var(--border);color:var(--muted);font-size:.8rem;padding:.4rem 1rem;text-align:center}
@media(max-width:600px){header{flex-wrap:wrap;gap:.5rem;padding:.75rem 1rem}.layout{flex-direction:column}aside{width:auto;border-right:0;border-bottom:1px solid var(--border)}main{padding:1rem}}
</style>
<div class="preview-note">Preview: sign in with test / test. Your data stays in this browser only. Resume upload accepts TXT files here.</div>
${body}
<script>
${shim}
${app}
</script>
`;
const dest = process.argv[2] || path.join(root, 'preview.html');
fs.writeFileSync(dest, out);
console.log('wrote', dest, out.length, 'bytes');
