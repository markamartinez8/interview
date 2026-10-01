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
const ivSteps = ['iv-step1', 'iv-step2', 'iv-loading', 'iv-choice', 'iv-list', 'iv-room'];
const ivShow = (id) => {
  ivSteps.forEach((s) => { $(s).hidden = s !== id; });
  $('iv-dialog').classList.toggle('xl', id === 'iv-room');
};
const validUrl = (v) => { try { return /^https?:$/.test(new URL(v).protocol); } catch { return false; } };
const editorText = () => $('iv-editor').innerText.trim();

const step1Valid = () => $('iv-role').value.trim() !== '' && (!$('iv-url').value.trim() || validUrl($('iv-url').value.trim()));
const step2Valid = () => {
  return !!iv.resumeText || editorText() !== '';
};
const refreshIv = () => { $('iv-next').disabled = !step1Valid(); $('iv-done').disabled = !step2Valid(); };
['iv-company', 'iv-role', 'iv-url'].forEach((id) => $(id).addEventListener('input', refreshIv));
$('iv-editor').addEventListener('input', refreshIv);

document.querySelectorAll('.toolbar button').forEach((btn) => {
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', () => { document.execCommand(btn.dataset.cmd); $('iv-editor').focus(); });
});

$('start-interview').addEventListener('click', () => {
  stopInterview();
  $('iv-end').textContent = 'End interview';
  iv.resumeText = '';
  ['iv-company', 'iv-role', 'iv-url', 'iv-file'].forEach((id) => { $(id).value = ''; });
  $('iv-editor').innerHTML = '';
  $('iv-file-status').textContent = '';
  $('iv-error1').textContent = $('iv-error2').textContent = '';
  ivShow('iv-step1');
  refreshIv();
  $('iv-modal').hidden = false;
  $('iv-role').focus();
});
const closeIv = () => { stopInterview(); $('iv-modal').hidden = true; };
$('iv-close').addEventListener('click', closeIv);
$('iv-list-close').addEventListener('click', closeIv);

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
  $('iv-notes').textContent = notes.join(' ');
  iv.questions = r.questions;
  $('iv-choice-error').textContent = '';
  ivShow('iv-choice');
}

$('iv-step2').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!step2Valid()) return;
  ivShow('iv-loading');
  iv.role = $('iv-role').value.trim();
  iv.company = $('iv-company').value.trim();
  try {
    const r = await api('/api/interviews', {
      company: $('iv-company').value, role: $('iv-role').value, jobUrl: $('iv-url').value,
      resumeText: iv.resumeText, pastedText: editorText(),
    });
    renderResults(r);
  } catch (err) {
    ivShow('iv-step2');
    $('iv-error2').textContent = err.message;
  }
});


// ---------- Live interview ----------
const SILENCE_MS = () => window.IV_SILENCE_MS || 5000; // quiet time before Andy moves on
const VOICE_LEVEL = 0.02;                              // mic RMS above this counts as speaking
const room = { run: 0, stream: null, ctx: null, raf: 0, speaking: false, open: 0, nodUntil: 0, nextBlink: 0 };

$('iv-see-yes').addEventListener('click', () => ivShow('iv-list'));
$('iv-see-no').addEventListener('click', () => startInterview());
$('iv-list-begin').addEventListener('click', () => startInterview());
$('iv-end').addEventListener('click', () => { stopInterview(); closeIv(); });

function stopInterview() {
  room.run++; // cancels any in-flight interview loop
  try { window.speechSynthesis && speechSynthesis.cancel(); } catch {}
  if (room.stream) room.stream.getTracks().forEach((t) => t.stop());
  room.stream = null;
  if (room.ctx) room.ctx.close().catch(() => {});
  room.ctx = null;
  cancelAnimationFrame(room.raf);
  room.speaking = false;
  $('iv-video').srcObject = null;
}

async function getMedia() {
  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) throw new Error('This browser cannot access a camera or microphone.');
  const audio = { echoCancellation: true, noiseSuppression: true };
  try {
    return { stream: await md.getUserMedia({ video: { facingMode: 'user' }, audio }), video: true };
  } catch (e) {
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw e;
    return { stream: await md.getUserMedia({ audio }), video: false }; // no camera present
  }
}

function pickVoice() {
  const voices = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  const en = voices.filter((v) => /^en/i.test(v.lang));
  return en.find((v) => /daniel|david|guy|alex|fred|male/i.test(v.name)) || en.find((v) => /google us english|en-us/i.test(v.name + v.lang)) || en[0] || null;
}

// Speaks `text` as Andy; resolves when finished (or when an estimated time passes if the browser gives no event).
function speak(text, run) {
  $('iv-caption').textContent = text;
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); room.speaking = false; resolve(); };
    const timer = setTimeout(finish, Math.max(2500, text.split(/\s+/).length * 450 + 2500));
    room.speaking = true;
    if (run !== room.run) return finish();
    if (!window.speechSynthesis) return; // timer drives the mouth and the wait
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = 0.98; u.pitch = 0.9; u.lang = (v && v.lang) || 'en-US';
      u.onend = finish; u.onerror = finish;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { /* the timer covers it */ }
  });
}

// Resolves once the mic has been quiet for SILENCE_MS (counted from now, restarting whenever the user speaks).
function waitForSilence(analyser, run) {
  const buf = new Uint8Array(analyser.fftSize);
  const bar = $('iv-silence');
  return new Promise((resolve) => {
    let lastVoice = performance.now();
    const tick = setInterval(() => {
      if (run !== room.run) { clearInterval(tick); return resolve(false); }
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const b of buf) { const d = (b - 128) / 128; sum += d * d; }
      const now = performance.now();
      if (Math.sqrt(sum / buf.length) > VOICE_LEVEL) lastVoice = now;
      const quiet = now - lastVoice;
      bar.style.width = `${Math.min(100, (quiet / SILENCE_MS()) * 100)}%`;
      $('iv-status').textContent = quiet < 1500 ? 'Listening…' : 'Take your time. I’ll move on after a few quiet seconds.';
      if (quiet >= SILENCE_MS()) { clearInterval(tick); bar.style.width = '0'; resolve(true); }
    }, 100);
  });
}

// Andy's face: mouth follows speech, periodic blinks, gentle head sway, small nods while listening.
function animateAndy() {
  const mouth = $('mouth'), lip = $('lip'), head = $('andy-head');
  const eyes = [$('eye-l'), $('eye-r')];
  const loop = (t) => {
    const target = room.speaking ? Math.abs(Math.sin(t / 95)) * 0.6 + Math.abs(Math.sin(t / 53)) * 0.4 : 0;
    room.open += (target - room.open) * 0.35;
    const ry = 2 + room.open * 13, rx = 17 - room.open * 4;
    mouth.setAttribute('rx', rx.toFixed(1)); mouth.setAttribute('ry', ry.toFixed(1));
    lip.setAttribute('d', `M${150 - rx} 204 Q150 ${(204 + 8 + room.open * 16).toFixed(1)} ${150 + rx} 204`);
    if (t > room.nextBlink) {
      eyes.forEach((e) => e.classList.add('blink'));
      setTimeout(() => eyes.forEach((e) => e.classList.remove('blink')), 120);
      room.nextBlink = t + 2000 + Math.random() * 4000;
    }
    const nod = t < room.nodUntil ? Math.sin((room.nodUntil - t) / 120) * 4 : 0;
    head.setAttribute('transform', `translate(0 ${(Math.sin(t / 1100) * 1.5 + nod).toFixed(2)}) rotate(${(Math.sin(t / 1700) * 1.2 + (room.speaking ? Math.sin(t / 400) * 0.8 : 0)).toFixed(2)} 150 250)`);
    if (!room.speaking && Math.random() < 0.004) room.nodUntil = t + 700;
    room.raf = requestAnimationFrame(loop);
  };
  room.raf = requestAnimationFrame(loop);
}

async function startInterview() {
  const run = ++room.run;
  $('iv-choice-error').textContent = '';
  let media;
  try {
    media = await getMedia();
  } catch (e) {
    ivShow('iv-choice');
    $('iv-choice-error').textContent = e.name === 'NotAllowedError' || e.name === 'SecurityError'
      ? 'Camera and microphone access was blocked. Allow access in your browser’s address bar and try again. Some embedded previews block it; use the full app.'
      : (e.name === 'NotFoundError' ? 'No microphone was found. Connect one and try again.' : e.message || 'Could not start the camera and microphone.');
    return;
  }
  if (run !== room.run) { media.stream.getTracks().forEach((t) => t.stop()); return; }
  room.stream = media.stream;
  $('iv-video').srcObject = media.stream;
  $('iv-novideo').hidden = media.video;
  $('iv-caption').textContent = '';
  $('iv-status').textContent = '';
  ivShow('iv-room');
  room.ctx = new (window.AudioContext || window.webkitAudioContext)();
  await room.ctx.resume().catch(() => {});
  const analyser = room.ctx.createAnalyser();
  analyser.fftSize = 1024;
  room.ctx.createMediaStreamSource(media.stream).connect(analyser);
  animateAndy();

  const qs = iv.questions;
  const where = iv.company ? ` at ${iv.company}` : '';
  const transitions = ['Thank you. Next question.', 'Okay, got it. Moving on.', 'Great. Here is the next one.', 'Thanks for that. Let’s continue.'];
  await speak(`Hi, I’m Andy. Thanks for joining me today. I’ll ask you ${qs.length} questions about the ${iv.role} position${where}. Take your time with each answer. When you’ve been quiet for about five seconds, I’ll move on. Let’s get started.`, run);
  for (let i = 0; i < qs.length; i++) {
    if (run !== room.run) return;
    $('iv-progress').textContent = `Question ${i + 1} of ${qs.length}`;
    $('iv-status').textContent = '';
    await speak(`${i ? transitions[i % transitions.length] + ' ' : ''}${qs[i].question}`, run);
    if (run !== room.run) return;
    if (!(await waitForSilence(analyser, run))) return;
  }
  if (run !== room.run) return;
  $('iv-progress').textContent = 'Interview complete';
  $('iv-status').textContent = '';
  await speak('That’s all my questions. Thank you for your time, and good luck with the real thing.', run);
  if (run !== room.run) return;
  $('iv-end').textContent = 'Close';
}

init();
