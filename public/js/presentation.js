// Practice Presenting: green room and a room where you see only yourself. Caddie is not in the room; it listens and gives feedback afterward.
(function (C) {
  const { esc, fmtDur, uid } = C.util;
  const statusChip = (text, cls) => `<span class="chip ${cls}">${esc(text)}</span>`;

  C.views.presentation = function (root) {
    const setup = C.pending;
    if (!setup || setup.kind !== 'presentation') { location.hash = '#/app/setup'; return {}; }
    const S = { stream: null, hasVideo: false, analyzer: null, recorder: null, chunks: [], t0: 0, pauseStart: 0, pausedMs: 0, paused: false, finishing: false, started: false, mediaOk: false, timers: [] };
    const $ = (s) => root.querySelector(s);
    const every = (fn, ms) => { const t = setInterval(fn, ms); S.timers.push(t); return t; };
    const set = (id, text, cls) => { const el = $(id); if (el) el.innerHTML = statusChip(text, cls); };
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    // ---------------- green room (only you) ----------------
    root.innerHTML = `<section class="container page">
      <div class="page-head"><div class="stack" style="gap:.4rem"><span class="eyebrow">Green room</span><h1 style="font-size:clamp(1.7rem,3.4vw,2.4rem)">Check your camera and mic</h1></div></div>
      <div class="prep-grid">
        <div class="card"><div class="preview"><video id="pv" autoplay muted playsinline></video><div class="overlay-msg" id="pv-msg">Asking for camera and microphone…</div></div>
          <div style="margin-top:1rem"><div class="row" style="justify-content:space-between"><span class="label">Microphone level</span><span class="small muted" id="mic-note">Say something to test</span></div><div class="meter"><div id="mic-meter"></div></div></div></div>
        <div class="stack">
          <div class="card"><h3 style="margin-bottom:.7rem">Your session</h3><dl class="kv"><dt>Presentation</dt><dd>${esc(setup.title)}</dd><dt>In the room</dt><dd>Just you. Caddie listens and gives feedback afterward.</dd></dl></div>
          <div class="card"><h3 style="margin-bottom:.7rem">Ready check</h3><ul class="checklist">
            <li><span>Camera</span><span id="ck-cam">${statusChip('Waiting', 'na')}</span></li><li><span>Microphone</span><span id="ck-mic">${statusChip('Waiting', 'na')}</span></li>
            <li><span>Face and posture analysis</span><span id="ck-vis">${statusChip('Waiting', 'na')}</span></li>
            <li><span>Speech transcript</span><span id="ck-sr">${statusChip(SR ? 'Supported' : 'Not in this browser', SR ? 'good' : 'low')}</span></li></ul></div>
          <div class="card stack"><p class="small muted">Your video is recorded on this device only so you can review it afterward. Nothing is uploaded.</p><div id="prep-err" class="error-text" role="alert"></div>
            <div class="row"><button class="btn btn-primary btn-lg" id="join" disabled>Start presenting</button><button class="btn btn-ghost" id="retry" hidden>Try again</button><a class="btn btn-ghost" href="#/app/setup">Back to setup</a></div></div>
        </div></div></section>`;

    async function requestMedia() {
      $('#prep-err').textContent = ''; $('#retry').hidden = true;
      const md = navigator.mediaDevices;
      if (!md || !md.getUserMedia) return failed('This browser cannot access a camera or microphone (or the page is not on localhost or https).');
      const audio = { echoCancellation: true, noiseSuppression: true };
      let stream = null, video = true;
      try { stream = await md.getUserMedia({ video: { facingMode: 'user' }, audio }); } catch (e) {
        if (e.name === 'NotAllowedError' || e.name === 'SecurityError') return failed('Camera and microphone access was blocked. Allow access in your browser address bar and try again.');
        try { stream = await md.getUserMedia({ audio }); video = false; } catch (e2) { return failed(e2.name === 'NotFoundError' ? 'No microphone was found. Connect one and try again.' : 'Could not start the microphone.'); }
      }
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
      S.mediaOk = true; $('#join').disabled = false;
    }
    function failed(msg) { $('#prep-err').textContent = msg; $('#retry').hidden = false; set('#ck-cam', 'Off', 'low'); set('#ck-mic', 'Off', 'low'); $('#pv-msg').textContent = 'Camera and microphone are off.'; }
    $('#retry').addEventListener('click', requestMedia);
    requestMedia();
    $('#join').addEventListener('click', () => { if (S.started || S.cancelCd || !S.mediaOk) return; $('#join').disabled = true; S.cancelCd = C.util.countdown(3, () => { S.cancelCd = null; enterRoom(); }, () => { S.cancelCd = null; const j = $('#join'); if (j) j.disabled = !S.mediaOk; }); });

    // ---------------- the room: only you ----------------
    const elapsed = () => (performance.now() - S.t0 - S.pausedMs - (S.paused ? performance.now() - S.pauseStart : 0)) / 1000;
    function enterRoom() {
      S.started = true;
      root.innerHTML = `<section class="container page"><div class="room">
        <div class="room-top"><div class="row"><span class="badge">${esc(setup.title)}</span><span class="badge">Presentation</span></div>
          <div class="row"><span class="small" id="timer">0:00</span><span class="rec" id="rec" ${window.MediaRecorder ? '' : 'hidden'}>REC</span></div></div>
        <div class="room-main"><div>
          <div class="tile solo"><video id="me" autoplay muted playsinline></video><div class="novideo" id="novid" hidden>No camera. Audio only.</div><span class="tag">You</span></div>
          <div class="status-line" id="status">Start whenever you are ready. Press End presentation when you finish.</div>
          <div class="controls"><button class="ctl" id="c-pause">⏸ Pause</button><button class="ctl end" id="c-end">End presentation</button></div>
          <div class="row" id="end-confirm" hidden style="justify-content:center;margin-top:.7rem"><span class="small">End now and see your summary?</span><button class="ctl end" id="end-yes">Yes, end</button><button class="ctl" id="end-no">Keep going</button></div>
        </div>
        <aside class="side"><div class="side-tabs"><button role="tab" aria-selected="true" style="cursor:default">Live cues</button></div>
          <div class="side-body"><div class="nudge" id="nudge">Cues appear as you speak.</div><div id="cue-rows" class="stack" style="gap:.5rem"></div><p class="small" style="color:#AEB3C7">Cues are estimates from your camera and mic, measured on this device.</p></div></aside>
        </div></div></section>`;
      const me = $('#me'); me.srcObject = S.stream; $('#novid').hidden = S.hasVideo;
      S.analyzer.video = me; S.analyzer.start(); S.analyzer.beginAnswer(0);
      S.t0 = performance.now();
      if (S.stream && window.MediaRecorder) {
        const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
        try { S.recorder = new MediaRecorder(S.stream, mime ? { mimeType: mime } : undefined); S.recorder.ondataavailable = (e) => { if (e.data && e.data.size) S.chunks.push(e.data); }; S.recorder.start(1000); } catch { const r = $('#rec'); if (r) r.hidden = true; }
      }
      every(() => { const t = $('#timer'); if (t) t.textContent = fmtDur(elapsed()); }, 500);
      every(updateCues, 1000);
      $('#c-pause').addEventListener('click', () => {
        S.paused = !S.paused; const b = $('#c-pause'); b.textContent = S.paused ? '▶ Resume' : '⏸ Pause'; b.classList.toggle('active', S.paused); $('#rec').classList.toggle('paused', S.paused);
        if (S.paused) { S.pauseStart = performance.now(); try { S.recorder && S.recorder.state === 'recording' && S.recorder.pause(); } catch { /* ignore */ } $('#status').textContent = 'Paused.'; }
        else { S.pausedMs += performance.now() - S.pauseStart; try { S.recorder && S.recorder.state === 'paused' && S.recorder.resume(); } catch { /* ignore */ } $('#status').textContent = ''; }
        S.analyzer.setPaused(S.paused);
      });
      $('#c-end').addEventListener('click', () => { $('#end-confirm').hidden = false; });
      $('#end-no').addEventListener('click', () => { $('#end-confirm').hidden = true; });
      $('#end-yes').addEventListener('click', () => finish(true));
    }

    function updateCues() {
      const rows = $('#cue-rows'); if (!rows || !S.analyzer) return;
      const a = S.analyzer, c = a.liveCues(), vis = a.visionState === 'ready';
      const grade = (v, good, ok, hiBad) => (v == null ? ['Warming up', 'na'] : (hiBad ? v <= good : v >= good) ? ['Good', 'good'] : (hiBad ? v <= ok : v >= ok) ? ['Okay', 'ok'] : ['Work on it', 'low']);
      const sr = a.srState === 'listening';
      const paceG = c.wpm == null ? ['Warming up', 'na'] : c.wpm >= 110 && c.wpm <= 160 ? ['Good', 'good'] : c.wpm >= 100 && c.wpm <= 175 ? ['Okay', 'ok'] : [c.wpm > 175 ? 'Too fast' : 'Slow', 'low'];
      const items = [
        ['Eye contact', vis ? (c.eyePct == null ? ['Warming up', 'na'] : grade(c.eyePct, 60, 40)) : ['Not available', 'na'], vis && c.eyePct != null ? `${c.eyePct}%` : ''],
        ['Expression', vis ? (c.smilePct == null ? ['Warming up', 'na'] : ['Tracking', 'na']) : ['Not available', 'na'], vis && c.smilePct != null ? `smiling ${c.smilePct}%` : ''],
        ['Posture', vis && a.vision.pose ? (c.upPct == null ? ['Warming up', 'na'] : grade(c.upPct, 70, 50)) : ['Not available', 'na'], c.upPct != null ? `${c.upPct}% upright` : ''],
        ['Pace', sr ? paceG : ['Not available', 'na'], c.wpm != null ? `${c.wpm} wpm` : ''],
        ['Filler words', sr ? grade(c.fillers, 1, 3, true) : ['Not available', 'na'], sr ? String(c.fillers) : ''],
      ];
      rows.innerHTML = items.map(([n, [t, cls], d]) => `<div class="cue"><div>${esc(n)}<small>${esc(d)}</small></div>${statusChip(t, cls)}</div>`).join('');
      if (S.paused) return;
      let msg = null;
      if (vis && c.faceSeen === false) msg = "I can't see your face. Center yourself in the frame.";
      else if (vis && c.gazeDown) msg = 'Look up at the camera, not down at your notes.';
      else if (vis && c.eyePct != null && c.eyePct < 40) msg = 'Try looking right at the camera lens.';
      else if (c.upPct != null && c.upPct < 50) msg = 'Stand or sit tall and drop your shoulders.';
      else if (c.wpm != null && c.wpm > 175) msg = 'Slow down a little. Pause between points.';
      else if (c.fillers >= 4) msg = 'Try a silent pause instead of a filler word.';
      else if (c.wpm != null || c.eyePct != null) msg = 'Looking good. Keep going.';
      const now = performance.now();
      if (msg && (msg !== S.lastNudge || now - (S.nudgeAt || 0) > 8000) && now - (S.nudgeAt || 0) > 5000) { $('#nudge').textContent = msg; S.lastNudge = msg; S.nudgeAt = now; }
    }

    async function finish(complete) {
      if (S.finishing) return; S.finishing = true;
      S.timers.forEach(clearInterval);
      const dur = elapsed();
      root.innerHTML = '<section class="container page"><div class="card" style="max-width:520px;margin:3rem auto;text-align:center"><h2>Putting your summary together…</h2><p class="muted">This takes a few seconds.</p></div></section>';
      let blob = null;
      if (S.recorder && S.recorder.state !== 'inactive') {
        blob = await new Promise((res) => { S.recorder.onstop = () => res(S.chunks.length ? new Blob(S.chunks, { type: S.recorder.mimeType || 'video/webm' }) : null); try { S.recorder.stop(); } catch { res(null); } });
      }
      S.analyzer.endAnswer(); S.analyzer.stop();
      if (S.stream) S.stream.getTracks().forEach((t) => t.stop());
      const questions = [{ text: setup.title }];
      const metrics = S.analyzer.finish(questions, dur);
      const { scores, actions } = C.score(metrics, questions, 'presentation');
      const id = uid();
      const session = { id, createdAt: Date.now(), completed: complete, setup: { kind: 'presentation', title: setup.title }, metrics, scores, actions, hasRecording: !!blob, ai: { qSource: 'none', followUps: 0 } };
      try { await C.store.saveSession(session); if (blob) await C.store.saveRecording(id, blob); } catch { /* summary still opens from memory */ }
      C.pending = null;
      location.hash = `#/app/summary/${id}`;
    }

    return {
      destroy() {
        if (S.cancelCd) S.cancelCd();
        S.finishing = true; S.timers.forEach(clearInterval);
        try { S.recorder && S.recorder.state !== 'inactive' && S.recorder.stop(); } catch { /* ignore */ }
        if (S.analyzer) S.analyzer.stop();
        if (S.stream) S.stream.getTracks().forEach((t) => t.stop());
      },
    };
  };
})(window.Caddie);
