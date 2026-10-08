// Recruiter area: create roles with a job description and up to 10 interview questions.
(function (C) {
  const V = C.views;
  const { esc, fmtDate, uid } = C.util;
  const MAX_Q = 10;

  V.recruiter = (root) => {
    const roles = C.store.getRoles();
    const card = (r) => `<div class="card role" data-id="${esc(r.id)}">
      <div class="card-title"><h3>${esc(r.title)}</h3><span class="muted small">${r.questions.length} question${r.questions.length === 1 ? '' : 's'} · Created ${fmtDate(r.createdAt)}</span></div>
      ${r.jd ? `<p class="muted small role-jd">${esc(r.jd.length > 220 ? r.jd.slice(0, 219) + '…' : r.jd)}</p>` : '<p class="muted small">No job description added.</p>'}
      <details class="role-qs"><summary>${r.questions.length ? `View ${r.questions.length} question${r.questions.length === 1 ? '' : 's'}` : 'No questions added'}</summary>${r.questions.length ? `<ol>${r.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>` : '<p class="small muted">Caddie will write questions from the job description.</p>'}</details>
      <div class="row" style="margin-top:.9rem"><a class="btn btn-ghost btn-sm" href="#/recruiter/edit/${esc(r.id)}">Edit</a><button class="btn btn-ghost btn-sm" data-preview="${esc(r.id)}">Preview interview</button><button class="btn btn-ghost btn-sm" data-del="${esc(r.id)}">Delete</button></div></div>`;
    root.innerHTML = `<section class="container page">
      <div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">Caddie for Recruiters</span><h1 style="font-size:clamp(1.8rem,3.6vw,2.6rem)">Recruiter Dashboard</h1></div></div>
      <div class="card cta-card"><div class="stack" style="gap:.4rem"><h2 style="font-size:1.5rem">Create a new job or role</h2><p>Add the role title, the job description and up to ${MAX_Q} questions for Caddie to ask.</p></div><a class="btn btn-lg" href="#/recruiter/new">Create new role</a></div>
      <div class="page-head" style="margin-bottom:.8rem"><h2 class="col-title" style="flex:1">Roles</h2></div>
      ${roles.length ? `<div class="roles">${roles.map(card).join('')}</div><p class="small muted" style="margin-top:1rem">Roles are saved in this browser. Use Preview interview to run the interview the way a candidate would.</p>`
        : '<div class="empty"><strong>No roles yet</strong>Create your first role to set the questions Caddie asks.</div>'}</section>`;
    root.onclick = (e) => {
      const pv = e.target.closest('[data-preview]'), del = e.target.closest('[data-del]');
      if (pv) {
        const r = C.store.getRoles().find((x) => x.id === pv.dataset.preview); if (!r) return;
        const qs = r.questions.length ? C.questions.staticList(r.questions) : C.questions.generate({ jobName: r.title, jd: r.jd }).questions;
        C.pending = { kind: 'interview', source: 'static', mode: 'mock', jobName: r.title, jd: r.jd, questions: qs, qSource: r.questions.length ? 'static' : 'templates' };
        location.hash = '#/app/interview';
      }
      if (del) {
        if (del.dataset.armed) { C.store.deleteRole(del.dataset.del); V.recruiter(root); }
        else { del.dataset.armed = '1'; del.textContent = 'Confirm delete'; del.classList.replace('btn-ghost', 'btn-danger'); }
      }
    };
  };

  V.recruiterEdit = (root, params) => {
    const editing = params && params[0] ? C.store.getRoles().find((r) => r.id === params[0]) : null;
    if (params && params[0] && !editing) { location.hash = '#/recruiter'; return; }
    const S = { title: editing ? editing.title : '', jd: editing ? editing.jd : '', qs: editing && editing.questions.length ? editing.questions.slice() : [''] };
    const $ = (x) => root.querySelector(x);

    function qRows() {
      return S.qs.map((q, i) => `<div class="qrow-edit"><span class="qnum">${i + 1}</span><input type="text" data-q="${i}" value="${esc(q)}" maxlength="300" placeholder="Type a question" aria-label="Question ${i + 1}">
        <div class="qbtns"><button type="button" class="btn btn-ghost btn-sm" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move question ${i + 1} up">↑</button><button type="button" class="btn btn-ghost btn-sm" data-down="${i}" ${i === S.qs.length - 1 ? 'disabled' : ''} aria-label="Move question ${i + 1} down">↓</button><button type="button" class="btn btn-ghost btn-sm" data-rm="${i}" aria-label="Remove question ${i + 1}">Remove</button></div></div>`).join('');
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
      $('#q-count').textContent = `${n} of ${MAX_Q}`;
      const add = $('#q-add'); add.disabled = n >= MAX_Q; add.textContent = n >= MAX_Q ? `${MAX_Q} of ${MAX_Q} added` : 'Add a question';
    }
    root.innerHTML = `<section class="container page"><div class="page-head"><div class="stack" style="gap:.3rem"><span class="eyebrow">Caddie for Recruiters</span><h1 style="font-size:clamp(1.7rem,3.4vw,2.4rem)">${editing ? 'Edit role' : 'Create a new role'}</h1></div></div>
      <form class="card form-card stack" id="role-form" novalidate>
        <div class="field"><label for="r-title">Role title <span class="req">*</span></label><input type="text" id="r-title" value="${esc(S.title)}" placeholder="e.g. Senior Backend Engineer" maxlength="120"></div>
        <div class="field"><label for="r-jd">Job description</label><textarea id="r-jd" style="min-height:200px" placeholder="Paste the full job description here">${esc(S.jd)}</textarea><span class="hint" id="jd-note" aria-live="polite">${esc(jdNote())}</span></div>
        <div class="field"><div class="row" style="justify-content:space-between"><span class="label">Questions for Caddie to ask</span><span class="chip" id="q-count"></span></div>
          <span class="hint">Add up to ${MAX_Q}. Caddie always opens with "Walk me through your resume", so you do not need to add it.</span>
          <div class="q-editor" id="qs"></div><div><button type="button" class="btn btn-ghost btn-sm" id="q-add">Add a question</button></div></div>
        <div class="error-text" id="r-err" role="alert"></div>
        <div class="actions" style="margin-top:.5rem"><a class="btn btn-ghost" href="#/recruiter">Cancel</a><button class="btn btn-primary btn-lg" type="submit">Save role</button></div></form></section>`;
    drawQs();
    $('#r-title').addEventListener('input', (e) => { S.title = e.target.value; $('#jd-note').textContent = jdNote(); });
    let t; $('#r-jd').addEventListener('input', (e) => { S.jd = e.target.value; clearTimeout(t); t = setTimeout(() => { const n = $('#jd-note'); if (n) n.textContent = jdNote(); }, 250); });
    $('#qs').addEventListener('input', (e) => { if (e.target.dataset.q !== undefined) S.qs[+e.target.dataset.q] = e.target.value; });
    $('#qs').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.rm !== undefined) { S.qs.splice(+b.dataset.rm, 1); if (!S.qs.length) S.qs.push(''); }
      else if (b.dataset.up !== undefined) { const i = +b.dataset.up; [S.qs[i - 1], S.qs[i]] = [S.qs[i], S.qs[i - 1]]; }
      else if (b.dataset.down !== undefined) { const i = +b.dataset.down; [S.qs[i + 1], S.qs[i]] = [S.qs[i], S.qs[i + 1]]; }
      drawQs();
    });
    $('#q-add').addEventListener('click', () => { if (S.qs.length >= MAX_Q) return; S.qs.push(''); drawQs(); const inputs = root.querySelectorAll('[data-q]'); inputs[inputs.length - 1].focus(); });
    $('#role-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!S.title.trim()) { $('#r-err').textContent = 'Add a role title.'; $('#r-title').focus(); return; }
      const now = Date.now();
      C.store.saveRole({ id: editing ? editing.id : uid(), title: S.title.trim(), jd: S.jd.trim(), questions: S.qs.map((q) => q.trim()).filter(Boolean).slice(0, MAX_Q), createdAt: editing ? editing.createdAt : now, updatedAt: now });
      location.hash = '#/recruiter';
      C.util.toast(editing ? 'Role updated' : 'Role created');
    });
  };
})(window.Caddie);
