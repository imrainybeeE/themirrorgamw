import * as THREE from 'three';

// One pooled GPU point system for all sparkles, hearts-ish stars and confetti.
// emit() is cheap; call it from event listeners freely.
const MAX = 1500;

export class Particles {
  constructor(scene, stage) {
    this.stage = stage;
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.life = new Float32Array(MAX); // remaining seconds
    this.maxLife = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.spin = new Float32Array(MAX);
    this.gravity = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.shape = new Float32Array(MAX); // 0 = soft dot, 1 = star
    this.cursor = 0;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('spin', new THREE.BufferAttribute(this.spin, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('shape', new THREE.BufferAttribute(this.shape, 1));
    this.geo = g;

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { pxPerUnit: { value: 50 } },
      vertexShader: `
        attribute vec3 color; attribute float size; attribute float alpha; attribute float spin; attribute float shape;
        uniform float pxPerUnit;
        varying vec3 vColor; varying float vAlpha; varying float vSpin; varying float vShape;
        void main(){
          vColor = color; vAlpha = alpha; vSpin = spin; vShape = shape;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * pxPerUnit;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha; varying float vSpin; varying float vShape;
        void main(){
          vec2 p = gl_PointCoord - 0.5;
          float c = cos(vSpin), s = sin(vSpin);
          p = mat2(c, -s, s, c) * p;
          float a;
          if (vShape > 0.5) {
            float ang = atan(p.y, p.x);
            float r = length(p) * 2.0;
            float star = 0.55 + 0.45 * cos(ang * 5.0);
            a = smoothstep(star * 0.95, star * 0.75, r);
          } else {
            a = smoothstep(0.5, 0.0, length(p));
          }
          if (a * vAlpha < 0.01) discard;
          gl_FragColor = vec4(vColor, a * vAlpha);
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this._c = new THREE.Color();
  }

  /**
   * @param {object} o
   *   x, y, z       spawn point
   *   count         number of particles
   *   speed         [min, max] initial speed
   *   up            extra upward velocity
   *   spread        'sphere' | 'ring' (horizontal)
   *   colors        array of css colors (picked randomly), may be HDR via `hdr`
   *   hdr           multiply color (>1 blooms)
   *   size          [min, max] world units
   *   life          [min, max] seconds
   *   gravity, drag, star (bool)
   */
  emit(o) {
    const n = o.count ?? 10;
    const [s0, s1] = o.speed ?? [1, 3];
    const [z0, z1] = o.size ?? [0.1, 0.25];
    const [l0, l1] = o.life ?? [0.5, 1.2];
    const colors = o.colors ?? ['#ffffff'];
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      const sp = s0 + Math.random() * (s1 - s0);
      let dx, dy, dz;
      if (o.spread === 'ring') {
        const a = Math.random() * Math.PI * 2;
        dx = Math.cos(a); dy = 0; dz = Math.sin(a);
      } else {
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        dx = r * Math.cos(a); dy = Math.abs(u); dz = r * Math.sin(a);
      }
      this.pos.set([o.x, o.y ?? 0.4, o.z], i * 3);
      this.vel.set([dx * sp, dy * sp + (o.up ?? 0), dz * sp], i * 3);
      this._c.set(colors[(Math.random() * colors.length) | 0]).multiplyScalar(o.hdr ?? 1);
      this.col.set([this._c.r, this._c.g, this._c.b], i * 3);
      this.size[i] = z0 + Math.random() * (z1 - z0);
      this.maxLife[i] = this.life[i] = l0 + Math.random() * (l1 - l0);
      this.spin[i] = Math.random() * 6.28;
      this.gravity[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 2;
      this.shape[i] = o.star ? 1 : 0;
    }
    this.geo.attributes.shape.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  update(dt) {
    this.mat.uniforms.pxPerUnit.value = this.stage.pixelsPerUnit * this.stage.renderer.getPixelRatio();
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const j = i * 3;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[j] *= d; this.vel[j + 1] = this.vel[j + 1] * d - this.gravity[i] * dt; this.vel[j + 2] *= d;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, k * 2.5) * Math.min(1, (1 - k) * 12 + 0.2);
      this.spin[i] += dt * 2;
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = a.alpha.needsUpdate = a.spin.needsUpdate = true;
  }
}
