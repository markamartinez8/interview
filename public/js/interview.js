// Green room and live interview room.
(function (C) {
  const { esc, fmtDur, uid } = C.util;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const statusChip = (text, cls) => `<span class="chip ${cls}">${esc(text)}</span>`;

  C.views.interview = function (root) {
    const setup = C.pending;
    if (!setup) { location.hash = '#/app/setup'; return {}; }
    const prefs = C.store.getPrefs();
    const questions = setup.questions;
    const S = { run: 0, stream: null, hasVideo: false, textOnly: false, analyzer: null, avatar: null, voice: null, paused: false, nav: null,
      qi: -1, speaking: false, useFollowups: false, followUps: 0, asked: new Set(), recorder: null, chunks: [], t0: 0, pauseStart: 0, pausedMs: 0, finishing: false, started: false, timers: [] };
    const $ = (s) => root.querySelector(s);
    const every = (fn, ms) => { const t = setInterval(fn, ms); S.timers.push(t); return t; };

    // ---------------- green room ----------------
    root.innerHTML = `<section class="container page">
      <div class="page-head"><div class="stack" style="gap:.4rem"><span class="eyebrow">Green room</span><h1 style="font-size:clamp(1.7rem,3.4vw,2.4rem)">Check your camera and mic</h1></div></div>
      <div class="prep-grid">
        <div class="card"><div class="preview"><video id="pv" autoplay muted playsinline></video><div class="overlay-msg" id="pv-msg">Asking for camera and microphone…</div></div>
          <div style="margin-top:1rem"><div class="row" style="justify-content:space-between"><span class="label">Microphone level</span><span class="small muted" id="mic-note">Say something to test</span></div><div class="meter"><div id="mic-meter"></div></div></div></div>
        <div class="stack">
          <div class="card"><h3 style="margin-bottom:.7rem">Your session</h3><dl class="kv">
            ${setup.applicantName ? `<dt>Applicant</dt><dd>${esc(setup.applicantName)}</dd>` : ''}<dt>Role</dt><dd>${esc(setup.jobName || 'Custom questions')}</dd><dt>Mode</dt><dd>${setup.mode === 'practice' ? 'Practice (live tips, pause and skip)' : 'Mock (tips after the interview)'}</dd>
            <dt>Questions</dt><dd>${questions.length}</dd>${setup.cameraRequired ? '<dt>Camera</dt><dd>Required</dd>' : ''}${setup.minutesPerQuestion ? `<dt>Time per question</dt><dd>${setup.minutesPerQuestion} min</dd>` : ''}<dt>Caddie moves on after</dt><dd>${prefs.silenceSec} seconds of silence</dd></dl></div>
          <div class="card"><h3 style="margin-bottom:.7rem">Ready check</h3><ul class="checklist">
            <li><span>Camera</span><span id="ck-cam">${statusChip('Waiting', 'na')}</span></li><li><span>Microphone</span><span id="ck-mic">${statusChip('Waiting', 'na')}</span></li>
            <li><span>Caddie's voice</span><span id="ck-voice">${statusChip('Loading', 'na')}</span></li><li><span>Face and posture analysis</span><span id="ck-vis">${statusChip('Waiting', 'na')}</span></li>
            <li><span>Speech transcript</span><span id="ck-sr">${statusChip(window.SpeechRecognition || window.webkitSpeechRecognition ? 'Supported' : 'Not in this browser', window.SpeechRecognition || window.webkitSpeechRecognition ? 'good' : 'low')}</span></li></ul></div>
          <div class="card stack" id="ai-card" hidden></div>
          <div class="card stack"><p class="small muted">Your video is recorded on this device only so you can review it afterward. Nothing is uploaded.</p><div id="prep-err" class="error-text" role="alert"></div>
            <div class="row"><button class="btn btn-primary btn-lg" id="join" disabled>Join interview</button><button class="btn btn-ghost" id="retry" hidden>Try again</button><button class="btn btn-ghost" id="textonly" hidden>Continue with typed answers</button><a class="btn btn-ghost" href="#/app/setup">Back to setup</a></div></div>
        </div></div></section>`;

    const set = (id, text, cls) => { const el = $(id); if (el) el.innerHTML = statusChip(text, cls); };
    async function requestMedia() {
      $('#prep-err').textContent = ''; $('#retry').hidden = true; $('#textonly').hidden = true;
      const md = navigator.mediaDevices;
      if (!md || !md.getUserMedia) return mediaFailed('This browser cannot access a camera or microphone (or the page is not on localhost or https).');
      const audio = { echoCancellation: true, noiseSuppression: true };
      let stream = null, video = true;
      try { stream = await md.getUserMedia({ video: { facingMode: 'user' }, audio }); } catch (e) {
        if (e.name === 'NotAllowedError' || e.name === 'SecurityError') return mediaFailed('Camera and microphone access was blocked. Allow access in your browser address bar and try again. Some embedded previews block it; use the full app.');
        try { stream = await md.getUserMedia({ audio }); video = false; } catch (e2) { return mediaFailed(e2.name === 'NotFoundError' ? 'No microphone was found. Connect one and try again.' : 'Could not start the microphone.'); }
      }
      if (setup.cameraRequired && !(video && stream.getVideoTracks().length)) { stream.getTracks().forEach((t) => t.stop()); return mediaFailed('This interview requires a camera. Connect one, allow access, and try again.'); }
      S.stream = stream; S.hasVideo = video && stream.getVideoTracks().length > 0;
      const pv = $('#pv'); pv.srcObject = stream;
      $('#pv-msg').hidden = S.hasVideo; if (!S.hasVideo) $('#pv-msg').textContent = 'No camera found. You can still practice with audio.';
      set('#ck-cam', S.hasVideo ? 'On' : 'Not found', S.hasVideo ? 'good' : 'ok'); set('#ck-mic', 'On', 'good');
      S.analyzer = new C.Analyzer({ stream, video: pv, hasVideo: S.hasVideo });
      await S.analyzer.init();
      every(() => {
        const a = S.analyzer; if (!a || !$('#mic-meter')) return;
        $('#mic-meter').style.width = `${Math.min(100, a.rms * 400)}%`;
        $('#mic-note').textContent = a.rms > a.threshold ? 'Hearing you' : 'Say something to test';
        const vs = a.visionState;
        if (vs === 'ready') set('#ck-vis', a.vision.pose ? 'Ready' : 'Face only', 'good'); else if (vs === 'loading') set('#ck-vis', 'Loading…', 'ok');
        else if (vs === 'unavailable') set('#ck-vis', 'Unavailable', 'low'); else if (vs === 'nocamera') set('#ck-vis', 'Needs camera', 'na');
      }, 150);
      S.mediaOk = true; updateJoin();
    }
    function mediaFailed(msg) { $('#prep-err').textContent = msg; $('#retry').hidden = false; $('#textonly').hidden = !!setup.cameraRequired; set('#ck-cam', 'Off', 'low'); set('#ck-mic', 'Off', 'low'); $('#pv-msg').textContent = 'Camera and microphone are off.'; }
    $('#retry').addEventListener('click', requestMedia);
    $('#textonly').addEventListener('click', () => { S.textOnly = true; $('#prep-err').textContent = ''; $('#retry').hidden = true; $('#textonly').hidden = true; set('#ck-cam', 'Skipped', 'ok'); set('#ck-mic', 'Typing instead', 'ok'); set('#ck-vis', 'Needs camera', 'na'); S.mediaOk = true; updateJoin(); });
    const updateJoin = () => { const j = $('#join'); if (j) j.disabled = !S.mediaOk; };
    C.voice.configure({ speed: prefs.voiceSpeed });
    C.voice.choose(prefs.voiceURI).then((v) => { S.voice = v; set('#ck-voice', v ? v.name.replace(/^Microsoft |^Google /, '') : 'Captions only', v ? 'good' : 'ok'); });
    C.ai.status().then((info) => {
      const card = $('#ai-card'); if (!card || setup.source !== 'ai') return;
      card.hidden = false;
      if (info.available) {
        card.innerHTML = `<label class="row" style="gap:.5rem;flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" id="ai-fu" ${C.store.getPrefs().aiConsent ? 'checked' : ''} style="margin-top:.25rem"><span><b>Let Caddie ask AI follow-up questions</b><br><span class="small muted">${C.disclosure.followups}</span></span></label>`;
        $('#ai-fu').addEventListener('change', (e) => C.store.setPrefs({ ...C.store.getPrefs(), aiConsent: e.target.checked }));
      } else if (info.offline) card.hidden = true;
      else card.innerHTML = '<p class="small muted"><b>AI follow-ups are off.</b> Caddie will ask only the questions on your list. To turn them on, add an Anthropic key in <a href="#/app/settings">Settings</a>.</p>';
    });
    requestMedia();
    $('#join').addEventListener('click', () => { if (S.started || S.cancelCd) return; $('#join').disabled = true; S.cancelCd = C.util.countdown(3, () => { S.cancelCd = null; enterRoom(); }, () => { S.cancelCd = null; updateJoin(); }); });

    // ---------------- live room ----------------
    function enterRoom() {
      S.started = true;
      const fu = $('#ai-fu'); S.useFollowups = !!(fu && fu.checked && setup.source === 'ai');
      const practice = setup.mode === 'practice';
      every(() => {}, 1000);
      const prevStream = S.stream;
      root.innerHTML = `<section class="container page"><div class="room">
        <div class="room-top"><div class="row"><span class="badge">${esc(setup.jobName || 'Custom questions')}</span><span class="badge">${practice ? 'Practice' : 'Mock'}</span><span class="small" id="progress">Getting started</span><span class="small" id="qtime" aria-live="off"></span></div>
          <div class="row"><span class="small" id="timer">0:00</span><span class="rec" id="rec" ${S.stream ? '' : 'hidden'}>REC</span></div></div>
        <div class="room-main"><div>
          <div class="tiles"><div class="tile caddie"><svg id="caddie" role="img" aria-label="Caddie, your interviewer"></svg><span class="tag">Caddie · AI interviewer</span></div>
            <div class="tile"><video id="me" autoplay muted playsinline></video><div class="novideo" id="novid" hidden>${S.textOnly ? 'Camera and mic are off. Type your answers in the chat.' : 'No camera. Audio only.'}</div><span class="tag">You</span></div></div>
          <p class="caption" id="caption" aria-live="polite"></p><div class="silence" aria-hidden="true"><div id="silbar"></div></div><div class="status-line" id="status"></div>
          <div class="controls">
            ${practice ? `<button class="ctl" id="c-back">⏮ Back</button><button class="ctl" id="c-pause">⏸ Pause</button><button class="ctl" id="c-fwd">⏭ Skip</button>` : ''}
            <button class="ctl" id="c-repeat">↺ Repeat question</button>
            ${S.textOnly ? '<button class="ctl active" id="c-next">Next question →</button>' : '<button class="ctl active" id="c-done">✓ I\'m done answering</button>'}
            <button class="ctl end" id="c-end">End interview</button></div>
          <div class="row" id="end-confirm" hidden style="justify-content:center;margin-top:.7rem"><span class="small">End now and see your summary?</span><button class="ctl end" id="end-yes">Yes, end</button><button class="ctl" id="end-no">Keep going</button></div>
        </div>
        <aside class="side"><div class="side-tabs" role="tablist">${practice ? '<button role="tab" id="tab-cues" aria-selected="true">Live cues</button>' : ''}<button role="tab" id="tab-chat" aria-selected="${practice ? 'false' : 'true'}">Chat</button></div>
          <div class="side-body" id="panel-cues" ${practice ? '' : 'hidden'}><div class="nudge" id="nudge">Cues appear while you answer.</div><div id="cue-rows" class="stack" style="gap:.5rem"></div>
            <p class="small" style="color:#AEB3C7">Cues are estimates from your camera and mic, measured on this device.</p></div>
          <div class="side-body" id="panel-chat" ${practice ? 'hidden' : ''} style="padding:0"><div class="side-body chat-log" id="chat-log"></div>
            <form class="chat-form" id="chat-form"><input type="text" id="chat-in" placeholder="${S.textOnly ? 'Type your answer' : 'Type a note or an answer'}" autocomplete="off" aria-label="Chat message"><button class="btn btn-primary btn-sm" type="submit">Send</button></form></div>
        </aside></div></div></section>`;
      const me = $('#me');
      if (S.stream) { me.srcObject = S.stream; if (S.analyzer) S.analyzer.video = me; } $('#novid').hidden = S.hasVideo;
      S.avatar = new C.Avatar($('#caddie'));
      every(() => { const a = S.analyzer; if (!a || !S.avatar) return; S.avatar.setListening(!!a.answering && !S.paused); S.avatar.setUserSpeaking(!!a.answering && a.voiceOn && !S.paused); S.avatar.setGaze(a.facePos); }, 150);
      every(() => { const t = $('#timer'); if (t) t.textContent = fmtDur(elapsed()); }, 500);
      if (!S.analyzer && S.textOnly) S.analyzer = new C.Analyzer({ stream: null, video: null, hasVideo: false });
      if (S.analyzer) S.analyzer.start();
      startRecording();
      S.t0 = performance.now();
      wireControls(practice);
      if (practice) every(updateCues, 1000);
      runInterview(++S.run, practice);
      void prevStream;
    }
    const elapsed = () => (performance.now() - S.t0 - S.pausedMs - (S.paused ? performance.now() - S.pauseStart : 0)) / 1000;

    function startRecording() {
      if (!S.stream || !window.MediaRecorder) return;
      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
      try { S.recorder = new MediaRecorder(S.stream, mime ? { mimeType: mime } : undefined); } catch { $('#rec').hidden = true; return; }
      S.recorder.ondataavailable = (e) => { if (e.data && e.data.size) S.chunks.push(e.data); };
      S.recorder.start(1000);
    }

    function wireControls(practice) {
      const nav = (v) => { S.nav = v; C.voice.cancel(); };
      $('#c-repeat').addEventListener('click', () => nav('repeat'));
      if (practice) {
        $('#c-back').addEventListener('click', () => nav('back'));
        $('#c-fwd').addEventListener('click', () => nav('next'));
        $('#c-pause').addEventListener('click', () => {
          S.paused = !S.paused;
          const b = $('#c-pause'); b.textContent = S.paused ? '▶ Play' : '⏸ Pause'; b.classList.toggle('active', S.paused);
          $('#rec').classList.toggle('paused', S.paused);
          if (S.paused) { S.pauseStart = performance.now(); if (S.speaking) nav('repeat'); try { S.recorder && S.recorder.state === 'recording' && S.recorder.pause(); } catch { /* ignore */ } $('#status').textContent = 'Paused. Press Play when you are ready.'; }
          else { S.pausedMs += performance.now() - S.pauseStart; try { S.recorder && S.recorder.state === 'paused' && S.recorder.resume(); } catch { /* ignore */ } }
          S.analyzer && S.analyzer.setPaused(S.paused);
        });
      }
      // "I'm done" ends the answer (an AI follow-up may still follow); Skip moves on without one.
      const nx = $('#c-next') || $('#c-done'); if (nx) nx.addEventListener('click', () => { S.done = true; });
      $('#c-end').addEventListener('click', () => { $('#end-confirm').hidden = false; });
      $('#end-no').addEventListener('click', () => { $('#end-confirm').hidden = true; });
      $('#end-yes').addEventListener('click', () => { S.nav = 'end'; C.voice.cancel(); S.paused = false; });
      const tc = $('#tab-cues'), th = $('#tab-chat');
      const tab = (cues) => { if (tc) { tc.setAttribute('aria-selected', cues); $('#panel-cues').hidden = !cues; } th.setAttribute('aria-selected', !cues); $('#panel-chat').hidden = cues; };
      if (tc) tc.addEventListener('click', () => tab(true)); th.addEventListener('click', () => tab(false));
      $('#chat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = $('#chat-in'), text = inp.value.trim(); if (!text) return; inp.value = '';
        addMsg('me', text);
        if (/\b(repeat|again|say that)\b/i.test(text) && text.length < 60) { addMsg('caddie', 'Of course, I will ask it again.'); nav('repeat'); return; }
        if (S.analyzer && S.qi >= 0) { S.analyzer.selectQuestion(S.qi); S.analyzer.addTyped(text); }
      });
    }
    function addMsg(who, text) { const log = $('#chat-log'); if (!log) return; const d = document.createElement('div'); d.className = `msg ${who}`; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; }

    function updateCues() {
      const rows = $('#cue-rows'); if (!rows || !S.analyzer) return;
      const a = S.analyzer, c = a.liveCues(), vis = a.visionState === 'ready';
      const grade = (v, good, ok, hiBad) => (v == null ? ['Warming up', 'na'] : (hiBad ? v <= good : v >= good) ? ['Good', 'good'] : (hiBad ? v <= ok : v >= ok) ? ['Okay', 'ok'] : ['Work on it', 'low']);
      const paceG = c.wpm == null ? ['Warming up', 'na'] : c.wpm >= 120 && c.wpm <= 165 ? ['Good', 'good'] : c.wpm >= 105 && c.wpm <= 180 ? ['Okay', 'ok'] : [c.wpm > 180 ? 'Too fast' : 'Slow', 'low'];
      const items = [
        ['Eye contact', vis ? (c.eyePct == null ? ['Warming up', 'na'] : grade(c.eyePct, 60, 40)) : ['Not available', 'na'], vis && c.eyePct != null ? `${c.eyePct}%` : ''],
        ['Expression', vis ? (c.smilePct == null ? ['Warming up', 'na'] : ['Tracking', 'na']) : ['Not available', 'na'], vis && c.smilePct != null ? `smiling ${c.smilePct}%` : ''],
        ['Posture', vis && a.vision.pose ? (c.upPct == null ? ['Warming up', 'na'] : grade(c.upPct, 70, 50)) : ['Not available', 'na'], c.upPct != null ? `${c.upPct}% upright` : ''],
        ['Pace', a.srState === 'listening' ? paceG : ['Not available', 'na'], c.wpm != null ? `${c.wpm} wpm` : ''],
        ['Filler words', a.srState === 'listening' ? grade(c.fillers, 1, 3, true) : ['Not available', 'na'], a.srState === 'listening' ? String(c.fillers) : ''],
      ];
      rows.innerHTML = items.map(([n, [t, cls], d]) => `<div class="cue"><div>${esc(n)}<small>${esc(d)}</small></div>${statusChip(t, cls)}</div>`).join('');
      // one nudge at a time, only while the user is answering
      const nz = $('#nudge');
      if (!a.answering || S.paused) return;
      let msg = null;
      if (vis && c.faceSeen === false) msg = "I can't see your face. Center yourself in the frame.";
      else if (vis && c.gazeDown) msg = 'Look up at the camera instead of down.';
      else if (vis && c.eyePct != null && c.eyePct < 40) msg = 'Try looking right at the camera lens.';
      else if (c.upPct != null && c.upPct < 50) msg = 'Sit tall and drop your shoulders.';
      else if (c.wpm != null && c.wpm > 180) msg = 'Slow down a little. Pause between points.';
      else if (c.fillers >= 4) msg = 'Try a silent pause instead of a filler word.';
      else if (c.wpm != null || c.eyePct != null) msg = 'Looking good. Keep going.';
      const now = performance.now();
      if (msg && (msg !== S.lastNudge || now - (S.nudgeAt || 0) > 8000) && now - (S.nudgeAt || 0) > 5000) { nz.textContent = msg; S.lastNudge = msg; S.nudgeAt = now; }
    }

    // ---------------- interview loop ----------------
    function say(text, caption = text) {
      if (S.finishing) return Promise.resolve();
      $('#caption').textContent = caption;
      S.speaking = true;
      return C.voice.speak(text, S.voice, S.avatar).then(() => { S.speaking = false; });
    }
    function waitAnswerEnd(run) {
      const bar = $('#silbar'), a = S.analyzer;
      const limitMs = setup.minutesPerQuestion ? setup.minutesPerQuestion * 60000 : 0; // recruiter-set time per question
      let used = 0, lastT = performance.now();
      return new Promise((resolve) => {
        const tick = setInterval(() => {
          if (run !== S.run || S.nav || S.done) { clearInterval(tick); S.done = false; const q = $('#qtime'); if (q) q.textContent = ''; return resolve(); }
          const nowT = performance.now(); if (!S.paused) used += nowT - lastT; lastT = nowT;
          if (limitMs) {
            const q = $('#qtime'); if (q) q.textContent = `Time left: ${fmtDur(Math.ceil((limitMs - used) / 1000))}`;
            if (used >= limitMs) { S.timedOut = true; clearInterval(tick); bar.style.width = '0'; if (q) q.textContent = ''; return resolve(); }
          }
          if (S.paused || S.textOnly || !a) { if (S.paused) bar.style.width = '0'; return; }
          // Optional extra time before the first word (Settings); after that, the normal silence window applies.
          const waitSec = prefs.silenceSec + (a.hasSpoken() ? 0 : (prefs.graceSec || 0)), silenceMs = waitSec * 1000;
          const quiet = a.quietMs();
          bar.style.width = `${Math.min(100, (quiet / silenceMs) * 100)}%`;
          $('#status').textContent = quiet < 1500 ? 'Listening…' : `Take your time. I'll move on after ${waitSec} quiet seconds.`;
          const live = a.interim; if (live) $('#caption').innerHTML = `<span class="you">You:</span> ${esc(live)}`;
          if (quiet >= silenceMs) { clearInterval(tick); bar.style.width = '0'; resolve(); }
        }, 100);
        S.timers.push(tick);
      });
    }
    // One AI follow-up per question, at most four per interview, only when the user opted in.
    async function maybeFollowUp(i, run) {
      if (!S.useFollowups || S.followUps >= 4 || S.asked.has(i) || questions[i].kind === 'closer' || !S.analyzer) return null;
      const q = S.analyzer.q[i]; if (!q) return null;
      const answer = `${q.text} ${q.typed}`.trim();
      if (answer.split(/\s+/).length < 12) return null;
      $('#status').textContent = 'Caddie is thinking…'; S.avatar && S.avatar.setThinking(true);
      const history = questions.slice(0, i).map((qq, j) => { const p = S.analyzer.q[j]; return p ? { question: qq.text, answer: `${p.text} ${p.typed}`.trim(), followUp: (p.segments || []).map((s) => s.followUp).join(' ') } : null; }).filter((h) => h && h.answer);
      const f = await C.ai.followUp({ role: setup.jobName, jd: setup.jd, history, current: { question: questions[i].text, answer } });
      S.avatar && S.avatar.setThinking(false);
      if (run !== S.run || !f) return null;
      S.asked.add(i); S.followUps++; S.analyzer.addFollowUp(i, f);
      return f;
    }
    const introText = () => {
      const practice = setup.mode === 'practice';
      const role = setup.jobName ? ` about the ${setup.jobName} position` : '';
      const how = S.textOnly ? 'Type your answer in the chat, then press Next question.' : `When you have been quiet for about ${prefs.silenceSec} seconds, I will move on.`;
      const modeLine = practice ? 'This is practice mode, so you will see live tips on the side, and you can pause or skip.' : 'This is a mock interview, so no tips until the end.';
      return `Hi, I am Caddie, your AI interviewer. Thanks for joining me today. I will ask you ${questions.length} questions${role}${S.useFollowups ? ', and maybe a follow-up or two' : ''}. ${modeLine} ${how} Let's get started.`;
    };
    async function runInterview(run, practice) {
      await say(introText());
      let i = 0;
      const transitions = ['Thank you. Next question.', 'Okay, got it. Moving on.', 'Great. Here is the next one.', 'Thanks for that. Let us continue.'];
      let fresh = true;
      while (i < questions.length) {
        if (run !== S.run) return;
        while (S.paused && run === S.run) await sleep(150);
        if (run !== S.run) return;
        if (S.nav === 'end') break; // End pressed while Caddie was still talking
        S.nav = null; S.done = false; S.qi = i;
        $('#progress').textContent = `Question ${i + 1} of ${questions.length}`; $('#status').textContent = '';
        const lead = fresh && i > 0 ? transitions[i % transitions.length] + ' ' : '';
        fresh = true;
        S.analyzer && S.analyzer.selectQuestion(i);
        await say(lead + questions[i].text, questions[i].text);
        if (run !== S.run) return;
        if (!S.nav && !S.paused) {
          let again = true;
          while (again && run === S.run) {
            again = false;
            S.analyzer && S.analyzer.beginAnswer(i); await waitAnswerEnd(run); S.analyzer && S.analyzer.endAnswer();
            if (S.nav || S.paused || run !== S.run) break;
            if (S.timedOut) { S.timedOut = false; await say('Thank you. That is the time for this question.'); break; }
            const f = await maybeFollowUp(i, run);
            if (f && !S.nav && run === S.run) { await say(f); again = !S.nav && !S.paused; }
            $('#status').textContent = '';
          }
        }
        if (run !== S.run) return;
        if (S.nav === 'end') break;
        if (S.nav === 'repeat') { fresh = false; continue; }
        if (S.paused && !S.nav) { fresh = false; continue; }
        i = S.nav === 'back' ? Math.max(0, i - 1) : i + 1;
      }
      const ended = S.nav === 'end';
      if (!ended) { $('#progress').textContent = 'Interview complete'; await say('That is all my questions. Thank you for your time. I will put your summary together now.'); }
      finishInterview(!ended);
    }

    async function finishInterview(complete) {
      if (S.finishing) return; S.finishing = true;
      const run = S.run; S.run++;
      C.voice.cancel(); S.timers.forEach(clearInterval);
      const dur = elapsed();
      if (S.avatar) S.avatar.destroy();
      root.innerHTML = '<section class="container page"><div class="card" style="max-width:520px;margin:3rem auto;text-align:center"><h2>Putting your summary together…</h2><p class="muted">This takes a few seconds.</p></div></section>';
      let blob = null;
      if (S.recorder && S.recorder.state !== 'inactive') {
        blob = await new Promise((res) => { S.recorder.onstop = () => res(S.chunks.length ? new Blob(S.chunks, { type: S.recorder.mimeType || 'video/webm' }) : null); try { S.recorder.stop(); } catch { res(null); } });
      }
      if (S.analyzer) S.analyzer.stop();
      if (S.stream) S.stream.getTracks().forEach((t) => t.stop());
      const metrics = S.analyzer ? S.analyzer.finish(questions, dur) : emptyMetrics(dur);
      const { scores, actions } = C.score(metrics, questions);
      const id = uid();
      const session = { id, createdAt: Date.now(), completed: complete, setup: { ...setup }, metrics, scores, actions, hasRecording: !!blob, ai: { qSource: setup.qSource || 'templates', followUps: S.followUps } };
      try { await C.store.saveSession(session); if (blob) await C.store.saveRecording(id, blob); } catch { /* summary still opens from memory */ }
      if (setup.roleId && setup.applicantId) C.store.updateApplicant(setup.roleId, setup.applicantId, complete ? { completed: true, sessionId: id, completedAt: Date.now() } : { sessionId: id });
      C.pending = null; void run;
      location.hash = `#/app/summary/${id}`;
    }
    function emptyMetrics(dur) {
      return { duration: Math.round(dur), capabilities: { speech: false, vision: false, camera: false, pose: false },
        speech: { words: 0, spokenWords: 0, speakSec: 0, wpm: null, fillers: 0, fillerWords: {}, fillersPer100: null, pauses: 0, longPauses: 0, avgRms: null, volVariation: null },
        face: { frames: 0, facePct: null, eyeContactPct: null, smilePct: null, expressiveness: null, headMovement: null },
        body: { poseFrames: 0, uprightPct: null, tiltPct: null, slouchPct: null, leanPct: null, fidget: null },
        perQuestion: questions.map((q, i) => ({ index: i, text: q.text, asked: false })) };
    }

    return {
      destroy() {
        if (S.cancelCd) S.cancelCd();
        S.run++; S.finishing = true; C.voice.cancel(); S.timers.forEach(clearInterval);
        if (S.avatar) S.avatar.destroy();
        try { S.recorder && S.recorder.state !== 'inactive' && S.recorder.stop(); } catch { /* ignore */ }
        if (S.analyzer) S.analyzer.stop();
        if (S.stream) S.stream.getTracks().forEach((t) => t.stop());
      },
    };
  };
})(window.Caddie);
