// Hash router, header and footer.
(function (C) {
  // Greenroom mark: a G whose top is a dotted line, with a green bar at the end. Colors follow the theme by default.
  const logoMark = (primary = 'var(--color-primary)', green = 'var(--color-success)') => `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke-width="8" stroke-linecap="round"><path d="M47 20A18 18 0 0 0 16.76 21.46" style="stroke:${primary}" stroke-dasharray="0.01 11.93"/><path d="M16.76 21.46A18 18 0 1 0 50 34" style="stroke:${primary}"/><path d="M50 34H35" style="stroke:${green}"/></svg>`;
  const LOGO = logoMark();
  C.logoMark = logoMark;
  C.LOGO = LOGO;
  const app = document.getElementById('app');
  let current = null;

  function header(route, minimal) {
    const inApp = route.startsWith('/app');
    if (route === '/admin') {
      return `<header class="site-header"><div class="container"><a class="logo" href="#/">${LOGO}Greenroom <span class="badge" style="font-size:.7rem">Admin</span></a><nav class="nav" aria-label="Admin"><a href="#/styleguide">Style guide</a><a href="#/">Back to Greenroom</a></nav></div></header>`;
    }
    if (route.startsWith('/recruiter')) {
      return `<header class="site-header"><div class="container"><a class="logo" href="#/">${LOGO}Greenroom <span class="badge" style="font-size:.7rem">Recruiter</span></a><nav class="nav" aria-label="Recruiter"><a href="#/recruiter" ${route === '/recruiter' ? 'aria-current="page"' : ''}>Roles</a><a href="#/recruiter/settings" ${route === '/recruiter/settings' ? 'aria-current="page"' : ''}>Profile and Settings</a><a class="btn btn-primary btn-sm" href="#/recruiter/new">Create new role</a></nav></div></header>`;
    }

    const link = (href, text, cur) => `<a href="${href}" ${cur ? 'aria-current="page"' : ''}>${text}</a>`;
    const nav = minimal ? '' : inApp
      ? `${link('#/app', 'Dashboard', route === '/app')}${link('#/app/settings', 'Profile and Settings', route === '/app/settings')}<a class="btn btn-primary btn-sm" href="#/app/setup">Begin session</a>`
      : `${link('#/value', 'Value', route === '/value')}${link('#/about', 'About', route === '/about')}${link('#/plans', 'Plans', route === '/plans')}<a class="btn btn-primary btn-sm" href="#/app">Start practicing</a>`;
    return `<header class="site-header"><div class="container"><a class="logo" href="#/">${LOGO}Greenroom</a><nav class="nav" aria-label="Main">${nav}</nav></div></header>`;
  }
  // The recruiter link appears only on the main homepage.
  const footer = (route) => `<footer class="site-footer"><div class="container"><div class="foot-left"><span>Greenroom · Interview practice</span><span class="small">Sessions are stored in your browser. Greenroom counts anonymous visits and any rating you choose to leave, and never collects your video, audio or answers. Optional AI features send text to Anthropic&rsquo;s Claude.</span></div>${route === '/' ? '<div class="foot-links"><a class="foot-link" href="#/recruiter">Recruiter login</a><a class="foot-link" href="#/admin">Admin</a></div>' : ''}</div></footer>`;

  // One visit per browsing session, whichever page the person lands on.
  function trackVisit() {
    let seen = false;
    try { seen = sessionStorage.getItem('caddie.visit') === '1'; sessionStorage.setItem('caddie.visit', '1'); } catch { /* blocked */ }
    if (!seen) C.analytics.track('visit');
  }

  // Sub navigation: smooth-scroll to a section on the current page and highlight the section in view.
  let unwire = null;
  function wireSubnav(view) {
    if (unwire) { unwire(); unwire = null; }
    const links = [...view.querySelectorAll('.subnav a[data-jump]')];
    if (!links.length) return;
    const targets = links.map((a) => document.getElementById(a.dataset.jump));
    const mark = () => {
      const line = window.innerHeight * 0.3; let active = -1;
      targets.forEach((t, i) => { if (t && t.getBoundingClientRect().top <= line) active = i; });
      links.forEach((a, i) => { if (i === active) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    };
    const click = (e) => {
      const a = e.target.closest('a[data-jump]'); if (!a) return;
      e.preventDefault();
      const t = document.getElementById(a.dataset.jump);
      if (t) t.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    };
    view.addEventListener('click', click); window.addEventListener('scroll', mark, { passive: true }); mark();
    unwire = () => { view.removeEventListener('click', click); window.removeEventListener('scroll', mark); };
  }

  async function route() {
    trackVisit();
    const hash = location.hash.replace(/^#/, '') || '/';
    const [path, ...rest] = hash.split('/').filter(Boolean).length ? ['/' + hash.split('/').filter(Boolean).slice(0, 2).join('/'), ...hash.split('/').filter(Boolean).slice(2)] : ['/'];
    if (current && current.destroy) { try { current.destroy(); } catch { /* ignore */ } }
    current = null;
    const publicPages = { '/': 'home', '/value': 'value', '/about': 'about', '/plans': 'plans' };
    const appPages = { '/app': 'dashboard', '/app/setup': 'setup', '/app/interview': 'interview', '/app/present': 'presentation', '/app/settings': 'settings', '/admin': 'admin', '/styleguide': 'styleguide', '/recruiter': 'recruiter', '/recruiter/new': 'recruiterEdit', '/recruiter/settings': 'recruiterSettings', '/recruiter/edit': 'recruiterEdit' };
    let key = path;
    let params = rest;
    if (path === '/app/summary') { key = '/app/summary'; params = rest; }
    const minimal = key === '/app/interview' || key === '/app/present';
    app.className = key.startsWith('/recruiter') ? 'theme-recruiter' : '';
    app.innerHTML = `${header(key, minimal)}<main id="view" tabindex="-1"></main>${minimal ? '' : footer(key)}`;
    const view = document.getElementById('view');
    window.scrollTo(0, 0);
    if (publicPages[key]) {
      view.innerHTML = C.views[publicPages[key]]();
      if (key === '/') { let seen = false; try { seen = sessionStorage.getItem('caddie.hv') === '1'; sessionStorage.setItem('caddie.hv', '1'); } catch { /* blocked */ } if (!seen) C.analytics.track('home_view'); }
      const hero = view.querySelector('#hero-avatar');
      if (hero) { const av = new C.Avatar(hero); av.setListening(true); current = { destroy: () => av.destroy() }; }
      wireSubnav(view);
      return;
    }
    const name = key === '/app/summary' ? 'summary' : appPages[key];
    if (name) { current = (await C.views[name](view, params)) || null; wireSubnav(view); return; }
    view.innerHTML = '<section class="container page"><div class="empty"><strong>Page not found</strong><p style="margin-top:1rem"><a class="btn btn-primary" href="#/">Go home</a></p></div></section>';
  }
  window.addEventListener('hashchange', route);
  route();
})(window.Caddie);
