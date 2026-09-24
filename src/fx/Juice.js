import { CONFIG, PALETTE } from '../config.js';
import { events } from '../core/events.js';
import { Spring } from './Tween.js';

// All the "feel good" reactions in one place. Gameplay emits events; this file decides
// what they look and sound like. Want more satisfaction? Add a listener here.
const PASTELS = [PALETTE.pink, PALETTE.mint, PALETTE.sky, PALETTE.lavender, PALETTE.butter, PALETTE.hotPink];

export class Juice {
  constructor({ stage, particles, sfx, voice, loop, game }) {
    Object.assign(this, { stage, particles, sfx, voice, loop, game });
    this.litOnce = new Set(); // puffs that already mumbled this level
    this.zoom = new Spring(1, 60, 9);
    this.sparkleTimer = 0;
    const y = CONFIG.mirror.beamHeight;

    events.on('hover', ({ mirror }) => mirror && this.sfx.hover());
    events.on('grab', () => this.sfx.grab());
    events.on('release', () => this.sfx.release());
    events.on('rotateTick', ({ dir }) => this.sfx.tick(dir));

    events.on('bounce', ({ point, index, mirror }) => {
      this.sfx.bounce(index);
      mirror?.boing(1.5);
      this.particles.emit({
        x: point.x, y, z: point.z, count: 10, speed: [1, 3], size: [0.08, 0.18], life: [0.3, 0.7],
        colors: [PALETTE.beam, '#ffffff'], hdr: 1.6,
      });
    });

    events.on('targetLit', ({ target }) => {
      target.boing(2);
      this.particles.emit({ x: target.x, y, z: target.z, count: 6, speed: [0.5, 1.5], size: [0.1, 0.2], life: [0.4, 0.8], colors: [PALETTE.beam], hdr: 1.4 });
    });

    events.on('targetCharge', ({ target, step }) => {
      this.sfx.chargeStep(target.index, step);
      target.boing(1 + step * 0.5);
    });

    events.on('targetFull', ({ target, index }) => {
      this.sfx.wake(index);
      target.boing(6);
      this.loop.hitstop(40);
      this.particles.emit({
        x: target.x, y: y + 0.3, z: target.z, count: 26, speed: [2, 5], up: 1.5, size: [0.15, 0.3], life: [0.6, 1.1],
        colors: PASTELS, star: true, gravity: 4, drag: 2.5,
      });
      this.particles.emit({ x: target.x, y: 0.05, z: target.z, count: 18, spread: 'ring', speed: [3, 4], size: [0.12, 0.2], life: [0.3, 0.5], colors: ['#ffffff'], hdr: 1.3, drag: 5 });
    });

    events.on('targetSleep', ({ target }) => {
      this.sfx.sleep();
      target.boing(-2);
    });

    events.on('levelStart', ({ level }) => {
      level.entities.forEach((e, i) => this.sfx.appear(i, 0.15 + i * 0.07));
      this.litOnce.clear();
    });
    events.on('levelStart', ({ level, index }) => this.voice.say('levelStart', { n: index + 1, name: level.data.name }));
    events.on('targetLit', ({ target }) => {
      if (target.awake || this.litOnce.has(target.id)) return;
      this.litOnce.add(target.id);
      this.voice.say('puffLit');
    });
    events.on('targetFull', () => this.voice.say('puffWake'));
    events.on('targetSleep', () => this.voice.say('puffSleep'));
    events.on('levelClear', () => this.voice.say('levelClear'));
    events.on('gameComplete', () => this.voice.say('gameComplete'));

    events.on('levelClear', ({ level }) => {
      this.loop.hitstop(CONFIG.fx.hitstopMs);
      this.sfx.levelClear();
      this.zoom.kick(0.9); // gentle "breath in"
      for (const tg of level.targets) tg.boing(8);
      for (const m of level.mirrors) m.boing(4);
      const n = CONFIG.fx.confettiCount;
      for (let i = 0; i < 6; i++) {
        this.particles.emit({
          x: (Math.random() - 0.5) * CONFIG.field.width * 0.8, y: 0.5, z: (Math.random() - 0.5) * CONFIG.field.height * 0.6,
          count: Math.round(n / 6), speed: [3, 7], up: 5, size: [0.18, 0.35], life: [1.2, 2.0],
          colors: PASTELS, star: true, gravity: 7, drag: 1.2,
        });
      }
    });
  }

  update(dt) {
    this.stage.setZoom(this.zoom.update(dt));

    // Constant soft sparkle at every bounce point so the light feels alive.
    this.sparkleTimer -= dt;
    const res = this.game.level?.result;
    if (this.sparkleTimer <= 0 && res && this.game.state !== 'leaving') {
      this.sparkleTimer = CONFIG.fx.sparkleEvery;
      const y = CONFIG.mirror.beamHeight;
      for (const b of res.bounces) {
        if (!this.game.revealedTo(res, { segment: b.index, point: b.point })) break;
        this.particles.emit({
          x: b.point.x, y, z: b.point.z, count: CONFIG.fx.reflectSparkles, speed: [0.3, 1.2], up: 0.6,
          size: [0.05, 0.12], life: [0.4, 0.9], colors: [PALETTE.beam, '#ffffff'], hdr: 1.5, drag: 1,
        });
      }
      const end = res.end;
      if ((end.type === 'blocker' || end.type === 'edge') && this.game.revealLen > this.game.beam.totalLength) {
        this.particles.emit({ x: end.point.x, y, z: end.point.z, count: 1, speed: [0.2, 0.8], size: [0.08, 0.15], life: [0.3, 0.6], colors: [PALETTE.beam], hdr: 1.2 });
      }
    }
  }
}
