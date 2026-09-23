import { CONFIG } from '../config.js';
import { events } from './events.js';
import { LEVELS } from '../levels/levels.js';
import { Level } from '../world/Level.js';
import { idealMirrorAngle } from '../physics/aimAssist.js';
import { angleDiff } from '../physics/geometry.js';

// Game rules and flow. Reads input, steers mirrors, decides when puffs wake and levels end.
// It never touches particles or sound directly; it emits events (see core/events.js).
//
// States: title -> playing -> clear -> (next level) playing ... -> done
export class Game {
  constructor({ stage, input, beam, cursor }) {
    this.stage = stage;
    this.input = input;
    this.beam = beam;
    this.cursor = cursor;
    this.state = 'title';
    this.level = null;
    this.levelIndex = 0;
    this.stateTime = 0;
    this.revealLen = 0;

    this.hovered = null;
    this.grabbed = null;
    this.grab = null; // {startAngle, startTwist, startPointer, lastPointer, accum}
    this.wasPinching = false;
    this.tickAccum = 0;

    this.prevBounceIds = [];
    this.bounceCooldown = [];
    this.prevLit = new Set();
    this.chargeSteps = new Map();
  }

  start(index = 0) {
    this.loadLevel(index);
  }

  loadLevel(index) {
    if (this.level) this.level.dispose();
    this.levelIndex = index;
    this.level = new Level(LEVELS[index], index, this.stage.scene, this.stage.camera);
    this.level.appear();
    this.setState('playing');
    this.revealLen = 0;
    this.hovered = this.grabbed = this.grab = null;
    this.prevBounceIds = [];
    this.prevLit.clear();
    this.chargeSteps.clear();
    events.emit('levelStart', { level: this.level, index, total: LEVELS.length });
  }

  nextLevel() {
    if (this.levelIndex + 1 < LEVELS.length) this.loadLevel(this.levelIndex + 1);
    else {
      this.setState('done');
      events.emit('gameComplete', {});
    }
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  update(dt, t, realDt) {
    this.stateTime += realDt;
    const pointer = this.input.update(performance.now());
    const world = this.input.world;

    if (!this.level) {
      this.cursor.set(world ? 'idle' : 'hidden');
      this.cursor.update(dt, t, world, pointer.pinchAmount);
      return;
    }

    if (this.state === 'playing') this.handlePointer(pointer, world);

    // Trace with current (visual) mirror angles, then compute aim assist from that trace.
    const result = this.level.traceBeam();
    const assist = this.state === 'playing' ? this.computeAssist(result) : new Map();
    this.level.update(dt, t, assist);

    this.updateTargets(result, dt);
    this.emitBounceEvents(result, dt);

    // Beam grows out of the emitter at level start.
    const revealStart = 0.5;
    if (this.stateTime > revealStart) this.revealLen += dt * 28;
    this.beam.setReveal(this.state === 'playing' || this.state === 'clear' ? this.revealLen : 0);
    this.beam.update(result, t);

    this.cursor.set(!world ? 'hidden' : this.grabbed ? 'grab' : this.hovered ? 'hover' : 'idle');
    this.cursor.update(dt, t, world, pointer.pinchAmount);

    if (this.state === 'playing' && this.level.allAwake && this.stateTime > 0.5) {
      this.release();
      this.setState('clear');
      events.emit('levelClear', { level: this.level, index: this.levelIndex, total: LEVELS.length });
    }
    if (this.state === 'clear' && this.stateTime > CONFIG.fx.levelClearDelay) {
      this.level.disappear();
      this.setState('leaving');
    }
    if (this.state === 'leaving' && this.stateTime > 0.45) this.nextLevel();
  }

  // --- Input -> mirrors ------------------------------------------------------

  handlePointer(p, world) {
    const pinchStart = p.pinching && !this.wasPinching;
    const pinchEnd = !p.pinching && this.wasPinching;
    this.wasPinching = p.pinching;

    if (!this.grabbed) {
      const near = world ? this.level.mirrorNear(world) : null;
      if (near !== this.hovered) {
        if (this.hovered) this.hovered.hovered = false;
        this.hovered = near;
        if (near) near.hovered = true;
        events.emit('hover', { mirror: near });
      }
      if (pinchStart && this.hovered) this.startGrab(this.hovered, p, world);
      return;
    }

    if (pinchEnd || !p.present) {
      this.release();
      return;
    }
    this.steerGrabbed(p, world);
  }

  startGrab(mirror, p, world) {
    this.grabbed = mirror;
    mirror.grabbed = true;
    mirror.boing(-4);
    const pa = world ? Math.atan2(world.z - mirror.z, world.x - mirror.x) : 0;
    this.grab = { startAngle: mirror.inputAngle, startTwist: p.twist, lastPointer: pa, accum: 0 };
    this.tickAccum = 0;
    events.emit('grab', { mirror });
  }

  steerGrabbed(p, world) {
    const m = this.grabbed, g = this.grab;
    const useTwist = p.twist !== null && CONFIG.input.handRotateMode === 'twist';
    let angle;
    if (useTwist) {
      angle = g.startAngle + (p.twist - g.startTwist) * CONFIG.input.rotateSensitivity;
    } else {
      // Dial: follow the pointer around the pivot. Ignore the pointer when it's right on the pivot.
      if (!world || Math.hypot(world.x - m.x, world.z - m.z) < 0.35) return;
      const pa = Math.atan2(world.z - m.z, world.x - m.x);
      g.accum += angleDiff(pa, g.lastPointer);
      g.lastPointer = pa;
      angle = g.startAngle + g.accum;
    }
    const delta = angle - m.inputAngle;
    m.steer(angle);
    this.tickAccum += delta;
    const step = (CONFIG.mirror.tickEveryDeg * Math.PI) / 180;
    while (Math.abs(this.tickAccum) >= step) {
      const dir = Math.sign(this.tickAccum);
      this.tickAccum -= dir * step;
      events.emit('rotateTick', { mirror: m, dir });
    }
  }

  release() {
    const m = this.grabbed;
    if (!m) return;
    // Keep whatever angle aim assist settled on, so letting go never nudges the beam off target.
    m.steer(m.angle);
    m.grabbed = false;
    m.boing(3);
    this.grabbed = this.grab = null;
    events.emit('release', { mirror: m });
  }

  /** Map mirrorId -> assisted angle for the grabbed mirror, when it is close to a useful shot. */
  computeAssist(result) {
    const out = new Map();
    const m = this.grabbed;
    const strength = CONFIG.mirror.snapAssistStrength;
    if (!m || strength <= 0) return out;
    const bounce = result.bounces.find((b) => b.mirrorId === m.id);
    if (!bounce) return out;
    // Useful shots: any puff, or the pivot of another mirror (makes chaining much friendlier).
    const aims = [
      ...this.level.targets.map((tg) => tg.worldPos()),
      ...this.level.mirrors.filter((o) => o !== m).map((o) => ({ x: o.x, z: o.z })),
    ];
    const windowRad = (CONFIG.mirror.snapAssistDeg * Math.PI) / 180;
    const ideal = idealMirrorAngle(bounce, { angle: m.inputAngle }, aims, windowRad);
    if (ideal === null) return out;
    const diff = ideal - m.inputAngle;
    const k = strength * (1 - Math.abs(diff) / windowRad); // pull grows as you get closer, no jump at the edge
    out.set(m.id, m.inputAngle + diff * k);
    return out;
  }

  // --- Targets & bounces ------------------------------------------------------

  updateTargets(result, dt) {
    const lit = new Set(result.targets.keys());
    // Only count light that the reveal animation has actually reached.
    for (const tg of this.level.targets) {
      const isLit = lit.has(tg.id) && this.state !== 'leaving' && this.revealedTo(result, result.targets.get(tg.id));
      tg.setLit(isLit);
      if (isLit && !this.prevLit.has(tg.id)) events.emit('targetLit', { target: tg });
      if (!isLit && this.prevLit.has(tg.id)) events.emit('targetUnlit', { target: tg });
      if (isLit) this.prevLit.add(tg.id);
      else this.prevLit.delete(tg.id);

      const step = Math.floor(tg.charge * 4);
      const prev = this.chargeSteps.get(tg.id) ?? 0;
      if (step > prev && step < 4 && isLit) events.emit('targetCharge', { target: tg, step });
      this.chargeSteps.set(tg.id, step);
      if (tg.justWoke) events.emit('targetFull', { target: tg, index: tg.index });
      if (tg.justSlept) events.emit('targetSleep', { target: tg });
    }
  }

  revealedTo(result, hit) {
    let d = 0;
    const segs = result.segments;
    for (let i = 0; i < hit.segment; i++) d += Math.hypot(segs[i].to.x - segs[i].from.x, segs[i].to.z - segs[i].from.z);
    d += Math.hypot(hit.point.x - segs[hit.segment].from.x, hit.point.z - segs[hit.segment].from.z);
    return d <= this.revealLen;
  }

  emitBounceEvents(result, dt) {
    const ids = result.bounces.map((b) => b.mirrorId);
    for (let i = 0; i < this.bounceCooldown.length; i++) this.bounceCooldown[i] -= dt;
    ids.forEach((id, i) => {
      if (this.prevBounceIds[i] === id) return;
      if ((this.bounceCooldown[i] ?? 0) > 0) return;
      const b = result.bounces[i];
      if (!this.revealedTo(result, { segment: i, point: b.point })) return; // wait for the reveal to arrive
      this.bounceCooldown[i] = 0.15;
      const mirror = this.level.mirrors.find((m) => m.id === id);
      events.emit('bounce', { point: b.point, index: i, mirror });
      this.prevBounceIds[i] = id;
    });
    this.prevBounceIds.length = ids.length;
  }

  /** Debug helper: rotate every mirror to its stored solution. */
  solve() {
    for (const m of this.level?.mirrors ?? []) if (m.solution !== null) m.steer(m.solution);
  }
}
