// Caddie: an animated interviewer, plus one consistent browser voice.
// The face is drawn as layered, shaded SVG and driven by a small behaviour model:
// lip-sync from the spoken text, blinks, eye movement, brow and head motion, listening nods,
// and gaze that follows where the candidate sits in their camera frame.
(function (C) {
  let uidCounter = 0;

  function markup(p) {
    return `
  <defs>
    <linearGradient id="${p}wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cdd5e6"/><stop offset="1" stop-color="#8f9bb8"/></linearGradient>
    <radialGradient id="${p}glow" cx=".5" cy=".38" r=".7"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <radialGradient id="${p}vig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#0b0f1f" stop-opacity="0"/><stop offset="1" stop-color="#0b0f1f" stop-opacity=".45"/></radialGradient>
    <filter id="${p}blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="${p}soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <filter id="${p}tiny" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1"/></filter>
    <radialGradient id="${p}skin" gradientUnits="userSpaceOnUse" cx="190" cy="112" r="125"><stop offset="0" stop-color="#f1c8a6"/><stop offset=".55" stop-color="#e2ac88"/><stop offset="1" stop-color="#c98d69"/></radialGradient>
    <linearGradient id="${p}side" gradientUnits="userSpaceOnUse" x1="130" y1="0" x2="270" y2="0"><stop offset="0" stop-color="#a8663f" stop-opacity=".0"/><stop offset=".62" stop-color="#8a4f2c" stop-opacity=".0"/><stop offset="1" stop-color="#7d4526" stop-opacity=".34"/></linearGradient>
    <linearGradient id="${p}hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3629"/><stop offset="1" stop-color="#241812"/></linearGradient>
    <linearGradient id="${p}jacket" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34405f"/><stop offset="1" stop-color="#1b2339"/></linearGradient>
    <radialGradient id="${p}sclera" cx=".5" cy=".45" r=".6"><stop offset=".55" stop-color="#f8f6f3"/><stop offset="1" stop-color="#cfc6bf"/></radialGradient>
    <radialGradient id="${p}iris" cx=".5" cy=".5" r=".5"><stop offset=".3" stop-color="#b08350"/><stop offset=".72" stop-color="#6d4a29"/><stop offset="1" stop-color="#2f2013"/></radialGradient>
    <linearGradient id="${p}teeth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf8f2"/><stop offset="1" stop-color="#dcd2c4"/></linearGradient>
    <linearGradient id="${p}lipU" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8706a"/><stop offset="1" stop-color="#9c5654"/></linearGradient>
    <linearGradient id="${p}lipL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cc857c"/><stop offset="1" stop-color="#b56b66"/></linearGradient>
    <clipPath id="${p}eyeL"><path d="M161 125 Q176 109 191 125 Q176 139 161 125 Z"/></clipPath>
    <clipPath id="${p}eyeR"><path d="M209 125 Q224 109 239 125 Q224 139 209 125 Z"/></clipPath>
    <clipPath id="${p}mouth"><path class="m-clip" d=""/></clipPath>
    <clipPath id="${p}neck"><rect x="171" y="198" width="58" height="60" rx="20"/></clipPath>
    <clipPath id="${p}face"><path d="M200 52 C238 52 262 78 264 118 C266 150 258 178 240 198 C228 211 214 218 200 218 C186 218 172 211 160 198 C142 178 134 150 136 118 C138 78 162 52 200 52 Z"/></clipPath>
  </defs>

  <rect width="400" height="300" fill="url(#${p}wall)"/>
  <g filter="url(#${p}blur)" opacity=".85"><rect x="18" y="30" width="86" height="150" rx="6" fill="#f4f7ff" opacity=".8"/><rect x="300" y="48" width="72" height="12" rx="3" fill="#59627c"/><rect x="300" y="82" width="72" height="12" rx="3" fill="#6b7590"/><rect x="304" y="116" width="64" height="10" rx="3" fill="#59627c"/><ellipse cx="352" cy="226" rx="26" ry="38" fill="#4d7a63" opacity=".8"/><rect x="334" y="236" width="36" height="50" rx="6" fill="#7d6a5b"/></g>
  <rect width="400" height="300" fill="url(#${p}glow)"/>

  <g class="body">
    <path d="M30 300 C42 262 108 246 168 242 L232 242 C292 246 358 262 370 300 Z" fill="url(#${p}jacket)"/>
    <path d="M168 242 L200 290 L232 242 L222 240 L200 268 L178 240 Z" fill="#f2f3f7"/>
    <path d="M168 242 L140 300 L176 300 L196 288 Z" fill="#161d30" opacity=".75"/><path d="M232 242 L260 300 L224 300 L204 288 Z" fill="#161d30" opacity=".75"/>
    <path d="M168 242 L186 250 L200 268 L178 240 Z" fill="#dfe2ea"/><path d="M232 242 L214 250 L200 268 L222 240 Z" fill="#dfe2ea"/>
    <rect x="171" y="198" width="58" height="58" rx="20" fill="#c9926f"/>
    <g clip-path="url(#${p}neck)"><ellipse cx="200" cy="214" rx="46" ry="19" fill="#5e3319" opacity=".5" filter="url(#${p}soft)"/></g>
    <path d="M168 242 Q200 262 232 242 L232 252 Q200 270 168 252 Z" fill="#000" opacity=".12" filter="url(#${p}tiny)"/>
  </g>

  <g class="head">
    <ellipse cx="134" cy="130" rx="8.5" ry="15" fill="#d49b77"/><ellipse cx="266" cy="130" rx="8.5" ry="15" fill="#d49b77"/>
    <ellipse cx="135" cy="131" rx="3.5" ry="8" fill="#b97b58" opacity=".55"/><ellipse cx="265" cy="131" rx="3.5" ry="8" fill="#b97b58" opacity=".55"/>
    <path d="M200 52 C238 52 262 78 264 118 C266 150 258 178 240 198 C228 211 214 218 200 218 C186 218 172 211 160 198 C142 178 134 150 136 118 C138 78 162 52 200 52 Z" fill="url(#${p}skin)"/>
    <g clip-path="url(#${p}face)">
      <rect x="120" y="40" width="160" height="190" fill="url(#${p}side)"/>
      <ellipse cx="200" cy="228" rx="64" ry="16" fill="#6e3f24" opacity=".22" filter="url(#${p}soft)"/>
      <ellipse cx="178" cy="84" rx="30" ry="14" fill="#fff" opacity=".13" filter="url(#${p}soft)"/>
      <path d="M142 160 Q150 196 190 214" stroke="#7d4526" stroke-width="7" fill="none" opacity=".12" filter="url(#${p}soft)"/>
      <path d="M258 160 Q250 196 210 214" stroke="#7d4526" stroke-width="8" fill="none" opacity=".2" filter="url(#${p}soft)"/>
      <ellipse cx="200" cy="203" rx="46" ry="14" fill="#2b1a10" opacity=".07" filter="url(#${p}soft)"/>
    </g>

    <g class="features">
      <g class="cheeks"><ellipse class="cheek-l" cx="158" cy="160" rx="17" ry="11" fill="#d9776e" opacity=".2" filter="url(#${p}soft)"/><ellipse class="cheek-r" cx="242" cy="160" rx="17" ry="11" fill="#d9776e" opacity=".2" filter="url(#${p}soft)"/></g>
      <path class="nl-l" d="M171 152 Q165 170 171 185" stroke="#8d5233" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0" filter="url(#${p}tiny)"/>
      <path class="nl-r" d="M229 152 Q235 170 229 185" stroke="#8d5233" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0" filter="url(#${p}tiny)"/>
      <ellipse cx="176" cy="134" rx="15" ry="5" fill="#a56a47" opacity=".16" filter="url(#${p}tiny)"/><ellipse cx="224" cy="134" rx="15" ry="5" fill="#a56a47" opacity=".16" filter="url(#${p}tiny)"/>

      <g class="eye-l"><g clip-path="url(#${p}eyeL)"><rect x="158" y="105" width="36" height="36" fill="url(#${p}sclera)"/>
        <g class="iris-l"><circle cx="176" cy="125" r="7.6" fill="url(#${p}iris)"/><circle cx="176" cy="125" r="7.6" fill="none" stroke="#1d130b" stroke-width="1.1" opacity=".75"/><circle class="pupil" cx="176" cy="125" r="3.2" fill="#0d0805"/><circle cx="173.6" cy="122.6" r="1.8" fill="#fff" opacity=".92"/><circle cx="178.6" cy="127.4" r=".9" fill="#fff" opacity=".45"/></g>
        <path class="lid-l" d="" fill="url(#${p}skin)"/></g>
        <path class="lash-l" d="" stroke="#20150e" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M162 128 Q176 139 190 128" stroke="#8d5233" stroke-width="1" fill="none" opacity=".35"/></g>
      <g class="eye-r"><g clip-path="url(#${p}eyeR)"><rect x="206" y="105" width="36" height="36" fill="url(#${p}sclera)"/>
        <g class="iris-r"><circle cx="224" cy="125" r="7.6" fill="url(#${p}iris)"/><circle cx="224" cy="125" r="7.6" fill="none" stroke="#1d130b" stroke-width="1.1" opacity=".75"/><circle class="pupil" cx="224" cy="125" r="3.2" fill="#0d0805"/><circle cx="221.6" cy="122.6" r="1.8" fill="#fff" opacity=".92"/><circle cx="226.6" cy="127.4" r=".9" fill="#fff" opacity=".45"/></g>
        <path class="lid-r" d="" fill="url(#${p}skin)"/></g>
        <path class="lash-r" d="" stroke="#20150e" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M210 128 Q224 139 238 128" stroke="#8d5233" stroke-width="1" fill="none" opacity=".35"/></g>

      <path class="brow-l" d="" stroke="#2c1e15" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path class="brow-r" d="" stroke="#2c1e15" stroke-width="5" fill="none" stroke-linecap="round"/>

      <path d="M196 124 Q193 146 189 158" stroke="#a8683f" stroke-width="3" fill="none" opacity=".2" filter="url(#${p}tiny)" stroke-linecap="round"/>
      <path d="M190 160 Q200 168 211 160" stroke="#8d5233" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".55"/>
      <ellipse cx="193" cy="162" rx="3.2" ry="2" fill="#4d2a18" opacity=".6"/><ellipse cx="208" cy="162" rx="3.2" ry="2" fill="#4d2a18" opacity=".6"/>
      <ellipse cx="200" cy="155" rx="5" ry="3.4" fill="#fff" opacity=".22" filter="url(#${p}tiny)"/>
      <path d="M194 170 Q200 173 206 170" stroke="#8d5233" stroke-width="1.4" fill="none" opacity=".25"/>

      <g class="mouth">
        <path class="m-in" d="" fill="#3f171c"/>
        <g clip-path="url(#${p}mouth)"><rect class="teeth" x="180" y="0" width="40" height="0" rx="3.5" fill="url(#${p}teeth)"/><ellipse class="tongue" cx="200" cy="190" rx="10" ry="0" fill="#b4545c"/></g>
        <path class="lip-u" d="" fill="url(#${p}lipU)"/>
        <path class="lip-l" d="" fill="url(#${p}lipL)"/>
        <ellipse class="lip-hl" cx="200" cy="191" rx="6" ry="1.3" fill="#fff" opacity=".2" filter="url(#${p}tiny)"/>
        <circle class="cor-l" cx="180" cy="187" r="1.7" fill="#5a2a22" opacity=".35"/><circle class="cor-r" cx="220" cy="187" r="1.7" fill="#5a2a22" opacity=".35"/>
      </g>
      <ellipse cx="200" cy="205" rx="12" ry="3" fill="#7d4526" opacity=".13" filter="url(#${p}tiny)"/>
    </g>

    <g class="hair">
      <path d="M131 132 C119 74 148 34 202 31 C256 31 286 70 270 132 C268 112 264 98 257 88 C238 98 214 94 198 82 C182 96 160 102 144 98 C137 108 133 120 131 132 Z" fill="url(#${p}hair)"/>
      <path d="M144 98 C150 70 176 52 204 52 C170 56 152 74 144 98 Z" fill="#5a4231" opacity=".5"/>
      <g stroke="#6b503c" stroke-width=".9" fill="none" opacity=".5" stroke-linecap="round"><path d="M154 92 C160 66 180 50 204 46"/><path d="M164 94 C170 70 188 54 210 50"/><path d="M180 92 C186 70 202 56 224 52"/><path d="M200 84 C208 66 228 56 246 58"/><path d="M226 88 C236 72 252 64 262 70"/><path d="M142 104 C146 84 156 70 170 60"/></g>
      <path d="M133 122 C132 108 134 98 138 92 L140 128 Z" fill="#2c1f17"/><path d="M267 122 C268 108 266 98 262 92 L260 128 Z" fill="#2c1f17"/>
    </g>
  </g>
  <rect width="400" height="300" fill="url(#${p}vig)"/>`;
  }

  // mouth shape (open, wide, round) for a character
  function viseme(ch) {
    const c = ch.toLowerCase();
    if ('a'.includes(c)) return [0.9, 0.35, 0];
    if ('e'.includes(c)) return [0.5, 0.75, 0];
    if ('i'.includes(c)) return [0.32, 0.95, 0];
    if ('o'.includes(c)) return [0.62, 0, 0.85];
    if ('u'.includes(c)) return [0.34, 0, 1];
    if ('mbp'.includes(c)) return [0, 0.1, 0];
    if ('fv'.includes(c)) return [0.12, 0.45, 0];
    if ('w'.includes(c)) return [0.3, 0, 0.8];
    if ('szcxtdn'.includes(c)) return [0.2, 0.6, 0];
    if ('rljgkhyq'.includes(c)) return [0.34, 0.3, 0.15];
    return [0.04, 0.2, 0]; // space, punctuation
  }
  const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  class Avatar {
    constructor(svg) {
      this.p = `cv${++uidCounter}_`;
      this.svg = svg; svg.setAttribute('viewBox', '28 20 344 258'); svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      svg.innerHTML = markup(this.p);
      const q = (s) => svg.querySelector(s);
      this.el = { body: q('.body'), head: q('.head'), features: q('.features'), hair: q('.hair'),
        browL: q('.brow-l'), browR: q('.brow-r'), lidL: q('.lid-l'), lidR: q('.lid-r'), lashL: q('.lash-l'), lashR: q('.lash-r'),
        irisL: q('.iris-l'), irisR: q('.iris-r'), pupils: svg.querySelectorAll('.pupil'),
        mIn: q('.m-in'), mClip: q('.m-clip'), teeth: q('.teeth'), tongue: q('.tongue'), lipU: q('.lip-u'), lipL: q('.lip-l'), lipHl: q('.lip-hl'),
        corL: q('.cor-l'), corR: q('.cor-r'), nlL: q('.nl-l'), nlR: q('.nl-r'), cheekL: q('.cheek-l'), cheekR: q('.cheek-r') };
      this.s = { open: 0, wide: 0.2, round: 0, smile: 0.4, browUp: 0, furrow: 0, lid: 1, gx: 0, gy: 0, yaw: 0, pitch: 0, roll: 0, nod: 0, breath: 0 };
      this.mode = { speaking: false, listening: false, userSpeaking: false, thinking: false };
      this.text = ''; this.speechStart = 0; this.anchor = null; this.cps = 14; this.emph = 0;
      this.blink = { next: performance.now() + 1500, t0: -1, double: false };
      this.sacc = { next: 0, x: 0, y: 0, away: 0 }; this.nodAt = 0; this.nodNext = 0; this.userGaze = null;
      this.last = performance.now();
      const loop = (t) => { this.frame(t); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    }

    // ----- behaviour inputs -----
    setSpeaking(on, text) {
      this.mode.speaking = on;
      if (!on) this.env = null;
      if (on) { this.text = text || ''; this.speechStart = performance.now(); this.anchor = null; this.cps = 14; }
    }
    // Called by the speech engine at each word; keeps the lips in step with the voice.
    boundary(charIndex) {
      const now = performance.now();
      if (this.anchor && charIndex > this.anchor.idx && now - this.anchor.t > 80) {
        const inst = ((charIndex - this.anchor.idx) / (now - this.anchor.t)) * 1000;
        this.cps = clamp(this.cps * 0.6 + inst * 0.4, 7, 24);
      }
      this.anchor = { idx: charIndex, t: now }; this.emph = 1;
    }
    // Exact timing from a rendered audio clip: lets the lips follow the real voice.
    setSpeechTiming(text, durationSec, env) {
      const now = performance.now();
      this.text = text; this.anchor = { idx: 0, t: now }; this.cps = clamp(text.length / Math.max(0.3, durationSec), 6, 30);
      this.env = env ? { hop: env.hop, data: env.data, t0: now } : null;
    }
    setListening(on) { this.mode.listening = on; }
    setUserSpeaking(on) { this.mode.userSpeaking = on; }
    setThinking(on) { this.mode.thinking = on; }
    setGaze(pos) { this.userGaze = pos; }

    // ----- per-frame -----
    mouthTarget(now) {
      if (!this.mode.speaking) return [0.03, 0.3, 0];
      if (!this.text) { const w = Math.abs(Math.sin(now / 95)) * 0.6 + Math.abs(Math.sin(now / 53)) * 0.3; return [w, 0.4, 0.1]; }
      const idx = this.anchor ? this.anchor.idx + ((now - this.anchor.t) * this.cps) / 1000 : ((now - this.speechStart) * this.cps) / 1000;
      const i = Math.floor(idx);
      if (i >= this.text.length) return [0.03, 0.3, 0];
      const [a, b, c] = viseme(this.text[i] || ' ');
      const [a2, b2, c2] = viseme(this.text[i + 1] || ' ');
      const f = idx - i; // blend toward the next sound
      let open = a + (a2 - a) * f * 0.5;
      if (this.env) { // follow the real loudness: closed in pauses, wider on stressed syllables
        const k = this.env.data[Math.floor((now - this.env.t0) / this.env.hop)] ?? 0;
        open *= clamp(0.15 + 0.95 * k, 0, 1.15);
      }
      return [open, b + (b2 - b) * f * 0.5, c + (c2 - c) * f * 0.5];
    }

    frame(now) {
      const dt = Math.min(0.06, (now - this.last) / 1000); this.last = now;
      const s = this.s, m = this.mode, e = this.el, T = {};
      this.emph *= Math.exp(-dt * 5);
      // expression targets
      T.smile = m.thinking ? 0.08 : m.speaking ? 0.3 : m.userSpeaking ? 0.62 : m.listening ? 0.5 : 0.4;
      T.browUp = (m.speaking ? this.emph * 0.5 + 0.08 : m.userSpeaking ? 0.28 : m.listening ? 0.16 : 0.05) + (m.thinking ? 0.1 : 0);
      T.furrow = m.thinking ? 0.45 : 0;
      // mouth
      const [mo, mw, mr] = this.mouthTarget(now);
      s.open = approach(s.open, mo, 30, dt); s.wide = approach(s.wide, mw, 24, dt); s.round = approach(s.round, mr, 24, dt);
      s.smile = approach(s.smile, T.smile, 4, dt); s.browUp = approach(s.browUp, T.browUp, 9, dt); s.furrow = approach(s.furrow, T.furrow, 5, dt);
      // blinks (sometimes double), eyes squint a little when smiling
      const B = this.blink;
      if (B.t0 < 0 && now > B.next) { B.t0 = now; B.double = Math.random() < 0.15; }
      let lidT = 1 - s.smile * 0.14 - (m.thinking ? 0.08 : 0);
      if (B.t0 >= 0) {
        const p = (now - B.t0) / 150;
        if (p >= 1) { if (B.double) { B.double = false; B.t0 = now + 60; } else { B.t0 = -1; B.next = now + 2200 + Math.random() * 4200; } } else if (p >= 0) lidT = Math.min(lidT, 1 - Math.sin(Math.PI * p));
      }
      s.lid = approach(s.lid, lidT, B.t0 >= 0 ? 60 : 10, dt);
      // gaze: steady at the viewer with small natural drifts; glances up and away when thinking
      const G = this.sacc;
      if (now > G.next) {
        G.next = now + 900 + Math.random() * 2200;
        G.x = (Math.random() - 0.5) * 2.2; G.y = (Math.random() - 0.5) * 1.4;
        if (Math.random() < 0.12 && !m.userSpeaking) { G.away = now + 700; G.x = (Math.random() < 0.5 ? -1 : 1) * 3.4; G.y = -1.6; }
      }
      let gx = G.x, gy = G.y;
      if (now < G.away) { gx = G.x; gy = G.y; }
      else if (m.thinking) { gx = -3.4; gy = -2.2; }
      else if (this.userGaze && (m.listening || m.userSpeaking)) { gx += clamp((0.5 - this.userGaze.x) * 7, -2.8, 2.8); gy += clamp((this.userGaze.y - 0.5) * 4, -1.5, 1.5); }
      s.gx = approach(s.gx, gx, 18, dt); s.gy = approach(s.gy, gy, 18, dt);
      // head: slow drift, emphasis nods while speaking, attentive nods while the candidate talks
      let yawT = Math.sin(now / 2300) * 1.6 + (m.speaking ? Math.sin(now / 700) * 1.2 : 0);
      let pitchT = Math.sin(now / 1900) * 0.8 + this.emph * (m.speaking ? 1.5 : 0);
      let rollT = Math.sin(now / 3100) * 0.8 + (m.listening && !m.userSpeaking ? 1.8 : 0) + (m.thinking ? -2 : 0);
      if (m.userSpeaking) { if (now > this.nodNext) { this.nodAt = now; this.nodNext = now + 3200 + Math.random() * 3500; } } else this.nodNext = Math.min(this.nodNext || 0, now + 1200);
      const np = (now - this.nodAt) / 650;
      if (np >= 0 && np < 1) pitchT += Math.sin(np * Math.PI) * 3.2;
      if (this.userGaze && (m.listening || m.userSpeaking)) yawT += clamp((0.5 - this.userGaze.x) * 6, -2.5, 2.5);
      s.yaw = approach(s.yaw, yawT, 5, dt); s.pitch = approach(s.pitch, pitchT, 8, dt); s.roll = approach(s.roll, rollT, 4, dt);
      s.breath = Math.sin(now / 1500);
      this.render();
    }

    render() {
      const s = this.s, e = this.el, f = (n) => n.toFixed(2);
      // ----- transforms -----
      e.body.setAttribute('transform', `translate(0 ${f(s.breath * 0.9)}) scale(1 ${f(1 + s.breath * 0.004)})`);
      e.head.setAttribute('transform', `translate(${f(s.yaw * 0.6)} ${f(s.pitch * 1.1 + s.breath * 0.5)}) rotate(${f(s.roll + s.yaw * 0.35)} 200 245)`);
      e.features.setAttribute('transform', `translate(${f(s.yaw * 1.6)} ${f(s.pitch * 0.9)})`);
      e.hair.setAttribute('transform', `translate(${f(s.yaw * 0.35)} ${f(-s.pitch * 0.15)})`);
      // ----- brows -----
      const up = s.browUp * 6, fur = s.furrow * 3.5;
      e.browL.setAttribute('d', `M157 ${f(113 - up + fur * 0.4)} Q171 ${f(104 - up - fur * 0.2)} 192 ${f(110 - up + fur)}`);
      e.browR.setAttribute('d', `M208 ${f(110 - up + fur)} Q229 ${f(104 - up - fur * 0.2)} 243 ${f(113 - up + fur * 0.4)}`);
      // ----- eyes -----
      for (const [lid, lash, cx] of [[e.lidL, e.lashL, 176], [e.lidR, e.lashR, 224]]) {
        const ctrl = 126 - 17 * s.lid; // 109 when fully open, 126 when closed
        lid.setAttribute('d', `M${cx - 18} 100 L${cx + 18} 100 L${cx + 18} 125 Q${cx} ${f(ctrl)} ${cx - 18} 125 Z`);
        lash.setAttribute('d', `M${cx - 15} 125.5 Q${cx} ${f(ctrl)} ${cx + 15} 125.5`);
      }
      const ix = clamp(s.gx, -4, 4), iy = clamp(s.gy, -2.5, 2.5);
      e.irisL.setAttribute('transform', `translate(${f(ix)} ${f(iy)})`); e.irisR.setAttribute('transform', `translate(${f(ix)} ${f(iy)})`);
      // ----- mouth -----
      const w = 20.5 + s.wide * 6 - s.round * 8, o = Math.max(0, s.open) * 16, sm = s.smile * 6.5, r = s.round;
      const cx = 200, cy = 187, Lx = cx - w, Rx = cx + w, cyc = cy - sm;
      const topY = cy - 8 - r * 1.8, bowY = cy - 5;
      const cUp = cy + 0.6 + sm * 0.9, cLow = cy + 1 + 2 * o + sm * 0.9;
      e.lipU.setAttribute('d', `M${f(Lx)} ${f(cyc)} C${f(cx - w * 0.6)} ${f(topY - sm * 0.3)} ${f(cx - w * 0.22)} ${f(topY)} ${cx} ${f(bowY)} C${f(cx + w * 0.22)} ${f(topY)} ${f(cx + w * 0.6)} ${f(topY - sm * 0.3)} ${f(Rx)} ${f(cyc)} Q${cx} ${f(cUp)} ${f(Lx)} ${f(cyc)} Z`);
      const bot = cy + o + 12 + r * 2;
      e.lipL.setAttribute('d', `M${f(Lx)} ${f(cyc)} Q${cx} ${f(cLow)} ${f(Rx)} ${f(cyc)} C${f(cx + w * 0.62)} ${f(bot)} ${f(cx - w * 0.62)} ${f(bot)} ${f(Lx)} ${f(cyc)} Z`);
      const inner = `M${f(Lx)} ${f(cyc)} Q${cx} ${f(cUp)} ${f(Rx)} ${f(cyc)} Q${cx} ${f(cLow)} ${f(Lx)} ${f(cyc)} Z`;
      e.mIn.setAttribute('d', inner); e.mClip.setAttribute('d', inner);
      const th = clamp(o * 0.5, 0, 8);
      e.teeth.setAttribute('x', f(cx - w * 0.8)); e.teeth.setAttribute('width', f(w * 1.6)); e.teeth.setAttribute('y', f(cy - 0.6)); e.teeth.setAttribute('height', f(th));
      e.tongue.setAttribute('cy', f(cy + o * 0.9)); e.tongue.setAttribute('rx', f(w * 0.55)); e.tongue.setAttribute('ry', f(Math.max(0, o * 0.32)));
      e.lipHl.setAttribute('cy', f(cy + o + 4.6)); e.lipHl.setAttribute('opacity', f(0.2 + s.round * 0.05));
      e.corL.setAttribute('cx', f(Lx - 0.5)); e.corL.setAttribute('cy', f(cyc)); e.corR.setAttribute('cx', f(Rx + 0.5)); e.corR.setAttribute('cy', f(cyc));
      // smile creases and cheek lift
      const nl = clamp(s.smile - 0.5, 0, 0.3) * 1.2;
      e.nlL.setAttribute('opacity', f(nl)); e.nlR.setAttribute('opacity', f(nl));
      e.cheekL.setAttribute('cy', f(160 - s.smile * 4)); e.cheekR.setAttribute('cy', f(160 - s.smile * 4));
    }
    destroy() { cancelAnimationFrame(this.raf); }
  }

  C.Avatar = Avatar;
})(window.Caddie);
