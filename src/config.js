// Every "feel" knob lives here. Tweak freely; `?debug` exposes most of these live.

export const PALETTE = {
  bg: '#fff4ec',
  bgBottom: '#ffe3ef',
  pink: '#ffb3d1',
  hotPink: '#ff8fbf',
  lavender: '#c9b6ff',
  mint: '#b8f0d8',
  butter: '#ffe8a3',
  sky: '#aee3ff',
  cream: '#fffaf5',
  ink: '#6b4a6e',
  beam: '#ffe27a', // ribbon body (warm butter)
  beamRim: '#ff8fbf', // soft pink outline so light reads on a light background
  beamCore: '#ffffff',
  cloud: '#ffffff',
};

export const ASSETS = {
  // Swap these for local copies to run fully offline.
  mediapipeWasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
  handModel: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
};

export const CONFIG = {
  render: {
    maxPixelRatio: 2, // computers
    touchPixelRatio: 1.25, // tablets/phones: the pixel filter hides it and it keeps iPads smooth
  },
  field: { width: 16, height: 10 }, // world units visible (XZ plane)
  camera: { tilt: 0.28, padding: 1.1 }, // tilt in radians from straight-down

  input: {
    // Hand
    pinchEnter: 0.32, // thumb-index distance / palm size to start a pinch
    pinchExit: 0.45, // must open wider than this to release (hysteresis)
    handRotateMode: 'twist', // 'twist' = roll your wrist, 'orbit' = drag the pinch around the pivot like a dial
    rotateSensitivity: 1.6, // hand twist multiplier while grabbing
    lostHandGraceMs: 250, // keep a grab alive through brief tracking dropouts
    handAreaMargin: 0.12, // camera-edge margin mapped to field edge (easier to reach corners)
    filter: { minCutoff: 1.4, beta: 0.02, dCutoff: 1.0 }, // One Euro filter
    angleFilter: { minCutoff: 1.0, beta: 0.05, dCutoff: 1.0 },
    // Shared
    grabRadius: 1.4, // world units from mirror pivot that counts as "on it"
  },

  mirror: {
    length: 1.8,
    thickness: 0.22,
    rotateLerp: 18, // how quickly the visual mirror follows the target angle (per s)
    snapAssistDeg: 3.5, // aim assist window around a perfect hit
    snapAssistStrength: 0.8, // 0 = off, 1 = strongest pull (eases in quadratically, never jumps)
    tickEveryDeg: 7, // rotation "ratchet" click spacing
    beamHeight: 0.35, // y of the light plane; mirrors, puffs and the beam all sit on it
  },

  beam: {
    maxBounces: 32,
    maxLength: 60,
    width: 0.2, // half-width of the ribbon
    sparkleSpeed: 2.2,
    revealDelay: 0.5, // seconds after a level starts before the beam grows out
    revealSpeed: 28, // world units per second the beam grows at level start
  },

  target: {
    radius: 0.55, // light hit radius
    spriteScale: 1.45, // drawn face size relative to the hit radius
    chargeTime: 0.6, // seconds of continuous light to wake a puff
    drainRate: 0.8, // fraction of a full charge lost per second when unlit
    awakeGrace: 0.5, // seconds an awake puff stays awake after the light leaves
    stayAwake: false, // true = once awake, always awake (easier, sequential puzzles)
    boilFps: 8, // how often the hand-drawn scribble aura jitters
  },

  fx: {
    bloomStrength: 0.4,
    bloomRadius: 0.15,
    bloomThreshold: 1.2, // only HDR colors (beam core, awake puffs, sparkles) glow; pastel surfaces stay crisp
    hitstopMs: 90,
    reflectSparkles: 3, // particles per bounce per emission tick
    sparkleEvery: 0.07, // seconds between bounce-sparkle emissions
    confettiCount: 90,
    levelClearDelay: 1.8, // seconds before next level loads
    pixel: {
      enabled: true, // X toggles it in-game
      size: 3, // screen pixels per "art pixel" (bigger = chunkier)
      levels: 28, // color steps per channel (lower = more posterized)
      dither: 0.55, // ordered-dither strength (0 = hard banding)
      scanlines: 0.07,
      curvature: 0.03, // CRT bulge; input is un-warped to match
      vignette: 0.28,
      aberration: 1.2, // chromatic fringe in screen pixels
    },
  },

  voice: {
    enabled: true, // V toggles in-game
    volume: 0.9,
    narrator: { pitch: 1.1, rate: 1.0 },
    puff: { pitch: 1.9, rate: 1.15 },
    puffCooldown: 1.2, // seconds between puff lines
  },

  audio: {
    master: 0.5,
    chime: 0.35,
    charge: 0.18,
    ui: 0.3,
    // C major pentatonic, two octaves
    scale: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0],
  },
};
