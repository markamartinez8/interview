// Caddie's voice. Two engines behind one API:
//  - "browser": the voices built into your browser/OS, with better ranking, sentence pacing and pronunciation.
//  - "natural": Kokoro, an open neural voice that runs on this device (one-time ~90 MB download, cached by the browser).
(function (C) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- text prepared for speech ----------
  const PRON = [
    [/\bNode\.js\b/gi, 'Node J S'], [/\bNext\.js\b/gi, 'Next J S'], [/\bReact\.js\b/gi, 'React J S'], [/\.NET\b/g, 'dot net'], [/\bC\+\+/g, 'C plus plus'], [/\bC#/g, 'C sharp'],
    [/\bPostgreSQL\b/gi, 'Postgres Q L'], [/\bMySQL\b/gi, 'My S Q L'], [/\bNoSQL\b/gi, 'No S Q L'], [/\bSQL\b/g, 'S Q L'], [/\bAPIs\b/g, 'A P Is'], [/\bAPI\b/g, 'A P I'],
    [/\bAWS\b/g, 'A W S'], [/\bGCP\b/g, 'G C P'], [/\bCI\/CD\b/g, 'C I C D'], [/\bKPIs\b/g, 'K P Is'], [/\bKPI\b/g, 'K P I'], [/\bOKRs\b/g, 'O K Rs'], [/\bCRM\b/g, 'C R M'], [/\bSEO\b/g, 'S E O'],
    [/\bUX\b/g, 'U X'], [/\bUI\b/g, 'U I'], [/\bAI\b/g, 'A I'], [/\bML\b/g, 'M L'], [/\bHR\b/g, 'H R'], [/\bETL\b/g, 'E T L'], [/\bEHR\b/g, 'E H R'], [/\bB2B\b/g, 'B to B'], [/\bB2C\b/g, 'B to C'],
    [/\bSaaS\b/g, 'sass'], [/\bP&L\b/g, 'P and L'], [/\bQ&A\b/g, 'Q and A'], [/\bA\/B\b/g, 'A B'], [/\be\.g\./gi, 'for example'], [/\bi\.e\./gi, 'that is'], [/\bvs\.?(?=\s)/gi, 'versus'],
    [/(\d+)\+/g, '$1 plus'], [/&/g, ' and '], [/[“”]/g, '"'], [/[‘’]/g, "'"], [/\s*[—–]\s*/g, ', '], [/…/g, '...'],
  ];
  function spoken(text) { let t = String(text); for (const [re, to] of PRON) t = t.replace(re, to); return t.replace(/\s+/g, ' ').trim(); }

  // Sentences, and clauses for long sentences, so the voice paces itself and never runs past engine limits.
  function chunks(text) {
    const out = [];
    for (const s of text.split(/(?<=[.!?])\s+(?=["'A-Z0-9])/)) {
      if (s.length <= 170) { out.push(s); continue; }
      let cur = '';
      for (const part of s.split(/(?<=[,;:])\s+/)) {
        if ((cur + ' ' + part).length > 150 && cur) { out.push(cur.trim()); cur = part; } else cur += ' ' + part;
      }
      if (cur.trim()) out.push(cur.trim());
    }
    return out.filter(Boolean);
  }

  // ---------- browser engine ----------
  function score(v) {
    let sc = 0;
    if (/^en[-_]US/i.test(v.lang)) sc += 4; else if (/^en/i.test(v.lang)) sc += 2; else return -1;
    if (/natural|neural|online/i.test(v.name)) sc += 12;
    if (/premium|enhanced|siri/i.test(v.name)) sc += 10;
    if (/google/i.test(v.name)) sc += 6;
    if (/guy|davis|andrew|brian|christopher|eric|roger|steffan|david|daniel|alex|aaron|fred|male/i.test(v.name)) sc += 5;
    if (/female|zira|aria|jenny|samantha|karen|moira|susan|hazel|victoria/i.test(v.name)) sc -= 8;
    if (/compact|eloquence|novelty|bad news|bahh|bells|boing|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred$/i.test(v.name)) sc -= 20; // robotic or novelty voices
    return sc;
  }
  const browser = {
    supported: () => 'speechSynthesis' in window,
    async ready() {
      if (!browser.supported()) return [];
      if (!speechSynthesis.getVoices().length) {
        await new Promise((res) => {
          const done = () => { speechSynthesis.removeEventListener('voiceschanged', done); res(); };
          speechSynthesis.addEventListener('voiceschanged', done);
          setTimeout(done, 2000);
        });
      }
      return speechSynthesis.getVoices();
    },
    async list() { return (await browser.ready()).filter((v) => score(v) >= 0).sort((a, b) => score(b) - score(a)); },
    // Resolves when one chunk finishes; if the browser never starts speaking, an estimated time stands in.
    one(say, chosen, avatar, speed) {
      return new Promise((resolve) => {
        let done = false, timer;
        const words = say.split(/\s+/).length;
        const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(); };
        avatar && avatar.setSpeaking(true, say);
        if (!browser.supported()) { timer = setTimeout(finish, words * 400 + 1200); return; }
        try {
          const u = new SpeechSynthesisUtterance(say);
          if (chosen) { u.voice = chosen; u.lang = chosen.lang; } else u.lang = 'en-US';
          u.rate = 0.96 * speed; u.pitch = 1;
          u.onstart = () => { clearTimeout(timer); avatar && avatar.setSpeaking(true, say); timer = setTimeout(finish, words * 700 + 6000); };
          u.onboundary = (ev) => avatar && avatar.boundary(ev.charIndex || 0);
          u.onend = finish; u.onerror = finish;
          timer = setTimeout(finish, 3000 + words * 400);
          speechSynthesis.speak(u);
        } catch { timer = setTimeout(finish, words * 400 + 1200); }
      });
    },
    async speak(text, chosen, avatar, tok, speed) {
      const parts = chunks(spoken(text));
      for (let i = 0; i < parts.length; i++) {
        if (tok !== voice.token) break;
        await browser.one(parts[i], chosen, avatar, speed);
        if (tok !== voice.token) break;
        if (i < parts.length - 1) { avatar && avatar.setSpeaking(false); await sleep(/[.!?]$/.test(parts[i]) ? 230 : 110); }
      }
      avatar && avatar.setSpeaking(false);
    },
    cancel() { try { speechSynthesis.cancel(); } catch { /* none */ } },
  };

  // ---------- natural engine (Kokoro, on device) ----------
  const NAT_VOICES = [['am_michael', 'Michael (US, male)'], ['am_adam', 'Adam (US, male)'], ['am_eric', 'Eric (US, male)'], ['am_liam', 'Liam (US, male)'], ['bm_george', 'George (UK, male)'], ['bm_daniel', 'Daniel (UK, male)'], ['af_heart', 'Heart (US, female)'], ['af_bella', 'Bella (US, female)'], ['bf_emma', 'Emma (UK, female)']];
  const natural = {
    ready: false, loading: null, tts: null, ctx: null, failures: 0, error: null, src: null, stopFn: null, queue: Promise.resolve(), cache: new Map(),
    // Resolves true when the model is ready. onProgress receives 0..100.
    load(onProgress) {
      if (natural.ready) return Promise.resolve(true);
      if (natural.loading) { natural.onProgress = onProgress; return natural.loading; }
      natural.onProgress = onProgress;
      const files = {};
      natural.loading = (async () => {
        const mod = await import('/vendor/kokoro.web.js');
        natural.tts = await mod.KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
          dtype: 'q8', device: 'wasm',
          progress_callback: (p) => {
            if (p && p.file && typeof p.total === 'number' && p.total > 0) {
              files[p.file] = { l: p.loaded || 0, t: p.total };
              const L = Object.values(files).reduce((a, f) => a + f.l, 0), Tt = Object.values(files).reduce((a, f) => a + f.t, 0);
              natural.onProgress && natural.onProgress(Math.min(99, Math.round((L / Tt) * 100)));
            }
          },
        });
        natural.ready = true; natural.error = null; natural.onProgress && natural.onProgress(100);
        return true;
      })().catch((e) => { natural.error = e; natural.loading = null; console.warn('Natural voice could not load:', e); return false; });
      return natural.loading;
    },
    audioCtx() { if (!natural.ctx || natural.ctx.state === 'closed') natural.ctx = new (window.AudioContext || window.webkitAudioContext)(); return natural.ctx; },
    synth(say, id, speed) {
      const key = `${id}|${speed}|${say}`;
      if (natural.cache.has(key)) return natural.cache.get(key);
      const run = () => natural.tts.generate(say, { voice: id, speed }).then((a) => ({ samples: a.audio, sr: a.sampling_rate }));
      const p = natural.queue.then(run, run);
      natural.queue = p.catch(() => {});
      natural.cache.set(key, p);
      if (natural.cache.size > 14) natural.cache.delete(natural.cache.keys().next().value);
      return p;
    },
    // Loudness over time (20 ms steps, 0..~1.2) so the mouth opens with the actual voice.
    envelope(samples, sr) {
      const hop = Math.round(sr * 0.02), n = Math.ceil(samples.length / hop), data = new Float32Array(n);
      for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let j = i * hop; j < Math.min(samples.length, (i + 1) * hop); j++) { s += samples[j] * samples[j]; c++; } data[i] = Math.sqrt(s / Math.max(1, c)); }
      const sorted = Array.from(data).sort((a, b) => a - b), ref = sorted[Math.floor(n * 0.9)] || 1e-3;
      for (let i = 0; i < n; i++) data[i] = Math.min(1.25, data[i] / ref);
      return { hop: 20, data };
    },
    async play(a, say, avatar) {
      const ctx = natural.audioCtx(); await ctx.resume().catch(() => {});
      const buf = ctx.createBuffer(1, a.samples.length, a.sr); buf.copyToChannel(a.samples, 0);
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); natural.src = src;
      avatar && (avatar.setSpeaking(true, say), avatar.setSpeechTiming(say, buf.duration, natural.envelope(a.samples, a.sr)));
      await new Promise((res) => { src.onended = res; natural.stopFn = res; src.start(); });
      natural.src = null; natural.stopFn = null;
    },
    async speak(text, avatar, id, speed, tok) {
      const parts = chunks(spoken(text));
      const jobs = parts.map((p) => natural.synth(p, id, speed)); // generation runs ahead while earlier parts play
      for (let i = 0; i < parts.length; i++) {
        const a = await jobs[i];
        if (tok !== voice.token) return;
        await natural.play(a, parts[i], avatar);
        if (tok !== voice.token) return;
        if (i < parts.length - 1) { avatar && avatar.setSpeaking(false); await sleep(/[.!?]$/.test(parts[i]) ? 200 : 90); }
      }
      avatar && avatar.setSpeaking(false);
    },
    stop() { try { natural.src && natural.src.stop(); } catch { /* ended */ } natural.stopFn && natural.stopFn(); },
    close() { natural.stop(); if (natural.ctx) natural.ctx.close().catch(() => {}); natural.ctx = null; },
  };

  // ---------- one API for the app ----------
  const voice = {
    engine: 'browser', speed: 1, naturalVoice: 'am_michael', token: 0, naturalVoices: NAT_VOICES,
    supported: browser.supported, ready: browser.ready, list: browser.list,
    // One browser voice for the whole interview: the saved choice if still installed, otherwise the best-ranked English voice.
    async choose(savedURI) { const all = await browser.list(); return all.find((v) => v.voiceURI === savedURI) || all[0] || null; },
    naturalState: () => ({ ready: natural.ready, loading: !!natural.loading && !natural.ready, error: natural.error }),
    loadNatural: (onProgress) => natural.load(onProgress),
    // Choose the engine from saved preferences; falls back to the browser voice if the natural one is not ready.
    configure({ engine, naturalVoice, speed }) {
      voice.speed = Math.max(0.8, Math.min(1.25, +speed || 1));
      voice.naturalVoice = naturalVoice || 'am_michael';
      voice.engine = engine === 'natural' && natural.ready ? 'natural' : 'browser';
      return voice.engine;
    },
    // Start generating audio early (for example the next question while the candidate is still answering).
    prefetch(text) {
      if (voice.engine !== 'natural' || !natural.ready) return;
      chunks(spoken(text)).forEach((p) => natural.synth(p, voice.naturalVoice, voice.speed).catch(() => {}));
    },
    async speak(text, chosen, avatar) {
      const tok = voice.token;
      if (voice.engine === 'natural' && natural.ready && natural.failures < 2) {
        try { await natural.speak(text, avatar, voice.naturalVoice, voice.speed, tok); return; } catch (e) { natural.failures++; console.warn('Natural voice failed, using the browser voice:', e); if (tok !== voice.token) return; }
      }
      return browser.speak(text, chosen, avatar, tok, voice.speed);
    },
    cancel() { voice.token++; browser.cancel(); natural.stop(); },
    shutdown() { voice.cancel(); natural.close(); },
  };

  voice._prep = { spoken, chunks }; // exposed for tests
  C.voice = voice;
})(window.Caddie);
