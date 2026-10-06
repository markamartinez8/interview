// Browser side of the optional AI features. All calls go to this computer's Caddie server, never straight to Anthropic.
(function (C) {
  async function post(url, body, ms) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(d.error || 'Request failed'), { status: r.status });
      return d;
    } finally { clearTimeout(t); }
  }
  C.ai = {
    info: { available: false },
    async status() {
      try { const r = await fetch('/api/status'); if (!r.ok) throw new Error(); this.info = await r.json(); } catch { this.info = { available: false, offline: true }; }
      return this.info;
    },
    async questions(role, jd) { try { return (await post('/api/questions', { role, jd }, 35000)).questions || null; } catch { return null; } },
    async followUp(payload) { try { return (await post('/api/followup', payload, 9000)).followUp || null; } catch { return null; } },
    async saveKey(key) { this.info = await post('/api/key', { key }, 25000); return this.info; },
    async removeKey() { const r = await fetch('/api/key', { method: 'DELETE' }); this.info = await r.json(); return this.info; },
  };
  const POLICY = '<a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener">Anthropic privacy policy</a>';
  C.disclosure = {
    questions: `Turning this on sends the job title and job description you entered to Anthropic's Claude so it can write your questions. See the ${POLICY}.`,
    followups: `Turning this on sends the text of your answers (the transcript) and the job title to Anthropic's Claude so Andy can ask follow-up questions. Your video and audio are never sent. See the ${POLICY}.`,
    general: `AI features are optional and off by default. When on, Caddie sends text, never video or audio, to Anthropic's Claude. See the ${POLICY}.`,
  };
})(window.Caddie);
