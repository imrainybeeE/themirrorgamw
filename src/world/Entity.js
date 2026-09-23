import * as THREE from 'three';
import { Spring, squash } from '../fx/Tween.js';

// Base for everything on the field: a group plus a pop-in/pop-out scale spring.
export class Entity {
  constructor() {
    this.group = new THREE.Group();
    this.pop = new Spring(0, 220, 14); // overall presence scale (0 = hidden, 1 = shown)
    this.bounce = new Spring(1, 260, 9); // squash & stretch around 1
    this.delay = 0;
    this.group.scale.setScalar(0.0001);
  }
  appear(delay = 0) {
    this.delay = delay;
    this.pop.target = 1;
  }
  disappear() {
    this.delay = 0;
    this.pop.target = 0;
    this.pop.stiffness = 300;
  }
  boing(amount = 3) {
    this.bounce.kick(amount);
  }
  updateBase(dt) {
    if (this.delay > 0) {
      this.delay -= dt;
      return;
    }
    const p = Math.max(0.0001, this.pop.update(dt));
    const [sx, sy, sz] = squash(this.bounce.update(dt));
    this.group.scale.set(p * sx, p * sy, p * sz);
  }
  dispose() {
    this.group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    this.group.removeFromParent();
  }
}
