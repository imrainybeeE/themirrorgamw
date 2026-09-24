// Records a beat-synced run through every level, frame by frame, with the game's own soundtrack.
//   node tools/video/capture.mjs            (serve the repo on :8765 first; see tools/video/README.md)
// Outputs to video-out/: frames/*.png, sfx.wav, timeline.json
//
// The game runs in ?capture mode: time only advances when we call capture.step(), so every frame is
// exact no matter how slow the machine renders. An "autopilot" plays each level on a musical grid.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EDIT = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/video/edit.json'), 'utf8'));
const OUT = path.join(ROOT, 'video-out');
const FRAMES = path.join(OUT, 'frames');
const URL_BASE = process.env.GAME_URL || 'http://localhost:8765/';
const VENDOR = process.env.VENDOR_DIR; // optional node_modules dir to serve CDN libs from (offline machines)

const BEAT = 60 / EDIT.bpm, BAR = BEAT * EDIT.beatsPerBar, EIGHTH = BEAT / 2;
const TOTAL = BAR * EDIT.bars;
const DT = 1 / EDIT.fps;
const NFRAMES = Math.min(Math.round(TOTAL * EDIT.fps), +(process.env.MAX_FRAMES || Infinity)); // MAX_FRAMES for quick trial runs

fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: EDIT.width, height: EDIT.height }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
if (VENDOR) {
  await page.route('https://cdn.jsdelivr.net/npm/**', (route) => {
    const m = new URL(route.request().url()).pathname.match(/^\/npm\/((?:@[^/]+\/)?[^@/]+)@[^/]+\/(.*)$/);
    route.fulfill({ body: fs.readFileSync(path.join(VENDOR, m[1], m[2])), contentType: 'application/javascript' });
  });
}
await page.goto(URL_BASE + '?capture');
await page.waitForFunction(() => window.prismPuff?.capture);
await page.evaluate(async () => { await document.fonts.ready; });
await page.waitForTimeout(1500); // let textures load
await page.addStyleTag({ content: '#hint { z-index: 50; }' }); // captions above the title card blur

// Capture tweaks: snappier charge/reveal so a level fits in one bar.
await page.evaluate(([cfg, seconds]) => {
  const C = window.prismPuff.CONFIG;
  for (const [k, v] of Object.entries(cfg)) {
    const keys = k.split('.');
    keys.slice(0, -1).reduce((o, key) => o[key], C)[keys.at(-1)] = v;
  }
  window.prismPuff.capture.startOffline(seconds);
}, [EDIT.captureConfig, TOTAL + 1.5]);

// Page-side helpers: world -> pointer coords (undoing the CRT warp), driving CSS animations on the virtual clock.
await page.evaluate(() => {
  const P = window.prismPuff;
  const W = {};
  W.worldToPointer = (x, z) => {
    const v = P.stage.camera.position.clone().set(x, P.CONFIG.mirror.beamHeight, z).project(P.stage.camera);
    const tx = (v.x + 1) / 2, ty = (1 - v.y) / 2; // screen uv the scene point is drawn at before warping
    // The pixel pass shows scene uv warp(s) at screen s; solve warp(s) = t by fixed-point iteration.
    let sx = tx, sy = ty;
    if (P.stage.pixel.enabled) {
      const k = P.stage.pixel.uniforms.curvature.value;
      for (let i = 0; i < 8; i++) {
        const x = sx * 2 - 1, y = (1 - sy) * 2 - 1;
        const wx = (x * (1 + y * y * k)) * 0.5 + 0.5, wy = 1 - ((y * (1 + x * x * k)) * 0.5 + 0.5);
        sx += tx - wx; sy += ty - wy;
      }
    }
    return { sx, sy };
  };
  W.setPointer = (sx, sy, pinching) => {
    const m = P.input.mouse;
    Object.assign(m.pointer, { present: true, sx, sy, pinching, pinchAmount: pinching ? 1 : 0 });
    m.lastMove = performance.now();
  };
  const starts = new WeakMap();
  W.syncAnimations = (clock) => {
    for (const a of document.getAnimations()) {
      if (!starts.has(a)) starts.set(a, clock);
      a.pause();
      a.currentTime = (clock - starts.get(a)) * 1000;
    }
  };
  W.caption = '';
  W.hint = () => {
    // Captions replace the game's hint bubble; re-applied every frame so game logic can't hide them.
    const h = document.getElementById('hint');
    if (h.textContent !== W.caption) h.textContent = W.caption;
    h.classList.toggle('show', !!W.caption);
  };
  window.__cap = W;
});

// ---------------------------------------------------------------- autopilot plan
// For each level: which mirrors to turn and when, all on the eighth-note grid.
const levels = await page.evaluate(() => {
  return import('./src/levels/levels.js').then(({ LEVELS }) => LEVELS.map((l) => l.mirrors.map((m, i) => ({ i, ...m }))));
});

const plan = []; // {t0, t1, kind, ...}
const tutorAt = [];
EDIT.tutor.forEach((text, bar) => tutorAt.push({ t: bar * BAR + 0.05, text }));
levels.forEach((mirrors, li) => {
  const t0 = (li + 1) * BAR;
  const wake = t0 + 3 * BEAT; // puffs should wake on beat 3
  const charge = EDIT.captureConfig['target.chargeTime'];
  const lastEnd = wake - charge + 0.02; // measured: light lands ~at release; nudged so the wake hits the beat
  const turn = mirrors.filter((m) => m.rotatable !== false && m.solution != null);
  turn.forEach((m, k) => {
    const end = lastEnd - EIGHTH * (turn.length - 1 - k);
    plan.push({ kind: 'turn', level: li, mirror: m.i, t0: end - 0.26, t1: end, from: end - 0.26 - 0.16 });
  });
  plan.push({ kind: 'start', level: li, t: t0 });
  plan.push({ kind: 'leave', level: li, t: t0 + BAR - 0.45 }); // Game advances 0.45 s after 'leaving'
});

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lineDiff = (a, b) => { let d = (a - b) % Math.PI; if (d > Math.PI / 2) d -= Math.PI; if (d <= -Math.PI / 2) d += Math.PI; return d; };

const timeline = { bpm: EDIT.bpm, duration: TOTAL, tutor: tutorAt, events: [] };
const turnState = new Map(); // plan item -> {startAngle, delta}
let cursor = { sx: 0.5, sy: 0.62 };
let started = new Set(), left = new Set();
let lastBeat = -1;

for (let f = 0; f < NFRAMES; f++) {
  const t = f * DT;

  // Level flow on the bar grid.
  for (const p of plan) {
    if (p.kind === 'start' && t >= p.t && !started.has(p.level)) {
      started.add(p.level);
      await page.evaluate((li) => {
        const P = window.prismPuff;
        if (li === 0) P.begin(false); else P.game.loadLevel(li);
      }, p.level);
      timeline.events.push({ t, kind: 'levelStart', level: p.level + 1 });
    }
    if (p.kind === 'leave' && t >= p.t && !left.has(p.level)) {
      left.add(p.level);
      const ok = await page.evaluate(() => {
        const g = window.prismPuff.game;
        const awake = g.level.allAwake;
        if (g.levelIndex < 7) { g.level.disappear(); g.setState('leaving'); }
        return awake;
      });
      if (!ok) console.warn(`level ${p.level + 1}: not all puffs awake at bar end`);
      timeline.events.push({ t, kind: 'levelLeave', level: p.level + 1, solved: ok });
    }
  }

  // Autopilot pointer.
  const active = plan.find((p) => p.kind === 'turn' && t >= p.from && t <= p.t1 + 0.05);
  let pinching = false;
  if (active) {
    const info = await page.evaluate((i) => {
      const m = window.prismPuff.game.level.mirrors[i];
      return { x: m.x, z: m.z, a: m.inputAngle, s: m.solution };
    }, active.mirror);
    if (!turnState.has(active)) turnState.set(active, { a0: info.a, d: lineDiff(info.s, info.a), ang: info.a });
    const st = turnState.get(active);
    const R = 1.0;
    let ang;
    if (t < active.t0) {
      // Glide to the end of the mirror.
      const k = ease(Math.min(1, (t - active.from) / (active.t0 - active.from)));
      const target = await page.evaluate(([x, z]) => window.__cap.worldToPointer(x, z), [info.x + Math.cos(st.a0) * R, info.z + Math.sin(st.a0) * R]);
      cursor = { sx: cursor.sx + (target.sx - cursor.sx) * k, sy: cursor.sy + (target.sy - cursor.sy) * k };
    } else {
      // Drag around the pivot with a small overshoot, so aim assist visibly snaps it home.
      const k = Math.min(1, (t - active.t0) / (active.t1 - active.t0));
      const over = Math.sin(k * Math.PI) * 0.07 * Math.sign(st.d || 1);
      // Closed loop: move the pointer by however far the mirror is from where it should be this frame,
      // which cancels small pointer-mapping errors (zoom punches, CRT warp) and ends exactly on the solution.
      const want = st.a0 + st.d * ease(k) + over;
      st.ang += want - info.a;
      ang = st.ang;
      pinching = t <= active.t1;
      cursor = await page.evaluate(([x, z]) => window.__cap.worldToPointer(x, z), [info.x + Math.cos(ang) * R, info.z + Math.sin(ang) * R]);
    }
  }
  await page.evaluate(([sx, sy, p]) => window.__cap.setPointer(sx, sy, p), [cursor.sx, cursor.sy, pinching]);

  if (process.env.DEBUG_TURNS) {
    for (const p of plan) if (p.kind === 'turn' && !p.logged && t > p.t1 + 0.2) {
      p.logged = true;
      console.log('turn', p.level + 1, p.mirror, JSON.stringify(await page.evaluate((i) => {
        const g = window.prismPuff.game, m = g.level.mirrors[i];
        return { idx: g.levelIndex, input: +m.inputAngle.toFixed(3), angle: +m.angle.toFixed(3), sol: m.solution, charge: g.level.targets.map((t) => +t.charge.toFixed(2)) };
      }, p.mirror)));
    }
  }
  // Beat punches: big on downbeats, small on other beats.
  const beat = Math.floor(t / BEAT + 1e-6);
  if (beat !== lastBeat) {
    lastBeat = beat;
    const down = beat % EDIT.beatsPerBar === 0;
    await page.evaluate((a) => window.prismPuff.capture.punch(a), down ? 0.45 : 0.12);
  }

  // On-screen captions follow the tutor lines.
  const line = [...tutorAt].reverse().find((l) => t >= l.t);
  await page.evaluate(([dt, clock, text]) => {
    window.__cap.caption = text;
    window.prismPuff.capture.step(dt);
    window.__cap.hint();
    window.__cap.syncAnimations(clock);
  }, [DT, t + DT, line ? line.text : '']);
  await page.screenshot({ path: path.join(FRAMES, String(f).padStart(5, '0') + '.png') });
  if (f % 60 === 0) console.log(`frame ${f}/${NFRAMES}  t=${t.toFixed(2)}s`);
}

const wavB64 = await page.evaluate(() => window.prismPuff.capture.finishOffline());
fs.writeFileSync(path.join(OUT, 'sfx.wav'), Buffer.from(wavB64, 'base64'));
timeline.voice = await page.evaluate(() => window.prismPuff.capture.voiceLog());
timeline.finalAwake = await page.evaluate(() => window.prismPuff.game.level.allAwake);
fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(timeline, null, 2));
console.log('done', { frames: NFRAMES, finalAwake: timeline.finalAwake });
await browser.close();
