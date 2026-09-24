# Beat-synced gameplay video

Renders a 28 s run through all 8 levels, cut to a 77 BPM grid (9 bars: title card, then one level per bar). Puffs wake on beat 3 and each new level lands on a downbeat, with zoom punches on every beat. It has a TTS tutorial voice, the puffs' own voices, and game SFX. **There's no music: add your own licensed track in your editor, with its first downbeat at 0:00.**

## One-time setup

```bash
pip install pillow numpy scipy espeakng-loader imageio-ffmpeg
npm i -D playwright && npx playwright install chromium   # or reuse an existing Chromium via CHROMIUM=/path
```

## Render

```bash
python3 -m http.server 8765 &          # serve the repo
node tools/video/capture.mjs            # ~10 min with software rendering; frames + sfx.wav + timeline.json
python3 tools/video/mux.py              # voices, mix, subtitles, MP4s
```

Everything lands in `video-out/`: `prism-puff-28s.mp4`, a `-click` version for checking sync, stems (`voices.wav`, `sfx.wav`, `click-77bpm.wav`), `prism-puff-28s.srt` and `script.txt`.

## Changing the edit

`edit.json` holds the BPM, bar count, fps/size, the callout text per bar, and the game tweaks used while capturing (faster charge/reveal so a level fits in a bar). The autopilot in `capture.mjs` schedules every mirror turn on the eighth-note grid, so the last turn in each level lands so that the puffs wake on beat 3.
