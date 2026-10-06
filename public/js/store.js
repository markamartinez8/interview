// Local-only persistence: profile and preferences in localStorage, sessions and recordings in IndexedDB.
window.Caddie = window.Caddie || { views: {} };
(function (C) {
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
  };
  const mem = { sessions: new Map(), recordings: new Map() };
  let dbPromise;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      try {
        const r = indexedDB.open('caddie', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('sessions', { keyPath: 'id' }); r.result.createObjectStore('recordings'); };
        r.onsuccess = () => resolve(r.result);
        r.onerror = r.onblocked = () => resolve(null);
      } catch { resolve(null); }
    });
    return dbPromise;
  }
  async function run(store, mode, fn) {
    const d = await db();
    if (!d) return undefined;
    return new Promise((resolve, reject) => {
      const t = d.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = t.onabort = () => reject(t.error);
    });
  }

  const PROFILE_DEFAULT = { name: '', email: '', targetRole: '' };
  const PREFS_DEFAULT = { mode: 'practice', voiceURI: '', silenceSec: 5 };

  C.store = {
    getProfile: () => ({ ...PROFILE_DEFAULT, ...LS.get('caddie.profile', {}) }),
    setProfile: (p) => LS.set('caddie.profile', p),
    getPrefs: () => ({ ...PREFS_DEFAULT, ...LS.get('caddie.prefs', {}) }),
    setPrefs: (p) => LS.set('caddie.prefs', p),
    getLastSetup: () => LS.get('caddie.lastSetup', null),
    setLastSetup: (s) => LS.set('caddie.lastSetup', s),

    async saveSession(s) { mem.sessions.set(s.id, s); await run('sessions', 'readwrite', (st) => st.put(s)); },
    async getSession(id) { return (await run('sessions', 'readonly', (st) => st.get(id))) || mem.sessions.get(id) || null; },
    async listSessions() {
      const fromDb = (await run('sessions', 'readonly', (st) => st.getAll())) || [...mem.sessions.values()];
      return fromDb.sort((a, b) => b.createdAt - a.createdAt);
    },
    async deleteSession(id) {
      mem.sessions.delete(id); mem.recordings.delete(id);
      await run('sessions', 'readwrite', (st) => st.delete(id));
      await run('recordings', 'readwrite', (st) => st.delete(id));
    },
    async saveRecording(id, blob) { mem.recordings.set(id, blob); await run('recordings', 'readwrite', (st) => st.put(blob, id)); },
    async getRecording(id) { return (await run('recordings', 'readonly', (st) => st.get(id))) || mem.recordings.get(id) || null; },
  };

  C.util = {
    esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    fmtDur(sec) { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, '0')}`; },
    fmtDate: (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    download(filename, blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    toast(msg) {
      const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
      document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
    },
  };
})(window.Caddie);
