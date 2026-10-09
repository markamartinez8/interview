// Anonymous usage counts and ratings. Works in the browser and in the Node server (same counting rules in both places).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Caddie = root.Caddie || { views: {} }; root.Caddie.analytics = api; }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const TYPES = ['home_view', 'interview_start', 'interview_complete', 'presentation_start', 'presentation_complete', 'rating'];

  // Counts people (anonymous visitor ids), not page loads. "Started" means the live interview or presentation began;
  // "completed" means an interview ran through all its questions, or a presentation was ended by the presenter.
  function aggregate(events) {
    const users = (type, kind) => new Set(events.filter((e) => e.type === type && (!kind || e.kind === kind)).map((e) => e.vid));
    const count = (type) => events.filter((e) => e.type === type).length;
    const ratings = (kind) => {
      const list = events.filter((e) => e.type === 'rating' && e.kind === kind && e.stars >= 1 && e.stars <= 5);
      const withComment = list.filter((e) => e.comment && e.comment.trim());
      return { count: list.length, avg: list.length ? Math.round((list.reduce((n, e) => n + e.stars, 0) / list.length) * 10) / 10 : null, withComments: withComment.length,
        comments: withComment.slice().sort((a, b) => b.t - a.t).slice(0, 100).map((e) => ({ stars: e.stars, comment: e.comment.trim(), t: e.t })) };
    };
    const flow = (name) => {
      const started = users(`${name}_start`), completed = users(`${name}_complete`);
      return { startedUsers: started.size, startedCount: count(`${name}_start`), completedUsers: completed.size, completedCount: count(`${name}_complete`),
        completionRate: started.size ? Math.round((completed.size / started.size) * 100) : null, rating: ratings(name) };
    };
    return { homepageUsers: users('home_view').size, homepageVisits: count('home_view'), interview: flow('interview'), presentation: flow('presentation') };
  }

  const api = { TYPES, aggregate };
  if (typeof window === 'undefined') return api;

  // ----- browser side -----
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked */ } } };
  function visitorId() {
    let id = null; try { id = localStorage.getItem('caddie.vid'); } catch { /* blocked */ }
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); try { localStorage.setItem('caddie.vid', id); } catch { /* blocked */ } }
    return id;
  }
  // Record in this browser, and send to the Caddie server when there is one (silently ignored on a plain static host).
  api.track = function (type, extra) {
    if (!TYPES.includes(type)) return;
    const ev = { t: Date.now(), vid: visitorId(), type, ...(extra || {}) };
    const all = LS.get('caddie.events', []); all.push(ev); LS.set('caddie.events', all.slice(-2000));
    try { fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev), keepalive: true }).catch(() => {}); } catch { /* ignore */ }
  };
  api.localEvents = () => LS.get('caddie.events', []);
  return api;
});
