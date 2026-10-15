// Downloads the two on-device vision models used for eye-contact and posture analysis.
// Failure is not fatal: the app falls back to loading them from Google's model host.
const fs = require('node:fs');
const path = require('node:path');

const BASE = 'https://storage.googleapis.com/mediapipe-models';
const MODELS = {
  'face_landmarker.task': `${BASE}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
  'pose_landmarker_lite.task': `${BASE}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
};
const dir = path.join(__dirname, '..', 'models');

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, url] of Object.entries(MODELS)) {
    const dest = path.join(dir, name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1e6) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      console.log(`Downloaded ${name}`);
    } catch (e) {
      console.warn(`Could not download ${name} (${e.message}). The app will fetch it from the model host instead.`);
    }
  }
})();
