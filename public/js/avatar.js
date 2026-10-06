// Andy: an animated illustrated interviewer plus one consistent browser voice.
(function (C) {
  const SVG = `
  <defs><linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3730A3"/><stop offset="1" stop-color="#272179"/></linearGradient></defs>
  <path d="M20 340 C30 272 85 250 150 250 C215 250 270 272 280 340 Z" fill="url(#shirt)"/>
  <path d="M118 252 L150 300 L182 252 L168 246 L150 268 L132 246 Z" fill="#F7F8FA"/>
  <rect x="124" y="196" width="52" height="62" rx="18" fill="#C58E6C"/>
  <g class="head">
    <ellipse cx="88" cy="158" rx="10" ry="15" fill="#D9A07C"/><ellipse cx="212" cy="158" rx="10" ry="15" fill="#D9A07C"/>
    <ellipse cx="150" cy="150" rx="62" ry="78" fill="#E0A985"/>
    <path d="M84 146 C70 66 118 40 154 42 C196 42 232 70 216 146 C208 110 192 90 150 88 C110 90 92 110 84 146 Z" fill="#3A2A22"/>
    <path d="M104 124 Q122 114 138 122" stroke="#3A2A22" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path d="M162 122 Q178 114 196 124" stroke="#3A2A22" stroke-width="5" stroke-linecap="round" fill="none"/>
    <g class="eye"><ellipse cx="122" cy="144" rx="11" ry="7.5" fill="#fff"/><circle cx="122" cy="144" r="5" fill="#2B2118"/></g>
    <g class="eye"><ellipse cx="178" cy="144" rx="11" ry="7.5" fill="#fff"/><circle cx="178" cy="144" r="5" fill="#2B2118"/></g>
    <path d="M150 150 Q142 176 148 182 Q154 186 160 181" stroke="#B9805F" stroke-width="3" stroke-linecap="round" fill="none"/>
    <ellipse class="mouth" cx="150" cy="204" rx="17" ry="2" fill="#6E2A2F"/>
    <path class="lip" d="M133 204 Q150 212 167 204" stroke="#A65A55" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  </g>`;

  class Avatar {
    constructor(svg) {
      this.svg = svg; svg.innerHTML = SVG;
      this.mouth = svg.querySelector('.mouth'); this.lip = svg.querySelector('.lip'); this.head = svg.querySelector('.head');
      this.eyes = [...svg.querySelectorAll('.eye')];
      this.speaking = false; this.open = 0; this.nodUntil = 0; this.nextBlink = 0; this.pulse = 0;
      const loop = (t) => { this.frame(t); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    }
    setSpeaking(on) { this.speaking = on; }
    boundary() { this.pulse = 1; }
    frame(t) {
      const wave = Math.abs(Math.sin(t / 95)) * 0.55 + Math.abs(Math.sin(t / 53)) * 0.3 + this.pulse * 0.25;
      this.pulse *= 0.9;
      this.open += ((this.speaking ? Math.min(1, wave) : 0) - this.open) * 0.35;
      const ry = 2 + this.open * 13, rx = 17 - this.open * 4;
      this.mouth.setAttribute('rx', rx.toFixed(1)); this.mouth.setAttribute('ry', ry.toFixed(1));
      this.lip.setAttribute('d', `M${150 - rx} 204 Q150 ${(204 + 8 + this.open * 16).toFixed(1)} ${150 + rx} 204`);
      if (t > this.nextBlink) {
        this.eyes.forEach((e) => e.classList.add('blink'));
        setTimeout(() => this.eyes.forEach((e) => e.classList.remove('blink')), 120);
        this.nextBlink = t + 2000 + Math.random() * 4000;
      }
      const nod = t < this.nodUntil ? Math.sin((this.nodUntil - t) / 120) * 4 : 0;
      const sway = Math.sin(t / 1700) * 1.2 + (this.speaking ? Math.sin(t / 400) * 0.8 : 0);
      this.head.setAttribute('transform', `translate(0 ${(Math.sin(t / 1100) * 1.5 + nod).toFixed(2)}) rotate(${sway.toFixed(2)} 150 250)`);
      if (!this.speaking && Math.random() < 0.004) this.nodUntil = t + 700;
    }
    destroy() { cancelAnimationFrame(this.raf); }
  }

  function score(v) {
    let s = 0;
    if (/^en[-_]US/i.test(v.lang)) s += 4; else if (/^en/i.test(v.lang)) s += 2; else return -1;
    if (/natural|neural|online/i.test(v.name)) s += 12;
    if (/premium|enhanced|siri/i.test(v.name)) s += 10;
    if (/google/i.test(v.name)) s += 6;
    if (/guy|davis|andrew|brian|christopher|eric|roger|steffan|david|daniel|alex|aaron|fred|male/i.test(v.name)) s += 5;
    if (/female|zira|aria|jenny|samantha|karen|moira|susan|hazel|victoria/i.test(v.name)) s -= 8;
    return s;
  }

  const voice = {
    supported: () => 'speechSynthesis' in window,
    async ready() {
      if (!voice.supported()) return [];
      if (!speechSynthesis.getVoices().length) {
        await new Promise((res) => {
          const done = () => { speechSynthesis.removeEventListener('voiceschanged', done); res(); };
          speechSynthesis.addEventListener('voiceschanged', done);
          setTimeout(done, 2000);
        });
      }
      return speechSynthesis.getVoices();
    },
    async list() { return (await voice.ready()).filter((v) => score(v) >= 0).sort((a, b) => score(b) - score(a)); },
    // One voice for the whole interview: the saved choice if still installed, otherwise the best-ranked English voice.
    async choose(savedURI) {
      const all = await voice.list();
      return all.find((v) => v.voiceURI === savedURI) || all[0] || null;
    },
    // Resolves when finished. If the browser never starts speaking, an estimated duration stands in.
    speak(text, chosen, avatar) {
      return new Promise((resolve) => {
        let done = false, timer;
        const words = text.split(/\s+/).length;
        const finish = () => { if (done) return; done = true; clearTimeout(timer); avatar && avatar.setSpeaking(false); resolve(); };
        avatar && avatar.setSpeaking(true);
        if (!voice.supported()) { timer = setTimeout(finish, words * 400 + 1500); return; }
        try {
          const u = new SpeechSynthesisUtterance(text);
          if (chosen) { u.voice = chosen; u.lang = chosen.lang; } else u.lang = 'en-US';
          u.rate = 0.95; u.pitch = 1;
          u.onstart = () => { clearTimeout(timer); timer = setTimeout(finish, words * 700 + 8000); };
          u.onboundary = () => avatar && avatar.boundary();
          u.onend = finish; u.onerror = finish;
          timer = setTimeout(finish, 3000 + words * 400);
          speechSynthesis.speak(u);
        } catch { timer = setTimeout(finish, words * 400 + 1500); }
      });
    },
    cancel() { try { speechSynthesis.cancel(); } catch { /* none */ } },
  };

  C.Avatar = Avatar; C.voice = voice; C.AVATAR_SVG = SVG;
})(window.Caddie);
