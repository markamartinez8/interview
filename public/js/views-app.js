// Signed-in screens: dashboard, setup, summary, settings.
(function (C) {
  const V = C.views;
  const { esc, fmtDur, fmtDate, uid } = C.util;
  const chip = (score) => { const l = C.label(score); return `<span class="chip ${l.cls}">${l.text}${score != null ? ` ${score}` : ''}</span>`; };
  const CAT = { speech: 'Speech', face: 'Face', body: 'Body', qa: 'Answers' };
  const scoreChips = (s) => ['speech', 'face', 'body', 'qa'].map((k) => `<span class="chip ${C.label(s[k]).cls}">${CAT[k]} ${s[k] == null ? '—' : s[k]}</span>`).join('');

  // ---------------- Dashboard ----------------
  V.dashboard = async (root) => {
    const profile = C.store.getProfile(), prefs = C.store.getPrefs();
    const sessions = await C.store.listSessions();
    const st = C.dashStats(sessions);
    const hl = [];
    if (st.strongest) hl.push(`<div class="hl high"><i></i><div><b>Strongest: ${esc(st.names[st.strongest[0]])}</b><div class="muted small">Average ${st.strongest[1]} across ${st.scored.length} scored session${st.scored.length > 1 ? 's' : ''}.</div></div></div>`);
    if (st.best) hl.push(`<div class="hl high"><i></i><div><b>Best session: ${esc(st.best.setup.jobName || 'Custom questions')}</b><div class="muted small">Overall ${st.best.scores.overall} on ${fmtDate(st.best.createdAt)}.</div></div></div>`);
    if (st.weakest) hl.push(`<div class="hl low"><i></i><div><b>Focus area: ${esc(st.names[st.weakest[0]])}</b><div class="muted small">Average ${st.weakest[1]}. Your lowest category so far.</div></div></div>`);
    if (st.recurring) hl.push(`<div class="hl low"><i></i><div><b>Keeps coming up</b><div class="muted small">${esc(st.recurring.text)}</div></div></div>`);
    root.innerHTML = `<section class="container page">
      <div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">Dashboard</span><h1 style="font-size:clamp(1.8rem,3.6vw,2.6rem)">${profile.name ? `Welcome back, ${esc(profile.name.split(' ')[0])}` : 'Welcome to Caddie'}</h1></div></div>
      <div class="card cta-card"><div class="stack" style="gap:.4rem"><h2 style="font-size:1.5rem">${sessions.length ? 'Ready for another round?' : 'Run your first interview'}</h2><p>${sessions.length ? 'Each run takes 10 to 15 minutes.' : 'Pick a role, meet Andy, and get feedback you can use right away.'}</p></div><a class="btn btn-lg" href="#/app/setup">Begin interview</a></div>
      <div class="dash-grid"><div class="stack">
        <div class="card"><div class="card-title"><h3>Summary of interviews</h3>${sessions.length ? `<span class="muted small">${sessions.length} session${sessions.length > 1 ? 's' : ''} · ${fmtDur(st.totalSec)} practiced</span>` : ''}</div>
          ${sessions.length ? `<div class="session-list">${sessions.slice(0, 6).map((s) => `<div class="session-row"><div><a href="#/app/summary/${s.id}"><b>${esc(s.setup.jobName || 'Custom questions')}</b></a><div class="muted small">${fmtDate(s.createdAt)} · ${fmtDur(s.metrics.duration)} · ${s.setup.mode === 'practice' ? 'Practice' : 'Mock'}${s.completed ? '' : ' · ended early'}</div></div><div class="scores">${scoreChips(s.scores)}</div></div>`).join('')}</div>${sessions.length > 6 ? '<p class="small muted" style="margin-top:.7rem"><a href="#/app/settings">See all sessions in Settings</a></p>' : ''}`
          : '<div class="empty"><strong>No interviews yet</strong>Your sessions and scores will appear here after your first run.</div>'}</div></div>
        <div class="stack">
          <div class="card"><div class="card-title"><h3>Highlights and lowlights</h3></div>${hl.length ? `<div class="hl-list">${hl.join('')}</div>` : '<div class="empty"><strong>Nothing to compare yet</strong>Finish a session with your camera on to see your strengths and focus areas.</div>'}</div>
          <div class="card"><div class="card-title"><h3>Your profile</h3><a class="small" href="#/app/settings">Edit</a></div><dl class="kv"><dt>Name</dt><dd>${esc(profile.name) || '—'}</dd><dt>Target role</dt><dd>${esc(profile.targetRole) || '—'}</dd><dt>Default mode</dt><dd>${prefs.mode === 'practice' ? 'Practice' : 'Mock'}</dd><dt>Silence before next question</dt><dd>${prefs.silenceSec} seconds</dd></dl></div>
        </div></div></section>`;
  };

  // ---------------- Setup ----------------
  V.setup = (root) => {
    const prefs = C.store.getPrefs(), profile = C.store.getProfile(), last = C.store.getLastSetup() || {};
    const S = { step: 1, source: last.source || 'ai', mode: last.mode || prefs.mode, jobName: last.jobName || profile.targetRole || '', jd: last.jd || '', custom: last.custom || '', withOpener: last.withOpener !== false, questions: [] };
    const steps = ['Choose', 'Details', 'Review'];
    const frame = (inner) => `<section class="container page"><div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">New interview</span><h1 style="font-size:clamp(1.7rem,3.4vw,2.4rem)">Set up your interview</h1></div></div>
      <div class="wizard-steps">${steps.map((n, i) => `<span class="chip ${i + 1 === S.step ? 'current' : ''}">${i + 1}. ${n}</span>`).join('')}</div><div class="card form-card">${inner}</div></section>`;
    const radio = (name, val, cur, title, desc, dis) => `<label class="choice ${dis ? 'disabled' : ''}"><input type="radio" name="${name}" value="${val}" ${cur === val ? 'checked' : ''} ${dis ? 'disabled' : ''}><strong>${title}</strong><span>${desc}</span></label>`;

    function render() {
      if (S.step === 1) {
        root.innerHTML = frame(`<div class="stack" style="gap:1.4rem">
          <div class="field"><span class="label">Practice agent</span><div class="seg">${radio('agent', 'interview', 'interview', 'Interview', 'Andy asks questions and listens while you answer.')}${radio('agent', 'more', '', 'Future workflows', 'More ways to practice will appear here.', true)}</div></div>
          <div class="field"><span class="label">Where should the questions come from?</span><div class="seg">${radio('source', 'ai', S.source, 'Dynamic questions', 'Built from the job title and, if you add one, the job description.')}${radio('source', 'static', S.source, 'Static questions', 'You enter the exact questions Andy asks.')}</div></div>
          <div class="field"><span class="label">Mode</span><div class="seg">${radio('mode', 'practice', S.mode, 'Practice', 'Live cues on the side. You can pause, skip and go back.')}${radio('mode', 'mock', S.mode, 'Mock', 'Like the real thing. No tips or pausing until the summary.')}</div></div>
          <div class="actions" style="margin-top:0;justify-content:flex-end"><button class="btn btn-primary" id="next">Next</button></div></div>`);
        root.querySelectorAll('input[name=source]').forEach((i) => i.addEventListener('change', () => { S.source = i.value; }));
        root.querySelectorAll('input[name=mode]').forEach((i) => i.addEventListener('change', () => { S.mode = i.value; }));
        root.querySelector('#next').addEventListener('click', () => { S.step = 2; render(); });
      } else if (S.step === 2) {
        root.innerHTML = frame(S.source === 'ai' ? `<div class="stack">
          <div class="field"><label for="job">Job title <span class="req">*</span></label><input type="text" id="job" value="${esc(S.jobName)}" placeholder="e.g. Product Manager"></div>
          <div class="field"><label for="jd">Job description (optional)</label><textarea id="jd" placeholder="Paste the posting here. Caddie looks for 'What you'll be doing' and 'What we're looking for' sections.">${esc(S.jd)}</textarea><span class="hint">Pasting is the only option for now. Links to job posts cannot be read.</span></div>
          <div class="error-text" id="err" role="alert"></div><div class="actions" style="margin-top:0"><button class="btn btn-ghost" id="back">Back</button><button class="btn btn-primary" id="next" ${S.jobName.trim() ? '' : 'disabled'}>Preview questions</button></div></div>`
          : `<div class="stack">
          <div class="field"><label for="qs">Your questions <span class="req">*</span></label><textarea id="qs" style="min-height:200px" placeholder="One question per line">${esc(S.custom)}</textarea><span class="hint">One per line.</span></div>
          <div class="field"><label for="jobc">Job title (optional)</label><input type="text" id="jobc" value="${esc(S.jobName)}"></div>
          <label class="row" style="gap:.5rem"><input type="checkbox" id="opener" ${S.withOpener ? 'checked' : ''}> Start with "Tell me about yourself" (recommended)</label>
          <div class="actions" style="margin-top:0"><button class="btn btn-ghost" id="back">Back</button><button class="btn btn-primary" id="next" ${S.custom.trim() ? '' : 'disabled'}>Preview questions</button></div></div>`);
        const nextBtn = root.querySelector('#next');
        root.querySelector('#back').addEventListener('click', () => { S.step = 1; render(); });
        if (S.source === 'ai') {
          const job = root.querySelector('#job'), jd = root.querySelector('#jd');
          job.addEventListener('input', () => { S.jobName = job.value; nextBtn.disabled = !job.value.trim(); });
          jd.addEventListener('input', () => { S.jd = jd.value; });
          nextBtn.addEventListener('click', () => { S.questions = C.questions.generate({ jobName: S.jobName.trim(), jd: S.jd }).questions; S.usedJd = S.jd.trim().length > 40; S.step = 3; render(); });
        } else {
          const qs = root.querySelector('#qs'), jc = root.querySelector('#jobc'), op = root.querySelector('#opener');
          qs.addEventListener('input', () => { S.custom = qs.value; nextBtn.disabled = !qs.value.trim(); });
          jc.addEventListener('input', () => { S.jobName = jc.value; }); op.addEventListener('change', () => { S.withOpener = op.checked; });
          nextBtn.addEventListener('click', () => { S.questions = C.questions.staticList(S.custom.split(/\r?\n/), S.withOpener); S.step = 3; render(); });
        }
      } else {
        const list = () => S.questions.map((q, i) => `<li class="qrow" style="display:grid;grid-template-columns:1fr auto;gap:.5rem;align-items:center;padding:.5rem 0;border-top:1px solid var(--border-default)"><span>${esc(q.text)}</span><button class="btn btn-ghost btn-sm" data-rm="${i}" aria-label="Remove question ${i + 1}">Remove</button></li>`).join('');
        root.innerHTML = frame(`<div class="stack"><p class="muted">${S.questions.length} questions for <b>${esc(S.jobName || 'your interview')}</b>. Andy asks them in this order. Remove any you do not want.</p>
          ${S.source === 'ai' && S.jd.trim() && !S.usedJd ? '' : ''}${S.source === 'ai' && S.jd.trim().length > 40 && !S.questions.some((q) => q.text.startsWith('This role') || q.text.startsWith("We're looking") || q.text.startsWith('The job description')) ? '<div class="callout warn">We could not find responsibilities or requirements in that job description, so the questions come from the job title.</div>' : ''}
          <ol id="qlist" style="margin:0;padding-left:1.2rem">${list()}</ol>
          <div class="actions" style="margin-top:.5rem"><button class="btn btn-ghost" id="back">Back</button><button class="btn btn-primary btn-lg" id="go" ${S.questions.length ? '' : 'disabled'}>Go to green room</button></div></div>`);
        root.querySelector('#back').addEventListener('click', () => { S.step = 2; render(); });
        root.querySelector('#qlist').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (!b) return; S.questions.splice(+b.dataset.rm, 1); render(); });
        root.querySelector('#go').addEventListener('click', () => {
          const setup = { source: S.source, mode: S.mode, jobName: S.jobName.trim(), jd: S.jd, custom: S.custom, withOpener: S.withOpener, questions: S.questions };
          C.store.setLastSetup({ source: S.source, mode: S.mode, jobName: S.jobName, jd: S.jd, custom: S.custom, withOpener: S.withOpener });
          C.pending = setup; location.hash = '#/app/interview';
        });
      }
    }
    render();
  };

  // ---------------- Summary ----------------
  V.summary = async (root, params) => {
    const s = await C.store.getSession(params[0]);
    if (!s) { root.innerHTML = '<section class="container page"><div class="empty"><strong>Session not found</strong>It may have been deleted, or it was saved in a different browser.<p style="margin-top:1rem"><a class="btn btn-primary" href="#/app">Back to dashboard</a></p></div></section>'; return; }
    const m = s.metrics, d = C.describe(m), sc = s.scores;
    const rowsHTML = (rows) => `<div class="metric-list">${rows.map((r) => `<div class="metric"><span>${esc(r[0])}${r[2] ? `<br><small class="muted">${esc(r[2])}</small>` : ''}</span><b>${esc(r[1])}</b></div>`).join('')}</div>`;
    const card = (title, key, rows, note) => `<div class="card score"><div class="card-title" style="margin:0"><h3>${title}</h3>${chip(sc[key])}</div><div class="score-num">${sc[key] == null ? '—' : `${sc[key]}<small> / 100</small>`}</div><div class="bar ${C.label(sc[key]).cls}"><div style="width:${sc[key] || 0}%"></div></div>${note ? `<p class="small muted">${note}</p>` : ''}${rowsHTML(rows)}</div>`;
    const caps = m.capabilities;
    root.innerHTML = `<section class="container page">
      <div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">Summary</span><h1 style="font-size:clamp(1.7rem,3.4vw,2.4rem)">${esc(s.setup.jobName || 'Custom questions')}</h1>
        <div class="muted">${fmtDate(s.createdAt)} · ${fmtDur(m.duration)} · ${s.setup.mode === 'practice' ? 'Practice' : 'Mock'} mode${s.completed ? '' : ' · ended early'}</div></div>
        <div class="row"><button class="btn btn-ghost" id="dl-sum">Download summary</button><button class="btn btn-ghost" id="dl-rec" ${s.hasRecording ? '' : 'disabled'}>Download recording</button><button class="btn btn-ghost" id="dl-tr">Download transcript</button></div></div>
      ${!caps.speech || !caps.vision ? `<div class="callout warn" style="margin-bottom:1rem">${[!caps.speech ? 'Speech measures need speech recognition, which this browser did not provide. Chrome or Edge work best.' : '', caps.camera && !caps.vision ? 'Face and posture analysis could not load.' : '', !caps.camera ? 'No camera was used, so face and posture were not measured.' : ''].filter(Boolean).join(' ')}</div>` : ''}
      <div class="score-grid">
        ${card('Speech style', 'speech', d.speech)}${card('Facial expression', 'face', d.face, 'Eye contact drives this score. Smiling and expressiveness are shown for information.')}${card('Body language', 'body', d.body)}</div>
      <div class="dash-grid"><div class="stack">
        <div class="card"><div class="card-title"><h3>Questions and answers</h3>${chip(sc.qa)}</div>${m.perQuestion.map((q, i) => `<div class="qa"><div class="row" style="justify-content:space-between"><b>${i + 1}. ${esc(q.text)}</b>${q.asked ? `<span class="muted small">${q.speakSec}s speaking${q.wpm ? ` · ${q.wpm} wpm` : ''}${q.eyePct != null ? ` · eye contact ${q.eyePct}%` : ''}</span>` : '<span class="chip na">Not asked</span>'}</div>${q.asked ? `<blockquote>${esc(q.answer || q.typed || (caps.speech ? 'No speech was captured for this answer.' : 'No transcript. This browser has no speech recognition.'))}</blockquote>` : ''}</div>`).join('')}</div></div>
        <div class="stack"><div class="card"><div class="card-title"><h3>Action items</h3></div><ol class="actions-list">${s.actions.length ? s.actions.map((a) => `<li>${esc(a.text)}</li>`).join('') : '<li>Not enough data was captured to suggest changes.</li>'}</ol></div>
          <div class="card"><h3 style="margin-bottom:.6rem">What next?</h3><div class="stack" style="gap:.6rem"><button class="btn btn-primary" id="retry">Retry session</button><div id="retry-opts" class="row" hidden><button class="btn btn-ghost btn-sm" id="retry-same">Same questions</button><button class="btn btn-ghost btn-sm" id="retry-change">Change setup</button></div><a class="btn btn-ghost" href="#/app/setup">New session</a><a class="btn btn-ghost" href="#/app">End session</a></div></div>
          <p class="small muted">Scores are practice indicators from on-device analysis, not predictions of hiring outcomes.</p></div></div></section>`;
    const $ = (x) => root.querySelector(x), stamp = new Date(s.createdAt).toISOString().slice(0, 10);
    $('#dl-sum').addEventListener('click', () => C.util.download(`caddie-summary-${stamp}.html`, new Blob([C.reportHTML(s)], { type: 'text/html' })));
    $('#dl-tr').addEventListener('click', () => C.util.download(`caddie-transcript-${stamp}.txt`, new Blob([C.transcriptText(s)], { type: 'text/plain' })));
    $('#dl-rec').addEventListener('click', async () => { const b = await C.store.getRecording(s.id); if (!b) return C.util.toast('The recording is not available in this browser.'); C.util.download(`caddie-recording-${stamp}.${/mp4/.test(b.type) ? 'mp4' : 'webm'}`, b); });
    $('#retry').addEventListener('click', () => { $('#retry-opts').hidden = false; });
    $('#retry-same').addEventListener('click', () => { C.pending = { ...s.setup }; location.hash = '#/app/interview'; });
    $('#retry-change').addEventListener('click', () => { C.store.setLastSetup({ source: s.setup.source, mode: s.setup.mode, jobName: s.setup.jobName, jd: s.setup.jd, custom: s.setup.custom, withOpener: s.setup.withOpener }); location.hash = '#/app/setup'; });
  };

  // ---------------- Settings ----------------
  V.settings = async (root) => {
    const profile = C.store.getProfile(), prefs = C.store.getPrefs();
    const sessions = await C.store.listSessions();
    let voices = [];
    const voicesP = C.voice.list();
    root.innerHTML = `<section class="container page"><div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">Settings</span><h1 style="font-size:clamp(1.8rem,3.6vw,2.6rem)">Your account</h1></div></div>
      <div class="dash-grid"><div class="stack">
        <form class="card stack" id="f-profile"><h3>Profile</h3>
          <div class="field"><label for="p-name">Name</label><input type="text" id="p-name" value="${esc(profile.name)}"></div>
          <div class="field"><label for="p-email">Email</label><input type="email" id="p-email" value="${esc(profile.email)}"></div>
          <div class="field"><label for="p-role">Target role</label><input type="text" id="p-role" value="${esc(profile.targetRole)}" placeholder="Used to pre-fill new interviews"></div>
          <div class="field"><label for="p-mode">Default mode</label><select id="p-mode"><option value="practice" ${prefs.mode === 'practice' ? 'selected' : ''}>Practice</option><option value="mock" ${prefs.mode === 'mock' ? 'selected' : ''}>Mock</option></select></div>
          <div class="field"><label for="p-sil">Seconds of silence before Andy moves on</label><input type="number" id="p-sil" min="3" max="15" value="${prefs.silenceSec}"></div>
          <div class="field"><label for="p-grace">Extra seconds to start your answer</label><input type="number" id="p-grace" min="0" max="30" value="${prefs.graceSec || 0}"><span class="hint">Added to the silence window only before you say your first word. 0 keeps it the same throughout.</span></div>
          <div class="field"><label for="p-voice">Andy's voice</label><select id="p-voice"><option value="">Loading voices…</option></select><span class="hint">Voices come from your browser and device. Leave as is for the best available one.</span></div>
          <div class="row"><button class="btn btn-primary" type="submit">Save</button><button class="btn btn-ghost" type="button" id="p-test" disabled>Hear voice</button><span class="small muted" id="p-msg" role="status"></span></div></form>
        <div class="card"><div class="card-title"><h3>Session logs</h3><span class="muted small">${sessions.length} saved on this device</span></div>
          ${sessions.length ? `<div class="scroll-x"><table class="logs"><thead><tr><th>Date</th><th>Role</th><th>Scores</th><th>Files</th><th></th></tr></thead><tbody>${sessions.map((s) => `<tr><td>${fmtDate(s.createdAt)}<br><span class="muted small">${fmtDur(s.metrics.duration)}</span></td><td>${esc(s.setup.jobName || 'Custom')}<br><span class="muted small">${s.setup.mode === 'practice' ? 'Practice' : 'Mock'}</span></td><td>${scoreChips(s.scores)}</td>
            <td><a href="#/app/summary/${s.id}">Summary</a><br><a href="#" data-rec="${s.id}" ${s.hasRecording ? '' : 'hidden'}>Recording</a><br><a href="#" data-tr="${s.id}">Transcript</a></td><td><button class="btn btn-ghost btn-sm" data-del="${s.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><strong>No sessions yet</strong>Completed interviews are listed here with their summary, recording and transcript.</div>'}</div></div>
      <div class="stack"><div class="card"><h3 style="margin-bottom:.6rem">Credits and subscription</h3><dl class="kv"><dt>Plan</dt><dd>Preview (free)</dd><dt>Sessions used</dt><dd>${sessions.length}</dd><dt>Limit</dt><dd>None</dd></dl><p class="small muted" style="margin-top:.7rem">Paid plans are not available yet. See <a href="#/plans">Plans</a>.</p></div>
        <div class="card stack"><h3>Payment details</h3><div class="field"><label for="pay">Card</label><input type="text" id="pay" disabled placeholder="Not needed during the preview"></div></div>
        <div class="card stack"><h3>Your data</h3><p class="small muted">Everything is stored in this browser only. Clearing site data removes it.</p><button class="btn btn-ghost" id="wipe">Delete all sessions</button><div id="wipe-c" class="row" hidden><span class="small">Delete ${sessions.length} sessions and recordings?</span><button class="btn btn-danger btn-sm" id="wipe-y">Delete</button><button class="btn btn-ghost btn-sm" id="wipe-n">Cancel</button></div></div></div></div></section>`;
    const $ = (x) => root.querySelector(x);
    $('#f-profile').addEventListener('submit', (e) => {
      e.preventDefault();
      C.store.setProfile({ name: $('#p-name').value.trim(), email: $('#p-email').value.trim(), targetRole: $('#p-role').value.trim() });
      C.store.setPrefs({ ...prefs, mode: $('#p-mode').value, silenceSec: Math.max(3, Math.min(15, +$('#p-sil').value || 5)), graceSec: Math.max(0, Math.min(30, +$('#p-grace').value || 0)), voiceURI: $('#p-voice').value });
      $('#p-msg').textContent = 'Saved.'; setTimeout(() => { const m = $('#p-msg'); if (m) m.textContent = ''; }, 2500);
    });
    voicesP.then((list) => {
      voices = list; const sel = $('#p-voice'); if (!sel) return;
      sel.innerHTML = list.length ? list.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === prefs.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('') : '<option value="">No voices available in this browser</option>';
      $('#p-test').disabled = !list.length;
    });
    $('#p-test').addEventListener('click', async () => { const v = voices.find((x) => x.voiceURI === $('#p-voice').value) || voices[0]; C.voice.cancel(); await C.voice.speak("Hi, I'm Andy. Ready when you are.", v); });
    root.addEventListener('click', async (e) => {
      const rec = e.target.closest('[data-rec]'), tr = e.target.closest('[data-tr]'), del = e.target.closest('[data-del]');
      if (rec) { e.preventDefault(); const b = await C.store.getRecording(rec.dataset.rec); if (b) C.util.download(`caddie-recording.${/mp4/.test(b.type) ? 'mp4' : 'webm'}`, b); }
      if (tr) { e.preventDefault(); const s = await C.store.getSession(tr.dataset.tr); if (s) C.util.download('caddie-transcript.txt', new Blob([C.transcriptText(s)], { type: 'text/plain' })); }
      if (del) { if (del.dataset.armed) { await C.store.deleteSession(del.dataset.del); V.settings(root); } else { del.dataset.armed = '1'; del.textContent = 'Confirm?'; del.classList.replace('btn-ghost', 'btn-danger'); } }
    });
    $('#wipe').addEventListener('click', () => { $('#wipe-c').hidden = false; });
    $('#wipe-n').addEventListener('click', () => { $('#wipe-c').hidden = true; });
    $('#wipe-y').addEventListener('click', async () => { for (const s of sessions) await C.store.deleteSession(s.id); V.settings(root); });
  };
  void uid;
})(window.Caddie);
