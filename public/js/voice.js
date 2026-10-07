// Caddie's voice: the voices built into your browser/OS, with better ranking, sentence pacing and pronunciation fixes.
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

  // ---------- one API for the app ----------
  const voice = {
    speed: 1, token: 0,
    supported: browser.supported, ready: browser.ready, list: browser.list,
    // One browser voice for the whole interview: the saved choice if still installed, otherwise the best-ranked English voice.
    async choose(savedURI) { const all = await browser.list(); return all.find((v) => v.voiceURI === savedURI) || all[0] || null; },
    configure({ speed }) { voice.speed = Math.max(0.8, Math.min(1.25, +speed || 1)); },
    speak(text, chosen, avatar) { return browser.speak(text, chosen, avatar, voice.token, voice.speed); },
    cancel() { voice.token++; browser.cancel(); },
  };

  voice._prep = { spoken, chunks }; // exposed for tests
  C.voice = voice;
})(window.Caddie);
