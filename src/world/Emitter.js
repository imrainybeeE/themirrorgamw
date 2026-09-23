import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';
import { toon, flat, starGeometry, glowTexture } from '../fx/materials.js';
import { Entity } from './Entity.js';

// The light source: a happy little star with a nozzle pointing along its angle.
export class Emitter extends Entity {
  constructor(data) {
    super();
    this.x = data.x;
    this.z = data.z;
    this.angle = data.angle;
    const h = CONFIG.mirror.beamHeight;
    this.group.position.set(this.x, 0, this.z);

    this.star = new THREE.Mesh(starGeometry(0.55, 0.28, 0.2), toon(PALETTE.butter, {
      emissive: new THREE.Color(PALETTE.butter), emissiveIntensity: 0.35,
    }));
    this.star.position.y = h + 0.15;
    this.star.rotation.x = -Math.PI / 2 + 0.25;
    this.group.add(this.star);

    // Tiny face on the star.
    const eyeMat = flat(PALETTE.ink);
    [-1, 1].forEach((s) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat);
      e.position.set(s * 0.12, 0.02, 0.2);
      e.scale.y = 1.6;
      this.star.add(e);
    });

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.5, 16), toon(PALETTE.hotPink));
    nozzle.rotation.z = -Math.PI / 2;
    nozzle.position.set(0.45, h, 0);
    this.nozzlePivot = new THREE.Group();
    this.nozzlePivot.add(nozzle);
    this.nozzlePivot.rotation.y = -this.angle;
    this.group.add(this.nozzlePivot);

    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: new THREE.Color(PALETTE.butter),
      transparent: true, depthWrite: false,
    }));
    this.halo.scale.setScalar(2.2);
    this.halo.position.y = h + 0.1;
    this.group.add(this.halo);
  }

  update(dt, t) {
    this.updateBase(dt);
    this.star.position.y = CONFIG.mirror.beamHeight + 0.15 + Math.sin(t * 2.2) * 0.06;
    this.star.rotation.z = Math.sin(t * 1.3) * 0.15;
    this.halo.material.opacity = 0.6 + Math.sin(t * 3) * 0.15;
  }

  /** Where the beam starts: the tip of the nozzle. */
  toTrace() {
    const off = 0.7;
    return { x: this.x + Math.cos(this.angle) * off, z: this.z + Math.sin(this.angle) * off, angle: this.angle };
  }
}
