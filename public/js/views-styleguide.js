// Style guide: the in-app reference for Greenroom's look, wording and components (#/styleguide).
// Colors, fonts, radii and shadows are read live from the CSS, so the page cannot drift from the code.
// To update: change the token in css/colors.css or css/app.css (the swatches follow), then edit the notes in the data below.
(function (C) {
  const V = C.views;
  const { esc } = C.util;

  // Documentation for each token. The value shown is read from the stylesheet at runtime.
  const COLORS = [
    ['Primary (indigo)', [
      ['--color-primary', 'Buttons, links, active nav, brand mark'],
      ['--color-primary-hover', 'Hover state for primary buttons'],
      ['--color-primary-bright', 'AI features, focus ring, eyebrow labels'],
      ['--color-primary-tint', 'Soft backgrounds, hovered nav, badges']]],
    ['Secondary (petrol)', [
      ['--color-secondary', 'Secondary buttons, data accents'],
      ['--color-secondary-bright', 'Charts and data highlights'],
      ['--color-secondary-tint', 'Callouts, soft data backgrounds']]],
    ['Tertiary (deep red)', [
      ['--color-tertiary', 'Destructive actions, alerts, accent badges'],
      ['--color-tertiary-bright', 'Brightest highlight, required marker'],
      ['--color-tertiary-tint', 'Soft alert background']]],
    ['Neutrals', [
      ['--color-ink', 'Headings and body text'],
      ['--color-slate', 'Secondary text'],
      ['--color-mist', 'Borders, dividers'],
      ['--color-cloud', 'Page background'],
      ['--color-white', 'Cards and surfaces']]],
    ['Status', [
      ['--color-success', 'Good results, completed'],
      ['--color-warning', 'Needs attention'],
      ['--color-error', 'Low results, errors']]],
    ['Special', [
      ['--room', 'Dark interview and presentation room background']]]
  ];

  const SEMANTIC = [['--bg-page', 'Page background'], ['--bg-surface', 'Cards and panels'], ['--text-default', 'Body text'], ['--text-muted', 'Secondary text'], ['--border-default', 'Borders'], ['--link', 'Links'], ['--focus-ring', 'Keyboard focus outline']];

  const TYPE = [
    ['h1', 'Practice the interview before it counts.', 'Page titles and the homepage hero. Bricolage Grotesque 700, 2.2 to 3.7rem.'],
    ['h2', 'Your sessions this month', 'Section titles. 650, 1.5 to 2.1rem.'],
    ['h3', 'Quick Summary', 'Card titles. 650, 1.15rem.'],
    ['p', 'Body text is Hanken Grotesk, 16px with 1.55 line height. Keep paragraphs short and plain.', 'Everything else.'],
    ['p class="muted small"', 'Secondary text and hints, 0.875rem, slate.', 'Hints, timestamps, footnotes.'],
    ['span class="eyebrow"', 'Interview practice', 'Small uppercase label above a heading.']
  ];

  const TERMS = [
    ['Greenroom', 'The product name. One word, no "The".', 'Never "Caddie".'],
    ['Frankie', 'The AI interviewer. First name only, always capitalised. Frankie asks the questions, speaks the follow-ups and, in presentations, listens and gives feedback afterward.', 'Frankie asks follow-up questions. Never "Andy" or "Caddie".'],
    ['Begin session', 'Starts a new interview or presentation from the header or dashboard.', 'Not "Begin interview" or "Start new interview".'],
    ['Check camera and mic', 'Moves from setup to the camera and microphone check. The page eyebrow reads "Before you start".', ''],
    ['Join', 'Leaves the camera and mic check and starts the 3-second countdown.', ''],
    ['Interview / Practice Presenting', 'The two session types. Presenting is solo, so only you are in the room.', ''],
    ['Practice / Mock', 'Practice shows live cues. Mock hides them until the end.', ''],
    ['Dashboard', 'The practice home, titled "<First name>\'s Dashboard".', ''],
    ['Profile and Settings', 'Top navigation for both the practice and recruiter areas.', ''],
    ['Recruiter login / Admin', 'Footer links shown only on the main homepage.', ''],
    ['Planning, Accepting applications, Interviewing, Closed', 'The four role statuses, in this order.', ''],
    ['Tell me about yourself and walk me through your resume.', 'The default first question for every role and session.', 'Locked as question 1.']
  ];

  const RULES = [
    'Sentences are short and plain. Say what will happen before it happens.',
    'Frankie speaks in first person only inside the session. Elsewhere the app says "Greenroom", "Frankie" or "we" sparingly.',
    'Sentence case for buttons, headings and labels. No exclamation marks.',
    'Never claim more than the app does: sessions stay in the browser, video and audio are never uploaded, and AI features are opt-in and disclosed.',
    'Scores come with a reason or a tip, never a number alone.',
    'Dates and times are shown in the viewer\'s local time.'
  ];

  const A11Y = [
    'Text must meet WCAG AA contrast (4.5:1, or 3:1 for large text). The ratios above are computed live from the real colors.',
    'Never rely on color alone. Pair status colors with words or icons (for example "Strong", "Needs work").',
    'Every control is reachable by keyboard and has a visible focus ring (--focus-ring).',
    'Camera and microphone controls always have text labels. The countdown can be cancelled.',
    'Respect reduced motion: no autoplay animation that cannot be paused.'
  ];

  // ----- helpers -----
  const css = (el, prop) => getComputedStyle(el).getPropertyValue(prop).trim();
  function toRGB(v) {
    const m = v.match(/#([0-9a-f]{3,8})/i);
    if (m) { let h = m[1]; if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
    const r = v.match(/rgba?\(([^)]+)\)/); return r ? r[1].split(',').slice(0, 3).map((n) => parseFloat(n)) : null;
  }
  const lum = (rgb) => { const f = rgb.map((c) => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }); return .2126 * f[0] + .7152 * f[1] + .0722 * f[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const hex = (rgb) => '#' + rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  const rating = (r) => r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA large' : 'Fail';

  const swatchRow = (name, note) => `<div class="sg-swatch" data-token="${name}"><span class="sg-chip" style="background:var(${name})"></span><div class="sg-meta"><code>${name}</code><span class="small muted">${esc(note)}</span></div><div class="sg-val"><b class="sg-hex">…</b><span class="small muted sg-contrast"></span></div></div>`;

  const section = (id, title, body, note) => `<section class="sg-section" id="sg-${id}"><div class="sg-head"><h2>${title}</h2>${note ? `<p class="muted">${note}</p>` : ''}</div>${body}</section>`;

  V.styleguide = async (view) => {
    const toc = [['principles', 'Principles'], ['logo', 'Logo'], ['colors', 'Colors'], ['recruiter', 'Recruiter theme'], ['type', 'Typography'], ['shape', 'Spacing and shape'], ['components', 'Components'], ['voice', 'Voice and terms'], ['a11y', 'Accessibility'], ['update', 'Updating this guide']];

    const principles = `<div class="sg-cols">
      <div class="card flat"><h3>Calm</h3><p class="muted">A course-like canvas: soft cloud background, generous space, one clear action per screen.</p></div>
      <div class="card flat"><h3>Guiding</h3><p class="muted">Indigo leads the eye. Petrol carries data. Deep red is reserved for alerts and the recruiter area.</p></div>
      <div class="card flat"><h3>Honest</h3><p class="muted">Plain language, visible privacy notes, and clear labels when AI is involved.</p></div></div>`;

    const logo = `<div class="sg-cols">
      <div class="card flat"><div class="sg-logo-demo"><a class="logo" href="#/styleguide">${C.LOGO}Greenroom<span class="beta-tag">Beta</span></a></div><h3>Primary</h3><p class="muted small">The G mark plus the wordmark "Greenroom" in Bricolage Grotesque 750, one word with no "The", followed by a small outlined "Beta" tag (<code>.beta-tag</code>) while the product is in beta. Links to the homepage.</p></div>
      <div class="card flat"><div class="sg-logo-demo"><a class="logo" href="#/styleguide">${C.LOGO}Greenroom<span class="beta-tag">Beta</span> <span class="badge" style="font-size:.7rem">Admin</span></a></div><h3>With area badge</h3><p class="muted small">Used for Admin and Recruiter. Badge turns red in the recruiter theme.</p></div>
      <div class="card flat"><div class="sg-logo-demo" style="background:var(--room);border-radius:var(--radius)"><a class="logo" href="#/styleguide" style="color:#fff">${C.logoMark('#5B5BD6', '#2FBF7A')}Greenroom<span class="beta-tag" style="color:#fff">Beta</span></a></div><h3>On dark</h3><p class="muted small">Wordmark switches to white and the mark to the lighter indigo and green. Keep clear space equal to the mark's width.</p></div></div>
      <p class="small muted">Source: <code>C.logoMark()</code> in <code>js/main.js</code>; the favicon and app icon are <code>public/favicon.svg</code>. A G whose top is a dotted line, a solid curve, and a green closing bar: the dots are the practice run, the bar is the way in. The curve uses --color-primary (so it turns red in the recruiter theme) and the bar uses --color-success. On dark, use #5B5BD6 and #2FBF7A. The dots stay readable down to about 24px; below that, use the favicon tile. Do not stretch, outline or add effects. Concept sheet: <code>design/logo-samples.html</code>.</p>`;

    const colors = COLORS.map(([g, list]) => `<h3 class="sg-sub">${g}</h3><div class="sg-swatches">${list.map(([n, note]) => swatchRow(n, note)).join('')}</div>`).join('')
      + `<h3 class="sg-sub">Semantic aliases</h3><p class="small muted">Prefer these in components so themes (like the recruiter theme) apply automatically.</p><div class="sg-swatches">${SEMANTIC.map(([n, note]) => swatchRow(n, note)).join('')}</div>
      <h3 class="sg-sub">Contrast checks</h3><div class="card flat"><table class="sg-table" id="sg-contrast"><thead><tr><th>Pair</th><th>Ratio</th><th>Rating</th></tr></thead><tbody></tbody></table></div>`;

    const recruiter = `<div class="sg-cols">
      <div class="card flat"><div class="sg-theme-demo"><span class="badge">Recruiter</span><button class="btn btn-primary btn-sm">Create new role</button><a href="#/styleguide">Link</a></div><p class="muted small" style="margin-top:.8rem">Indigo</p></div>
      <div class="card flat theme-recruiter"><div class="sg-theme-demo"><span class="badge">Recruiter</span><button class="btn btn-primary btn-sm">Create new role</button><a href="#/styleguide">Link</a></div><p class="muted small" style="margin-top:.8rem">Recruiter theme (deep red)</p></div></div>
      <p class="small muted">Applied with the <code>.theme-recruiter</code> class on routes starting <code>/recruiter</code>. It redefines <code>--color-primary</code>, <code>-hover</code>, <code>-bright</code>, <code>-tint</code>, <code>--link</code> and <code>--focus-ring</code> to the tertiary deep red. Components must use these tokens, not hard-coded indigo, so they re-theme automatically.</p>`;

    const type = `<div class="card flat"><table class="sg-table">${TYPE.map(([tag, sample, use]) => { const t = tag.split(' ')[0]; const attr = tag.slice(t.length); return `<tr><td class="sg-type-sample"><${t}${attr}>${esc(sample)}</${t}></td><td class="small muted">${esc(use)}</td></tr>`; }).join('')}</table></div>
      <div class="sg-cols" style="margin-top:1rem"><div class="card flat"><h3>Display</h3><p class="muted small" id="sg-font-display"></p></div><div class="card flat"><h3>Body</h3><p class="muted small" id="sg-font-body"></p></div></div>`;

    const shape = `<div class="sg-cols">
      <div class="card flat"><div class="sg-shape" style="border-radius:var(--radius)"></div><h3>--radius</h3><p class="muted small" id="sg-radius"></p><p class="small muted">Buttons, inputs, callouts.</p></div>
      <div class="card flat"><div class="sg-shape" style="border-radius:var(--radius-lg)"></div><h3>--radius-lg</h3><p class="muted small" id="sg-radius-lg"></p><p class="small muted">Cards, choices, rooms.</p></div>
      <div class="card flat"><div class="sg-shape" style="box-shadow:var(--shadow)"></div><h3>--shadow</h3><p class="muted small">Featured cards and floating elements. Use sparingly.</p></div>
      <div class="card flat"><div class="sg-shape" style="border-radius:999px"></div><h3>Pill</h3><p class="muted small">Badges, chips and status labels (999px).</p></div></div>
      <p class="small muted" style="margin-top:.8rem">Page gutter: <code>--gutter</code> (<span id="sg-gutter"></span>), content max width 1180px. Spacing in components moves in steps of .25rem; stacks default to a 1rem gap, rows to .75rem.</p>`;

    const components = `
      <h3 class="sg-sub">Buttons</h3><div class="card flat row">
        <button class="btn btn-primary">Primary</button><button class="btn btn-secondary">Secondary</button><button class="btn btn-ghost">Ghost</button><button class="btn btn-danger">Danger</button><button class="btn btn-primary" disabled>Disabled</button><button class="btn btn-primary btn-sm">Small</button><button class="btn btn-primary btn-lg">Large</button></div>
      <p class="small muted">One primary button per view. Class names: <code>.btn .btn-primary .btn-secondary .btn-ghost .btn-danger .btn-sm .btn-lg</code>.</p>
      <h3 class="sg-sub">Badges</h3><div class="card flat row"><span class="badge">Default</span><span class="badge petrol">Petrol</span><span class="badge accent">Accent</span></div>
      <h3 class="sg-sub">Chips (scores and cues)</h3><div class="card flat row"><span class="chip good">Strong 82</span><span class="chip ok">Solid 64</span><span class="chip low">Needs work 41</span><span class="chip na">Not measured</span></div>
      <p class="small muted">Bands (see <code>label()</code> in <code>js/summary.js</code>): Strong 75 and above, Solid 55 to 74, Needs work below 55. Always include the word, not only the color.</p>
      <h3 class="sg-sub">Role status</h3><div class="card flat row"><span class="status st-planning">Planning</span><span class="status st-accepting">Accepting applications</span><span class="status st-interviewing">Interviewing</span><span class="status st-closed">Closed</span></div>
      <h3 class="sg-sub">Form fields</h3><div class="card flat sg-cols"><div class="field"><label for="sg-in">Role title <span class="req">*</span></label><input id="sg-in" type="text" placeholder="Product Manager"><span class="hint">Hint text sits below the field.</span></div><div class="field"><label for="sg-sel">Time per question</label><select id="sg-sel"><option>2 minutes</option><option>3 minutes</option></select></div></div>
      <h3 class="sg-sub">Cards and callouts</h3><div class="sg-cols"><div class="card"><div class="card-title"><h3>Card</h3><span class="small muted">Meta</span></div><p class="muted">Surface, 1px mist border, 16px radius, 1.4rem padding.</p></div>
        <div class="stack"><div class="callout">Callout: helpful information.</div><div class="callout warn">Callout (warn): something needs attention but is not blocking.</div></div></div>
      <h3 class="sg-sub">Empty state</h3><div class="empty"><strong>No sessions yet</strong><p>Say what is missing and offer one next step.</p></div>
      <h3 class="sg-sub">Stat tile</h3><div class="card flat stat-row"><div class="stat"><span class="stat-label">Users</span><span class="stat-value">128</span><span class="stat-sub">Unique people</span></div><div class="stat"><span class="stat-label">Average rating</span><span class="stat-value">4.6<small> / 5</small></span><span class="stat-sub">From 32 ratings</span></div></div>
      <h3 class="sg-sub">Sub navigation</h3><div class="card flat"><nav class="subnav" style="position:static;border:0;background:none" aria-label="Example"><div class="subnav-in" style="padding:0"><a href="#/styleguide" aria-current="true">Interview</a><a href="#/styleguide">Presentation</a><a href="#/styleguide">What we measure</a></div></nav></div>
      <p class="small muted">Sticky pill tabs under the header that scroll to sections of the same page. Use <code>V.subnav([[id, label], ...])</code> from <code>js/views-public.js</code> whenever a page has distinct Interview and Presentation sections (home, value, dashboard). Section ids must be unique on the page.</p>
      <h3 class="sg-sub">Toast</h3><div class="card flat"><button class="btn btn-ghost btn-sm" id="sg-toast">Show a toast</button> <span class="small muted">Short confirmations that disappear on their own.</span></div>
      <p class="small muted" style="margin-top:.8rem">Other patterns to reuse rather than reinvent: the dark interview room and tiles (<code>.room</code>, <code>.preview</code>), the 3-second countdown, the rating dialog (<code>.modal-wrap</code>), Quick Summary KPI rows with sparklines (<code>.kpi</code>), and the wizard step chips (<code>.wizard-steps</code>).</p>`;

    const voice = `<h3 class="sg-sub">Wording</h3><ul class="sg-list">${RULES.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <h3 class="sg-sub">Terms and labels</h3><div class="card flat"><table class="sg-table"><thead><tr><th>Term</th><th>Meaning and use</th><th>Notes</th></tr></thead><tbody>${TERMS.map(([a, b, c]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td class="small muted">${esc(c)}</td></tr>`).join('')}</tbody></table></div>`;

    const a11y = `<ul class="sg-list">${A11Y.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;

    const update = `<ol class="sg-list">
      <li>Change colors in <code>public/css/colors.css</code>; fonts, radius, shadow and gutter in the top of <code>public/css/app.css</code>. This page shows the new values automatically.</li>
      <li>Add a new token, term or component by editing the data at the top of <code>public/js/views-styleguide.js</code> (or the Components section).</li>
      <li>Record notable decisions in the log below, newest first.</li>
      <li>Keep one source of truth: if a value is written in two places, move it into a token.</li></ol>
      <h3 class="sg-sub">Change log</h3><ul class="sg-list">
        <li><b>Beta tag and footer contact.</b> The logo carries a Beta tag on every page; the footer lists a contact email at the bottom right. Admin can delete ratings.</li>
        <li><b>Frankie and sub navigation.</b> The AI interviewer is named Frankie. Home, Value and Dashboard gain Interview and Presentation sub navigation, and the homepage covers both practice types.</li>
        <li><b>Renamed to Greenroom.</b> New G mark with dotted top and green bar, replacing the Caddie logo. The pre-session step is "Check camera and mic".</li>
        <li><b>First version.</b> Palette (indigo, petrol, deep red), recruiter theme, Bricolage Grotesque and Hanken Grotesk, core components, terminology and accessibility rules.</li></ul>`;

    view.innerHTML = `<section class="container page sg">
      <div class="page-head"><div><span class="eyebrow">Greenroom</span><h1>Style guide</h1><p class="muted" style="margin-top:.6rem;max-width:60ch">The reference for how Greenroom looks, reads and behaves. Colors and type are read live from the stylesheets, so this page always matches the app.</p></div></div>
      <nav class="sg-toc" aria-label="Sections">${toc.map(([id, t]) => `<a href="#/styleguide" data-jump="sg-${id}">${t}</a>`).join('')}</nav>
      ${section('principles', 'Principles', principles)}
      ${section('logo', 'Logo', logo)}
      ${section('colors', 'Colors', colors, 'Values are read from <code>css/colors.css</code>. Contrast is measured against white and ink text.')}
      ${section('recruiter', 'Recruiter theme', recruiter)}
      ${section('type', 'Typography', type)}
      ${section('shape', 'Spacing and shape', shape)}
      ${section('components', 'Components', components)}
      ${section('voice', 'Voice and terms', voice)}
      ${section('a11y', 'Accessibility', a11y)}
      ${section('update', 'Updating this guide', update)}
    </section>`;

    // Fill live values.
    const root = document.documentElement;
    view.querySelectorAll('.sg-swatch').forEach((el) => {
      const rgb = toRGB(css(root, el.dataset.token));
      if (!rgb) { el.querySelector('.sg-hex').textContent = css(root, el.dataset.token) || 'n/a'; return; }
      el.querySelector('.sg-hex').textContent = hex(rgb);
      const w = ratio(rgb, [255, 255, 255]);
      el.querySelector('.sg-contrast').textContent = `${w.toFixed(1)}:1 on white`;
    });
    const tok = (n) => toRGB(css(root, n));
    const pairs = [['Ink on cloud (body text)', '--color-ink', '--color-cloud'], ['Slate on white (secondary text)', '--color-slate', '--color-white'], ['White on primary (buttons)', '--color-white', '--color-primary'], ['White on secondary (buttons)', '--color-white', '--color-secondary'], ['White on tertiary (danger)', '--color-white', '--color-tertiary'], ['Primary on white (links)', '--color-primary', '--color-white'], ['Primary on primary tint (nav, badges)', '--color-primary', '--color-primary-tint'], ['Secondary on secondary tint', '--color-secondary', '--color-secondary-tint'], ['Tertiary on tertiary tint', '--color-tertiary', '--color-tertiary-tint'], ['Primary bright on white (eyebrow)', '--color-primary-bright', '--color-white']];
    view.querySelector('#sg-contrast tbody').innerHTML = pairs.map(([label, a, b]) => { const A = tok(a), B = tok(b); if (!A || !B) return ''; const r = ratio(A, B); return `<tr><td>${label}</td><td>${r.toFixed(2)}:1</td><td><span class="chip ${r >= 4.5 ? 'good' : r >= 3 ? 'ok' : 'low'}">${rating(r)}</span></td></tr>`; }).join('');
    const set = (id, t) => { const el = view.querySelector(id); if (el) el.textContent = t; };
    set('#sg-font-display', css(root, '--font-display'));
    set('#sg-font-body', css(root, '--font-body'));
    set('#sg-radius', css(root, '--radius'));
    set('#sg-radius-lg', css(root, '--radius-lg'));
    set('#sg-gutter', css(root, '--gutter'));
    const t = view.querySelector('#sg-toast'); if (t) t.addEventListener('click', () => C.util.toast('Saved. This is a toast.'));
    view.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); const el = document.getElementById(a.dataset.jump); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  };
})(window.Caddie);
