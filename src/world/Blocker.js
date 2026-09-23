import * as THREE from 'three';
import { toon, flat } from '../fx/materials.js';
import { CONFIG, PALETTE } from '../config.js';
import { Entity } from './Entity.js';

// A fluffy cloud that swallows light. Collision is its box (w x h); visuals are puffy spheres inside it.
export class Blocker extends Entity {
  constructor(data, id) {
    super();
    this.id = id;
    this.x = data.x; this.z = data.z; this.w = data.w; this.h = data.h;
    this.group.position.set(this.x, 0, this.z);
    this.seed = Math.random() * 10;

    const mat = toon(PALETTE.cloud);
    const cols = Math.max(2, Math.round(this.w / 0.8));
    const rows = Math.max(1, Math.round(this.h / 0.8));
    this.puffs = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const r = 0.45 + Math.random() * 0.2;
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat);
        const px = ((i + 0.5) / cols - 0.5) * (this.w - r);
        const pz = ((j + 0.5) / rows - 0.5) * (this.h - r);
        m.position.set(px, CONFIG.mirror.beamHeight + Math.random() * 0.2, pz);
        m.scale.y = 0.8;
        m.userData.baseY = m.position.y;
        m.userData.phase = Math.random() * Math.PI * 2;
        this.group.add(m);
        this.puffs.push(m);
      }
    }
    // Cheeks so clouds are cute too.
    const eyeMat = flat(PALETTE.ink);
    [-1, 1].forEach((s) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat);
      e.position.set(s * 0.22, CONFIG.mirror.beamHeight + 0.62, this.h * 0.2);
      e.scale.y = 0.4;
      this.group.add(e);
    });

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(this.w, this.h), flat('#000000', { transparent: true, opacity: 0.05, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    this.group.add(shadow);
  }

  update(dt, t) {
    this.updateBase(dt);
    for (const m of this.puffs) m.position.y = m.userData.baseY + Math.sin(t * 1.5 + m.userData.phase) * 0.05;
  }

  toTrace() {
    return { id: this.id, x: this.x, z: this.z, w: this.w, h: this.h };
  }
}
