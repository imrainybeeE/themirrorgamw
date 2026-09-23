# Prism Puff

A cozy hand-tracking light puzzle. Pinch a mirror, twist your hand to turn it, and bounce the starlight into every sleepy puff to wake them up. Built with Three.js and MediaPipe Hands, with no build step.

## Run it

Browsers won't run the game if you double-click `index.html`, because pages opened from `file://` can't load their own script modules. Serve it on `localhost` instead:

- **Windows:** unzip the folder, then double-click **`start-game.bat`**. It starts a tiny local server (PowerShell, no install needed) and opens the game. Keep the black window open while you play.
- **Mac / Linux:** `python3 -m http.server 8000` in this folder, then open http://localhost:8000.
- **Online:** turn on GitHub Pages (repo Settings → Pages → Deploy from branch → pick this branch, `/ (root)`). You get an `https://…github.io/…` link where the webcam works and anyone can play.

Choose **Play with your hand** (webcam) or **Play with mouse** (drag around a mirror to turn it).

| Key | Action |
| --- | --- |
| `M` | mute |
| `X` | toggle the pixel/CRT filter |
| `C` | hand cam size: large, small, hidden |

Add `?debug` to the URL for the live tuning panel. It also adds `N` / `P` to change level and `S` to snap mirrors to the solution. `?level=5` starts on a given level.

## Tests

```bash
npm test
```

The tests cover the reflection math, aim assist, pinch hysteresis and twist tracking. They also check that every level can be solved with its stored `solution` angles and that no level starts already solved.

## Where things live

- `src/config.js` holds every feel knob: pinch thresholds, smoothing, rotation sensitivity, aim assist, charge time, bloom, pixel filter, sound volumes.
- `src/levels/levels.js` is the level data. Copy a level, move things, then run `npm test`.
- `src/physics/` is the pure 2D ray tracer and aim assist, with no Three.js inside so it runs in Node.
- `src/core/Game.js` has the rules and flow. It only emits events.
- `src/fx/Juice.js` turns those events into particles, sounds, hitstop and zoom. **Put new "satisfying" effects here.**
- `src/fx/PixelPass.js` is the Balatro-style pixelate, dither, scanline and CRT pass.
- `src/audio/Sfx.js` holds the synthesized sounds (no audio files).
- `src/input/` covers the webcam, MediaPipe, One Euro smoothing and the gesture-to-pointer mapping, with mouse fallback.
- `assets/sprites/` has the hand-drawn puff sprites. Sources live in `assets/sprites/src/`. After changing a drawing, run `python3 tools/process_sprites.py` (needs `pip install pillow numpy scipy`).
