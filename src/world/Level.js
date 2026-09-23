import { CONFIG } from '../config.js';
import { Emitter } from './Emitter.js';
import { Mirror } from './Mirror.js';
import { Target } from './Target.js';
import { Blocker } from './Blocker.js';
import { trace } from '../physics/rayTracer.js';

// Builds and owns the entities for one level. Knows nothing about input, FX or sound.
export class Level {
  constructor(data, index, scene, camera) {
    this.data = data;
    this.index = index;
    this.scene = scene;
    this.emitter = new Emitter(data.emitter);
    this.mirrors = data.mirrors.map((m, i) => new Mirror(m, `m${i}`));
    this.targets = data.targets.map((t, i) => new Target(t, `t${i}`, i, camera));
    this.blockers = (data.blockers ?? []).map((b, i) => new Blocker(b, `b${i}`));
    this.entities = [this.emitter, ...this.blockers, ...this.mirrors, ...this.targets];
    for (const e of this.entities) scene.add(e.group);
    this.result = null;
  }

  /** Staggered pop-in so the level assembles itself with a little rhythm. */
  appear() {
    this.entities.forEach((e, i) => e.appear(0.15 + i * 0.07));
  }

  disappear() {
    this.entities.forEach((e) => e.disappear());
  }

  traceBeam() {
    const scene = {
      mirrors: this.mirrors.map((m) => m.toTrace()),
      targets: this.targets.map((t) => t.toTrace()),
      blockers: this.blockers.map((b) => b.toTrace()),
      bounds: { w: CONFIG.field.width, h: CONFIG.field.height },
    };
    this.result = trace(this.emitter.toTrace(), scene, {
      maxBounces: CONFIG.beam.maxBounces, maxLength: CONFIG.beam.maxLength,
    });
    return this.result;
  }

  /** Nearest rotatable mirror within grab radius of a world point. */
  mirrorNear(p, radius = CONFIG.input.grabRadius) {
    let best = null, bestD = radius;
    for (const m of this.mirrors) {
      if (!m.rotatable) continue;
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  get awakeCount() {
    return this.targets.filter((t) => t.awake).length;
  }

  get allAwake() {
    return this.targets.every((t) => t.awake);
  }

  update(dt, t, assist = new Map()) {
    for (const e of this.entities) {
      if (e instanceof Mirror) e.update(dt, t, assist.get(e.id) ?? null);
      else e.update(dt, t);
    }
  }

  dispose() {
    for (const e of this.entities) e.dispose();
  }
}
