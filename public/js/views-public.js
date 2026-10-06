// Public website: home, value, about, plans.
(function (C) {
  const V = C.views;
  const mockTiles = `<div class="mock" aria-hidden="true"><div class="mock-tiles">
    <div class="mock-tile andy"><svg viewBox="0 0 300 340">${C.AVATAR_SVG.replace('id="shirt"', 'id="shirt2"').replace('url(#shirt)', 'url(#shirt2)')}</svg><span class="mock-tag">Andy</span></div>
    <div class="mock-tile you"><svg viewBox="0 0 300 340"><circle cx="150" cy="140" r="58" fill="#34505C"/><path d="M30 340 C40 262 90 238 150 238 C210 238 260 262 270 340 Z" fill="#2A404B"/></svg><span class="mock-tag">You</span></div></div>
    <div class="mock-cues"><span class="chip good">Eye contact 72%</span><span class="chip good">Pace 138 wpm</span><span class="chip ok">Fillers 3</span><span class="chip good">Posture upright</span></div></div>`;

  V.home = () => `
  <section class="hero"><div class="container hero-grid">
    <div class="stack" style="gap:1.2rem"><span class="eyebrow">Interview practice</span>
      <h1>Practice the interview <em>before it counts.</em></h1>
      <p class="lead">Meet Andy, a virtual interviewer who asks real questions, waits while you answer, and gives you a straight read on your speech, eye contact and posture.</p>
      <div class="row"><a class="btn btn-primary btn-lg" href="#/app">Start practicing</a><a class="btn btn-ghost btn-lg" href="#/value">See what you get</a></div>
      <p class="small muted">No account needed in this preview. Your sessions stay on your device.</p></div>
    ${mockTiles}</div></section>
  <section class="section alt"><div class="container"><div class="section-head"><span class="eyebrow">How it works</span><h2>From setup to feedback in one sitting</h2></div>
    <div class="steps">
      <div class="step"><h3>Set up your interview</h3><p class="muted">Enter the job title and paste the job description, or write the exact questions you want to rehearse. Andy always opens with "Tell me about yourself."</p></div>
      <div class="step"><h3>Interview with Andy</h3><p class="muted">Turn on your camera and mic. Andy speaks each question, then waits until you have been quiet for a few seconds before moving on.</p></div>
      <div class="step"><h3>Review your summary</h3><p class="muted">Get scores, a question-by-question breakdown, action items, a transcript and your recording to download.</p></div></div></div></section>
  <section class="section"><div class="container"><div class="section-head"><span class="eyebrow">What Caddie measures</span><h2>Things you can see and change</h2><p class="muted">We measure observable habits, not feelings. Nothing here guesses your emotions or predicts a hiring decision.</p></div>
    <div class="measure-grid">
      <div class="card measure"><h3><span class="dot"></span>Speech</h3><p class="muted">How you sound.</p><ul><li>Words per minute</li><li>Filler words</li><li>Long pauses</li></ul></div>
      <div class="card measure"><h3><span class="dot"></span>Face</h3><p class="muted">How you come across on camera.</p><ul><li>Eye contact with the camera</li><li>Smiling and expressiveness</li><li>Head movement</li></ul></div>
      <div class="card measure"><h3><span class="dot"></span>Body language</h3><p class="muted">What your posture says.</p><ul><li>Upright and level shoulders</li><li>Slouching and leaning</li><li>Restless movement</li></ul></div>
      <div class="card measure"><h3><span class="dot"></span>Answers</h3><p class="muted">How you structure what you say.</p><ul><li>Answer length per question</li><li>Full transcript</li><li>STAR-style action items</li></ul></div></div></div></section>
  <section class="section alt"><div class="container row" style="justify-content:space-between;gap:1.5rem"><div class="stack" style="gap:.4rem;max-width:36rem"><h2>Your practice is private</h2><p class="muted">Video, audio and transcripts are analyzed and stored in your browser. Nothing is uploaded in this version.</p></div><a class="btn btn-primary btn-lg" href="#/app">Begin an interview</a></div></section>`;

  V.value = () => `
  <section class="section"><div class="container"><div class="section-head"><span class="eyebrow">Value</span><h1 style="font-size:clamp(2rem,4.5vw,3rem)">Rehearse with something that talks back</h1><p class="muted">Practicing alone in the mirror gives you no feedback. A friend is not always available. Caddie fills the gap.</p></div>
    <div class="measure-grid">
      <div class="card"><h3>Realistic pressure</h3><p class="muted" style="margin-top:.4rem">Andy speaks, you answer out loud, and the clock keeps moving. That is much closer to the real thing than reading questions on a page.</p></div>
      <div class="card"><h3>Feedback you can act on</h3><p class="muted" style="margin-top:.4rem">Every summary ends with a short list of specific changes, like slowing down or looking at the lens, with the numbers behind them.</p></div>
      <div class="card"><h3>Tailored to the job</h3><p class="muted" style="margin-top:.4rem">Paste a job description and Caddie turns its responsibilities and requirements into questions. Or write your own.</p></div></div></div></section>
  <section class="section alt"><div class="container"><div class="section-head"><span class="eyebrow">Two ways to practice</span><h2>Practice mode and Mock mode</h2></div>
    <div class="measure-grid"><div class="card"><h3>Practice mode</h3><ul><li>Live cues on the side while you answer</li><li>Pause, skip and go back</li><li>Best when you are learning your habits</li></ul></div>
      <div class="card"><h3>Mock mode</h3><ul><li>No tips during the interview</li><li>No pausing, just like the real thing</li><li>Everything shows up in the summary afterward</li></ul></div></div></div></section>
  <section class="section"><div class="container prose"><h2>What Caddie cannot do</h2>
    <p class="muted">Being clear about limits makes the feedback more useful.</p>
    <ul class="muted"><li>It does not predict whether you will get a job.</li><li>It does not read emotions. Eye contact, posture and pace are estimates from your camera and microphone, and lighting and camera angle affect them.</li><li>In this version Andy follows a script of questions. He does not yet ask follow-ups based on what you say.</li></ul>
    <div><a class="btn btn-primary" href="#/app">Try it now</a></div></div></section>`;

  V.about = () => `
  <section class="section"><div class="container prose"><span class="eyebrow">About</span><h1 style="font-size:clamp(2rem,4.5vw,3rem)">A caddie carries the bag and reads the course</h1>
    <p>A golf caddie does not swing the club for you. They know the course, hand you the right tool and tell you the truth about the shot. Caddie does the same for interviews.</p>
    <h2>Principles</h2>
    <p><b>Measure what you can see.</b> We report pace, filler words, eye contact and posture, things you can change. We do not label emotions or personality.</p>
    <p><b>Keep your data yours.</b> Recordings, transcripts and scores are stored in your browser. You can download or delete them any time from Settings.</p>
    <p><b>Make practice feel real.</b> A voice, a face, a clock, and a question you did not see coming if you want that.</p>
    <h2>How it works today</h2>
    <p>Andy reads questions from a bank matched to your role and the job description you provide. Your camera and microphone are analyzed on your device using open computer-vision models and your browser's speech recognition. Smarter follow-up questions and more natural voices are planned.</p>
    <div><a class="btn btn-primary" href="#/app">Start practicing</a></div></div></section>`;

  V.plans = () => `
  <section class="section"><div class="container"><div class="section-head"><span class="eyebrow">Plans</span><h1 style="font-size:clamp(2rem,4.5vw,3rem)">Free while we build</h1><p class="muted">Pricing for paid plans has not been set. Nothing here asks for payment.</p></div>
    <div class="plans">
      <div class="card plan featured"><span class="badge">Available now</span><h3 style="margin-top:.6rem">Preview</h3><p class="muted">Everything in this app.</p>
        <ul><li>Unlimited interviews</li><li>AI-style questions from a role and job description, or your own</li><li>Practice and Mock modes</li><li>Summary, transcript and recording downloads</li></ul><div style="margin-top:1rem"><a class="btn btn-primary" href="#/app">Start practicing</a></div></div>
      <div class="card plan"><span class="badge petrol">Planned</span><h3 style="margin-top:.6rem">Pro</h3><p class="muted">Pricing to be announced.</p>
        <ul><li>Follow-up questions that respond to your answers</li><li>More natural interviewer voices</li><li>Sync sessions across devices</li><li>Progress tracking over time</li></ul><div style="margin-top:1rem"><button class="btn btn-ghost" disabled>Not available yet</button></div></div></div></div></section>`;
})(window.Caddie);
