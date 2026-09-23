import { CONFIG } from '../config.js';

// Fully synthesized sounds (no files): soft bell chimes on a pentatonic scale through a dreamy echo.
// Every sound is one method, so swapping in samples later is a local change.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  /** Must be called from a user gesture (click / key) because of browser autoplay rules. */
  unlock() {
    if (this.ctx) { this.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = (this.ctx = new Ctx());
    this.master = ctx.createGain();
    this.master.gain.value = CONFIG.audio.master;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    // Feedback echo for a cozy, spacious feel.
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.23;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    this.echoIn = ctx.createGain();
    this.echoIn.gain.value = 0.4;
    this.echoIn.connect(this.echo).connect(lp).connect(fb).connect(this.echo);
    lp.connect(this.master);
  }

  get ready() {
    return !!this.ctx && !this.muted;
  }

  /** A bell-like tone: sine + soft overtone with fast attack and long exponential tail. */
  bell(freq, { vol = 0.3, decay = 1.2, when = 0, type = 'sine', overtone = 2.0, echo = true } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    g.connect(this.master);
    if (echo) g.connect(this.echoIn);

    const o1 = ctx.createOscillator();
    o1.type = type;
    o1.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * overtone;
    o2.detune.value = 4;
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o1.connect(g);
    o2.connect(g2).connect(g);
    o1.start(t); o2.start(t);
    o1.stop(t + decay + 0.05); o2.stop(t + decay + 0.05);
  }

  /** Pitch sweep "bloop" for grabs and pops. */
  sweep(f0, f1, { vol = 0.2, dur = 0.12, when = 0, type = 'sine' } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  note(i) {
    const s = CONFIG.audio.scale;
    const octave = Math.floor(i / s.length);
    return s[((i % s.length) + s.length) % s.length] * Math.pow(2, octave);
  }

  // --- Game sounds -------------------------------------------------------
  grab() { this.sweep(420, 760, { vol: CONFIG.audio.ui }); }
  release() { this.sweep(700, 380, { vol: CONFIG.audio.ui * 0.8 }); }
  hover() { this.bell(this.note(7), { vol: 0.06, decay: 0.15, echo: false }); }
  tick(dir) { this.bell(dir > 0 ? 2400 : 2100, { vol: 0.04, decay: 0.05, echo: false, type: 'triangle', overtone: 1.5 }); }
  bounce(index) { this.bell(this.note(index + 2), { vol: CONFIG.audio.chime, decay: 1.4 }); }
  chargeStep(targetIndex, step) { this.bell(this.note(targetIndex * 2 + step + 3), { vol: CONFIG.audio.charge, decay: 0.5 }); }
  wake(index) {
    const base = index * 2 + 5;
    [0, 2, 4].forEach((k, j) => this.bell(this.note(base + k), { vol: CONFIG.audio.chime * 0.8, decay: 1.6, when: j * 0.06 }));
    this.sweep(600, 1400, { vol: 0.12, dur: 0.18 });
  }
  sleep() {
    this.bell(this.note(4), { vol: 0.12, decay: 0.5 });
    this.bell(this.note(2), { vol: 0.12, decay: 0.7, when: 0.12 });
  }
  levelClear() {
    [0, 2, 4, 5, 7, 9, 10].forEach((k, j) => this.bell(this.note(k + 3), { vol: CONFIG.audio.chime, decay: 2.0, when: j * 0.09 }));
    [0, 2, 4].forEach((k) => this.bell(this.note(k) / 2, { vol: 0.15, decay: 2.5, when: 0.7, type: 'triangle' }));
  }
  appear(i) { this.sweep(300 + i * 60, 900 + i * 90, { vol: 0.06, dur: 0.1 }); }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}
