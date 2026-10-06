// On-device analysis of speech, face and posture. Nothing leaves the browser.
(function (C) {
  const REMOTE = {
    'face_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    'pose_landmarker_lite.task': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  };
  const FILLERS = /\b(um+|uh+|er|erm|ah|you know|basically|literally|kind of|sort of|i mean|actually)\b/gi;
  const DEG = 180 / Math.PI;

  // Vision models load once and are shared by the green room and the interview.
  let visionPromise;
  C.loadVision = function () {
    if (visionPromise) return visionPromise;
    visionPromise = (async () => {
      const mod = await import('/vendor/mediapipe/vision_bundle.mjs');
      const fileset = await mod.FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
      const make = async (Cls, file, opts) => {
        let last;
        for (const url of [`/models/${file}`, REMOTE[file]]) {
          for (const delegate of ['GPU', 'CPU']) {
            try { return await Cls.createFromOptions(fileset, { baseOptions: { modelAssetPath: url, delegate }, runningMode: 'VIDEO', ...opts }); } catch (e) { last = e; }
          }
        }
        throw last;
      };
      const face = await make(mod.FaceLandmarker, 'face_landmarker.task', { numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true });
      let pose = null;
      try { pose = await make(mod.PoseLandmarker, 'pose_landmarker_lite.task', { numPoses: 1 }); } catch { /* posture is optional */ }
      return { face, pose };
    })();
    visionPromise.catch(() => {});
    return visionPromise;
  };

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

  const blank = () => ({ text: '', typed: '', startedAt: 0, endedAt: 0, speakMs: 0, voiceBursts: 0, pauses: 0, longPauses: 0,
    frames: 0, faceF: 0, eyeF: 0, smileF: 0, poseF: 0, uprightF: 0, tiltF: 0, slouchF: 0, leanF: 0, motion: 0, motionN: 0, attempts: 0 });

  class Analyzer {
    constructor({ stream, video, hasVideo }) {
      this.stream = stream; this.video = video; this.hasVideo = hasVideo;
      this.q = []; this.cur = -1; this.answering = false; this.active = false;
      this.rms = 0; this.lastVoiceAt = 0; this.voiceOn = false; this.threshold = 0.02; this.floor = 1;
      this.volSum = 0; this.volN = 0; this.volSq = 0;
      this.live = []; this.expr = []; this.headDelta = []; this.baseline = []; this.base = null;
      this.vision = null; this.visionState = 'idle'; this.srState = SR ? 'idle' : 'unsupported';
      this.lastFace = null; this.lastPose = null; this.startedAt = 0; this.interim = '';
    }
    get quest() { return this.q[this.cur] || (this.q[this.cur] = blank()); }

    async init() {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      await this.ctx.resume().catch(() => {});
      this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 1024;
      this.buf = new Uint8Array(this.analyser.fftSize);
      this.ctx.createMediaStreamSource(this.stream).connect(this.analyser);
      this.audioTimer = setInterval(() => this.audioTick(), 100);
      if (this.hasVideo) {
        this.visionState = 'loading';
        C.loadVision().then((v) => { this.vision = v; this.visionState = 'ready'; }).catch((e) => { this.visionState = 'unavailable'; this.visionError = e; });
      } else this.visionState = 'nocamera';
    }

    // ----- audio -----
    audioTick() {
      this.analyser.getByteTimeDomainData(this.buf);
      let sum = 0;
      for (const b of this.buf) { const d = (b - 128) / 128; sum += d * d; }
      this.rms = Math.sqrt(sum / this.buf.length);
      const now = performance.now();
      if (!this.active) { // green room: learn the room's noise floor
        this.floorWin = (this.floorWin || []).concat(this.rms).slice(-30);
        this.floor = Math.min(...this.floorWin);
        this.threshold = Math.max(0.015, this.floor * 3);
      }
      const voice = this.rms > this.threshold;
      if (this.answering && !this.paused) {
        const q = this.quest;
        if (voice) {
          q.speakMs += 100; this.volSum += this.rms; this.volSq += this.rms * this.rms; this.volN++;
          if (!this.voiceOn) { // voice onset: measure the gap that just ended
            const gap = now - this.lastVoiceAt;
            if (q.voiceBursts > 0 && gap >= 1200) { q.pauses++; if (gap >= 3000) q.longPauses++; }
            q.voiceBursts++;
          }
          this.lastVoiceAt = now;
        }
      }
      this.voiceOn = voice;
    }
    quietMs() { return performance.now() - this.lastVoiceAt; }
    hasSpoken() { if (this.cur < 0) return false; const q = this.quest; return q.voiceBursts > 0 || !!q.typed; }

    // ----- speech recognition (Chrome / Edge / Safari) -----
    startSpeech() {
      if (!SR || this.rec) return;
      const rec = new SR();
      rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i], t = r[0].transcript;
          if (r.isFinal) { if (this.answering && !this.paused) this.quest.text += (this.quest.text ? ' ' : '') + t.trim(); } else interim += t;
        }
        this.interim = this.answering ? interim : '';
        if (this.onInterim) this.onInterim(this.interim);
      };
      rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { this.srState = 'blocked'; this.active = false; } };
      rec.onend = () => { if (this.active && this.srState !== 'blocked') { try { rec.start(); } catch { /* already running */ } } };
      try { rec.start(); this.rec = rec; this.srState = 'listening'; } catch { this.srState = 'unsupported'; }
    }

    // ----- vision -----
    startVision() {
      if (this.visionLoop) return;
      this.visionLoop = true; this.lastV = 0;
      const loop = () => {
        if (!this.active) { this.visionLoop = false; return; }
        const now = performance.now();
        if (this.vision && this.video && this.video.readyState >= 2 && this.video.videoWidth && now - this.lastV >= 150 && !this.paused) {
          this.lastV = now;
          try { this.visionSample(now); } catch (e) { this.visionError = e; }
        }
        this.vraf = requestAnimationFrame(loop);
      };
      this.vraf = requestAnimationFrame(loop);
    }

    visionSample(ts) {
      if (this.cur < 0) return;
      const q = this.quest, s = { t: ts };
      q.frames++;
      const fr = this.vision.face.detectForVideo(this.video, ts);
      if (fr.faceLandmarks && fr.faceLandmarks.length) {
        q.faceF++; s.face = true;
        const cat = {};
        for (const c of (fr.faceBlendshapes[0] || { categories: [] }).categories) cat[c.categoryName] = c.score;
        const g = (n) => cat[n] || 0;
        const gazeH = Math.abs((g('eyeLookOutLeft') + g('eyeLookInRight') - g('eyeLookInLeft') - g('eyeLookOutRight')) / 2);
        const gazeDown = (g('eyeLookDownLeft') + g('eyeLookDownRight')) / 2;
        const gazeUp = (g('eyeLookUpLeft') + g('eyeLookUpRight')) / 2;
        let yaw = 0, pitch = 0;
        const m = fr.facialTransformationMatrixes && fr.facialTransformationMatrixes[0];
        if (m) { const d = m.data; yaw = Math.abs(Math.atan2(d[8], d[10]) * DEG); pitch = Math.abs(Math.asin(Math.max(-1, Math.min(1, d[9]))) * DEG); }
        const eye = yaw < 22 && pitch < 22 && gazeH < 0.4 && gazeDown < 0.5 && gazeUp < 0.5;
        const smile = (g('mouthSmileLeft') + g('mouthSmileRight')) / 2;
        const brow = (g('browInnerUp') + g('browOuterUpLeft') + g('browOuterUpRight')) / 3;
        if (eye) q.eyeF++;
        if (smile > 0.35) q.smileF++;
        s.eye = eye; s.smile = smile > 0.35; s.gazeDown = gazeDown > 0.5;
        this.expr.push(smile + brow);
        if (this.lastFace) { const dm = Math.hypot(yaw - this.lastFace.yaw, pitch - this.lastFace.pitch); this.headDelta.push(dm); }
        this.lastFace = { yaw, pitch };
      } else s.face = false;

      if (this.vision.pose) {
        const pr = this.vision.pose.detectForVideo(this.video, ts + 0.5);
        const lm = pr.landmarks && pr.landmarks[0];
        if (lm && lm[11] && lm[12] && (lm[11].visibility ?? 1) > 0.5 && (lm[12].visibility ?? 1) > 0.5) {
          q.poseF++;
          const dx = Math.abs(lm[12].x - lm[11].x), dy = lm[12].y - lm[11].y;
          const tilt = Math.abs(Math.atan2(dy, dx) * DEG);
          const width = dx, midY = (lm[11].y + lm[12].y) / 2, headDrop = midY - lm[0].y;
          const cur = { width, midY, headDrop };
          if (!this.base) {
            this.baseline.push(cur);
            if (this.baseline.length >= 20) this.base = { width: median(this.baseline.map((b) => b.width)), midY: median(this.baseline.map((b) => b.midY)), headDrop: median(this.baseline.map((b) => b.headDrop)) };
          }
          const tilted = tilt > 9;
          let slouch = false, lean = false;
          if (this.base) {
            slouch = headDrop < this.base.headDrop * 0.75 || midY - this.base.midY > 0.07;
            lean = width > this.base.width * 1.25 || width < this.base.width * 0.75;
          }
          if (tilted) q.tiltF++; if (slouch) q.slouchF++; if (lean) q.leanF++;
          const upright = !tilted && !slouch && !lean;
          if (upright) q.uprightF++;
          s.upright = upright; s.posed = true;
          const pts = [lm[0], lm[11], lm[12]];
          [lm[15], lm[16]].forEach((w) => { if (w && (w.visibility ?? 0) > 0.5) pts.push(w); });
          if (this.lastPose && this.lastPose.length === pts.length) {
            let mv = 0; pts.forEach((p, i) => { mv += Math.hypot(p.x - this.lastPose[i].x, p.y - this.lastPose[i].y); });
            q.motion += mv / pts.length; q.motionN++;
          }
          this.lastPose = pts;
        }
      }
      this.live.push(s); if (this.live.length > 60) this.live.shift();
    }

    // ----- lifecycle -----
    start() {
      this.active = true; this.startedAt = performance.now(); this.lastVoiceAt = performance.now();
      if (this.stream) this.startSpeech();
      if (this.hasVideo) this.startVision();
    }
    setPaused(p) { this.paused = p; if (!p) this.lastVoiceAt = performance.now(); }
    beginAnswer(i) {
      this.cur = i; const q = this.quest; q.attempts++; if (!q.startedAt) q.startedAt = performance.now();
      this.answering = true; this.lastVoiceAt = performance.now(); this.voiceOn = false;
    }
    endAnswer() { if (this.cur >= 0) { this.quest.endedAt = performance.now(); } this.answering = false; this.interim = ''; }
    selectQuestion(i) { this.cur = i; }
    addTyped(text) { const q = this.quest; q.typed += (q.typed ? ' ' : '') + text; this.lastVoiceAt = performance.now(); }

    // Rolling window used for live cues (last ~9 seconds).
    liveCues() {
      const w = this.live.slice(-60);
      const faces = w.filter((s) => s.face);
      const eyePct = faces.length >= 8 ? pct(faces.filter((s) => s.eye).length, faces.length) : null;
      const smilePct = faces.length >= 8 ? pct(faces.filter((s) => s.smile).length, faces.length) : null;
      const posed = w.filter((s) => s.posed);
      const upPct = posed.length >= 8 ? pct(posed.filter((s) => s.upright).length, posed.length) : null;
      const q = this.cur >= 0 ? this.quest : null;
      const text = q ? `${q.text} ${q.typed}`.trim() : '';
      const words = text ? text.split(/\s+/).length : 0;
      const wpm = q && q.speakMs > 6000 && q.text ? Math.round(q.text.split(/\s+/).length / (q.speakMs / 60000)) : null;
      const fillers = (text.match(FILLERS) || []).length;
      const avgRms = this.volN ? this.volSum / this.volN : null;
      return { eyePct, smilePct, upPct, wpm, fillers, words, avgRms, faceSeen: w.length ? faces.length / w.length > 0.5 : null, gazeDown: faces.length >= 8 && faces.filter((s) => s.gazeDown).length / faces.length > 0.5 };
    }

    stop() {
      this.active = false; this.answering = false;
      clearInterval(this.audioTimer); cancelAnimationFrame(this.vraf);
      try { this.rec && this.rec.stop(); } catch { /* ignore */ }
      this.rec = null;
      if (this.ctx) this.ctx.close().catch(() => {});
    }

    // Final metrics for the summary.
    finish(questions, durationSec) {
      const per = [];
      let words = 0, speakMs = 0, fillerTotal = 0, pauses = 0, longPauses = 0;
      const byWord = {};
      const T = { frames: 0, faceF: 0, eyeF: 0, smileF: 0, poseF: 0, uprightF: 0, tiltF: 0, slouchF: 0, leanF: 0, motion: 0, motionN: 0 };
      questions.forEach((qq, i) => {
        const q = this.q[i];
        if (!q) { per.push({ index: i, text: qq.text, asked: false }); return; }
        const full = `${q.text} ${q.typed}`.trim();
        const w = full ? full.split(/\s+/).length : 0;
        const f = full.match(FILLERS) || [];
        f.forEach((x) => { const k = x.toLowerCase(); byWord[k] = (byWord[k] || 0) + 1; });
        words += w; speakMs += q.speakMs; fillerTotal += f.length; pauses += q.pauses; longPauses += q.longPauses;
        Object.keys(T).forEach((k) => { T[k] += q[k]; });
        const spoken = q.text ? q.text.split(/\s+/).length : 0;
        per.push({
          index: i, text: qq.text, asked: true, answer: q.text, typed: q.typed, words: w, fillers: f.length,
          seconds: q.startedAt ? Math.round((q.endedAt - q.startedAt) / 1000) : 0, speakSec: Math.round(q.speakMs / 1000),
          wpm: q.speakMs > 5000 && spoken ? Math.round(spoken / (q.speakMs / 60000)) : null, pauses: q.pauses, longPauses: q.longPauses,
          eyePct: pct(q.eyeF, q.faceF), uprightPct: pct(q.uprightF, q.poseF),
        });
      });
      const spokenWords = this.q.reduce((n, q) => n + (q && q.text ? q.text.split(/\s+/).length : 0), 0);
      const avgDelta = this.headDelta.length ? this.headDelta.reduce((a, b) => a + b, 0) / this.headDelta.length : null;
      const exprMean = this.expr.length ? this.expr.reduce((a, b) => a + b, 0) / this.expr.length : 0;
      const exprStd = this.expr.length ? Math.sqrt(this.expr.reduce((a, b) => a + (b - exprMean) ** 2, 0) / this.expr.length) : null;
      const avgRms = this.volN ? this.volSum / this.volN : null;
      const rmsStd = this.volN ? Math.sqrt(Math.max(0, this.volSq / this.volN - avgRms * avgRms)) : null;
      return {
        duration: Math.round(durationSec),
        capabilities: { speech: this.srState !== 'unsupported' && this.srState !== 'blocked', vision: this.visionState === 'ready', camera: this.hasVideo, pose: !!(this.vision && this.vision.pose) },
        speech: { words, spokenWords, speakSec: Math.round(speakMs / 1000), wpm: speakMs > 8000 && spokenWords ? Math.round(spokenWords / (speakMs / 60000)) : null,
          fillers: fillerTotal, fillerWords: byWord, fillersPer100: words ? +(fillerTotal / words * 100).toFixed(1) : null, pauses, longPauses,
          avgRms, volVariation: avgRms ? rmsStd / avgRms : null },
        face: { frames: T.frames, facePct: pct(T.faceF, T.frames), eyeContactPct: pct(T.eyeF, T.faceF), smilePct: pct(T.smileF, T.faceF), expressiveness: exprStd, headMovement: avgDelta },
        body: { poseFrames: T.poseF, uprightPct: pct(T.uprightF, T.poseF), tiltPct: pct(T.tiltF, T.poseF), slouchPct: pct(T.slouchF, T.poseF), leanPct: pct(T.leanF, T.poseF), fidget: T.motionN ? T.motion / T.motionN : null },
        perQuestion: per,
      };
    }
  }

  C.Analyzer = Analyzer;
  C.FILLERS = FILLERS;
})(window.Caddie);
