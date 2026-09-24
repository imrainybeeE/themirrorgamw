import { CONFIG } from '../config.js';
import { LinePicker } from './lines.js';

// Text-to-speech voices using the browser's built-in speechSynthesis (no downloads, works offline).
// Two characters: a cozy narrator and high-pitched puffs. The narrator has priority.
// In capture mode nothing is spoken; lines are logged with timestamps for the video pipeline.
export class Voice {
  constructor({ clock = () => performance.now() / 1000, rand } = {}) {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.picker = new LinePicker(rand);
    this.clock = clock;
    this.muted = false;
    this.capture = false;
    this.log = [];
    this.voices = [];
    this.narratorBusyUntil = 0;
    this.lastPuffAt = -Infinity;
    const load = () => (this.voices = this.synth?.getVoices() ?? []);
    load();
    this.synth?.addEventListener?.('voiceschanged', load);
  }

  get enabled() {
    return CONFIG.voice.enabled && !this.muted;
  }

  /** kind is a key of LINES (lines.js). */
  say(kind, vars) {
    if (!this.enabled) return;
    const line = this.picker.pick(kind, vars);
    if (!line) return;
    const now = this.clock();
    const cfg = CONFIG.voice;
    if (line.who === 'puff') {
      // Puffs don't talk over the narrator or each other.
      if (now < this.narratorBusyUntil || now - this.lastPuffAt < cfg.puffCooldown) return;
      this.lastPuffAt = now;
    } else {
      this.narratorBusyUntil = now + 0.08 * line.text.length + 0.4; // rough speaking time
    }

    if (this.capture) {
      this.log.push({ t: +now.toFixed(3), who: line.who, text: line.text });
      return;
    }
    if (!this.synth) return;
    if (line.who === 'narrator') this.synth.cancel(); // narrator interrupts chatter
    const u = new SpeechSynthesisUtterance(line.text);
    const p = cfg[line.who];
    u.pitch = p.pitch;
    u.rate = p.rate;
    u.volume = cfg.volume;
    const v = this.pickVoice(line.who);
    if (v) u.voice = v;
    this.synth.speak(u);
  }

  pickVoice(who) {
    const en = this.voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
    if (!en.length) return null;
    // Prefer lighter voices for puffs, and a warm default for the narrator.
    const prefer = who === 'puff' ? /(child|junior|kid|samantha|zira|female|aria|jenny)/i : /(daniel|google uk|karen|moira|serena|natural)/i;
    return en.find((v) => prefer.test(v.name)) ?? en.find((v) => v.default) ?? en[0];
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.synth?.cancel();
    return this.muted;
  }
}
