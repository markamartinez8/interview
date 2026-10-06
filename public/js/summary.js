// Turns raw metrics into scores, plain-language findings, action items and downloadable reports.
(function (C) {
  const { esc, fmtDur, fmtDate } = C.util;
  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
  const label = (s) => (s == null ? { text: 'Not measured', cls: 'na' } : s >= 75 ? { text: 'Strong', cls: 'good' } : s >= 55 ? { text: 'Solid', cls: 'ok' } : { text: 'Needs work', cls: 'low' });
  C.label = label;

  C.score = function (m, questions) {
    const out = { speech: null, face: null, body: null, qa: null };
    const actions = [];
    const add = (key, sev, text) => actions.push({ key, sev, text });
    const sp = m.speech;

    // Speech: pace, filler words, long pauses
    if (m.capabilities.speech && sp.wpm != null && sp.words >= 25) {
      let s = 100;
      if (sp.wpm < 110) s -= Math.min(30, (110 - sp.wpm) * 0.8);
      if (sp.wpm > 175) s -= Math.min(30, (sp.wpm - 175) * 0.8);
      if (sp.fillersPer100 > 2) s -= Math.min(30, (sp.fillersPer100 - 2) * 6);
      s -= Math.min(20, sp.longPauses * 5);
      out.speech = Math.round(clamp(s));
      if (sp.wpm > 175) add('pace-fast', 3, `Slow down. You averaged ${sp.wpm} words per minute; aim for 120 to 165. Take a breath after each main point.`);
      if (sp.wpm < 105) add('pace-slow', 2, `Pick up the energy a little. You averaged ${sp.wpm} words per minute; 120 to 165 sounds natural and confident.`);
      if (sp.fillersPer100 > 3) {
        const top = Object.entries(sp.fillerWords).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w, n]) => `"${w}" ×${n}`).join(', ');
        add('fillers', 3, `Cut filler words. You used ${sp.fillers} (${top}). Replace them with a short silent pause.`);
      }
      if (sp.longPauses >= 3) add('pauses', 2, `You paused for 3+ seconds ${sp.longPauses} times mid-answer. Buy time with a phrase like "Let me think about that for a moment" instead of going quiet.`);
    } else if (sp.speakSec >= 10) {
      out.speech = null;
      add('no-transcript', 1, 'Speech pace and filler words were not measured because this browser has no speech recognition. Use Chrome or Edge for a full transcript.');
    }

    // Face: eye contact (primary), smile and expressiveness are informational
    if (m.capabilities.vision && m.face.facePct != null && m.face.eyeContactPct != null && m.face.frames >= 20) {
      out.face = Math.round(clamp((m.face.eyeContactPct / 70) * 100));
      if (m.face.facePct < 60) add('face-hidden', 2, `Your face was visible only ${m.face.facePct}% of the time. Center yourself in the frame and sit in front of a light source.`);
      if (m.face.eyeContactPct < 50) add('eye', 3, `Look at the camera more. You made eye contact about ${m.face.eyeContactPct}% of the time; aim for 60% or more. Put a sticky note next to the lens as a target.`);
    } else if (m.capabilities.camera && !m.capabilities.vision) add('no-vision', 1, 'Face and posture analysis could not load, so those sections are not measured.');

    // Body: posture and movement
    if (m.capabilities.pose && m.body.poseFrames >= 20) {
      let s = m.body.uprightPct;
      if (m.body.fidget != null && m.body.fidget > 0.03) s -= 15;
      out.body = Math.round(clamp(s));
      if (m.body.slouchPct > 30) add('slouch', 2, `You slouched or dropped your shoulders for ${m.body.slouchPct}% of the time. Sit back in the chair, shoulders down and relaxed.`);
      if (m.body.tiltPct > 35) add('tilt', 1, `Your shoulders were tilted for ${m.body.tiltPct}% of the time. Square up to the camera.`);
      if (m.body.fidget != null && m.body.fidget > 0.03) add('fidget', 2, 'You moved a lot while answering. Rest your hands on the desk and let gestures be deliberate.');
    }

    // Answers: length and coverage
    const asked = m.perQuestion.filter((q) => q.asked && q.seconds > 0);
    if (asked.length) {
      const good = asked.filter((q) => q.speakSec >= 20 && q.speakSec <= 150 || (q.speakSec < 20 && q.typed));
      out.qa = Math.round((good.length / questions.length) * 100);
      const short = asked.filter((q) => q.speakSec < 20 && !q.typed).length, long = asked.filter((q) => q.speakSec > 150).length;
      if (short) add('short', 3, `${short} answer${short > 1 ? 's were' : ' was'} under 20 seconds. Use the STAR structure: Situation, Task, Action, Result.`);
      if (long) add('long', 2, `${long} answer${long > 1 ? 's ran' : ' ran'} past 2.5 minutes. Lead with the result, then give only the details that support it.`);
      if (questions.length > asked.length) add('incomplete', 1, `You ended before the last ${questions.length - asked.length} question${questions.length - asked.length > 1 ? 's' : ''}. Finish a full run next time for the most useful feedback.`);
    }

    const vals = Object.values(out).filter((v) => v != null);
    out.overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    actions.sort((a, b) => b.sev - a.sev);
    if (!actions.some((a) => a.sev >= 2) && out.overall != null) add('keep-going', 0, 'No major issues found. Try Mock mode or a harder set of questions to keep sharpening.');
    return { scores: out, actions: actions.slice(0, 6) };
  };

  const pc = (v) => (v == null ? '—' : `${v}%`);
  C.describe = function (m) {
    const sp = m.speech, f = m.face, b = m.body;
    const unit = (v, lo, hi, a, ok, c) => (v == null ? '—' : v < lo ? a : v > hi ? c : ok);
    return {
      speech: [
        ['Pace', sp.wpm != null ? `${sp.wpm} words/min` : 'Not measured', sp.wpm == null ? '' : sp.wpm < 110 ? 'a bit slow' : sp.wpm > 175 ? 'fast' : 'in the target range'],
        ['Filler words', sp.fillersPer100 != null ? `${sp.fillers} (${sp.fillersPer100} per 100 words)` : 'Not measured', sp.fillersPer100 == null ? '' : sp.fillersPer100 > 3 ? 'frequent' : 'low'],
        ['Pauses over 3 seconds', m.capabilities.speech ? String(sp.longPauses) : 'Not measured', ''],
        ['Time speaking', fmtDur(sp.speakSec), ''],
        ['Volume steadiness', sp.volVariation != null ? unit(sp.volVariation, 0.35, 0.8, 'very steady', 'natural variation', 'highly variable') : 'Not measured', ''],
      ],
      face: [
        ['Eye contact', pc(f.eyeContactPct), f.eyeContactPct == null ? '' : f.eyeContactPct >= 60 ? 'good' : 'low'],
        ['Face in frame', pc(f.facePct), ''],
        ['Smiling', pc(f.smilePct), 'share of time; no target'],
        ['Expressiveness', f.expressiveness != null ? unit(f.expressiveness, 0.04, 0.12, 'flat', 'natural', 'very animated') : '—', 'smile and eyebrow movement'],
        ['Head movement', f.headMovement != null ? unit(f.headMovement, 1.2, 4, 'very still', 'natural', 'restless') : '—', ''],
      ],
      body: [
        ['Upright posture', pc(b.uprightPct), 'measured against how you sat at the start'],
        ['Slouching', pc(b.slouchPct), ''],
        ['Shoulders level', b.tiltPct == null ? '—' : pc(100 - b.tiltPct), ''],
        ['Movement', b.fidget != null ? unit(b.fidget, 0.008, 0.03, 'very calm', 'natural', 'restless') : '—', ''],
      ],
    };
  };

  C.transcriptText = function (s) {
    const lines = [`Caddie interview transcript`, `Role: ${s.setup.jobName || 'Custom questions'}`, `Date: ${fmtDate(s.createdAt)}`, `Mode: ${s.setup.mode === 'practice' ? 'Practice' : 'Mock'}`, ''];
    s.metrics.perQuestion.forEach((q, i) => {
      lines.push(`Q${i + 1} Andy: ${q.text}`);
      if (q.asked) {
        if (q.answer) lines.push(`You: ${q.answer}`);
        if (q.typed) lines.push(`You (typed): ${q.typed}`);
        if (!q.answer && !q.typed) lines.push('You: (no transcript captured)');
      } else lines.push('(not asked)');
      lines.push('');
    });
    return lines.join('\n');
  };

  C.reportHTML = function (s) {
    const d = C.describe(s.metrics), L = (x) => label(x).text;
    const block = (title, rows) => `<h3>${esc(title)}</h3><table>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td><b>${esc(r[1])}</b></td><td>${esc(r[2] || '')}</td></tr>`).join('')}</table>`;
    return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Caddie summary</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#14171F}h1{color:#3730A3}h3{margin-top:1.6rem}table{border-collapse:collapse;width:100%}td{padding:.35rem .5rem;border-top:1px solid #E6E8EC}blockquote{margin:.3rem 0 1rem;padding:.4rem .8rem;border-left:3px solid #2A9DA8;background:#F7F8FA;color:#4A5261}.s{display:inline-block;margin-right:1.2rem}</style>
<h1>Caddie interview summary</h1><p>${esc(s.setup.jobName || 'Custom questions')} · ${fmtDate(s.createdAt)} · ${fmtDur(s.metrics.duration)} · ${s.setup.mode === 'practice' ? 'Practice' : 'Mock'} mode</p>
<p>${['speech', 'face', 'body', 'qa'].map((k) => `<span class="s"><b>${{ speech: 'Speech', face: 'Face', body: 'Body language', qa: 'Answers' }[k]}</b>: ${s.scores[k] == null ? 'not measured' : `${s.scores[k]} (${L(s.scores[k])})`}</span>`).join('')}</p>
<h3>Action items</h3><ol>${s.actions.map((a) => `<li>${esc(a.text)}</li>`).join('')}</ol>
${block('Speech', d.speech)}${block('Face', d.face)}${block('Body language', d.body)}
<h3>Questions and answers</h3>${s.metrics.perQuestion.map((q, i) => `<p><b>Q${i + 1}.</b> ${esc(q.text)}</p><blockquote>${esc(q.answer || q.typed || (q.asked ? 'No transcript captured.' : 'Not asked.'))}</blockquote>`).join('')}
<p style="color:#4A5261;font-size:.85rem">Measurements are practice indicators from on-device analysis, not predictions of hiring outcomes.</p></html>`;
  };

  C.dashStats = function (sessions) {
    const scored = sessions.filter((s) => s.scores && s.scores.overall != null);
    const names = { speech: 'Speech', face: 'Eye contact and expression', body: 'Body language', qa: 'Answer structure' };
    const avg = {};
    for (const k of Object.keys(names)) { const v = scored.map((s) => s.scores[k]).filter((x) => x != null); if (v.length) avg[k] = Math.round(v.reduce((a, b) => a + b, 0) / v.length); }
    const ranked = Object.entries(avg).sort((a, b) => b[1] - a[1]);
    const best = scored.slice().sort((a, b) => b.scores.overall - a.scores.overall)[0] || null;
    const counts = {};
    scored.forEach((s) => (s.actions || []).filter((a) => a.sev >= 1).forEach((a) => { counts[a.key] = counts[a.key] || { n: 0, text: a.text }; counts[a.key].n++; }));
    const recurring = Object.values(counts).sort((a, b) => b.n - a.n)[0];
    return { scored, names, avg, strongest: ranked[0], weakest: ranked.length > 1 ? ranked[ranked.length - 1] : null, best, recurring: recurring && recurring.n > 1 ? recurring : null,
      totalSec: sessions.reduce((n, s) => n + ((s.metrics && s.metrics.duration) || 0), 0) };
  };
})(window.Caddie);
