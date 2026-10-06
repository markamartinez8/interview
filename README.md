# Caddie

Practice interviews with Andy, a virtual interviewer, and get feedback on speech, eye contact and posture.
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
- `public/js/questions.js`: question generation without a paid AI.
- `public/js/avatar.js`: Andy's animated face and the single browser voice.
- `public/css/colors.css`: brand palette. `public/css/app.css`: layout and components.

Login is intentionally skipped for now.
