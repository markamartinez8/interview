// Reads a pasted job description: finds responsibilities and requirements, key skills, seniority and years of experience.
(function (C) {
  const HEAD = {
    resp: /(what you(?:'|’)?ll (?:be )?(?:do|doing|own|work on|working on)|what you will do|responsibilit|the role|your role|in this role|day[- ]to[- ]day|key duties|duties|you will|how you(?:'|’)?ll make|your impact|what you(?:'|’)?ll own|about the (?:job|position)|job description|the opportunity|what the job involves)/i,
    req: /(what we(?:'|’)?re looking for|who you are|qualification|requirement|you have|about you|what you bring|must[- ]have|minimum|skills (?:and|&) experience|required|you(?:'|’)?ll bring|what we need|ideal candidate|your background|experience)/i,
    nice: /(nice to have|preferred|bonus|a plus|good to have|desirable|extra credit)/i,
    skip: /(benefit|perk|compensation|salary|pay range|about us|about the company|who we are|our (?:mission|values|story|culture)|equal opportunity|eeo|what we offer|why join|diversity|location|how to apply|apply now)/i,
  };
  const BULLET = /^\s*(?:[-•*·▪●◦–—]|\d+[.)])\s*/;
  const VERBS = 'design build develop manage lead partner drive own write run create maintain collaborate work analyze analyse coordinate execute deliver ship define optimize optimise improve support monitor mentor scale implement plan prioritize prioritise communicate present negotiate forecast report evaluate review test debug deploy architect conduct produce ensure identify oversee establish train recruit onboard sell prospect close generate grow launch track translate advise resolve handle respond provide assist operate administer document research craft shape influence champion contribute act serve help build engage nurture source screen interview'.split(' ');
  const DOUBLE = new Set('run plan set get put cut stop drop map ship begin win swap wrap shop chat plot scan spin trim'.split(' '));
  const SKILLS = ['python', 'java', 'javascript', 'typescript', 'react', 'angular', 'vue', 'node.js', 'golang', 'rust', 'c++', 'c#', '.net', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'nosql', 'postgres', 'mysql', 'mongodb', 'redis', 'kafka', 'graphql', 'api', 'apis', 'microservices', 'distributed systems', 'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'terraform', 'ci/cd', 'devops', 'linux', 'machine learning', 'deep learning', 'data analysis', 'data science', 'statistics', 'a/b testing', 'experimentation', 'tableau', 'power bi', 'looker', 'excel', 'spark', 'etl', 'figma', 'sketch', 'user research', 'prototyping', 'design systems', 'accessibility', 'product roadmap', 'roadmap', 'agile', 'scrum', 'kanban', 'okrs', 'kpis', 'stakeholder management', 'cross-functional', 'project management', 'program management', 'budgeting', 'forecasting', 'p&l', 'financial modeling', 'financial reporting', 'gaap', 'audit', 'accounts payable', 'accounts receivable', 'reconciliation', 'salesforce', 'hubspot', 'crm', 'pipeline', 'prospecting', 'cold calling', 'negotiation', 'account management', 'customer success', 'customer support', 'onboarding', 'seo', 'sem', 'content marketing', 'email marketing', 'paid media', 'social media', 'brand', 'copywriting', 'analytics', 'google analytics', 'patient care', 'ehr', 'hipaa', 'triage', 'clinical', 'compliance', 'risk management', 'recruiting', 'talent acquisition', 'hris', 'people management', 'coaching', 'mentoring', 'leadership', 'strategy', 'communication', 'presentation', 'problem solving', 'public speaking', 'training', 'curriculum', 'supply chain', 'logistics', 'procurement', 'inventory', 'quality assurance', 'testing', 'automation', 'security', 'incident response', 'networking', 'technical writing'];
  const STOPACR = new Set(['USA', 'EOE', 'LLC', 'INC', 'THE', 'AND', 'FOR', 'WITH', 'YOU', 'OUR', 'WE', 'US', 'UK', 'PTO', 'FAQ', 'OR', 'ALL', 'NOT']);

  const clean = (s) => s.replace(BULLET, '').replace(/\s+/g, ' ').trim();
  const headingClass = (line) => {
    const t = line.replace(/[:：]\s*$/, '').trim();
    const looksHeading = line.length < 80 && !BULLET.test(line) && (/[:：]\s*$/.test(line) || (t === t.toUpperCase() && /[A-Z]/.test(t)) || (/^[A-Z][^.!?]*$/.test(t) && t.split(/\s+/).length <= 7));
    if (!looksHeading) return null;
    if (HEAD.skip.test(t)) return 'skip';
    if (HEAD.nice.test(t)) return 'nice';
    if (HEAD.resp.test(t)) return 'resp';
    if (HEAD.req.test(t)) return 'req';
    return /[:：]\s*$/.test(line) || t === t.toUpperCase() ? 'other' : null;
  };
  const sentences = (line) => line.split(/(?<=[.!?])\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
  const RESP_CUE = /^(?:\w+ing\b|(?:you(?:'|’)?ll|you will|will)\b)|^(?:[A-Z][a-z]+)\s/;
  const REQ_CUE = /(\d+\+?\s*(?:-\s*\d+\s*)?years?|experience (?:in|with|of)|proficien|knowledge of|familiar|degree|bachelor|master|certif|ability to|strong\b|excellent\b|skilled|background in|understanding of|expertise|comfortable)/i;

  function classifyLoose(item) {
    const first = item.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
    if (REQ_CUE.test(item)) return 'req';
    if (VERBS.includes(first) || /^(?:you(?:'|’)?ll|you will)\b/i.test(item)) return 'resp';
    return null;
  }

  C.jd = {
    analyze(text, role = '') {
      const out = { resp: [], req: [], nice: [], skills: [], seniority: null, years: null, structured: false, length: (text || '').trim().length };
      if (out.length < 30) return out;
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let section = null;
      const take = (item, sec) => {
        const t = clean(item);
        if (t.length < 20 || t.length > 280 || /^(?:apply|equal opportunity)/i.test(t)) return;
        if (!out[sec].includes(t)) out[sec].push(t);
      };
      for (const raw of lines) {
        const h = headingClass(raw);
        if (h) { section = h; continue; }
        const pieces = BULLET.test(raw) ? [raw] : sentences(raw);
        for (const piece of pieces) {
          const sec = section === 'resp' || section === 'req' || section === 'nice' ? section : section === 'skip' ? null : classifyLoose(clean(piece));
          if (sec) take(piece, sec);
        }
      }
      out.structured = out.resp.length > 0 && out.req.length > 0;
      // skills, by how often they appear and how early
      const low = ` ${text.toLowerCase()} `;
      const found = [];
      SKILLS.forEach((s) => {
        const re = new RegExp(`(?<![a-z0-9+#.])${s.replace(/[.+*?^${}()|[\]\\/]/g, '\\$&')}(?![a-z0-9+#])`, 'g');
        const hits = low.match(re);
        if (hits) found.push({ s, n: hits.length, at: low.search(re) });
      });
      (text.match(/\b[A-Z][A-Z0-9&+]{1,5}\b/g) || []).forEach((a) => {
        if (STOPACR.has(a) || found.some((f) => f.s.toUpperCase() === a)) return;
        const n = (text.match(new RegExp(`\\b${a.replace(/[+&]/g, '\\$&')}\\b`, 'g')) || []).length;
        if (n >= 2) found.push({ s: a, n, at: text.indexOf(a) });
      });
      const PRETTY = { 'node.js': 'Node.js', seo: 'SEO', sql: 'SQL', nosql: 'NoSQL', aws: 'AWS', gcp: 'GCP', api: 'APIs', apis: 'APIs', crm: 'CRM', ehr: 'EHR', hipaa: 'HIPAA', etl: 'ETL', okrs: 'OKRs', kpis: 'KPIs', 'ci/cd': 'CI/CD', 'a/b testing': 'A/B testing', 'p&l': 'P&L', gaap: 'GAAP', hris: 'HRIS', sem: 'SEM', devops: 'DevOps', javascript: 'JavaScript', typescript: 'TypeScript', mysql: 'MySQL', graphql: 'GraphQL', mongodb: 'MongoDB', '.net': '.NET', 'power bi': 'Power BI', hubspot: 'HubSpot', golang: 'Go', 'c#': 'C#', 'c++': 'C++', excel: 'Excel' };
      const seen = new Set();
      out.skills = found.sort((a, b) => b.n - a.n || a.at - b.at).map((f) => (PRETTY[f.s] || (f.s === f.s.toUpperCase() ? f.s : f.s.replace(/\b\w/g, (c) => c.toUpperCase())))).filter((x) => !seen.has(x) && seen.add(x)).slice(0, 8);
      const hay = `${role} ${text.slice(0, 600)}`;
      const sen = hay.match(/\b(intern|entry[- ]level|junior|jr\.?|associate|mid[- ]level|senior|sr\.?|staff|principal|lead|head of|director|vp|vice president|manager)\b/i);
      if (sen) out.seniority = sen[1].replace(/\.$/, '').replace(/^sr$/i, 'senior').replace(/^jr$/i, 'junior').toLowerCase();
      const yrs = [...text.matchAll(/(\d{1,2})\s*\+?\s*(?:-|to|–)?\s*(\d{1,2})?\s*\+?\s*years?/gi)].map((m) => +m[1]).filter((n) => n > 0 && n < 30);
      if (yrs.length) out.years = Math.max(...yrs);
      return out;
    },

    gerund(verb) {
      const v = verb.toLowerCase();
      if (/ie$/.test(v)) return v.slice(0, -2) + 'ying';
      if (/ee$|ye$|oe$/.test(v)) return v + 'ing';
      if (/e$/.test(v)) return v.slice(0, -1) + 'ing';
      if (DOUBLE.has(v)) return v + v.slice(-1) + 'ing';
      return v + 'ing';
    },
    // "Design and build scalable APIs" -> "designing and building scalable APIs"; null if it does not start with a verb.
    toGerundPhrase(item) {
      const t = clean(item).replace(/[.;,]+$/, '').replace(/^you(?:'|’)?ll\s+|^you will\s+|^will\s+/i, '');
      const words = t.split(/\s+/);
      if (!VERBS.includes(words[0].toLowerCase())) return /^\w+ing\b/i.test(words[0]) ? t.charAt(0).toLowerCase() + t.slice(1) : null;
      words[0] = this.gerund(words[0]);
      for (let i = 2; i < Math.min(words.length, 14); i++) if (/^(and|or)$/i.test(words[i - 1]) && VERBS.includes(words[i].toLowerCase())) words[i] = this.gerund(words[i]);
      return words.join(' ');
    },
  };
})(window.Caddie);
