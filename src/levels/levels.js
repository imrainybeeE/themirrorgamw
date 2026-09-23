// Level data. Field is 16 x 10 world units: x in [-8, 8], z in [-5, 5] (negative z = top of screen).
// Angles are radians. Mirrors are lines, so an angle and angle + PI are the same mirror.
//
//   emitter:  {x, z, angle}
//   mirrors:  {x, z, angle, solution?, rotatable = true, length?}
//             `solution` is only used by tests, the ?debug solve key and aim-assist tuning.
//   targets:  {x, z, r?}          sleepy puffs; light passes through them
//   blockers: {x, z, w, h}        fluffy clouds that stop light
//
// To add a level: copy one below, move things around, open with ?debug&level=N,
// press S to snap to the solution and check it lights everything. `npm test` checks every
// level is solvable with its `solution` angles and not already solved at the start.

export const LEVELS = [
  {
    name: 'Hello, Light',
    hint: 'Pinch the mirror and twist your hand',
    emitter: { x: -6, z: 0, angle: 0 },
    mirrors: [{ x: 0, z: 0, angle: 1.7, solution: 2.3562 }],
    targets: [{ x: 0, z: -3.5 }],
  },
  {
    name: 'Tilt a Little',
    hint: 'Small twists make big turns',
    emitter: { x: -6, z: 3, angle: 0 },
    mirrors: [{ x: 2, z: 3, angle: 0.9, solution: 2.0283 }],
    targets: [{ x: -3, z: -3.5 }],
  },
  {
    name: 'Pass it On',
    hint: 'Light can bounce twice!',
    emitter: { x: -6, z: -3, angle: 0 },
    mirrors: [
      { x: 4, z: -3, angle: 1.6, solution: 0.7438 },
      { x: 4.5, z: 3, angle: 1.3, solution: 2.3409 },
    ],
    targets: [{ x: -5, z: 2.5 }],
  },
  {
    name: 'Two Sleepyheads',
    hint: 'Light shines right through puffs',
    emitter: { x: -7, z: 2, angle: 0 },
    mirrors: [
      { x: 0, z: 2, angle: 1.9, solution: 2.7489 },
      { x: 5, z: -3, angle: 0.3, solution: 1.2058 },
    ],
    targets: [{ x: 2.5, z: -0.5 }, { x: -4, z: -3.5 }],
  },
  {
    name: 'Stubborn Mirror',
    hint: 'Striped mirrors are stuck in place',
    emitter: { x: -7, z: -3, angle: 0 },
    mirrors: [
      { x: 3, z: -3, angle: 0.7854, rotatable: false },
      { x: 3, z: 3.5, angle: 1.6, solution: 2.5076 },
    ],
    targets: [{ x: -5, z: 1 }],
  },
  {
    name: 'Cloudy Day',
    hint: 'Clouds swallow light. Go around!',
    emitter: { x: -7, z: 0, angle: 0 },
    mirrors: [
      { x: -4, z: 0, angle: 1.8, solution: 2.588 },
      { x: -2, z: -4, angle: 2.0, solution: 2.8582 },
    ],
    targets: [{ x: 5.5, z: 0.5 }],
    blockers: [{ x: 0.5, z: 0.5, w: 2.4, h: 2 }],
  },
  {
    name: 'Zig Zag',
    hint: '',
    emitter: { x: -7, z: 4, angle: 0 },
    mirrors: [
      { x: -3, z: 4, angle: 1.4, solution: 2.2852 },
      { x: -4, z: -3, angle: 1.5, solution: 2.3474 },
      { x: 4, z: -2, angle: 1.7, solution: 0.6732 },
    ],
    targets: [{ x: 0, z: -2.5 }, { x: 6, z: 3.5 }],
    blockers: [{ x: 1.5, z: 2, w: 2, h: 1.4 }],
  },
  {
    name: 'Starlight Parade',
    hint: 'Wake everyone up!',
    emitter: { x: -7, z: -4, angle: 0.1974 },
    mirrors: [
      { x: -2, z: -3, angle: 1.4, solution: 0.5562 },
      { x: 3, z: 3.5, angle: 2.2, solution: 3.0456 },
      { x: 6.5, z: -3.5, angle: 1.9, solution: 0.7232 },
      { x: -1, z: 1.5, angle: 1.2, solution: 2.6158 },
    ],
    targets: [{ x: 1.5, z: 1.55 }, { x: 3.5, z: -1.5 }, { x: -6, z: 4 }],
  },
];
