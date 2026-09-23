// Renderer, camera, lights and post-processing. Owns the canvas and the world <-> screen mapping.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG, PALETTE } from '../config.js';
import { createPixelPass, warpUv } from '../fx/PixelPass.js';

export class Stage {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NoToneMapping; // keep pastel colors exact
    this.renderer.setClearColor(PALETTE.bg);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.zoom = 1; // animated by FX (level clear "breath")

    const hemi = new THREE.HemisphereLight('#ffffff', '#ffd6e8', 1.6);
    const sun = new THREE.DirectionalLight('#fff6e6', 1.8);
    sun.position.set(-4, 10, 6);
    this.scene.add(hemi, sun);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), CONFIG.fx.bloomStrength, CONFIG.fx.bloomRadius, CONFIG.fx.bloomThreshold);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.pixel = createPixelPass();
    this.composer.addPass(this.pixel);

    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CONFIG.mirror.beamHeight);
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._hit = new THREE.Vector3();

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    const pr = this.renderer.getPixelRatio();
    this.pixel.uniforms.resolution.value.set(w * pr, h * pr);
    this.pixel.uniforms.pixelSize.value = CONFIG.fx.pixel.size * pr;
    this._updateCamera();
  }

  _updateCamera() {
    const { width: fw, height: fh } = CONFIG.field;
    const { tilt, padding } = CONFIG.camera;
    const aspect = this.width / this.height;
    // Projected field height shrinks with tilt; fit whichever axis is tighter.
    const viewH = Math.max(fh * Math.cos(tilt) * padding + 1.2, (fw * padding) / aspect) / this.zoom;
    const viewW = viewH * aspect;
    const cam = this.camera;
    cam.left = -viewW / 2; cam.right = viewW / 2; cam.top = viewH / 2; cam.bottom = -viewH / 2;
    const dist = 30;
    cam.position.set(0, Math.cos(tilt) * dist, Math.sin(tilt) * dist);
    cam.up.set(0, 0, -1);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    this.pixelsPerUnit = this.height / viewH;
  }

  setZoom(z) {
    if (Math.abs(z - this.zoom) < 1e-4) return;
    this.zoom = z;
    this._updateCamera();
  }

  /** Normalized screen coords (0..1, y down) -> world point on the light plane, or null. */
  screenToWorld(sx, sy) {
    // The pixel pass bends the image like a CRT; bend the pointer the same way so it lines up.
    if (this.pixel.enabled) {
      const [u, v] = warpUv(sx, 1 - sy, this.pixel.uniforms.curvature.value);
      sx = u; sy = 1 - v;
    }
    this._ndc.set(sx * 2 - 1, -(sy * 2 - 1));
    this._ray.setFromCamera(this._ndc, this.camera);
    return this._ray.ray.intersectPlane(this._plane, this._hit) ? { x: this._hit.x, z: this._hit.z } : null;
  }

  render(t = 0) {
    this.pixel.uniforms.time.value = t;
    this.composer.render();
  }
}
