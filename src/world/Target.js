import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';
import { flat, glowTexture, textSprite, spriteMaterial } from '../fx/materials.js';
import { Entity } from './Entity.js';
import { Spring, lerp, damp } from '../fx/Tween.js';

const SPRITES = {
  sleepFace: 'assets/sprites/puff_sleep_face.png',
  awakeFace: 'assets/sprites/puff_awake_face.png',
  sleepAura: 'assets/sprites/puff_sleep_aura.png',
  awakeAura: 'assets/sprites/puff_awake_aura.png',
};
const SPRITE_SCALE = 1.7; // must match AURA_SCALE in tools/process_sprites.py
const WHITE = new THREE.Color('#ffffff');

const PUFF_COLORS = [PALETTE.pink, PALETTE.mint, PALETTE.sky, PALETTE.lavender, PALETTE.butter];

// A sleepy puff. Light charges it; full charge = awake and glowing.
export class Target extends Entity {
  constructor(data, id, index, camera) {
    super();
    this.id = id;
    this.index = index;
    this.x = data.x;
    this.z = data.z;
    this.r = data.r ?? CONFIG.target.radius;
    this.camera = camera;
    this.charge = 0; // 0..1
    this.lit = false;
    this.awake = false;
    this.unlitTime = 0;
    this.wake = new Spring(0, 120, 10); // eye-open / smile blend
    this.wobble = 0;
    this.seed = Math.random() * 10;

    const h = CONFIG.mirror.beamHeight;
    const color = PUFF_COLORS[index % PUFF_COLORS.length];
    this.group.position.set(this.x, 0, this.z);

    // Body floats and faces the camera.
    this.body = new THREE.Group();
    this.body.position.y = h;
    this.group.add(this.body);

    // Hand-drawn face sprites (assets/sprites, made by tools/process_sprites.py).
    // The texture is white body + dark ink, so the material color tints the body per puff.
    // Quads are 2 * r * SPRITE_SCALE wide because the face fills 1 / SPRITE_SCALE of the texture.
    const size = this.r * CONFIG.target.spriteScale * 2 * SPRITE_SCALE;
    const quad = new THREE.PlaneGeometry(size, size);
    const faceColor = new THREE.Color(color);
    this.auraSleepMat = spriteMaterial(SPRITES.sleepAura, { color: new THREE.Color(PALETTE.lavender), opacity: 0.55 });
    this.auraAwakeMat = spriteMaterial(SPRITES.awakeAura, { color: new THREE.Color(PALETTE.butter).multiplyScalar(1.1), opacity: 0 });
    this.sleepMat = spriteMaterial(SPRITES.sleepFace, { color: faceColor });
    this.awakeMat = spriteMaterial(SPRITES.awakeFace, { color: faceColor.clone(), opacity: 0 });
    this.auraSleep = new THREE.Mesh(quad, this.auraSleepMat);
    this.auraAwake = new THREE.Mesh(quad, this.auraAwakeMat);
    this.faceSleep = new THREE.Mesh(quad, this.sleepMat);
    this.faceAwake = new THREE.Mesh(quad, this.awakeMat);
    this.auraSleep.position.z = -0.02;
    this.auraAwake.position.z = -0.01;
    this.faceAwake.position.z = 0.01;
    this.auraSleep.renderOrder = this.auraAwake.renderOrder = 3;
    this.faceSleep.renderOrder = this.faceAwake.renderOrder = 7; // faces draw over the beam
    this.faceSleep.material.depthTest = this.faceAwake.material.depthTest = false;
    this.face = new THREE.Group();
    this.face.add(this.auraSleep, this.auraAwake, this.faceSleep, this.faceAwake);
    this.body.add(this.face);
    this.boilTimer = 0;
    this.baseColor = faceColor.clone();

    // Extra cuteness: blush dots that appear when the puff wakes up.
    this.blushMat = flat(PALETTE.hotPink, { transparent: true, opacity: 0, depthTest: false });
    [-1, 1].forEach((s) => {
      const b = new THREE.Mesh(new THREE.CircleGeometry(this.r * 0.13 * CONFIG.target.spriteScale, 16), this.blushMat);
      b.position.set(s * this.r * 0.62 * CONFIG.target.spriteScale, -this.r * 0.12 * CONFIG.target.spriteScale, 0.02);
      b.scale.y = 0.6;
      b.renderOrder = 8;
      this.face.add(b);
    });

    // Charge ring on the floor.
    this.ringMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { progress: { value: 0 }, color: { value: new THREE.Color(PALETTE.hotPink) }, bright: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float progress; uniform vec3 color; uniform float bright; varying vec2 vUv;
        void main(){
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;
          float a = atan(p.x, p.y) / 6.28318 + 0.5;
          float band = smoothstep(0.78, 0.82, r) * (1.0 - smoothstep(0.96, 1.0, r));
          float filled = step(a, progress);
          float alpha = band * mix(0.18, 1.0, filled);
          gl_FragColor = vec4(color * mix(1.0, bright, filled), alpha);
        }`,
    });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(this.r * 3, this.r * 3), this.ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.group.add(ring);

    // Soft glow halo when awake (HDR color so bloom catches it).
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: new THREE.Color(PALETTE.butter).multiplyScalar(1.3),
      transparent: true, opacity: 0, depthWrite: false,
    }));
    this.halo.scale.setScalar(this.r * 5);
    this.body.add(this.halo);

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(this.r * 0.9, 24), flat('#000000', { transparent: true, opacity: 0.08, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    this.group.add(shadow);

    // Sleepy "z".
    this.zzz = textSprite('z', PALETTE.ink);
    this.zzz.scale.setScalar(0.45);
    this.group.add(this.zzz);
  }

  /** Called every frame by gameplay with whether the beam touches this puff. */
  setLit(lit) {
    this.lit = lit;
  }

  update(dt, t) {
    this.updateBase(dt);
    const cfg = CONFIG.target;
    const wasAwake = this.awake;

    if (this.lit) {
      this.unlitTime = 0;
      this.charge = Math.min(1, this.charge + dt / cfg.chargeTime);
    } else {
      this.unlitTime += dt;
      const canDrain = !this.awake || (!cfg.stayAwake && this.unlitTime > cfg.awakeGrace);
      if (canDrain) this.charge = Math.max(0, this.charge - cfg.drainRate * dt);
    }
    if (this.charge >= 1) this.awake = true;
    else if (this.awake && this.charge < 0.5) this.awake = false;
    this.justWoke = !wasAwake && this.awake;
    this.justSlept = wasAwake && !this.awake;

    const w = this.wake;
    w.target = this.awake ? 1 : 0;
    const k = w.update(dt);

    // Swap sleeping -> awake drawing (the squash spring hides the cut), glow aura fades in.
    this.sleepMat.opacity = 1 - k;
    this.awakeMat.opacity = Math.min(1, k * 1.5);
    this.auraSleepMat.opacity = 0.55 * (1 - k) * (0.6 + 0.4 * this.charge);
    this.auraAwakeMat.opacity = 0.9 * k;
    this.blushMat.opacity = 0.55 * k;
    this.sleepMat.color.lerp(this.baseColor.clone().lerp(WHITE, this.charge * 0.35), damp(10, dt));

    // Breathing while asleep, jittery excitement while charging, happy hop when awake.
    const breathe = Math.sin(t * 2 + this.seed) * 0.03;
    const shiver = this.lit && !this.awake ? Math.sin(t * 45) * 0.04 * this.charge : 0;
    const hop = this.awake ? Math.abs(Math.sin(t * 5 + this.seed)) * 0.18 : 0;
    this.body.position.y = CONFIG.mirror.beamHeight + hop;
    this.body.position.x = shiver;
    this.faceSleep.scale.set(1 + breathe, 1 - breathe, 1);
    this.faceAwake.scale.set(1 - breathe, 1 + breathe, 1);
    this.body.quaternion.copy(this.camera.quaternion);

    // Hand-drawn "boil": the scribble aura jumps a little a few times a second.
    this.boilTimer -= dt;
    if (this.boilTimer <= 0) {
      this.boilTimer = 1 / CONFIG.target.boilFps;
      this.auraSleep.rotation.z = (Math.random() - 0.5) * 0.12;
      this.auraSleep.scale.setScalar(0.97 + Math.random() * 0.06);
    }
    this.auraAwake.rotation.z += dt * 0.4;
    this.auraAwake.scale.setScalar(0.9 + k * 0.15 + Math.sin(t * 4) * 0.03);
    this.halo.material.opacity = lerp(this.halo.material.opacity, this.awake ? 0.9 : this.charge * 0.35, damp(8, dt));

    this.ringMat.uniforms.progress.value = this.charge;
    this.ringMat.uniforms.bright.value = this.awake ? 2.2 : 1.0;

    // z drifts up and fades on a loop while asleep.
    const zc = (t * 0.5 + this.seed) % 1;
    const rs = this.r * CONFIG.target.spriteScale;
    this.zzz.position.set(rs * 0.9 + zc * 0.3, CONFIG.mirror.beamHeight + rs + zc * 0.9, -rs * 0.6 - zc * 0.3);
    this.zzz.material.opacity = (1 - k) * Math.sin(zc * Math.PI) * 0.8;
  }

  worldPos() {
    return { x: this.x, z: this.z };
  }

  toTrace() {
    return { id: this.id, x: this.x, z: this.z, r: this.r };
  }
}
