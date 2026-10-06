// Hash router, header and footer.
(function (C) {
  const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#3730A3"/><path d="M12 24V8l10 4.5L12 17" fill="#fff"/><circle cx="12" cy="24" r="2.2" fill="#2A9DA8"/></svg>';
  const app = document.getElementById('app');
  let current = null;

  function header(route, minimal) {
    const inApp = route.startsWith('/app');
    const link = (href, text, cur) => `<a href="${href}" ${cur ? 'aria-current="page"' : ''}>${text}</a>`;
    const nav = minimal ? '' : inApp
      ? `${link('#/app', 'Dashboard', route === '/app')}${link('#/app/settings', 'Settings', route === '/app/settings')}<a class="btn btn-primary btn-sm" href="#/app/setup">Begin session</a>`
      : `${link('#/value', 'Value', route === '/value')}${link('#/about', 'About', route === '/about')}${link('#/plans', 'Plans', route === '/plans')}<a class="btn btn-primary btn-sm" href="#/app">Start practicing</a>`;
    return `<header class="site-header"><div class="container"><a class="logo" href="${inApp ? '#/app' : '#/'}">${LOGO}Caddie</a><nav class="nav" aria-label="Main">${nav}</nav></div></header>`;
  }
  const footer = '<footer class="site-footer"><div class="container"><span>Caddie · Interview practice</span><span>Sessions are stored in your browser. Optional AI features send text, never video or audio, to Anthropic&rsquo;s Claude.</span></div></footer>';

  async function route() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const [path, ...rest] = hash.split('/').filter(Boolean).length ? ['/' + hash.split('/').filter(Boolean).slice(0, 2).join('/'), ...hash.split('/').filter(Boolean).slice(2)] : ['/'];
    if (current && current.destroy) { try { current.destroy(); } catch { /* ignore */ } }
    current = null;
    const publicPages = { '/': 'home', '/value': 'value', '/about': 'about', '/plans': 'plans' };
    const appPages = { '/app': 'dashboard', '/app/setup': 'setup', '/app/interview': 'interview', '/app/settings': 'settings' };
    let key = path;
    let params = rest;
    if (path === '/app/summary') { key = '/app/summary'; params = rest; }
    const minimal = key === '/app/interview';
    app.innerHTML = `${header(key, minimal)}<main id="view" tabindex="-1"></main>${minimal ? '' : footer}`;
    const view = document.getElementById('view');
    window.scrollTo(0, 0);
    if (publicPages[key]) {
      view.innerHTML = C.views[publicPages[key]]();
      const hero = view.querySelector('#hero-avatar');
      if (hero) { const av = new C.Avatar(hero); av.setListening(true); current = { destroy: () => av.destroy() }; }
      return;
    }
    const name = key === '/app/summary' ? 'summary' : appPages[key];
    if (name) { current = (await C.views[name](view, params)) || null; return; }
    view.innerHTML = '<section class="container page"><div class="empty"><strong>Page not found</strong><p style="margin-top:1rem"><a class="btn btn-primary" href="#/">Go home</a></p></div></section>';
  }
  window.addEventListener('hashchange', route);
  route();
})(window.Caddie);
