// Admin: lightweight sign-in and a simple analytics page.
(function (C) {
  const V = C.views;
  const { esc, fmtDateTime } = C.util;
  const KEY = 'caddie.admin';
  const getToken = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
  const setToken = (t) => { try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch { /* blocked */ } };
  const starText = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

  // Uses the Greenroom server when there is one. On a plain static host there is no server, so it falls back to a check in the browser
  // (lightweight by design: the demo credentials are in the page source).
  async function signIn(username, password) {
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      if (r.ok) return { token: (await r.json()).token };
      if (r.status === 401 || r.status === 429) return { error: (await r.json().catch(() => ({}))).error || 'Incorrect username or password.' };
    } catch { /* no server */ }
    return (await localCheck(username, password)) ? { token: 'local' } : { error: 'Incorrect username or password.' };
  }
  // Same sign-in as the server's built-in one, compared as SHA-256 hashes so the password is not written in the page source.
  const USER_HASH = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', PASS_HASH = 'c887fccb09ca7da3d2118bfaaed1edd1c5ea5f76a9136661b38d6dda0cb963b0';
  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function localCheck(username, password) {
    try { return (await sha256(String(username).trim().toLowerCase())) === USER_HASH && (await sha256(String(password))) === PASS_HASH; } catch { return false; }
  }
  async function deleteRating(token, source, id) {
    if (source === 'server') {
      const r = await fetch('/api/admin/rating/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) });
      if (r.status === 401) return { expired: true };
      if (!r.ok && r.status !== 404) return { error: 'Could not delete that rating. Try again.' };
      return {};
    }
    C.analytics.deleteLocal(id);
    return {};
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
        <div class="row" style="justify-content:space-between"><a class="btn btn-ghost" href="#/">Back to Greenroom</a><button class="btn btn-primary" type="submit">Sign in</button></div></form></div></section>`;
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
    // One row per rating. The stars and the comment from the same person and sitting are shown together and deleted together.
    const entries = r.entries.length ? `<ul class="comments">${r.entries.map((c) => `<li class="entry"><div class="entry-main"><span class="stars-static" aria-label="${c.stars} out of 5">${starText(c.stars)}</span><div>${c.comment ? esc(c.comment) : '<span class="muted">No comment</span>'}</div><div class="small muted">${fmtDateTime(c.t)}</div></div><button class="btn btn-ghost btn-sm entry-del" type="button" data-del="${esc(c.id)}" data-stars="${c.stars}" aria-label="Delete this ${c.stars}-star rating${c.comment ? ' and its comment' : ''}">Delete</button></li>`).join('')}</ul>` : '<p class="small muted">No ratings yet.</p>';
    return `<div class="stack"><h2 class="col-title">${name}</h2>
      ${stat(`Users who started the ${name.toLowerCase().replace(/s$/, '')} workflow`, f.startedUsers, f.startedCount !== f.startedUsers ? `${f.startedCount} starts in total` : '')}
      ${stat(`Users who completed the ${name.toLowerCase().replace(/s$/, '')} workflow`, f.completedUsers, f.completionRate != null ? `${f.completionRate}% of the users who started` : '')}
      ${stat(`Average rating for ${name.toLowerCase()}`, ratingVal, ratingSub)}
      <div class="card"><h3 style="margin-bottom:.6rem">${name.replace(/s$/, '')} ratings and comments</h3>${entries}</div></div>`;
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
      <div class="callout ${res.source === 'server' ? '' : 'warn'}" style="margin-bottom:1rem">${res.source === 'server' ? 'Showing activity from every visitor, collected by the Greenroom server. Counts are anonymous people, not page loads.' : 'Showing activity from this browser only. This site has no Greenroom server collecting visits, so other visitors are not counted. Counts are anonymous people, not page loads.'}</div>
      <div class="stat-row">${stat('Users', s.siteUsers, 'Unique people who used the website')}${stat('Visits', s.siteVisits, 'Total visits to the website')}${stat('Users accessing the homepage', s.homepageUsers, s.homepageVisits !== s.homepageUsers ? `${s.homepageVisits} homepage visits in total` : 'Unique people')}</div>
      <div class="dash-cols" style="margin-top:1rem">${flowHTML('Interviews', s.interview)}${flowHTML('Presentations', s.presentation)}</div>
      <p class="small muted" style="margin-top:1rem">Users are unique anonymous people (one per browser). Visits are total visits: each time someone arrives at the site in a new browser tab or window counts once, however many pages they open. Started means the live interview or presentation began. Completed means an interview ran through every question, or a presentation was ended by the presenter.</p></section>`;
    root.querySelector('#ad-out').addEventListener('click', () => { setToken(null); V.admin(root); });
    root.onclick = async (e) => { // assigned, not added, so re-rendering the page never stacks handlers
      const b = e.target.closest('[data-del]'); if (!b) return;
      if (!confirm(`Delete this ${b.dataset.stars}-star rating and its comment? This cannot be undone.`)) return;
      b.disabled = true;
      const r = await deleteRating(token, res.source, b.dataset.del);
      if (r.expired) { setToken(null); return login(root, 'Your session expired. Sign in again.'); }
      if (r.error) { C.util.toast(r.error); b.disabled = false; return; }
      C.util.toast('Rating deleted.');
      V.admin(root);
    };
  };
})(window.Caddie);
