const $ = (id) => document.getElementById(id);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function api(path, body) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  return data;
}

function showLogin() {
  $('dash-view').hidden = true;
  $('login-view').hidden = false;
}

function showDashboard(account) {
  $('login-view').hidden = true;
  $('dash-view').hidden = false;
  $('create-account').hidden = !!account;
  $('start-interview').hidden = !account;
  $('greeting').hidden = !account;
  if (account) $('greeting').textContent = `Hi, ${account.firstName}`;
}

async function init() {
  try {
    const me = await api('/api/me');
    showDashboard(me.account);
  } catch {
    showLogin();
  }
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').textContent = '';
  try {
    await api('/api/login', { username: $('username').value, password: $('password').value });
    $('password').value = '';
    await init();
  } catch (err) {
    $('login-error').textContent = err.message;
  }
});

$('logout').addEventListener('click', async () => {
  await api('/api/logout', {});
  showLogin();
});

// Account modal
const validForm = () => $('first').value.trim() !== '' && EMAIL_RE.test($('email').value.trim());
const refreshDone = () => { $('done').disabled = !validForm(); };
['first', 'last', 'email'].forEach((id) => $(id).addEventListener('input', refreshDone));

$('create-account').addEventListener('click', () => {
  $('account-form').reset();
  $('account-error').textContent = '';
  refreshDone();
  $('modal').hidden = false;
  $('first').focus();
});

$('account-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validForm()) return;
  $('done').disabled = true;
  try {
    const { account } = await api('/api/account', {
      firstName: $('first').value, lastName: $('last').value, email: $('email').value,
    });
    $('modal').hidden = true;
    showDashboard(account);
  } catch (err) {
    $('account-error').textContent = err.message;
    refreshDone();
  }
});

// New interview flow
const iv = { resumeText: '' };
const ivSteps = ['iv-step1', 'iv-step2', 'iv-loading', 'iv-results'];
const ivShow = (id) => ivSteps.forEach((s) => { $(s).hidden = s !== id; });
const validUrl = (v) => { try { return /^https?:$/.test(new URL(v).protocol); } catch { return false; } };
const editorText = () => $('iv-editor').innerText.trim();

const step1Valid = () => $('iv-role').value.trim() !== '' && (!$('iv-url').value.trim() || validUrl($('iv-url').value.trim()));
const step2Valid = () => {
  const li = $('iv-linkedin').value.trim();
  if (li && !validUrl(li)) return false;
  return !!li || !!iv.resumeText || editorText() !== '';
};
const refreshIv = () => { $('iv-next').disabled = !step1Valid(); $('iv-done').disabled = !step2Valid(); };
['iv-company', 'iv-role', 'iv-url', 'iv-linkedin'].forEach((id) => $(id).addEventListener('input', refreshIv));
$('iv-editor').addEventListener('input', refreshIv);

document.querySelectorAll('.toolbar button').forEach((btn) => {
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', () => { document.execCommand(btn.dataset.cmd); $('iv-editor').focus(); });
});

$('start-interview').addEventListener('click', () => {
  iv.resumeText = '';
  ['iv-company', 'iv-role', 'iv-url', 'iv-linkedin', 'iv-file'].forEach((id) => { $(id).value = ''; });
  $('iv-editor').innerHTML = '';
  $('iv-file-status').textContent = '';
  $('iv-error1').textContent = $('iv-error2').textContent = '';
  ivShow('iv-step1');
  refreshIv();
  $('iv-modal').hidden = false;
  $('iv-role').focus();
});
const closeIv = () => { $('iv-modal').hidden = true; };
$('iv-close').addEventListener('click', closeIv);
$('iv-finish').addEventListener('click', closeIv);

$('iv-step1').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!step1Valid()) return;
  ivShow('iv-step2');
  refreshIv();
});
$('iv-back').addEventListener('click', () => ivShow('iv-step1'));

$('iv-file').addEventListener('change', async () => {
  const file = $('iv-file').files[0];
  iv.resumeText = '';
  $('iv-error2').textContent = '';
  if (!file) { $('iv-file-status').textContent = ''; return refreshIv(); }
  if (file.size > 5 * 1024 * 1024) { $('iv-file-status').textContent = ''; $('iv-error2').textContent = 'File must be under 5 MB'; $('iv-file').value = ''; return refreshIv(); }
  $('iv-file-status').textContent = 'Reading file…';
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const { text } = await api('/api/resume', { filename: file.name, data: btoa(bin) });
    iv.resumeText = text;
    $('iv-file-status').textContent = `✓ ${file.name} read`;
  } catch (err) {
    $('iv-file-status').textContent = '';
    $('iv-error2').textContent = err.message;
    $('iv-file').value = '';
  }
  refreshIv();
});

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ALIGN_TITLE = {
  strong: 'Your experience lines up well with this role',
  partial: 'Heads up: your experience only partly lines up with this role',
  weak: 'Heads up: your experience does not line up closely with this role',
  unknown: 'We could not compare your experience to this role',
};

function renderResults(r) {
  const a = r.alignment;
  const list = (items) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
  const level = ALIGN_TITLE[a.level] ? a.level : 'unknown';
  $('iv-alignment').innerHTML = `<div class="align ${level}"><strong>${ALIGN_TITLE[level]}</strong>
    ${esc(a.summary)}${a.gaps.length ? '<div><em>Possible gaps</em>' + list(a.gaps) + '</div>' : ''}${a.strengths.length ? '<div><em>Strengths</em>' + list(a.strengths) + '</div>' : ''}
    <div class="hint">This is informational only.</div></div>`;
  $('iv-questions').innerHTML = r.questions.map((q) => `<li>${q.category ? `<span class="cat">${esc(q.category)}</span>` : ''}${esc(q.question)}</li>`).join('');
  const notes = [...(r.notes || [])];
  if (r.source === 'built-in') notes.push('Questions were generated with built-in templates. Set ANTHROPIC_API_KEY on the server for questions tailored by Claude.');
  $('iv-notes').textContent = notes.join(' ');
  ivShow('iv-results');
}

$('iv-step2').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!step2Valid()) return;
  ivShow('iv-loading');
  try {
    const r = await api('/api/interviews', {
      company: $('iv-company').value, role: $('iv-role').value, jobUrl: $('iv-url').value,
      linkedin: $('iv-linkedin').value, resumeText: iv.resumeText, pastedText: editorText(),
    });
    renderResults(r);
  } catch (err) {
    ivShow('iv-step2');
    $('iv-error2').textContent = err.message;
  }
});

init();
