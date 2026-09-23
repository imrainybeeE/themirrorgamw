import { events } from '../core/events.js';

// DOM overlay: level label, puff counter, hints, camera preview + status, banners.
const $ = (id) => document.getElementById(id);
const CHEERS = ['Yay!', 'Sparkly!', 'Wonderful!', 'Hooray!', 'So bright!', 'Puff-tastic!'];

// Skeleton connections for the camera preview.
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

export class Hud {
  constructor() {
    this.el = {
      num: $('level-num'), name: $('level-name'), puffs: $('puffs'), hint: $('hint'),
      banner: $('banner'), camWrap: $('cam-wrap'), camStatus: $('cam-status'), overlay: $('cam-overlay'),
    };
    this.ctx = this.el.overlay.getContext('2d');
    $('cam-btn').addEventListener('click', () => this.cycleCamSize());
    this.hintTimer = null;

    events.on('levelStart', ({ level, index, total }) => {
      this.el.num.textContent = `${index + 1}/${total}`;
      this.el.name.textContent = level.data.name;
      this.renderPuffs(level);
      this.showHint(level.data.hint);
    });
    events.on('targetFull', () => this.pendingPuffs = true);
    events.on('targetSleep', () => this.pendingPuffs = true);
    events.on('grab', () => this.hideHint());
    events.on('levelClear', () => this.showBanner(CHEERS[(Math.random() * CHEERS.length) | 0]));
    events.on('handStatus', ({ status, message }) => {
      this.el.camWrap.dataset.status = status;
      this.el.camStatus.textContent = message;
      this.el.camWrap.classList.toggle('hidden', status === 'off');
    });
  }

  cycleCamSize() {
    const order = ['large', 'small', 'hidden'];
    const w = this.el.camWrap;
    w.dataset.size = order[(order.indexOf(w.dataset.size) + 1) % order.length];
  }

  renderPuffs(level) {
    this.el.puffs.replaceChildren(...level.targets.map((t) => {
      const d = document.createElement('span');
      d.className = 'puff' + (t.awake ? ' awake' : '');
      return d;
    }));
  }

  showHint(text) {
    clearTimeout(this.hintTimer);
    this.el.hint.textContent = text || '';
    this.el.hint.classList.toggle('show', !!text);
  }

  hideHint() {
    this.hintTimer = setTimeout(() => this.el.hint.classList.remove('show'), 1200);
  }

  showBanner(text) {
    const b = this.el.banner;
    b.textContent = text;
    b.classList.remove('pop');
    void b.offsetWidth; // restart the CSS animation
    b.classList.add('pop');
  }

  update(game, input) {
    if (this.pendingPuffs && game.level) {
      this.pendingPuffs = false;
      [...this.el.puffs.children].forEach((d, i) => {
        const awake = game.level.targets[i]?.awake;
        if (awake && !d.classList.contains('awake')) { d.classList.remove('boop'); void d.offsetWidth; d.classList.add('boop'); }
        d.classList.toggle('awake', !!awake);
      });
    }
    this.drawHand(input);
  }

  drawHand(input) {
    const cv = this.el.overlay, v = input.hand.video;
    if (input.hand.status !== 'ready') return;
    if (cv.width !== v.videoWidth && v.videoWidth) { cv.width = v.videoWidth; cv.height = v.videoHeight; }
    const g = this.ctx, L = input.hand.landmarks;
    g.clearRect(0, 0, cv.width, cv.height);
    const tracking = !!L;
    if (tracking !== this.wasTracking) {
      this.wasTracking = tracking;
      this.el.camWrap.classList.toggle('tracking', tracking);
      if (!tracking) this.el.camStatus.textContent = 'Show me your hand!';
    }
    if (!L) return;

    const W = cv.width, H = cv.height, u = W / 100;
    const P = (i) => [L[i].x * W, L[i].y * H];
    const ptr = input.gesture.pointer;

    // Bones: white outline under pastel color, per finger.
    const fingerColor = ['#ffb3d1', '#ffe8a3', '#b8f0d8', '#aee3ff', '#c9b6ff'];
    const finger = (a, b) => (Math.max(a, b) <= 4 ? 0 : Math.floor((Math.max(a, b) - 1) / 4));
    g.lineCap = 'round';
    for (const pass of [0, 1]) {
      for (const [a, b] of BONES) {
        g.lineWidth = pass === 0 ? u * 2.6 : u * 1.4;
        g.strokeStyle = pass === 0 ? 'rgba(255,255,255,0.95)' : fingerColor[finger(a, b)];
        g.beginPath(); g.moveTo(...P(a)); g.lineTo(...P(b)); g.stroke();
      }
    }
    // Joints.
    L.forEach((_, i) => {
      const tip = i === 4 || i === 8;
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(...P(i), u * (tip ? 2.2 : 1.4), 0, Math.PI * 2); g.fill();
      g.fillStyle = tip ? (ptr.pinching ? '#ffd23f' : '#ff8fbf') : '#6b4a6e';
      g.beginPath(); g.arc(...P(i), u * (tip ? 1.5 : 0.7), 0, Math.PI * 2); g.fill();
    });
    // Pinch meter: a ring between thumb and index that fills as they close.
    const [tx, ty] = P(4), [ix, iy] = P(8);
    const mx = (tx + ix) / 2, my = (ty + iy) / 2, r = u * 4;
    g.lineWidth = u * 1.2;
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = ptr.pinching ? '#ffd23f' : '#ff8fbf';
    g.beginPath(); g.arc(mx, my, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (ptr.pinching ? 1 : ptr.pinchAmount)); g.stroke();
    if (ptr.pinching) {
      g.fillStyle = 'rgba(255, 210, 63, 0.35)';
      g.beginPath(); g.arc(mx, my, r * 0.8, 0, Math.PI * 2); g.fill();
    }
  }
}
