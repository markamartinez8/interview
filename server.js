const express = require('express');
const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { fetchPageText } = require('./lib/fetchPage');
const { generate } = require('./lib/generate');

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'interview.db'));
db.exec(`CREATE TABLE IF NOT EXISTS accounts (
  username   TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS interviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL,
  job_url TEXT NOT NULL DEFAULT '',
  linkedin TEXT NOT NULL DEFAULT '',
  experience_text TEXT NOT NULL DEFAULT '',
  questions TEXT NOT NULL,
  alignment TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

// Hard-coded credentials for now.
const USERS = { test: 'test' };
const sessions = new Map(); // token -> username

const app = express();
app.use(express.json({ limit: '10mb' }));

function cookieToken(req) {
  const m = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || '');
  return m && m[1];
}
function requireAuth(req, res, next) {
  const user = sessions.get(cookieToken(req));
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  req.user = user;
  next();
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || USERS[username] === undefined || USERS[username] !== password) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, username);
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; SameSite=Lax; Path=/`);
  res.json({ username });
});

app.post('/api/logout', (req, res) => {
  sessions.delete(cookieToken(req));
  res.setHeader('Set-Cookie', 'session=; Max-Age=0; Path=/');
  res.json({ ok: true });
});

function getAccount(username) {
  const r = db.prepare('SELECT first_name, last_name, email FROM accounts WHERE username = ?').get(username);
  return r ? { firstName: r.first_name, lastName: r.last_name, email: r.email } : null;
}

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ username: req.user, account: getAccount(req.user) });
});

app.post('/api/account', requireAuth, (req, res) => {
  const firstName = String(req.body?.firstName ?? '').trim();
  const lastName = String(req.body?.lastName ?? '').trim();
  const email = String(req.body?.email ?? '').trim();
  if (!firstName) return res.status(400).json({ error: 'First name is required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  db.prepare(`INSERT INTO accounts (username, first_name, last_name, email) VALUES (?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET first_name=excluded.first_name, last_name=excluded.last_name, email=excluded.email`)
    .run(req.user, firstName, lastName, email);
  res.json({ account: getAccount(req.user) });
});

app.post('/api/resume', requireAuth, async (req, res) => {
  const { filename, data } = req.body || {};
  if (typeof filename !== 'string' || typeof data !== 'string') return res.status(400).json({ error: 'Invalid upload' });
  const buf = Buffer.from(data, 'base64');
  if (!buf.length || buf.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'File must be under 5 MB' });
  const ext = path.extname(filename).toLowerCase();
  try {
    let text;
    if (ext === '.pdf') text = (await require('pdf-parse')(buf)).text;
    else if (ext === '.docx') text = (await require('mammoth').extractRawText({ buffer: buf })).value;
    else if (ext === '.txt' || ext === '.md') text = buf.toString('utf8');
    else return res.status(400).json({ error: 'Upload a PDF, DOCX or TXT file' });
    text = text.replace(/\s+\n/g, '\n').trim();
    if (text.length < 20) return res.status(400).json({ error: 'No readable text found in that file' });
    res.json({ text: text.slice(0, 30000) });
  } catch {
    res.status(400).json({ error: 'Could not read that file' });
  }
});

app.post('/api/interviews', requireAuth, async (req, res) => {
  const b = req.body || {};
  const company = String(b.company ?? '').trim().slice(0, 200);
  const role = String(b.role ?? '').trim().slice(0, 200);
  const jobUrl = String(b.jobUrl ?? '').trim();
  const resumeText = String(b.resumeText ?? '').trim();
  const pastedText = String(b.pastedText ?? '').trim();
  if (!role) return res.status(400).json({ error: 'Position/Role is required' });
  if (!resumeText && !pastedText) return res.status(400).json({ error: 'Upload a resume or paste your experience' });
  for (const [label, v] of [['Job description URL', jobUrl]]) {
    if (v) { try { if (!/^https?:$/.test(new URL(v).protocol)) throw 0; } catch { return res.status(400).json({ error: `${label} is not a valid URL` }); } }
  }
  const notes = [];
  let jobText = '';
  if (jobUrl) {
    try { jobText = await fetchPageText(jobUrl); } catch (e) { notes.push(`Could not read the job description page (${e.message}); used the role title only.`); }
  }
  const candidateText = [resumeText, pastedText].filter(Boolean).join('\n\n').slice(0, 40000);
  const result = await generate({ company, role, jobText, candidateText });
  result.notes = notes;
  const info = db.prepare(`INSERT INTO interviews (username, company, role, job_url, experience_text, questions, alignment)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(req.user, company, role, jobUrl, candidateText, JSON.stringify(result.questions), JSON.stringify(result.alignment));
  res.json({ id: Number(info.lastInsertRowid), ...result });
});

app.use(express.static(path.join(__dirname, 'public')));

const port = process.env.PORT || 3000;
if (require.main === module) app.listen(port, () => console.log(`http://localhost:${port}`));
module.exports = app;
