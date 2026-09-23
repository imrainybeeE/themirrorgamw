import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';
import { toon, flat } from '../fx/materials.js';
import { Entity } from './Entity.js';
import { damp, Spring } from '../fx/Tween.js';
import { lineAngleDiff } from '../physics/geometry.js';

export class Mirror extends Entity {
  constructor(data, id) {
    super();
    this.id = id;
    this.x = data.x;
    this.z = data.z;
    this.length = data.length ?? CONFIG.mirror.length;
    this.rotatable = data.rotatable !== false;
    this.solution = data.solution ?? null;
    this.angle = data.angle; // what's drawn and traced
    this.inputAngle = data.angle; // where the player is steering it
    this.hovered = false;
    this.grabbed = false;
    this.glow = new Spring(0, 120, 14);

    const h = CONFIG.mirror.beamHeight;
    const L = this.length, T = CONFIG.mirror.thickness;
    this.group.position.set(this.x, 0, this.z);

    // Rotating part: pastel frame capsule + shiny glass strip.
    this.pivot = new THREE.Group();
    this.group.add(this.pivot);

    const frameColor = this.rotatable ? PALETTE.lavender : '#b9a9c9';
    const frame = new THREE.Mesh(new THREE.CapsuleGeometry(T * 0.9, L, 6, 16), toon(frameColor));
    frame.rotation.z = Math.PI / 2;
    frame.position.y = h;
    frame.scale.set(1, 1, 0.55);
    this.pivot.add(frame);

    this.glassMat = flat('#eaf7ff');
    const glass = new THREE.Mesh(new THREE.BoxGeometry(L * 0.98, 0.5, T * 0.35), this.glassMat);
    glass.position.y = h + 0.02;
    this.pivot.add(glass);

    // Little highlight streak so it reads as "shiny".
    const shine = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.35, 0.06), flat('#ffffff'));
    shine.position.set(-L * 0.2, h + 0.3, 0);
    shine.rotation.x = -Math.PI / 2;
    this.pivot.add(shine);

    if (!this.rotatable) {
      // Stripes = "stuck" in place.
      for (let i = -2; i <= 2; i++) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.28), flat('#9c8bb0'));
        s.rotation.set(-Math.PI / 2, 0, 0.6);
        s.position.set(i * L * 0.18, h + 0.3, 0);
        this.pivot.add(s);
      }
    }

    // Pivot knob and base shadow.
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), toon(this.rotatable ? PALETTE.butter : '#d8cfe0'));
    knob.position.y = h + 0.3;
    knob.scale.y = 0.6;
    this.group.add(knob);

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(L * 0.55, 32), flat('#000000', { transparent: true, opacity: 0.06, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    shadow.scale.y = 0.5;
    this.shadow = shadow;
    this.pivot.add(shadow);

    // Hover ring: shows "you can turn me".
    if (this.rotatable) {
      this.ringMat = flat(PALETTE.hotPink, { transparent: true, opacity: 0, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(L * 0.62, L * 0.62 + 0.08, 64), this.ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      this.group.add(ring);
      this.ring = ring;
    }

    this._syncRotation();
  }

  /** Called by gameplay when the player steers. */
  steer(angle) {
    this.inputAngle = angle;
  }

  /** Aim assist nudges the visible angle toward `ideal` without touching the player's input. */
  update(dt, t, assistAngle = null) {
    this.updateBase(dt);
    let goal = this.inputAngle;
    if (assistAngle !== null) goal = assistAngle;
    this.angle += lineAngleDiff(goal, this.angle) * damp(CONFIG.mirror.rotateLerp, dt);

    this.glow.target = this.grabbed ? 1 : this.hovered ? 0.6 : 0;
    const g = this.glow.update(dt);
    if (this.ring) {
      this.ringMat.opacity = Math.min(0.85, g * 0.9) * (0.75 + 0.25 * Math.sin(t * 6));
      this.ring.scale.setScalar(1 + g * 0.06 + (this.grabbed ? 0.03 * Math.sin(t * 10) : 0));
    }
    this.glassMat.color.set(g > 0.01 ? '#ffffff' : '#eaf7ff');
    this._syncRotation();
  }

  _syncRotation() {
    // Our 2D angle is measured x -> z; Three's Y rotation goes x -> -z, hence the minus.
    this.pivot.rotation.y = -this.angle;
  }

  toTrace() {
    return { id: this.id, x: this.x, z: this.z, angle: this.angle, length: this.length };
  }
}
