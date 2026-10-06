// Builds the interview: always "Walk me through your resume" first, then the 2 to 4 questions most relevant to the role and job description.
(function (C) {
  const OPENER = "Let's start with your background. Walk me through your resume.";

  const FAMILIES = [
    { name: 'engineering', re: /engineer|developer|programmer|software|devops|sre|data scientist|machine learning|\bml\b|\bqa\b/i, qs: [
      'Describe a technically difficult problem you solved recently. How did you approach it and what was the outcome?',
      'Tell me about a time you had to trade speed against quality. What did you decide and why?',
      'How do you debug something when you have no idea where the problem is?',
      'Walk me through how you would design a system you have not built before. Where do you start?'] },
    { name: 'product', re: /product manager|product owner|\bpm\b|program manager/i, qs: [
      'Tell me about a product decision you made with incomplete data. What happened?',
      'How do you decide what not to build?',
      'Describe a time you aligned stakeholders who disagreed about priorities.',
      'How would you measure whether a feature you shipped was successful?'] },
    { name: 'design', re: /design|ux|ui\b|creative|brand/i, qs: [
      'Walk me through a project from the first brief to the final result. What was your role?',
      'Tell me about a time you got tough feedback on your work. What did you change?',
      'How do you balance user needs with business constraints?',
      'How do you decide when a design is finished?'] },
    { name: 'sales', re: /sales|account executive|business development|\bbdr\b|\bsdr\b|account manager/i, qs: [
      'Walk me through your process for a deal from first contact to close.',
      'Tell me about a deal you lost. What did you learn from it?',
      'How do you respond when a prospect says your price is too high?',
      'How do you build and manage your pipeline each week?'] },
    { name: 'marketing', re: /marketing|growth|content|seo|social media|communications|\bpr\b/i, qs: [
      'Tell me about a campaign you ran. What was the goal and how did you measure it?',
      'How do you decide where to spend a limited budget?',
      'Describe a time an initiative underperformed. What did you do next?',
      'How do you learn about an audience you know little about?'] },
    { name: 'finance', re: /finance|accountant|accounting|analyst|auditor|controller|bookkeep/i, qs: [
      'Describe a time you found an error or inconsistency in numbers. How did you handle it?',
      'How do you explain a complex financial result to someone without a finance background?',
      'How do you prioritize when a deadline such as a close is tight?',
      'Tell me about an analysis that changed a decision.'] },
    { name: 'healthcare', re: /nurse|clinical|health|medical|patient|care|therapist|pharmac/i, qs: [
      'Tell me about a time you stayed calm in a high-pressure situation with a patient or client.',
      'How do you prioritize when several people need your attention at once?',
      'Describe a time you advocated for someone in your care.',
      'How do you handle disagreement with a colleague about the right course of action?'] },
    { name: 'customer', re: /customer|support|success|service|help desk/i, qs: [
      'Tell me about a time you turned around an unhappy customer.',
      'How do you handle a request you cannot fulfill?',
      'How do you stay patient with a customer who keeps repeating themselves?',
      'How do you prioritize when the queue is long?'] },
    { name: 'management', re: /manager|director|lead|head of|supervisor|operations|project|coordinator/i, qs: [
      'Tell me about a time you led a team through a difficult change.',
      'How do you handle a team member who is underperforming?',
      'How do you prioritize and delegate when everything feels urgent?',
      'Tell me about a project that went off track. How did you get it back?'] },
  ];
  const BEHAVIORAL = [
    'Tell me about a time you disagreed with a colleague. How did you resolve it?',
    'Describe a setback at work. What did you do next?',
    'Tell me about a time you had to learn something new quickly to get a job done.',
    'What would your last manager say is your biggest strength, and one thing you could improve?',
  ];
  const SENIOR = 'Tell me about a time you set direction for others or made a call that was yours alone to make. How did it turn out?';
  const JUNIOR = 'Tell me about something you taught yourself recently. How did you go about it and what did you build or produce?';

  const STOP = new Set('the and for with that this from your you our are will have has not but can all any use using work working team experience years year ability strong skills role job new more also who what when where about into across such other including must should may per plus able well'.split(' '));
  const tokens = (t) => (String(t).toLowerCase().match(/[a-z][a-z+#.\-]{2,}/g) || []).filter((w) => !STOP.has(w));
  const clip = (s, n = 130) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s).replace(/[.;,]+$/, '');
  const excerpt = (s) => `“${clip(s, 90)}”`;

  function respQuestion(item, i) {
    const g = C.jd.toGerundPhrase(item);
    if (!g) return `The role involves: ${clip(item)}. Walk me through a specific time you did something like that.`;
    return i % 2 === 0
      ? `Tell me about a time you were responsible for ${clip(g)}. What was your approach and what was the result?`
      : `This role involves ${clip(g)}. Walk me through a specific example from your experience.`;
  }
  function reqQuestion(item) {
    const yrs = item.match(/(\d{1,2})\s*\+?\s*years?\s+(?:of\s+)?([^.;,]{4,90})/i);
    if (yrs) return `The posting asks for ${yrs[1]}+ years of ${clip(yrs[2], 90)}. What is the most significant work you have done there?`;
    const exp = item.match(/(?:experience|proficien\w*|expertise|knowledge|familiarity)\s+(?:in|with|of)\s+([^.;]{4,90})/i);
    if (exp) return `How have you used ${clip(exp[1], 90)} on a real project? What was the outcome?`;
    if (/^(?:strong|excellent|proven|demonstrated|ability|able)/i.test(item)) return `The role calls for ${clip(item[0].toLowerCase() + item.slice(1))}. Give me an example that shows it.`;
    return `We are looking for ${clip(item[0].toLowerCase() + item.slice(1))}. What is the strongest example of that in your background?`;
  }

  C.questions = {
    OPENER,
    analyze: (jd, role) => C.jd.analyze(jd || '', role || ''),

    // Returns { questions: [opener, ...2-4 ranked questions], analysis }.
    generate({ jobName, jd }) {
      const role = jobName || '';
      const a = C.jd.analyze(jd || '', role);
      const roleTok = new Set(tokens(role));
      const skillSet = a.skills.map((s) => s.toLowerCase());
      const cand = [];
      const add = (text, kind, base, why, hay = '') => {
        const hits = tokens(hay).filter((w) => roleTok.has(w)).length;
        const skillHits = skillSet.filter((s) => hay.toLowerCase().includes(s)).length;
        cand.push({ text, kind, why, score: base + Math.min(1.5, hits * 0.5) + Math.min(1.2, skillHits * 0.4) });
      };
      a.resp.slice(0, 5).forEach((r, i) => add(respQuestion(r, i), 'jd-do', 3.2 - i * 0.25, `Responsibility in the posting: ${excerpt(r)}`, r));
      a.req.slice(0, 5).forEach((r, i) => add(reqQuestion(r), 'jd-need', 3.1 - i * 0.25, `Requirement in the posting: ${excerpt(r)}`, r));
      const covered = (s) => cand.some((c) => c.why.toLowerCase().includes(s.toLowerCase()));
      a.skills.filter((s) => !covered(s)).slice(0, 2).forEach((s) => add(`${s} comes up in this posting. How have you used it in your work, and what was the result?`, 'skill', 2.2, `Skill emphasized in the posting: ${s}`, s));
      const fam = FAMILIES.find((f) => f.re.test(role));
      if (fam) fam.qs.forEach((q, i) => add(q, 'role', 2.0 - i * 0.1, `Common for ${fam.name} roles`, q));
      if (a.seniority && /senior|staff|principal|lead|head|director|vp|manager/.test(a.seniority)) add(SENIOR, 'level', 2.4, `The posting is for a ${a.seniority} role`);
      else if (a.seniority && /junior|entry|intern|associate/.test(a.seniority)) add(JUNIOR, 'level', 2.4, `The posting is for a ${a.seniority} role`);
      BEHAVIORAL.forEach((q, i) => add(q, 'behavioral', 1.0 - i * 0.05, 'Asked in most interviews'));

      const rich = a.resp.length + a.req.length >= 3;
      const want = rich ? 4 : a.resp.length + a.req.length > 0 || fam ? 3 : 2;
      const picked = [], count = {};
      const limit = { 'jd-do': 2, 'jd-need': 2, skill: 1, role: 2, level: 1, behavioral: 2 };
      for (const c of cand.sort((x, y) => y.score - x.score)) {
        if (picked.length >= want) break;
        if ((count[c.kind] || 0) >= limit[c.kind]) continue;
        picked.push(c); count[c.kind] = (count[c.kind] || 0) + 1;
      }
      // make sure a posting that has both sections is represented by both
      if (a.resp.length && a.req.length && picked.length >= 3) {
        for (const kind of ['jd-do', 'jd-need']) {
          if (!picked.some((p) => p.kind === kind)) { const c = cand.find((x) => x.kind === kind); if (c) picked[picked.length - 1] = c; }
        }
      }
      return { questions: [{ text: OPENER, kind: 'opener', why: 'Always first' }, ...picked.map((p) => ({ text: p.text, kind: p.kind, why: p.why }))], analysis: a, roleFamily: !!fam };
    },

    // Claude returns [{text, why}] (3 to 4 questions); the opener is added here.
    fromAI(list) {
      return [{ text: OPENER, kind: 'opener', why: 'Always first' }, ...list.slice(0, 4).map((q) => ({ text: q.text, kind: 'ai', why: q.why || '' }))];
    },
    // Your own questions, with the resume question always first (any similar question of yours is folded into it).
    staticList(lines) {
      const mine = lines.map((l) => l.trim()).filter(Boolean).filter((l) => !/walk me through your (resume|cv)|tell me about yourself/i.test(l));
      return [{ text: OPENER, kind: 'opener', why: 'Always first' }, ...mine.map((text) => ({ text, kind: 'custom', why: 'Your question' }))];
    },
  };
})(window.Caddie);
