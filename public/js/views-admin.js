// Admin: lightweight sign-in and a simple analytics page.
(function (C) {
  const V = C.views;
  const { esc, fmtDateTime } = C.util;
  const KEY = 'caddie.admin';
  const getToken = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
  const setToken = (t) => { try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch { /* blocked */ } };
  const starText = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

  // Uses the Caddie server when there is one. On a plain static host there is no server, so it falls back to a check in the browser
  // (lightweight by design: the demo credentials are in the page source).
  async function signIn(username, password) {
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      if (r.ok) return { token: (await r.json()).token };
      if (r.status === 401 || r.status === 429) return { error: (await r.json().catch(() => ({}))).error || 'Incorrect username or password.' };
    } catch { /* no server */ }
    return username === 'caddie' && password === 'test' ? { token: 'local' } : { error: 'Incorrect username or password.' };
  }
  async function loadStats(token) {
    if (token !== 'local') {
      try {
        const r = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
        if (r.status === 401) return { expired: true };
        if (r.ok) { const d = await r.json(); return { source: 'server', stats: d.stats }; }
      } catch { /* fall through */ }
    }
    return { source: 'browser', stats: C.analytics.aggregate(C.analytics.localEvents()) };
  }

  function login(root, message) {
    root.innerHTML = `<section class="container page"><div class="card" style="max-width:420px;margin:2rem auto">
      <span class="eyebrow">Admin</span><h1 style="font-size:1.8rem;margin:.3rem 0 1rem">Sign in</h1>
      <form class="stack" id="ad-form"><div class="field"><label for="ad-user">Username</label><input type="text" id="ad-user" autocomplete="username" autocapitalize="off"></div>
        <div class="field"><label for="ad-pass">Password</label><input type="password" id="ad-pass" autocomplete="current-password"></div>
        <div class="error-text" id="ad-err" role="alert">${esc(message || '')}</div>
        <div class="row" style="justify-content:space-between"><a class="btn btn-ghost" href="#/">Back to Caddie</a><button class="btn btn-primary" type="submit">Sign in</button></div></form></div></section>`;
    root.querySelector('#ad-user').focus();
    root.querySelector('#ad-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
      const r = await signIn(root.querySelector('#ad-user').value.trim(), root.querySelector('#ad-pass').value);
      if (r.token) { setToken(r.token); V.admin(root); } else { root.querySelector('#ad-err').textContent = r.error; btn.disabled = false; }
    });
  }

  const stat = (label, value, sub) => `<div class="card stat"><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;
  function flowHTML(name, f) {
    const r = f.rating;
    const ratingVal = r.avg == null ? '—' : `${r.avg.toFixed(1)}<small> / 5</small>`;
    const ratingSub = r.avg == null ? 'No ratings yet' : `<span class="stars-static" aria-label="${r.avg} out of 5 stars">${starText(r.avg)}</span> ${r.count} rating${r.count === 1 ? '' : 's'} · ${r.withComments} with comments`;
    const comments = r.comments.length ? `<ul class="comments">${r.comments.map((c) => `<li><span class="stars-static" aria-label="${c.stars} out of 5">${starText(c.stars)}</span><div>${esc(c.comment)}</div><div class="small muted">${fmtDateTime(c.t)}</div></li>`).join('')}</ul>` : '<p class="small muted">No comments yet.</p>';
    return `<div class="stack"><h2 class="col-title">${name}</h2>
      ${stat(`Users who started the ${name.toLowerCase().replace(/s$/, '')} workflow`, f.startedUsers, f.startedCount !== f.startedUsers ? `${f.startedCount} starts in total` : '')}
      ${stat(`Users who completed the ${name.toLowerCase().replace(/s$/, '')} workflow`, f.completedUsers, f.completionRate != null ? `${f.completionRate}% of the users who started` : '')}
      ${stat(`Average rating for ${name.toLowerCase()}`, ratingVal, ratingSub)}
      <div class="card"><h3 style="margin-bottom:.6rem">${name.replace(/s$/, '')} comments</h3>${comments}</div></div>`;
  }

  V.admin = async (root) => {
    const token = getToken();
    if (!token) return login(root);
    root.innerHTML = '<section class="container page"><p class="muted">Loading…</p></section>';
    const res = await loadStats(token);
    if (res.expired) { setToken(null); return login(root, 'Your session expired. Sign in again.'); }
    if (!root.isConnected) return;
    const s = res.stats;
    root.innerHTML = `<section class="container page">
      <div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">Admin</span><h1 style="font-size:clamp(1.8rem,3.6vw,2.6rem)">Web analytics</h1></div><button class="btn btn-ghost" id="ad-out">Sign out</button></div>
      <div class="callout ${res.source === 'server' ? '' : 'warn'}" style="margin-bottom:1rem">${res.source === 'server' ? 'Showing activity from every visitor, collected by the Caddie server. Counts are anonymous people, not page loads.' : 'Showing activity from this browser only. This site has no Caddie server collecting visits, so other visitors are not counted. Counts are anonymous people, not page loads.'}</div>
      ${stat('Users accessing the homepage', s.homepageUsers, s.homepageVisits !== s.homepageUsers ? `${s.homepageVisits} visits in total` : '')}
      <div class="dash-cols" style="margin-top:1rem">${flowHTML('Interviews', s.interview)}${flowHTML('Presentations', s.presentation)}</div>
      <p class="small muted" style="margin-top:1rem">Started means the live interview or presentation began. Completed means an interview ran through every question, or a presentation was ended by the presenter.</p></section>`;
    root.querySelector('#ad-out').addEventListener('click', () => { setToken(null); V.admin(root); });
  };
})(window.Caddie);
