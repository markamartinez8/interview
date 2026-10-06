// Question generation without a paid AI: role-family question banks plus lines pulled from the job description.
(function (C) {
  const OPENER = "Let's start simple. Tell me about yourself and walk me through your resume.";
  const CLOSER = 'Last one. Do you have any questions for us about the role or the team?';

  const FAMILIES = [
    { re: /engineer|developer|programmer|software|devops|sre|data scientist|machine learning|\bml\b|\bqa\b/i, qs: [
      'Describe a technically difficult problem you solved recently. How did you approach it and what was the outcome?',
      'Tell me about a time you had to make a trade-off between speed and quality. What did you decide and why?',
      'How do you debug something when you have no idea where the problem is?',
      'Walk me through how you would design a system you have not built before. Where do you start?'] },
    { re: /product manager|product owner|\bpm\b|program manager/i, qs: [
      'Tell me about a product decision you made with incomplete data. What happened?',
      'How do you decide what not to build?',
      'Describe a time you aligned stakeholders who disagreed about priorities.',
      'How would you measure whether a feature you shipped was successful?'] },
    { re: /design|ux|ui\b|creative|brand/i, qs: [
      'Walk me through a project from the first brief to the final result. What was your role?',
      'Tell me about a time you received tough feedback on your work. What did you change?',
      'How do you balance user needs with business constraints?',
      'How do you decide when a design is finished?'] },
    { re: /sales|account executive|business development|\bbdr\b|\bsdr\b|account manager/i, qs: [
      'Walk me through your process for a deal from first contact to close.',
      'Tell me about a deal you lost. What did you learn from it?',
      'How do you handle a prospect who says your price is too high?',
      'How do you build and manage your pipeline each week?'] },
    { re: /marketing|growth|content|seo|social media|communications|\bpr\b/i, qs: [
      'Tell me about a campaign you ran. What was the goal and how did you measure it?',
      'How do you decide where to spend a limited budget?',
      'Describe a time an initiative underperformed. What did you do next?',
      'How do you understand an audience you know little about?'] },
    { re: /finance|accountant|accounting|analyst|auditor|controller|bookkeep/i, qs: [
      'Describe a time you found an error or inconsistency in numbers. How did you handle it?',
      'How do you explain a complex financial result to someone without a finance background?',
      'Walk me through how you prioritize during a tight deadline such as a close.',
      'Tell me about an analysis that changed a decision.'] },
    { re: /nurse|clinical|health|medical|patient|care|therapist|pharmac/i, qs: [
      'Tell me about a time you had to stay calm in a high-pressure situation with a patient or client.',
      'How do you prioritize when several people need your attention at once?',
      'Describe a time you advocated for someone in your care.',
      'How do you handle disagreement with a colleague about the right course of action?'] },
    { re: /customer|support|success|service|help desk/i, qs: [
      'Tell me about a time you turned around an unhappy customer.',
      'How do you handle a request you cannot fulfill?',
      'Describe how you stay patient with a customer who keeps repeating themselves.',
      'How do you prioritize when the queue is long?'] },
    { re: /manager|director|lead|head of|supervisor|operations|project|coordinator/i, qs: [
      'Tell me about a time you led a team through a difficult change.',
      'How do you handle a team member who is underperforming?',
      'Describe how you prioritize and delegate when everything feels urgent.',
      'Tell me about a project that went off track. How did you get it back?'] },
  ];
  const GENERAL = [
    'What interests you about this role, and why now?',
    'Tell me about a project you are proud of. What was your specific contribution?',
    'Describe a time you had to learn something new quickly to get a job done.',
    'What would your last manager say is your biggest strength, and one thing you could improve?',
    'Tell me about a time you disagreed with a colleague. How did you resolve it?',
    'Describe a setback at work. What did you do next?',
  ];

  function section(text, headings) {
    const lines = text.split(/\r?\n/);
    const out = [];
    let on = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const isHeading = line.length < 70 && /[:?]?$/.test(line) && !/^[-•*·•]/.test(line);
      if (isHeading && headings.test(line)) { on = true; continue; }
      if (isHeading && /(benefits|about us|about the company|compensation|salary|equal opportunity|what we offer|perks)/i.test(line)) { on = false; continue; }
      if (isHeading && !headings.test(line) && /^(what|who|your|about|requirements|qualifications|responsibilities|nice|bonus|preferred)/i.test(line)) { on = false; continue; }
      if (on) out.push(line.replace(/^(?:[-•*·]|\d+[.)])\s*/, '').trim());
    }
    return out.filter((l) => l.length >= 20 && l.length <= 260);
  }
  const clip = (s, n = 140) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s).replace(/[.;,]+$/, '');

  function shuffle(a, seed) {
    const arr = a.slice(); let s = seed;
    for (let i = arr.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  C.questions = {
    OPENER, CLOSER,
    generate({ jobName, jd }) {
      const seed = (jobName + (jd || '')).length + 7;
      const fam = FAMILIES.find((f) => f.re.test(jobName)) || null;
      const roleQs = fam ? shuffle(fam.qs, seed) : [];
      const out = [{ text: OPENER, kind: 'opener' }];
      let fromJd = 0;
      if (jd && jd.trim().length > 40) {
        const doing = section(jd, /(what you'?ll (be )?do|what you will do|responsibilities|the role|your role|in this role|day[- ]to[- ]day|what you'?ll be doing)/i);
        const looking = section(jd, /(what we'?re looking for|who you are|qualifications|requirements|you have|about you|what you bring|must have|minimum)/i);
        let pool = [...doing.slice(0, 2).map((l) => ({ text: `This role involves: ${clip(l)}. Tell me about a time you did something similar, and how it went.`, kind: 'jd-do' })),
          ...looking.slice(0, 2).map((l) => ({ text: `We're looking for: ${clip(l)}. How does your experience match that?`, kind: 'jd-need' }))];
        if (!pool.length) {
          // No recognizable headings: use the longest-looking bullet-like lines
          const lines = jd.split(/\r?\n/).map((l) => l.replace(/^(?:[-•*·]|\d+[.)])\s*/, '').trim()).filter((l) => l.length >= 30 && l.length <= 220);
          pool = lines.slice(0, 3).map((l) => ({ text: `The job description mentions: ${clip(l)}. Tell me about your experience with that.`, kind: 'jd' }));
        }
        out.push(...pool); fromJd = pool.length;
      }
      const target = 7;
      const fill = [...roleQs, ...shuffle(GENERAL, seed + 3)];
      for (const q of fill) { if (out.length >= target) break; if (!out.some((o) => o.text === q)) out.push({ text: q, kind: 'role' }); }
      out.push({ text: CLOSER, kind: 'closer' });
      return { questions: out.slice(0, 9), usedJd: fromJd > 0, roleFamily: !!fam };
    },
    fromAI(list) { return [{ text: OPENER, kind: 'opener' }, ...list.map((text) => ({ text, kind: 'ai' })), { text: CLOSER, kind: 'closer' }]; },
    staticList(lines, withOpener) {
      const qs = lines.map((l) => l.trim()).filter(Boolean).map((text) => ({ text, kind: 'custom' }));
      return withOpener && !qs.some((q) => /tell me about yourself|walk me through your (resume|cv)/i.test(q.text)) ? [{ text: OPENER, kind: 'opener' }, ...qs] : qs;
    },
  };
})(window.Caddie);
