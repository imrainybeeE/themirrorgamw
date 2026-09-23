import { CONFIG } from './config.js';
import { LEVELS } from './levels/levels.js';
import { events } from './core/events.js';
import { Stage } from './core/Stage.js';
import { Loop } from './core/Loop.js';
import { Game } from './core/Game.js';
import { InputManager } from './input/InputManager.js';
import { Background } from './world/Background.js';
import { Cursor } from './world/Cursor.js';
import { BeamRenderer } from './fx/BeamRenderer.js';
import { Particles } from './fx/Particles.js';
import { Juice } from './fx/Juice.js';
import { Sfx } from './audio/Sfx.js';
import { Hud } from './ui/Hud.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const startLevel = Math.min(LEVELS.length - 1, Math.max(0, (parseInt(params.get('level'), 10) || 1) - 1));

const stage = new Stage(document.getElementById('stage'));
const background = new Background(stage.scene);
const beam = new BeamRenderer(stage.scene);
const particles = new Particles(stage.scene, stage);
const cursor = new Cursor(stage.scene, stage.camera);
const input = new InputManager(stage, document.getElementById('cam'));
const sfx = new Sfx();
const hud = new Hud();
const game = new Game({ stage, input, beam, cursor });

const loop = new Loop(
  (dt, t, raw) => {
    background.update(dt, t);
    game.update(dt, t, raw);
    juice.update(raw);
    particles.update(dt);
    hud.update(game, input);
  },
  (dt, t) => stage.render(t),
);
const juice = new Juice({ stage, particles, sfx, loop, game });
loop.start();

// --- Screens ---------------------------------------------------------------
const $ = (id) => document.getElementById(id);
function begin(withHand) {
  sfx.unlock();
  $('title').classList.add('hidden');
  game.start(startLevel);
  if (withHand) input.startHand();
}
$('play-hand').addEventListener('click', () => begin(true));
$('play-mouse').addEventListener('click', () => begin(false));
if (window.matchMedia?.('(pointer: coarse)').matches) {
  $('play-mouse').textContent = 'Play with touch';
  $('mouse-tip').textContent = 'Touch: drag your finger around a mirror.';
}
$('replay').addEventListener('click', () => {
  $('finale').classList.add('hidden');
  game.start(0);
});
events.on('gameComplete', () => $('finale').classList.remove('hidden'));

const muteBtn = $('mute');
const toggleMute = () => muteBtn.classList.toggle('off', sfx.toggleMute());
muteBtn.addEventListener('click', toggleMute);

window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') toggleMute();
  if (e.key === 'x' || e.key === 'X') stage.pixel.enabled = !stage.pixel.enabled;
  if (e.key === 'c' || e.key === 'C') hud.cycleCamSize();
  if (!DEBUG) return;
  if (e.key === 'n') game.loadLevel((game.levelIndex + 1) % LEVELS.length);
  if (e.key === 'p') game.loadLevel((game.levelIndex - 1 + LEVELS.length) % LEVELS.length);
  if (e.key === 's') game.solve();
});

// Handy for poking at things from the console and for automated tests.
window.prismPuff = { game, stage, input, sfx, CONFIG, events, begin };

// --- Debug tuning panel (?debug) -----------------------------------------------
if (DEBUG) {
  import('lil-gui').then(({ default: GUI }) => {
    const gui = new GUI({ title: 'Juice panel  (N/P level, S solve)' });
    const i = gui.addFolder('Hand');
    i.add(CONFIG.input, 'handRotateMode', ['twist', 'orbit']);
    i.add(CONFIG.input, 'rotateSensitivity', 0.5, 4, 0.05);
    i.add(CONFIG.input, 'pinchEnter', 0.1, 0.6, 0.01);
    i.add(CONFIG.input, 'pinchExit', 0.2, 0.9, 0.01);
    i.add(CONFIG.input.filter, 'minCutoff', 0.1, 5, 0.05).name('smooth (minCutoff)');
    i.add(CONFIG.input.filter, 'beta', 0, 0.2, 0.005).name('responsive (beta)');
    i.add(CONFIG.input, 'grabRadius', 0.5, 3, 0.05);
    const m = gui.addFolder('Mirrors');
    m.add(CONFIG.mirror, 'rotateLerp', 2, 40, 1);
    m.add(CONFIG.mirror, 'snapAssistDeg', 0, 15, 0.5);
    m.add(CONFIG.mirror, 'snapAssistStrength', 0, 1, 0.05);
    m.add(CONFIG.mirror, 'tickEveryDeg', 2, 30, 1);
    const t = gui.addFolder('Puffs');
    t.add(CONFIG.target, 'chargeTime', 0.1, 3, 0.05);
    t.add(CONFIG.target, 'drainRate', 0.1, 3, 0.05);
    t.add(CONFIG.target, 'stayAwake');
    const f = gui.addFolder('FX');
    f.add(stage.bloom, 'strength', 0, 2, 0.01).name('bloom');
    f.add(stage.bloom, 'radius', 0, 1.5, 0.01).name('bloom radius');
    f.add(CONFIG.fx, 'hitstopMs', 0, 300, 5);
    f.add(CONFIG.fx, 'reflectSparkles', 0, 12, 1);
    const px = gui.addFolder('Pixel look');
    const u = stage.pixel.uniforms;
    px.add(stage.pixel, 'enabled');
    px.add(CONFIG.fx.pixel, 'size', 1, 8, 1).onChange(() => stage.resize());
    px.add(u.levels, 'value', 3, 32, 1).name('color levels');
    px.add(u.dither, 'value', 0, 2, 0.05).name('dither');
    px.add(u.scanlines, 'value', 0, 0.4, 0.01).name('scanlines');
    px.add(u.curvature, 'value', 0, 0.15, 0.005).name('curvature');
    px.add(u.vignette, 'value', 0, 1, 0.01).name('vignette');
    px.add(u.aberration, 'value', 0, 5, 0.1).name('aberration');
    f.add(CONFIG.audio, 'master', 0, 1, 0.01).onChange((v) => sfx.master && (sfx.master.gain.value = v));
  });
}
