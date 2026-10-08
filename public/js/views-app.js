// Signed-in screens: dashboard, setup, summary, settings.
(function (C) {
  const V = C.views;
  const { esc, fmtDur, fmtDate, fmtDateTime, uid } = C.util;
  const chip = (score) => { const l = C.label(score); return `<span class="chip ${l.cls}">${l.text}${score != null ? ` ${score}` : ''}</span>`; };
  const CAT = { speech: 'Speech', face: 'Face', body: 'Body', qa: 'Answers' };
  const scoreChips = (s, kind) => (kind === 'presentation' ? ['speech', 'face', 'body'] : ['speech', 'face', 'body', 'qa']).map((k) => `<span class="chip ${C.label(s[k]).cls}">${CAT[k]} ${s[k] == null ? '—' : s[k]}</span>`).join('');

  // ---------------- Dashboard ----------------
  const sparkline = (series) => {
    if (series.length < 2) return '';
    const w = 84, h = 24, pts = series.map((v, i) => `${(i / (series.length - 1)) * (w - 6) + 3},${h - 3 - (Math.max(0, Math.min(100, v)) / 100) * (h - 6)}`);
    const last = pts[pts.length - 1].split(',');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Recent scores"><polyline points="${pts.join(' ')}" fill="none" stroke="var(--color-secondary-bright)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.8" fill="var(--color-secondary)"/></svg>`;
  };
  const trendHTML = (k) => k.trend == null
    ? '<span class="trend none" title="Trend appears after two scored sessions">Trend: needs 2+ sessions</span>'
    : `<span class="trend ${k.trend}">${k.trend === 'up' ? '▲' : k.trend === 'down' ? '▼' : '◆'} ${k.trend === 'steady' ? 'Steady' : `${k.delta > 0 ? '+' : ''}${k.delta} pts`}</span>`;
  const kpiRow = (k) => `<div class="kpi ${k.key === 'overall' ? 'overall' : ''}"><div class="kpi-name">${esc(k.name)}</div><div class="kpi-val">${k.avg == null ? '—' : k.avg}</div><div class="kpi-side">${trendHTML(k)}${sparkline(k.series)}</div></div>`;

  // Sessions with the same name are grouped; each session shows its own date and time.
  function groupByName(list) {
    const map = new Map();
    for (const s of list) { // list is newest first
      const name = C.sessionName(s).trim(), key = name.toLowerCase();
      if (!map.has(key)) map.set(key, { name, items: [] });
      map.get(key).items.push(s);
    }
    return [...map.values()];
  }
  function sessionsTile(q, kind) {
    const noun = kind === 'presentation' ? 'Presentation' : 'Interview';
    const groups = groupByName(q.list);
    const row = (s) => `<div class="session-row"><div><a href="#/app/summary/${s.id}"><b>${fmtDateTime(s.createdAt)}</b></a><div class="muted small">${fmtDur(s.metrics.duration)}${kind === 'interview' ? ` · ${s.setup.mode === 'practice' ? 'Practice' : 'Mock'}` : ''}${s.completed ? '' : ' · ended early'}</div></div><div class="scores">${scoreChips(s.scores, kind)}</div></div>`;
    const group = (g, n) => { const latest = g.items[0], ov = latest.scores && latest.scores.overall;
      return `<details class="sgroup" ${n === 0 ? 'open' : ''}><summary><span class="sg-name">${esc(g.name)}</span><span class="sg-meta">${g.items.length} session${g.items.length > 1 ? 's' : ''} · latest ${fmtDateTime(latest.createdAt)}</span>${ov != null ? `<span class="chip ${C.label(ov).cls}">Latest ${ov}</span>` : ''}</summary><div class="session-list">${g.items.map(row).join('')}</div></details>`; };
    return `<div class="card"><div class="card-title"><h3>${noun} Sessions</h3>${q.count ? `<span class="muted small">${q.count} · ${fmtDur(q.totalSec)} practiced</span>` : ''}</div>
      ${q.count ? `<div class="sgroups">${groups.slice(0, 5).map(group).join('')}</div>${groups.length > 5 ? '<p class="small muted" style="margin-top:.7rem"><a href="#/app/settings">See all sessions in Profile and Settings</a></p>' : ''}`
      : `<div class="empty"><strong>No ${noun.toLowerCase()} sessions yet</strong>${kind === 'presentation' ? 'Practice a talk and your sessions will be listed here.' : 'Your sessions and scores will appear here after your first run.'}</div>`}</div>`;
  }
  function quickTile(q, kind) {
    const noun = kind === 'presentation' ? 'Presentation' : 'Interview';
    const foot = [];
    if (q.strongest) foot.push(`<div class="hl high"><i></i><div><b>Strongest: ${esc(q.strongest.name)}</b><div class="muted small">Average ${q.strongest.avg}.</div></div></div>`);
    if (q.weakest) foot.push(`<div class="hl low"><i></i><div><b>Focus area: ${esc(q.weakest.name)}</b><div class="muted small">Average ${q.weakest.avg}, your lowest so far.</div></div></div>`);
    if (q.recurring) foot.push(`<div class="hl low"><i></i><div><b>Keeps coming up</b><div class="muted small">${esc(q.recurring.text)}</div></div></div>`);
    return `<div class="card"><div class="card-title"><h3>${noun} Quick Summary</h3>${q.scoredCount ? `<span class="muted small">${q.scoredCount} scored session${q.scoredCount > 1 ? 's' : ''}</span>` : ''}</div>
      ${q.scoredCount ? `<div class="kpis">${q.kpis.map(kpiRow).join('')}</div><p class="small muted" style="margin:.6rem 0 0">Scores are out of 100. Trend compares your latest sessions with the ones before them.</p>${foot.length ? `<div class="hl-list" style="margin-top:1rem">${foot.join('')}</div>` : ''}`
      : `<div class="empty"><strong>Nothing to summarize yet</strong>Finish a ${noun.toLowerCase()} with your camera on to see your scores and how they trend.</div>`}</div>`;
  }

  V.dashboard = async (root) => {
    const profile = C.store.getProfile();
    const sessions = await C.store.listSessions();
    const qi = C.quick(sessions, 'interview'), qp = C.quick(sessions, 'presentation');
    root.innerHTML = `<section class="container page">
      <div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">Welcome back</span><h1 style="font-size:clamp(1.8rem,3.6vw,2.6rem)">${profile.name.trim() ? `${esc(profile.name.trim().split(/\s+/)[0])}'s Dashboard` : 'Your Dashboard'}</h1></div></div>
      <div class="card cta-card"><div class="stack" style="gap:.4rem"><h2 style="font-size:1.5rem">${sessions.length ? 'Ready for another round?' : 'Start your first session'}</h2><p>${sessions.length ? 'Practice makes perfect! Begin a new session.' : 'Practice an interview with Caddie, or rehearse a talk and get feedback you can use right away.'}</p></div><a class="btn btn-lg" href="#/app/setup">Begin session</a></div>
      <div class="dash-cols">
        <div class="stack"><h2 class="col-title">Interviews</h2>${sessionsTile(qi, 'interview')}${quickTile(qi, 'interview')}</div>
        <div class="stack"><h2 class="col-title">Presentations</h2>${sessionsTile(qp, 'presentation')}${quickTile(qp, 'presentation')}</div>
      </div></section>`;
  };

  // ---------------- Setup ----------------
  V.setup = async (root) => {
    const prefs = C.store.getPrefs(), profile = C.store.getProfile(), last = C.store.getLastSetup() || {};
    await C.ai.status();
    const S = { step: 1, agent: last.agent === 'present' ? 'present' : 'interview', title: last.title || '', aiQ: !!(prefs.aiConsent && C.ai.info.available), qSource: 'templates', source: last.source || 'ai', mode: last.mode || prefs.mode,
      jobName: last.jobName || profile.targetRole || '', jd: last.jd || '', custom: last.custom || '', questions: [] };
    const stepsOf = () => (S.agent === 'present' ? ['Choose', 'Presentation'] : ['Choose', 'Details', 'Review']);
    const frame = (inner) => `<section class="container page"><div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">New interview</span><h1 style="font-size:clamp(1.7rem,3.4vw,2.4rem)">Set up your interview</h1></div></div>
      <div class="wizard-steps">${stepsOf().map((n, i) => `<span class="chip ${i + 1 === S.step ? 'current' : ''}">${i + 1}. ${n}</span>`).join('')}</div><div class="card form-card">${inner}</div></section>`;
    const radio = (name, val, cur, title, desc, dis) => `<label class="choice ${dis ? 'disabled' : ''}"><input type="radio" name="${name}" value="${val}" ${cur === val ? 'checked' : ''} ${dis ? 'disabled' : ''}><strong>${title}</strong><span>${desc}</span></label>`;
    const $ = (x) => root.querySelector(x);

    // Turn the details into the question list (Claude if opted in, otherwise built in), without leaving the page.
    async function build(btn) {
      const label = btn.textContent;
      root.querySelectorAll('.actions button').forEach((b) => { b.disabled = true; });
      btn.textContent = S.source === 'ai' && S.aiQ && C.ai.info.available ? 'Writing questions with Claude…' : 'Reading the job description…';
      if (S.source === 'static') {
        S.questions = C.questions.staticList(S.custom.split(/\r?\n/)); S.qSource = 'static';
      } else {
        const role = S.jobName.trim();
        const local = () => C.questions.generate({ jobName: role, jd: S.jd }).questions;
        if (S.aiQ && C.ai.info.available) {
          const list = await C.ai.questions(role, S.jd);
          if (!root.isConnected) return false;
          if (list) { S.questions = C.questions.fromAI(list); S.qSource = 'claude'; } else { S.questions = local(); S.qSource = 'fallback'; }
        } else { S.questions = local(); S.qSource = 'templates'; }
      }
      btn.textContent = label;
      return true;
    }
    function toGreenRoom() {
      C.store.setLastSetup({ agent: 'interview', source: S.source, mode: S.mode, jobName: S.jobName, jd: S.jd, custom: S.custom });
      C.pending = { kind: 'interview', source: S.source, mode: S.mode, jobName: S.jobName.trim(), jd: S.jd, custom: S.custom, questions: S.questions, qSource: S.qSource };
      location.hash = '#/app/interview';
    }

    function panelHTML() {
      if (!S.jd.trim()) return '<p class="small muted">Paste a job description and Caddie will pick out the responsibilities, requirements and skills to build your questions from. Without one, questions come from the job title.</p>';
      const a = C.jd.analyze(S.jd, S.jobName);
      if (a.length < 80) return '<p class="small muted">That is quite short. A full posting gives better questions.</p>';
      const li = (arr) => arr.slice(0, 3).map((x) => `<li>${esc(x.length > 110 ? x.slice(0, 109) + '…' : x)}</li>`).join('');
      return `<div class="row" style="gap:.4rem"><span class="chip ${a.resp.length ? 'good' : 'low'}">${a.resp.length} responsibilit${a.resp.length === 1 ? 'y' : 'ies'}</span><span class="chip ${a.req.length ? 'good' : 'low'}">${a.req.length} requirement${a.req.length === 1 ? '' : 's'}</span>${a.seniority ? `<span class="chip">${esc(a.seniority)} level</span>` : ''}${a.years ? `<span class="chip">${a.years}+ years</span>` : ''}</div>
        ${a.skills.length ? `<div class="row" style="gap:.35rem"><span class="small muted">Skills:</span>${a.skills.map((k) => `<span class="badge petrol">${esc(k)}</span>`).join('')}</div>` : ''}
        ${a.resp.length ? `<div><b class="small">Responsibilities it found</b><ul class="small muted" style="margin:.2rem 0 0;padding-left:1.1rem">${li(a.resp)}</ul></div>` : ''}
        ${a.req.length ? `<div><b class="small">Requirements it found</b><ul class="small muted" style="margin:.2rem 0 0;padding-left:1.1rem">${li(a.req)}</ul></div>` : ''}
        ${!a.structured ? '<div class="callout warn small">Caddie could not find clear responsibilities and requirements sections, so it is using the sentences that look most like duties and qualifications. Headings such as "What you\'ll do" and "What we\'re looking for" help.</div>' : ''}`;
    }

    function render() {
      if (S.step === 1) {
        const interview = S.agent === 'interview';
        root.innerHTML = frame(`<div class="stack" style="gap:1.4rem">
          <div class="field"><span class="label">Practice agent</span><div class="seg">${radio('agent', 'interview', S.agent, 'Interview', 'Caddie asks questions and listens while you answer.')}${radio('agent', 'present', S.agent, 'Practice Presenting', 'Caddie listens to your presentation')}</div></div>
          ${interview ? `<div class="field"><span class="label">Where should the questions come from?</span><div class="seg">${radio('source', 'ai', S.source, 'Dynamic questions', 'Built from the job title and, if you add one, the job description.')}${radio('source', 'static', S.source, 'Static questions', 'You enter the exact questions Caddie asks.')}</div></div>
          <div class="field"><span class="label">Mode</span><div class="seg">${radio('mode', 'practice', S.mode, 'Practice', 'Live cues on the side. You can pause, skip and go back.')}${radio('mode', 'mock', S.mode, 'Mock', 'Like the real thing. No tips or pausing until the summary.')}</div></div>` : ''}
          <div class="actions" style="margin-top:0;justify-content:flex-end"><button class="btn btn-primary" id="next">Next</button></div></div>`);
        root.querySelectorAll('input[name=agent]').forEach((i) => i.addEventListener('change', () => { S.agent = i.value; render(); }));
        root.querySelectorAll('input[name=source]').forEach((i) => i.addEventListener('change', () => { S.source = i.value; }));
        root.querySelectorAll('input[name=mode]').forEach((i) => i.addEventListener('change', () => { S.mode = i.value; }));
        $('#next').addEventListener('click', () => { S.step = 2; render(); });
      } else if (S.step === 2 && S.agent === 'present') {
        root.innerHTML = frame(`<div class="stack">
          <div class="field"><label for="ptitle">Presentation name <span class="req">*</span></label><input type="text" id="ptitle" value="${esc(S.title)}" placeholder="e.g. Q4 results for the leadership team" maxlength="120"><span class="hint">You will see only yourself in the green room. Caddie listens and gives feedback afterward, but does not join or talk.</span></div>
          <div class="actions" style="margin-top:.5rem"><button class="btn btn-ghost" id="back">Back</button><button class="btn btn-primary" id="go" ${S.title.trim() ? '' : 'disabled'}>Go to green room</button></div></div>`);
        const t = $('#ptitle'), go = $('#go');
        t.addEventListener('input', () => { S.title = t.value; go.disabled = !t.value.trim(); });
        t.focus();
        $('#back').addEventListener('click', () => { S.step = 1; render(); });
        const start = () => { if (!S.title.trim()) return; C.store.setLastSetup({ agent: 'present', title: S.title.trim() }); C.pending = { kind: 'presentation', title: S.title.trim() }; location.hash = '#/app/present'; };
        go.addEventListener('click', start);
        t.addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
      } else if (S.step === 2) {
        const buttons = `<div class="actions" style="margin-top:.5rem"><button class="btn btn-ghost" id="back">Back</button><div class="row"><button class="btn btn-ghost" id="preview">Preview questions</button><button class="btn btn-primary" id="go">Go to green room</button></div></div>`;
        root.innerHTML = frame(S.source === 'ai' ? `<div class="stack">
          <div class="field"><label for="job">Job title <span class="req">*</span></label><input type="text" id="job" value="${esc(S.jobName)}" placeholder="e.g. Senior Backend Engineer"></div>
          <div class="field"><label for="jd">Job description (optional)</label><textarea id="jd" style="min-height:190px" placeholder="Paste the whole posting here, including 'What you'll do' and 'What we're looking for'.">${esc(S.jd)}</textarea><span class="hint">Links to job posts cannot be read, so paste the text.</span></div>
          <div class="callout stack" style="gap:.6rem" id="jd-panel" aria-live="polite"><b>What Caddie picked up</b><div class="stack" style="gap:.5rem" id="jd-body">${panelHTML()}</div></div>
          ${C.ai.info.available ? `<div class="callout"><label class="row" style="gap:.5rem;flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" id="ai-q" ${S.aiQ ? 'checked' : ''} style="margin-top:.25rem"><span><b>Use Claude (AI) to write my questions</b> for a deeper read of the posting<br><span class="small">${C.disclosure.questions}</span></span></label></div>` : C.ai.info.offline ? '<div class="callout small">Caddie builds the questions from the job title and description.</div>' : '<div class="callout small">Questions are built by Caddie from the job title and description. For a deeper read by Claude, add an Anthropic key in <a href="#/app/settings">Settings</a>.</div>'}
          <p class="small muted">Caddie always opens with "Walk me through your resume", then asks the 3 or 4 questions most relevant to the role.</p>
          <div class="error-text" id="err" role="alert"></div>${buttons}</div>`
          : `<div class="stack">
          <div class="field"><label for="qs">Your questions <span class="req">*</span></label><textarea id="qs" style="min-height:200px" placeholder="One question per line">${esc(S.custom)}</textarea><span class="hint">One per line. Caddie always opens with "Walk me through your resume", then asks yours in order.</span></div>
          <div class="field"><label for="jobc">Job title (optional)</label><input type="text" id="jobc" value="${esc(S.jobName)}"></div>
          ${buttons}</div>`);
        const preview = $('#preview'), go = $('#go');
        const ready = () => { const ok = S.source === 'ai' ? !!S.jobName.trim() : !!S.custom.trim(); preview.disabled = go.disabled = !ok; };
        $('#back').addEventListener('click', () => { S.step = 1; render(); });
        if (S.source === 'ai') {
          const job = $('#job'), jd = $('#jd'); let t;
          job.addEventListener('input', () => { S.jobName = job.value; ready(); });
          jd.addEventListener('input', () => { S.jd = jd.value; clearTimeout(t); t = setTimeout(() => { const el = $('#jd-body'); if (el) el.innerHTML = panelHTML(); }, 250); });
          const aiq = $('#ai-q');
          if (aiq) aiq.addEventListener('change', () => { S.aiQ = aiq.checked; C.store.setPrefs({ ...C.store.getPrefs(), aiConsent: aiq.checked }); });
        } else {
          const qs = $('#qs'), jc = $('#jobc');
          qs.addEventListener('input', () => { S.custom = qs.value; ready(); });
          jc.addEventListener('input', () => { S.jobName = jc.value; });
        }
        ready();
        preview.addEventListener('click', async () => { if (await build(preview)) { S.step = 3; render(); } });
        go.addEventListener('click', async () => { if (await build(go)) toGreenRoom(); });
      } else {
        const list = () => S.questions.map((q, i) => `<li style="padding:.6rem 0;border-top:1px solid var(--border-default)"><div style="display:grid;grid-template-columns:1fr auto;gap:.5rem;align-items:start"><div><span>${esc(q.text)}</span>${q.why ? `<div class="small muted" style="margin-top:.15rem">${esc(q.why)}</div>` : ''}</div>${q.kind === 'opener' ? '<span class="chip">Always first</span>' : `<button class="btn btn-ghost btn-sm" data-rm="${i}" aria-label="Remove question ${i + 1}">Remove</button>`}</div></li>`).join('');
        root.innerHTML = frame(`<div class="stack"><p class="muted">${S.questions.length} question${S.questions.length === 1 ? '' : 's'} for <b>${esc(S.jobName || 'your interview')}</b>${S.source === 'ai' ? ', chosen as the most relevant to the role and posting' : ''}. Caddie asks them in this order.</p>
          ${S.qSource === 'claude' ? '<div class="callout">These questions were written by Claude, an AI from Anthropic.</div>' : S.qSource === 'fallback' ? '<div class="callout warn">Claude could not be reached, so Caddie chose these itself.</div>' : ''}
          <ol id="qlist" style="margin:0;padding-left:1.2rem">${list()}</ol>
          <div class="actions" style="margin-top:.5rem"><button class="btn btn-ghost" id="back">Back</button><button class="btn btn-primary btn-lg" id="go" ${S.questions.length ? '' : 'disabled'}>Go to green room</button></div></div>`);
        $('#back').addEventListener('click', () => { S.step = 2; render(); });
        $('#qlist').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (!b) return; S.questions.splice(+b.dataset.rm, 1); render(); });
        $('#go').addEventListener('click', toGreenRoom);
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
    const caps = m.capabilities, pres = C.sessionKind(s) === 'presentation';
    const pq = m.perQuestion[0] || {};
    const transcriptCard = `<div class="card"><div class="card-title"><h3>Transcript</h3><span class="muted small">${pq.words || 0} words${pq.wpm ? ` · ${pq.wpm} wpm` : ''}${pq.eyePct != null ? ` · eye contact ${pq.eyePct}%` : ''}</span></div>${pq.answer ? `<blockquote style="margin:0;padding:.6rem .9rem;background:var(--color-cloud);border-left:3px solid var(--color-secondary-bright);border-radius:0 8px 8px 0;color:var(--text-muted);font-size:.94rem">${esc(pq.answer)}</blockquote>` : `<p class="muted">${caps.speech ? 'No speech was captured.' : 'No transcript. This browser has no speech recognition. Chrome or Edge work best.'}</p>`}</div>`;
    const qaCard = `<div class="card"><div class="card-title"><h3>Questions and answers</h3>${chip(sc.qa)}</div>${m.perQuestion.map((q, i) => `<div class="qa"><div class="row" style="justify-content:space-between"><b>${i + 1}. ${esc(q.text)}</b>${q.asked ? `<span class="muted small">${q.speakSec}s speaking${q.wpm ? ` · ${q.wpm} wpm` : ''}${q.eyePct != null ? ` · eye contact ${q.eyePct}%` : ''}</span>` : '<span class="chip na">Not asked</span>'}</div>${q.asked ? (C.qaParts(q).map((p) => `<blockquote>${p.who === 'caddie' ? '<b>Caddie (AI follow-up):</b> ' : ''}${esc(p.text)}</blockquote>`).join('') || `<blockquote>${caps.speech ? 'No speech was captured for this answer.' : 'No transcript. This browser has no speech recognition.'}</blockquote>`) : ''}</div>`).join('')}</div></div>`;
    const actionsCard = `<div class="card"><div class="card-title"><h3>Action items</h3></div><ol class="actions-list">${s.actions.length ? s.actions.map((a) => `<li>${esc(a.text)}</li>`).join('') : '<li>Not enough data was captured to suggest changes.</li>'}</ol></div>`;
    const nextCard = `<div class="card"><h3 style="margin-bottom:.6rem">What next?</h3><div class="stack" style="gap:.6rem"><button class="btn btn-primary" id="retry">Retry session</button><div id="retry-opts" class="row" hidden><button class="btn btn-ghost btn-sm" id="retry-same">${pres ? 'Same presentation' : 'Same questions'}</button><button class="btn btn-ghost btn-sm" id="retry-change">Change setup</button></div><a class="btn btn-ghost" href="#/app/setup">New session</a><a class="btn btn-ghost" href="#/app">End session</a></div></div>`;
    const note = '<p class="small muted">Scores are practice indicators from on-device analysis, not predictions of hiring or audience outcomes.</p>';
    const recCard = `<div class="card"><div class="card-title"><h3>Recording</h3><span class="muted small">${fmtDur(m.duration)}</span></div>${s.hasRecording ? '<video id="rec-video" class="rec-video" controls playsinline preload="metadata"></video><p class="small muted" id="rec-note" style="margin:.5rem 0 0"></p>' : '<div class="empty"><strong>No recording saved</strong>This session was not recorded, or the recording is not available in this browser.</div>'}</div>`;
    root.innerHTML = `<section class="container page">
      <div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">${pres ? 'Presentation summary' : 'Summary'}</span><h1 style="font-size:clamp(1.7rem,3.4vw,2.4rem)">${esc(C.sessionName(s))}</h1>
        <div class="muted">${fmtDateTime(s.createdAt)} · ${fmtDur(m.duration)}${pres ? '' : ` · ${s.setup.mode === 'practice' ? 'Practice' : 'Mock'} mode`}${s.completed ? '' : ' · ended early'}</div>
        ${s.ai && (s.ai.qSource === 'claude' || s.ai.followUps) ? `<div class="row" style="gap:.4rem">${s.ai.qSource === 'claude' ? '<span class="badge">Questions written by Claude (AI)</span>' : ''}${s.ai.followUps ? `<span class="badge">${s.ai.followUps} AI follow-up${s.ai.followUps > 1 ? 's' : ''}</span>` : ''}</div>` : ''}</div>
        <div class="row"><button class="btn btn-ghost" id="dl-sum">Download summary</button><button class="btn btn-ghost" id="dl-rec" ${s.hasRecording ? '' : 'disabled'}>Download recording</button><button class="btn btn-ghost" id="dl-tr">Download transcript</button></div></div>
      ${!caps.speech || !caps.vision ? `<div class="callout warn" style="margin-bottom:1rem">${[!caps.speech ? 'Speech measures need speech recognition, which this browser did not provide. Chrome or Edge work best.' : '', caps.camera && !caps.vision ? 'Face and posture analysis could not load.' : '', !caps.camera ? 'No camera was used, so face and posture were not measured.' : ''].filter(Boolean).join(' ')}</div>` : ''}
      <div class="score-grid">
        ${card('Speech style', 'speech', d.speech)}${card('Facial expression', 'face', d.face, 'Eye contact drives this score. Smiling and expressiveness are shown for information.')}${card('Body language', 'body', d.body)}</div>
      ${pres ? `<div class="rec-grid">${recCard}${transcriptCard}</div>
      <div class="dash-grid"><div class="stack">${actionsCard}</div><div class="stack">${nextCard}${note}</div></div>`
      : `<div class="dash-grid"><div class="stack">${qaCard}</div><div class="stack">${actionsCard}${nextCard}${note}</div></div>`}</section>`;
    const $ = (x) => root.querySelector(x), stamp = new Date(s.createdAt).toISOString().slice(0, 10);
    $('#dl-sum').addEventListener('click', () => C.util.download(`caddie-summary-${stamp}.html`, new Blob([C.reportHTML(s)], { type: 'text/html' })));
    $('#dl-tr').addEventListener('click', () => C.util.download(`caddie-transcript-${stamp}.txt`, new Blob([C.transcriptText(s)], { type: 'text/plain' })));
    $('#dl-rec').addEventListener('click', async () => { const b = await C.store.getRecording(s.id); if (!b) return C.util.toast('The recording is not available in this browser.'); C.util.download(`caddie-recording-${stamp}.${/mp4/.test(b.type) ? 'mp4' : 'webm'}`, b); });
    let recUrl = null;
    if (pres && s.hasRecording) {
      const video = $('#rec-video');
      C.store.getRecording(s.id).then((blob) => {
        if (!blob || !video.isConnected) { const n = $('#rec-note'); if (n) n.textContent = 'The recording is not available in this browser.'; return; }
        recUrl = URL.createObjectURL(blob); video.src = recUrl;
        // Browser recordings often report an unknown length; seeking to the end once makes the scrub bar work.
        video.addEventListener('loadedmetadata', () => { if (video.duration === Infinity) { video.currentTime = 1e101; video.addEventListener('timeupdate', function f() { video.removeEventListener('timeupdate', f); video.currentTime = 0; }); } });
      });
    }
    $('#retry').addEventListener('click', () => { $('#retry-opts').hidden = false; });
    $('#retry-same').addEventListener('click', () => { C.pending = { ...s.setup }; location.hash = pres ? '#/app/present' : '#/app/interview'; });
    $('#retry-change').addEventListener('click', () => { C.store.setLastSetup(pres ? { agent: 'present', title: s.setup.title } : { source: s.setup.source, mode: s.setup.mode, jobName: s.setup.jobName, jd: s.setup.jd, custom: s.setup.custom, withOpener: s.setup.withOpener }); location.hash = '#/app/setup'; });
    return { destroy() { if (recUrl) URL.revokeObjectURL(recUrl); } };
  };

  // ---------------- Settings ----------------
  V.settings = async (root) => {
    const profile = C.store.getProfile(), prefs = C.store.getPrefs();
    const sessions = await C.store.listSessions();
    const ai = await C.ai.status();
    let voices = [];
    const voicesP = C.voice.list();
    root.innerHTML = `<section class="container page"><div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">Profile and Settings</span><h1 style="font-size:clamp(1.8rem,3.6vw,2.6rem)">Your profile</h1></div></div>
      <div class="dash-grid"><div class="stack">
        <form class="card stack" id="f-profile"><h3>Profile</h3>
          <div class="field"><label for="p-name">Name</label><input type="text" id="p-name" value="${esc(profile.name)}"></div>
          <div class="field"><label for="p-email">Email</label><input type="email" id="p-email" value="${esc(profile.email)}"></div>
          <div class="field"><label for="p-role">Target role</label><input type="text" id="p-role" value="${esc(profile.targetRole)}" placeholder="Used to pre-fill new interviews"></div>
          <div class="field"><label for="p-mode">Default mode</label><select id="p-mode"><option value="practice" ${prefs.mode === 'practice' ? 'selected' : ''}>Practice</option><option value="mock" ${prefs.mode === 'mock' ? 'selected' : ''}>Mock</option></select></div>
          <div class="field"><label for="p-sil">Seconds of silence before Caddie moves on</label><input type="number" id="p-sil" min="3" max="15" value="${prefs.silenceSec}"></div>
          <div class="field"><label for="p-grace">Extra seconds to start your answer</label><input type="number" id="p-grace" min="0" max="30" value="${prefs.graceSec || 0}"><span class="hint">Added to the silence window only before you say your first word. 0 keeps it the same throughout.</span></div>
          <div class="field"><label for="p-voice">Caddie's voice</label><select id="p-voice"><option value="">Loading voices…</option></select><span class="hint">Voices come from your browser and device. Leave as is for the best available one.</span></div>
          <div class="field"><label for="p-speed">Speaking speed: <span id="p-speed-v">${(+prefs.voiceSpeed || 1).toFixed(2)}x</span></label><input type="range" id="p-speed" min="0.85" max="1.15" step="0.05" value="${+prefs.voiceSpeed || 1}"></div>
          <div class="row"><button class="btn btn-primary" type="submit">Save</button><button class="btn btn-ghost" type="button" id="p-test">Hear voice</button><span class="small muted" id="p-msg" role="status"></span></div></form>
        <div class="card"><div class="card-title"><h3>Session logs</h3><span class="muted small">${sessions.length} saved on this device</span></div>
          ${sessions.length ? `<div class="scroll-x"><table class="logs"><thead><tr><th>Date</th><th>Session</th><th>Scores</th><th>Files</th><th></th></tr></thead><tbody>${sessions.map((s) => `<tr><td>${fmtDateTime(s.createdAt)}<br><span class="muted small">${fmtDur(s.metrics.duration)}</span></td><td>${esc(C.sessionName(s))}<br><span class="muted small">${C.sessionKind(s) === 'presentation' ? 'Presentation' : `Interview · ${s.setup.mode === 'practice' ? 'Practice' : 'Mock'}`}</span></td><td>${scoreChips(s.scores, C.sessionKind(s))}</td>
            <td><a href="#/app/summary/${s.id}">Summary</a><br><a href="#" data-rec="${s.id}" ${s.hasRecording ? '' : 'hidden'}>Recording</a><br><a href="#" data-tr="${s.id}">Transcript</a></td><td><button class="btn btn-ghost btn-sm" data-del="${s.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><strong>No sessions yet</strong>Completed interviews are listed here with their summary, recording and transcript.</div>'}</div></div>
      <div class="stack"><div class="card"><h3 style="margin-bottom:.6rem">Credits and subscription</h3><dl class="kv"><dt>Plan</dt><dd>Preview (free)</dd><dt>Sessions used</dt><dd>${sessions.length}</dd><dt>Limit</dt><dd>None</dd></dl><p class="small muted" style="margin-top:.7rem">Paid plans are not available yet. See <a href="#/plans">Plans</a>.</p></div>
        <div class="card stack" id="ai-card"><h3>AI features</h3>
          ${ai.offline ? '<p class="small muted">AI features need the Caddie server on your computer (<code>npm start</code>). They are not available here.</p>'
            : ai.available ? `<p class="small"><span class="chip good">On</span> ${ai.source === 'test' ? 'Test mode: canned responses, no key used.' : ai.source === 'environment' ? 'Using the key from your ANTHROPIC_API_KEY setting.' : `A key ending in <b>${esc(ai.last4)}</b> is saved on this computer.`}</p>
              <label class="row" style="gap:.5rem;flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" id="ai-default" ${prefs.aiConsent ? 'checked' : ''} style="margin-top:.25rem"><span>Turn AI questions and follow-ups on by default</span></label>
              ${ai.source === 'saved' ? '<div><button class="btn btn-ghost btn-sm" id="ai-remove">Remove key</button></div>' : ''}`
            : `<p class="small muted">To let Claude write questions and follow-ups, paste an Anthropic API key. It is saved in a private file on this computer and is never sent to your browser. <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener">Get a key</a></p>
              <form class="stack" id="f-key" style="gap:.6rem"><div class="field"><label for="ai-key">Anthropic API key</label><input type="password" id="ai-key" autocomplete="off" placeholder="sk-ant-..."></div><div class="error-text" id="ai-err" role="alert"></div><div><button class="btn btn-primary btn-sm" type="submit">Save key</button></div></form>`}
          <p class="small muted">${C.disclosure.general}</p></div>
        <div class="card stack"><h3>Payment details</h3><div class="field"><label for="pay">Card</label><input type="text" id="pay" disabled placeholder="Not needed during the preview"></div></div>
        <div class="card stack"><h3>Your data</h3><p class="small muted">Everything is stored in this browser only. Clearing site data removes it.</p><button class="btn btn-ghost" id="wipe">Delete all sessions</button><div id="wipe-c" class="row" hidden><span class="small">Delete ${sessions.length} sessions and recordings?</span><button class="btn btn-danger btn-sm" id="wipe-y">Delete</button><button class="btn btn-ghost btn-sm" id="wipe-n">Cancel</button></div></div></div></div></section>`;
    const $ = (x) => root.querySelector(x);
    $('#f-profile').addEventListener('submit', (e) => {
      e.preventDefault();
      C.store.setProfile({ name: $('#p-name').value.trim(), email: $('#p-email').value.trim(), targetRole: $('#p-role').value.trim() });
      C.store.setPrefs({ ...C.store.getPrefs(), mode: $('#p-mode').value, silenceSec: Math.max(3, Math.min(15, +$('#p-sil').value || 5)), graceSec: Math.max(0, Math.min(30, +$('#p-grace').value || 0)), voiceURI: $('#p-voice').value, voiceSpeed: +$('#p-speed').value || 1 });
      $('#p-msg').textContent = 'Saved.'; setTimeout(() => { const m = $('#p-msg'); if (m) m.textContent = ''; }, 2500);
    });
    voicesP.then((list) => {
      voices = list; const sel = $('#p-voice'); if (!sel) return;
      sel.innerHTML = list.length ? list.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === prefs.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('') : '<option value="">No voices available in this browser</option>';
    });
    $('#p-speed').addEventListener('input', () => { $('#p-speed-v').textContent = `${(+$('#p-speed').value).toFixed(2)}x`; });
    $('#p-test').addEventListener('click', async () => {
      C.voice.cancel(); C.voice.configure({ speed: +$('#p-speed').value });
      const v = voices.find((x) => x.voiceURI === $('#p-voice').value) || voices[0] || null;
      await C.voice.speak("Hi, I'm Caddie. Thanks for joining me today. Let's start with your background.", v, null);
    });
    root.addEventListener('click', async (e) => {
      const rec = e.target.closest('[data-rec]'), tr = e.target.closest('[data-tr]'), del = e.target.closest('[data-del]');
      if (rec) { e.preventDefault(); const b = await C.store.getRecording(rec.dataset.rec); if (b) C.util.download(`caddie-recording.${/mp4/.test(b.type) ? 'mp4' : 'webm'}`, b); }
      if (tr) { e.preventDefault(); const s = await C.store.getSession(tr.dataset.tr); if (s) C.util.download('caddie-transcript.txt', new Blob([C.transcriptText(s)], { type: 'text/plain' })); }
      if (del) { if (del.dataset.armed) { await C.store.deleteSession(del.dataset.del); V.settings(root); } else { del.dataset.armed = '1'; del.textContent = 'Confirm?'; del.classList.replace('btn-ghost', 'btn-danger'); } }
    });
    const fk = $('#f-key');
    if (fk) fk.addEventListener('submit', async (e) => {
      e.preventDefault(); const btn = fk.querySelector('button'); btn.disabled = true; btn.textContent = 'Checking…'; $('#ai-err').textContent = '';
      try { await C.ai.saveKey($('#ai-key').value); V.settings(root); } catch (err) { $('#ai-err').textContent = err.message; btn.disabled = false; btn.textContent = 'Save key'; }
    });
    const rm = $('#ai-remove'); if (rm) rm.addEventListener('click', async () => { await C.ai.removeKey(); V.settings(root); });
    const ad = $('#ai-default'); if (ad) ad.addEventListener('change', () => C.store.setPrefs({ ...C.store.getPrefs(), aiConsent: ad.checked }));
    $('#wipe').addEventListener('click', () => { $('#wipe-c').hidden = false; });
    $('#wipe-n').addEventListener('click', () => { $('#wipe-c').hidden = true; });
    $('#wipe-y').addEventListener('click', async () => { for (const s of sessions) await C.store.deleteSession(s.id); V.settings(root); });
  };
  void uid;
})(window.Caddie);
