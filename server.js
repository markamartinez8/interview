const express = require('express');
const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'interview.db'));
db.exec(`CREATE TABLE IF NOT EXISTS accounts (
  username   TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

// Hard-coded credentials for now.
const USERS = { test: 'test' };
const sessions = new Map(); // token -> username

const app = express();
app.use(express.json());

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

app.use(express.static(path.join(__dirname, 'public')));

const port = process.env.PORT || 3000;
if (require.main === module) app.listen(port, () => console.log(`http://localhost:${port}`));
module.exports = app;
