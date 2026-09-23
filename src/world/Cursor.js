import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';
import { toon, starGeometry, glowTexture } from '../fx/materials.js';
import { Spring, damp, lerp } from '../fx/Tween.js';

// The player's "hand": a floating star that reacts to hover, pinch and grab.
export class Cursor {
  constructor(scene, camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.mat = toon(PALETTE.hotPink, { emissive: new THREE.Color(PALETTE.hotPink), emissiveIntensity: 0.3 });
    this.star = new THREE.Mesh(starGeometry(0.32, 0.16, 0.12), this.mat);
    this.group.add(this.star);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: new THREE.Color(PALETTE.pink),
      transparent: true, opacity: 0.6, depthWrite: false,
    }));
    this.halo.scale.setScalar(1.4);
    this.group.add(this.halo);
    this.group.renderOrder = 20;
    scene.add(this.group);
    this.size = new Spring(0, 250, 16);
    this.squish = new Spring(1, 300, 10);
    this.pos = new THREE.Vector3();
    this.first = true;
    this.state = 'idle';
  }

  /** state: 'hidden' | 'idle' | 'hover' | 'grab' */
  set(state) {
    if (state === this.state) return;
    if (state === 'grab') this.squish.kick(-6);
    if (state === 'hover' || (this.state === 'grab' && state !== 'grab')) this.squish.kick(4);
    this.state = state;
  }

  update(dt, t, world, pinchAmount = 0) {
    const visible = !!world && this.state !== 'hidden';
    const sizes = { hidden: 0, idle: 1, hover: 1.35, grab: 1.1 };
    this.size.target = visible ? sizes[this.state] * (1 - pinchAmount * 0.2) : 0;
    if (world) {
      const target = new THREE.Vector3(world.x, CONFIG.mirror.beamHeight + 0.9, world.z);
      if (this.first) { this.pos.copy(target); this.first = false; }
      this.pos.lerp(target, damp(28, dt));
    }
    this.group.position.copy(this.pos);
    const s = Math.max(0.0001, this.size.update(dt));
    const q = this.squish.update(dt);
    this.group.scale.set(s / Math.sqrt(q), s * q, s / Math.sqrt(q));
    this.star.quaternion.copy(this.camera.quaternion);
    this.star.rotateZ(this.state === 'grab' ? 0 : Math.sin(t * 2) * 0.3);
    const col = this.state === 'grab' ? PALETTE.butter : this.state === 'hover' ? PALETTE.hotPink : PALETTE.pink;
    this.mat.color.lerp(new THREE.Color(col), damp(12, dt));
    this.halo.material.opacity = lerp(this.halo.material.opacity, this.state === 'idle' ? 0.35 : 0.8, damp(10, dt));
  }
}
