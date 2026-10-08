# Caddie

Practice interviews with Caddie, a virtual interviewer, and get feedback on speech, eye contact and posture.
Everything runs in the browser. Sessions, transcripts and recordings are stored on the user's device only.

## Run it

Requires Node 18 or later.

    npm install     # also downloads two small vision models into ./models
    npm start       # http://localhost:3000

Open it in Chrome or Edge (best support for camera, microphone and speech recognition).

## Structure

- `server.js`: dependency-free static server. Serves `public/`, the MediaPipe runtime from `node_modules`, and `models/`.
- `public/js/main.js`: hash router and header/footer.
- `public/js/views-public.js`: Home, Value, About, Plans.
- `public/js/views-app.js`: Dashboard, Setup, Summary, Settings.
- `public/js/interview.js`: green room and live interview room.
- `public/js/analysis.js`: speech (Web Speech API + mic level), face and posture (MediaPipe) metrics.
- `public/js/summary.js`: scoring, action items, downloadable reports.
- `public/js/jd.js`: reads a pasted job description (responsibilities, requirements, skills, seniority, years).
- `public/js/questions.js`: picks the 3 to 4 most relevant questions; "Walk me through your resume" is always first.
- `public/js/avatar.js`: Caddie's animated face (lip-sync, blinks, gaze, nods).
- `public/js/voice.js`: Caddie's voice: browser voices with better ranking, sentence pacing and pronunciation fixes.
- `public/js/views-recruiter.js`: Recruiter Dashboard (footer link, no login yet): create roles with a job description and up to 10 questions. Uses a deep-red theme (`.theme-recruiter`).
- `public/js/presentation.js`: Practice Presenting: a green room and a room where you see only yourself.
- `public/css/colors.css`: brand palette. `public/css/app.css`: layout and components.

Login is intentionally skipped for now.

## Optional AI features (Claude)

Off by default. When turned on, Caddie sends text (never video or audio) to Anthropic's Claude to write questions and ask follow-ups.

1. Create an API key at https://platform.claude.com/settings/keys (add credits under Billing first).
2. Open Settings in Caddie, paste the key under "AI features". It is saved to `data/config.json` on this computer (git-ignored).
   Or set the `ANTHROPIC_API_KEY` environment variable before `npm start`.
3. Choose "Use Claude" when setting up an interview, and tick the follow-up box in the green room.

The model defaults to `claude-sonnet-5-5`; override with `CADDIE_MODEL`. The server listens on 127.0.0.1 only and rejects cross-origin requests.
`CADDIE_FAKE_AI=1` returns canned responses for testing without a key.

## Shareable demo

`npm run build:demo` creates a `dist/` folder (about 30 MB) that works on any static host, with no server.
Upload that folder to, for example, Netlify Drop (https://app.netlify.com/drop) to get a link anyone can open.
Each visitor's sessions, recordings and transcripts stay in their own browser. The optional AI features need the local server and are hidden on a static host.
