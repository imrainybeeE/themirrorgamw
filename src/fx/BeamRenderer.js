import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';
import { glowTexture } from './materials.js';

// Draws the traced light path as a flat glowing ribbon lying on the light plane,
// with a soft round glow at every bounce. Rebuilt from trace segments every frame.
export class BeamRenderer {
  constructor(scene) {
    this.maxSegs = CONFIG.beam.maxBounces + 2;
    const verts = this.maxSegs * 4;
    this.positions = new Float32Array(verts * 3);
    this.uvs = new Float32Array(verts * 2); // x = distance along beam, y = across (-1..1)
    const idx = [];
    for (let i = 0; i < this.maxSegs; i++) {
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2).setUsage(THREE.DynamicDrawUsage));
    this.geo.setIndex(idx);

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(PALETTE.beam) },
        rim: { value: new THREE.Color(PALETTE.beamRim) },
        core: { value: new THREE.Color(PALETTE.beamCore) },
        intensity: { value: 1 },
        reveal: { value: 1e6 }, // beam length visible (animated on level start)
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      // Kirby-ish ribbon: pink rim -> butter body -> HDR white core (the only part that blooms).
      fragmentShader: `
        uniform float time; uniform vec3 color; uniform vec3 rim; uniform vec3 core; uniform float intensity; uniform float reveal;
        varying vec2 vUv;
        float hash(float n){ return fract(sin(n) * 43758.5453); }
        void main(){
          if (vUv.x > reveal) discard;
          float across = abs(vUv.y);
          float pulse = 0.5 + 0.5 * sin(vUv.x * 2.5 - time * 7.0);
          vec3 c = mix(rim, color, smoothstep(0.85, 0.6, across));
          float coreAmt = smoothstep(0.3 + 0.05 * pulse, 0.05, across);
          c = mix(c, core * (1.25 + 0.25 * pulse) * intensity, coreAmt);
          // Sparkles flowing along the beam.
          float s = vUv.x * 3.0 - time * ${CONFIG.beam.sparkleSpeed.toFixed(2)};
          float f = fract(s);
          float spark = step(0.55, hash(floor(s))) * smoothstep(0.35, 0.0, abs(f - 0.5)) * smoothstep(0.7, 0.2, across);
          c += core * spark * 0.8;
          float alpha = smoothstep(1.0, 0.8, across) * smoothstep(reveal, reveal - 0.4, vUv.x);
          gl_FragColor = vec4(c, alpha);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);

    // Bounce glows (pooled sprites).
    this.glows = [];
    const glowMat = new THREE.SpriteMaterial({
      map: glowTexture(), color: new THREE.Color(PALETTE.beamCore).multiplyScalar(1.8),
      transparent: true, depthWrite: false,
    });
    for (let i = 0; i < this.maxSegs; i++) {
      const s = new THREE.Sprite(glowMat);
      s.visible = false;
      s.renderOrder = 6;
      scene.add(s);
      this.glows.push(s);
    }
    this.totalLength = 0;
  }

  update(result, t) {
    const y = CONFIG.mirror.beamHeight;
    const hw = CONFIG.beam.width * (1 + 0.08 * Math.sin(t * 8));
    const P = this.positions, U = this.uvs;
    let dist = 0;
    const segs = result ? result.segments.slice(0, this.maxSegs) : [];

    segs.forEach((s, i) => {
      const dx = s.to.x - s.from.x, dz = s.to.z - s.from.z;
      const L = Math.hypot(dx, dz) || 1;
      // Perpendicular on XZ plane; extend a little past each end so joints overlap smoothly.
      const nx = (-dz / L) * hw, nz = (dx / L) * hw;
      const ex = (dx / L) * hw * 0.5, ez = (dz / L) * hw * 0.5;
      const ax = s.from.x - ex, az = s.from.z - ez, bx = s.to.x + ex, bz = s.to.z + ez;
      const v = i * 12;
      P.set([ax + nx, y, az + nz, ax - nx, y, az - nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz], v);
      const u = i * 8;
      U.set([dist, 1, dist, -1, dist + L, 1, dist + L, -1], u);
      dist += L;
    });
    // Collapse unused quads.
    P.fill(0, segs.length * 12);
    U.fill(0, segs.length * 8);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
    this.geo.setDrawRange(0, segs.length * 6);
    this.totalLength = dist;

    this.mat.uniforms.time.value = t;
    const bounces = result ? result.bounces : [];
    this.glows.forEach((g, i) => {
      const b = bounces[i];
      g.visible = !!b && this._revealedAt(b.point, segs, i);
      if (!g.visible) return;
      g.position.set(b.point.x, y + 0.05, b.point.z);
      g.scale.setScalar(0.55 + 0.1 * Math.sin(t * 7 + i));
    });
  }

  _revealedAt(point, segs, index) {
    let d = 0;
    for (let i = 0; i <= index && i < segs.length; i++) d += Math.hypot(segs[i].to.x - segs[i].from.x, segs[i].to.z - segs[i].from.z);
    return d <= this.mat.uniforms.reveal.value;
  }

  setReveal(len) {
    this.mat.uniforms.reveal.value = len;
  }

  setIntensity(v) {
    this.mat.uniforms.intensity.value = v;
  }
}
