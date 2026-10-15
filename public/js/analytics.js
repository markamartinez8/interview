// Anonymous usage counts and ratings. Works in the browser and in the Node server (same counting rules in both places).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Caddie = root.Caddie || { views: {} }; root.Caddie.analytics = api; }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const TYPES = ['visit', 'home_view', 'interview_start', 'interview_complete', 'presentation_start', 'presentation_complete', 'rating'];

  // Counts people (anonymous visitor ids), not page loads. "Started" means the live interview or presentation began;
  // "completed" means an interview ran through all its questions, or a presentation was ended by the presenter.
  // Every rating has an id so an admin can remove it. Older ratings have none, so one is derived from when and who (stable across reads).
  const eventId = (e) => e.id || `t${e.t}-${e.vid}`;

  function aggregate(events) {
    const users = (type, kind) => new Set(events.filter((e) => e.type === type && (!kind || e.kind === kind)).map((e) => e.vid));
    const count = (type) => events.filter((e) => e.type === type).length;
    const ratings = (kind) => {
      const list = events.filter((e) => e.type === 'rating' && e.kind === kind && e.stars >= 1 && e.stars <= 5);
      const withComment = list.filter((e) => e.comment && e.comment.trim());
      return { count: list.length, avg: list.length ? Math.round((list.reduce((n, e) => n + e.stars, 0) / list.length) * 10) / 10 : null, withComments: withComment.length,
        // One entry per rating: the stars and the comment left in the same sitting by the same person stay together, with or without a comment.
        entries: list.slice().sort((a, b) => b.t - a.t).slice(0, 100).map((e) => ({ id: eventId(e), stars: e.stars, comment: (e.comment || '').trim(), t: e.t })) };
    };
    const flow = (name) => {
      const started = users(`${name}_start`), completed = users(`${name}_complete`);
      return { startedUsers: started.size, startedCount: count(`${name}_start`), completedUsers: completed.size, completedCount: count(`${name}_complete`),
        completionRate: started.size ? Math.round((completed.size / started.size) * 100) : null, rating: ratings(name) };
    };
    // Website-wide: a user is one anonymous person who did anything on the site; a visit is one browsing session (tab) arriving at the site.
    // Older data has no 'visit' events, so visits never count fewer than homepage visits.
    const everyone = new Set(events.map((e) => e.vid));
    return { siteUsers: everyone.size, siteVisits: Math.max(count('visit'), count('home_view')), homepageUsers: users('home_view').size, homepageVisits: count('home_view'), interview: flow('interview'), presentation: flow('presentation') };
  }

  const api = { TYPES, aggregate, eventId };
  if (typeof window === 'undefined') return api;

  // ----- browser side -----
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked */ } } };
  function visitorId() {
    let id = null; try { id = localStorage.getItem('caddie.vid'); } catch { /* blocked */ }
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); try { localStorage.setItem('caddie.vid', id); } catch { /* blocked */ } }
    return id;
  }
  // Record in this browser, and send to the Greenroom server when there is one (silently ignored on a plain static host).
  api.track = function (type, extra) {
    if (!TYPES.includes(type)) return;
    const ev = { t: Date.now(), vid: visitorId(), type, ...(extra || {}) };
    if (type === 'rating') ev.id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 40);
    const all = LS.get('caddie.events', []); all.push(ev); LS.set('caddie.events', all.slice(-2000));
    try { fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev), keepalive: true }).catch(() => {}); } catch { /* ignore */ }
  };
  api.localEvents = () => LS.get('caddie.events', []);
  // Browser-only fallback (a static host with no server): remove one rating from this browser's saved events.
  api.deleteLocal = (id) => { LS.set('caddie.events', LS.get('caddie.events', []).filter((e) => !(e.type === 'rating' && eventId(e) === id))); };
  return api;
});
