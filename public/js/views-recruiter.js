// Recruiter area: roles (status, questions, applicants, settings) and recruiter-wide defaults.
(function (C) {
  const V = C.views;
  const { esc, fmtDate, uid } = C.util;
  const MAX_Q = 10;
  const STATUSES = [['planning', 'Planning'], ['accepting', 'Accepting applications'], ['interviewing', 'Interviewing'], ['closed', 'Closed']];
  const statusLabel = (k) => (STATUSES.find((s) => s[0] === k) || STATUSES[0])[1];
  const statusChip = (k) => `<span class="status st-${esc(k || 'planning')}">${esc(statusLabel(k))}</span>`;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const minutesText = (m) => (m ? `${m} min per question` : 'no time limit per question');

  // A role's own settings if it has any, otherwise the recruiter-wide defaults.
  C.recruiterSettings = (role) => {
    const own = role && role.settings, src = own || C.store.getRecruiter();
    return { cameraRequired: !!src.cameraRequired, minutesPerQuestion: src.minutesPerQuestion || null, usesDefaults: !own };
  };
  const toggleHTML = (id, on) => `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span class="slider" aria-hidden="true"></span><span class="switch-text" id="${id}-t">${on ? 'Yes' : 'No'}</span></label>`;
  const parseMinutes = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? Math.min(120, Math.round(n * 2) / 2) : null; };

  // Run the interview for a role (optionally as a specific applicant).
  function startInterview(role, applicant) {
    const eff = C.recruiterSettings(role);
    const qs = role.questions.length ? C.questions.staticList(role.questions) : C.questions.generate({ jobName: role.title, jd: role.jd }).questions;
    C.pending = { kind: 'interview', source: 'static', mode: 'mock', jobName: role.title, jd: role.jd, questions: qs, qSource: role.questions.length ? 'static' : 'templates',
      cameraRequired: eff.cameraRequired, minutesPerQuestion: eff.minutesPerQuestion, roleId: role.id, applicantId: applicant ? applicant.id : null, applicantName: applicant ? applicant.name : null };
    location.hash = '#/app/interview';
  }

  // ---------------- dashboard ----------------
  V.recruiter = (root) => {
    const roles = C.store.getRoles();
    const applicantRow = (r, a) => `<li class="ap-row"><div class="ap-who"><b>${esc(a.name)}</b><span class="muted small">${esc(a.email)}</span></div>
      <span class="chip ${a.completed ? 'good' : 'na'}">${a.completed ? 'Interview completed' : 'Not completed'}</span>
      <div class="ap-actions"><button class="btn btn-ghost btn-sm" data-start="${esc(r.id)}|${esc(a.id)}">Start interview</button><button class="btn btn-ghost btn-sm" data-toggle="${esc(r.id)}|${esc(a.id)}">${a.completed ? 'Mark not completed' : 'Mark completed'}</button>${a.sessionId ? `<a class="btn btn-ghost btn-sm" href="#/app/summary/${esc(a.sessionId)}">View summary</a>` : ''}</div></li>`;
    const card = (r) => {
      const eff = C.recruiterSettings(r), aps = r.applicants || [], done = aps.filter((a) => a.completed).length;
      return `<div class="card role" data-id="${esc(r.id)}">
        <div class="role-head"><h3>${esc(r.title)}</h3>${statusChip(r.status)}</div>
        <div class="muted small">${r.questions.length + 1} questions · ${aps.length} applicant${aps.length === 1 ? '' : 's'}${aps.length ? ` (${done} completed)` : ''} · Created ${fmtDate(r.createdAt)}</div>
        ${r.jd ? `<p class="muted small role-jd">${esc(r.jd.length > 220 ? r.jd.slice(0, 219) + '…' : r.jd)}</p>` : '<p class="muted small">No job description added.</p>'}
        <p class="small role-settings">Camera required: <b>${eff.cameraRequired ? 'Yes' : 'No'}</b> · <b>${esc(minutesText(eff.minutesPerQuestion))}</b> <span class="muted">${eff.usesDefaults ? '(your defaults)' : '(set on this role)'}</span></p>
        <details class="role-qs"><summary>View ${r.questions.length + 1} questions</summary><ol><li>${esc(C.questions.OPENER)} <span class="chip">Default</span></li>${r.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol></details>
        <details class="role-qs"><summary>Applicants (${aps.length})${aps.length ? ` · ${done} completed` : ''}</summary>${aps.length ? `<ul class="ap-list">${aps.map((a) => applicantRow(r, a)).join('')}</ul>` : '<p class="small muted">No applicants yet. Add them by editing the role.</p>'}</details>
        <div class="row" style="margin-top:.9rem"><a class="btn btn-ghost btn-sm" href="#/recruiter/edit/${esc(r.id)}">Edit</a><button class="btn btn-ghost btn-sm" data-preview="${esc(r.id)}">Preview interview</button><button class="btn btn-ghost btn-sm" data-del="${esc(r.id)}">Delete</button></div></div>`;
    };
    root.innerHTML = `<section class="container page">
      <div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">Caddie for Recruiters</span><h1 style="font-size:clamp(1.8rem,3.6vw,2.6rem)">Recruiter Dashboard</h1></div></div>
      <div class="card cta-card"><div class="stack" style="gap:.4rem"><h2 style="font-size:1.5rem">Create a new job or role</h2><p>Add the role, the job description, the questions Caddie asks and your applicants.</p></div><a class="btn btn-lg" href="#/recruiter/new">Create new role</a></div>
      <div class="page-head" style="margin-bottom:.8rem"><h2 class="col-title" style="flex:1">Roles</h2></div>
      ${roles.length ? `<div class="roles">${roles.map(card).join('')}</div><p class="small muted" style="margin-top:1rem">Roles are saved in this browser. Start interview runs the interview for that applicant on this computer and marks them completed when they finish.</p>`
        : '<div class="empty"><strong>No roles yet</strong>Create your first role to set the questions Caddie asks.</div>'}</section>`;
    root.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.preview) { const r = C.store.getRole(b.dataset.preview); if (r) startInterview(r, null); }
      else if (b.dataset.start) { const [rid, aid] = b.dataset.start.split('|'); const r = C.store.getRole(rid); const a = r && (r.applicants || []).find((x) => x.id === aid); if (r && a) startInterview(r, a); }
      else if (b.dataset.toggle) { const [rid, aid] = b.dataset.toggle.split('|'); const r = C.store.getRole(rid); const a = r && (r.applicants || []).find((x) => x.id === aid); if (a) { C.store.updateApplicant(rid, aid, { completed: !a.completed, completedAt: !a.completed ? Date.now() : null }); V.recruiter(root); const d = root.querySelector(`.role[data-id="${rid}"] details:nth-of-type(2)`); if (d) d.open = true; } }
      else if (b.dataset.del) {
        if (b.dataset.armed) { C.store.deleteRole(b.dataset.del); V.recruiter(root); }
        else { b.dataset.armed = '1'; b.textContent = 'Confirm delete'; b.classList.replace('btn-ghost', 'btn-danger'); }
      }
    };
  };

  // ---------------- create / edit a role ----------------
  V.recruiterEdit = (root, params) => {
    const editing = params && params[0] ? C.store.getRole(params[0]) : null;
    if (params && params[0] && !editing) { location.hash = '#/recruiter'; return; }
    const def = C.store.getRecruiter();
    const own = editing && editing.settings;
    const S = { title: editing ? editing.title : '', status: editing ? editing.status || 'planning' : 'planning', jd: editing ? editing.jd : '',
      qs: editing ? editing.questions.slice() : [], applicants: editing ? (editing.applicants || []).map((a) => ({ ...a })) : [], ignored: new Set(),
      useDefaults: !own, cameraRequired: own ? !!own.cameraRequired : !!def.cameraRequired, minutes: own ? own.minutesPerQuestion : def.minutesPerQuestion };
    const $ = (x) => root.querySelector(x);

    function qRows() {
      const fixed = `<div class="qrow-edit fixed"><span class="qnum">1</span><div class="q-fixed">${esc(C.questions.OPENER)} <span class="chip">Default</span></div><div class="qbtns"></div></div>`;
      return fixed + S.qs.map((q, i) => `<div class="qrow-edit"><span class="qnum">${i + 2}</span><input type="text" data-q="${i}" value="${esc(q)}" maxlength="300" placeholder="Type a question" aria-label="Question ${i + 2}">
        <div class="qbtns"><button type="button" class="btn btn-ghost btn-sm" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move question ${i + 2} up">↑</button><button type="button" class="btn btn-ghost btn-sm" data-down="${i}" ${i === S.qs.length - 1 ? 'disabled' : ''} aria-label="Move question ${i + 2} down">↓</button><button type="button" class="btn btn-ghost btn-sm" data-rm="${i}" aria-label="Remove question ${i + 2}">Remove</button></div></div>`).join('');
    }
    function jdNote() {
      if (!S.jd.trim()) return 'Paste the posting. Caddie reads the responsibilities and requirements so you can check it understood the role.';
      const a = C.jd.analyze(S.jd, S.title);
      if (a.length < 80) return 'That is quite short. A full posting gives better questions.';
      return `Caddie found ${a.resp.length} responsibilit${a.resp.length === 1 ? 'y' : 'ies'} and ${a.req.length} requirement${a.req.length === 1 ? '' : 's'}${a.seniority ? `, a ${a.seniority} level role` : ''}${a.skills.length ? `, and skills like ${a.skills.slice(0, 4).join(', ')}` : ''}.`;
    }
    function drawQs() {
      $('#qs').innerHTML = qRows();
      const n = S.qs.length;
      $('#q-count').textContent = `${n} of ${MAX_Q} added`;
      const add = $('#q-add'); add.disabled = n >= MAX_Q; add.textContent = n >= MAX_Q ? `${MAX_Q} of ${MAX_Q} added` : 'Add a question';
      drawSuggestions();
    }
    // Up to five suggestions from the job description; accepting or ignoring one brings the next best into view.
    function drawSuggestions() {
      const box = $('#sugg'); if (!box) return;
      if (S.jd.trim().length < 40) { box.innerHTML = '<p class="small muted">Paste a job description above and Caddie will suggest up to 5 questions based on it.</p>'; return; }
      const list = C.questions.suggest({ jobName: S.title, jd: S.jd, n: 12, exclude: [...S.qs, ...S.ignored] }).slice(0, 5);
      const full = S.qs.length >= MAX_Q;
      box.innerHTML = list.length ? list.map((q, i) => `<div class="sugg"><div><div>${esc(q.text)}</div><div class="small muted">${esc(q.why)}</div></div><div class="sugg-btns"><button type="button" class="btn btn-primary btn-sm" data-accept="${i}" ${full ? 'disabled title="You have added 10 questions"' : ''}>Add</button><button type="button" class="btn btn-ghost btn-sm" data-ignore="${i}">Ignore</button></div></div>`).join('') : '<p class="small muted">No more suggestions for this posting.</p>';
      box._list = list;
    }
    function apRows() {
      return S.applicants.length ? S.applicants.map((a, i) => `<li class="ap-row"><div class="ap-who"><b>${esc(a.name)}</b><span class="muted small">${esc(a.email)}</span></div><span class="chip ${a.completed ? 'good' : 'na'}">${a.completed ? 'Interview completed' : 'Not completed'}</span><div class="ap-actions"><button type="button" class="btn btn-ghost btn-sm" data-aprm="${i}" aria-label="Remove ${esc(a.name)}">Remove</button></div></li>`).join('') : '<li class="small muted">No applicants added yet.</li>';
    }
    function syncSettings() {
      const d = C.store.getRecruiter();
      const on = $('#r-defaults').checked; S.useDefaults = on;
      if (on) { S.cameraRequired = !!d.cameraRequired; S.minutes = d.minutesPerQuestion; }
      $('#r-cam').checked = S.cameraRequired; $('#r-cam').disabled = on; $('#r-cam-t').textContent = S.cameraRequired ? 'Yes' : 'No';
      $('#r-min').value = S.minutes || ''; $('#r-min').disabled = on;
    }

    root.innerHTML = `<section class="container page"><div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">Caddie for Recruiters</span><h1 style="font-size:clamp(1.7rem,3.4vw,2.4rem)">${editing ? 'Edit role' : 'Create a new role'}</h1></div></div>
      <form class="stack" id="role-form" novalidate style="max-width:820px">
        <div class="card stack">
          <div class="grid2"><div class="field"><label for="r-title">Role title <span class="req">*</span></label><input type="text" id="r-title" value="${esc(S.title)}" placeholder="e.g. Senior Backend Engineer" maxlength="120"></div>
            <div class="field"><label for="r-status">Status</label><select id="r-status">${STATUSES.map(([k, n]) => `<option value="${k}" ${k === S.status ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
          <div class="field"><label for="r-jd">Job description</label><textarea id="r-jd" style="min-height:200px" placeholder="Paste the full job description here">${esc(S.jd)}</textarea><span class="hint" id="jd-note" aria-live="polite">${esc(jdNote())}</span></div></div>
        <div class="card stack"><div class="row" style="justify-content:space-between"><h3>Questions for Caddie to ask</h3><span class="chip" id="q-count"></span></div>
          <span class="hint">Every interview starts with the default question. Add up to ${MAX_Q} more of your own.</span>
          <div class="q-editor" id="qs"></div><div><button type="button" class="btn btn-ghost btn-sm" id="q-add">Add a question</button></div>
          <div class="sugg-wrap"><h3 style="font-size:1rem">Suggested questions</h3><span class="hint">Based on the job description. Add the ones you like, or ignore them.</span><div id="sugg" class="stack" style="gap:.6rem;margin-top:.6rem"></div></div></div>
        <div class="card stack"><div class="row" style="justify-content:space-between"><h3>Applicants</h3><span class="muted small">Add the people you want to interview</span></div>
          <div class="grid2 ap-add"><div class="field"><label for="ap-name">Name</label><input type="text" id="ap-name" autocomplete="off"></div><div class="field"><label for="ap-email">Email</label><input type="email" id="ap-email" autocomplete="off"></div></div>
          <div class="row"><button type="button" class="btn btn-ghost btn-sm" id="ap-add">Add applicant</button><span class="error-text" id="ap-err" role="alert"></span></div>
          <ul class="ap-list" id="aps"></ul></div>
        <div class="card stack"><h3>Settings for this role</h3>
          <label class="row" style="gap:.5rem;flex-wrap:nowrap"><input type="checkbox" id="r-defaults" ${S.useDefaults ? 'checked' : ''}><span>Use my default settings <a href="#/recruiter/settings" class="small">(change defaults)</a></span></label>
          <div class="setting"><div><b>Camera required</b><div class="small muted">Applicants must turn on their camera to interview.</div></div>${toggleHTML('r-cam', S.cameraRequired)}</div>
          <div class="setting"><div><label for="r-min"><b>Time allotted per question</b></label><div class="small muted">In minutes. Leave blank for no limit.</div></div><div class="min-field"><input type="number" id="r-min" min="0.5" max="120" step="0.5" inputmode="decimal" placeholder="No limit"><span class="muted small">min</span></div></div></div>
        <div class="error-text" id="r-err" role="alert"></div>
        <div class="actions" style="margin-top:0"><a class="btn btn-ghost" href="#/recruiter">Cancel</a><button class="btn btn-primary btn-lg" type="submit">Save role</button></div></form></section>`;
    drawQs(); $('#aps').innerHTML = apRows(); syncSettings();

    $('#r-title').addEventListener('input', (e) => { S.title = e.target.value; });
    $('#r-status').addEventListener('change', (e) => { S.status = e.target.value; });
    let t; $('#r-jd').addEventListener('input', (e) => { S.jd = e.target.value; clearTimeout(t); t = setTimeout(() => { const n = $('#jd-note'); if (n) { n.textContent = jdNote(); drawSuggestions(); } }, 300); });
    $('#qs').addEventListener('input', (e) => { if (e.target.dataset.q !== undefined) S.qs[+e.target.dataset.q] = e.target.value; });
    $('#qs').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.rm !== undefined) S.qs.splice(+b.dataset.rm, 1);
      else if (b.dataset.up !== undefined) { const i = +b.dataset.up; [S.qs[i - 1], S.qs[i]] = [S.qs[i], S.qs[i - 1]]; }
      else if (b.dataset.down !== undefined) { const i = +b.dataset.down; [S.qs[i + 1], S.qs[i]] = [S.qs[i], S.qs[i + 1]]; }
      drawQs();
    });
    $('#q-add').addEventListener('click', () => { if (S.qs.length >= MAX_Q) return; S.qs.push(''); drawQs(); const inputs = root.querySelectorAll('[data-q]'); inputs[inputs.length - 1].focus(); });
    $('#sugg').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; const list = $('#sugg')._list || [];
      if (b.dataset.accept !== undefined) { const q = list[+b.dataset.accept]; if (q && S.qs.length < MAX_Q) { S.qs = S.qs.filter((x) => x.trim()); S.qs.push(q.text); drawQs(); } }
      else if (b.dataset.ignore !== undefined) { const q = list[+b.dataset.ignore]; if (q) { S.ignored.add(q.text); drawSuggestions(); } }
    });
    // applicants
    $('#ap-add').addEventListener('click', () => {
      const name = $('#ap-name').value.trim(), email = $('#ap-email').value.trim(), err = $('#ap-err');
      if (!name) { err.textContent = 'Enter a name.'; return; }
      if (!EMAIL_RE.test(email)) { err.textContent = 'Enter a valid email address.'; return; }
      if (S.applicants.some((a) => a.email.toLowerCase() === email.toLowerCase())) { err.textContent = 'That email is already on the list.'; return; }
      err.textContent = ''; S.applicants.push({ id: uid(), name, email, completed: false, sessionId: null, completedAt: null, addedAt: Date.now() });
      $('#ap-name').value = ''; $('#ap-email').value = ''; $('#aps').innerHTML = apRows(); $('#ap-name').focus();
    });
    $('#ap-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#ap-add').click(); } });
    $('#aps').addEventListener('click', (e) => { const b = e.target.closest('[data-aprm]'); if (b) { S.applicants.splice(+b.dataset.aprm, 1); $('#aps').innerHTML = apRows(); } });
    // settings
    $('#r-defaults').addEventListener('change', () => { if (!$('#r-defaults').checked) { S.cameraRequired = $('#r-cam').checked; } syncSettings(); });
    $('#r-cam').addEventListener('change', (e) => { S.cameraRequired = e.target.checked; $('#r-cam-t').textContent = S.cameraRequired ? 'Yes' : 'No'; });
    $('#r-min').addEventListener('input', (e) => { S.minutes = parseMinutes(e.target.value); });

    $('#role-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!S.title.trim()) { $('#r-err').textContent = 'Add a role title.'; $('#r-title').focus(); return; }
      const now = Date.now();
      C.store.saveRole({ id: editing ? editing.id : uid(), title: S.title.trim(), status: S.status, jd: S.jd.trim(),
        questions: S.qs.map((q) => q.trim()).filter(Boolean).slice(0, MAX_Q), applicants: S.applicants,
        settings: S.useDefaults ? null : { cameraRequired: !!S.cameraRequired, minutesPerQuestion: parseMinutes($('#r-min').value) },
        createdAt: editing ? editing.createdAt : now, updatedAt: now });
      location.hash = '#/recruiter';
      C.util.toast(editing ? 'Role updated' : 'Role created');
    });
  };

  // ---------------- recruiter profile and default settings ----------------
  V.recruiterSettings = (root) => {
    const r = C.store.getRecruiter();
    root.innerHTML = `<section class="container page"><div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">Caddie for Recruiters</span><h1 style="font-size:clamp(1.8rem,3.6vw,2.6rem)">Profile and Settings</h1></div></div>
      <form class="stack" id="rs-form" style="max-width:720px">
        <div class="card stack"><h3>Profile</h3>
          <div class="field"><label for="rs-name">Name</label><input type="text" id="rs-name" value="${esc(r.name)}"></div>
          <div class="field"><label for="rs-email">Email</label><input type="email" id="rs-email" value="${esc(r.email)}"></div>
          <div class="field"><label for="rs-company">Company</label><input type="text" id="rs-company" value="${esc(r.company)}"></div></div>
        <div class="card stack"><h3>Default settings for all roles</h3><p class="small muted">These apply to every role unless you change the settings on that role. Roles that use your defaults update automatically when you change them here.</p>
          <div class="setting"><div><b>Camera required</b><div class="small muted">Applicants must turn on their camera to interview.</div></div>${toggleHTML('rs-cam', r.cameraRequired)}</div>
          <div class="setting"><div><label for="rs-min"><b>Time allotted per question</b></label><div class="small muted">In minutes. Leave blank for no limit.</div></div><div class="min-field"><input type="number" id="rs-min" min="0.5" max="120" step="0.5" inputmode="decimal" placeholder="No limit" value="${r.minutesPerQuestion || ''}"><span class="muted small">min</span></div></div></div>
        <div class="row"><button class="btn btn-primary" type="submit">Save</button><span class="small muted" id="rs-msg" role="status"></span></div></form></section>`;
    root.querySelector('#rs-cam').addEventListener('change', (e) => { root.querySelector('#rs-cam-t').textContent = e.target.checked ? 'Yes' : 'No'; });
    root.querySelector('#rs-form').addEventListener('submit', (e) => {
      e.preventDefault();
      C.store.setRecruiter({ name: root.querySelector('#rs-name').value.trim(), email: root.querySelector('#rs-email').value.trim(), company: root.querySelector('#rs-company').value.trim(),
        cameraRequired: root.querySelector('#rs-cam').checked, minutesPerQuestion: parseMinutes(root.querySelector('#rs-min').value) });
      const m = root.querySelector('#rs-msg'); m.textContent = 'Saved.'; setTimeout(() => { m.textContent = ''; }, 2500);
    });
  };
})(window.Caddie);
