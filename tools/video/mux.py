"""Mix voices + game SFX and encode the captured frames into the final video.

    python3 tools/video/mux.py        (after tools/video/capture.mjs)

Writes to video-out/:
  prism-puff-28s.mp4            the edit: gameplay + tutor voice + puff voices + SFX, NO music
  prism-puff-28s-click.mp4      same, with a 77 BPM click so you can check sync before adding your song
  voices.wav, sfx.wav, click-77bpm.wav   stems for your editor
  prism-puff-28s.srt            subtitles for every spoken line
  script.txt                    who says what, when
"""
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
import imageio_ffmpeg

sys.path.insert(0, str(Path(__file__).parent))
from tts import synth, save_wav, RATE  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'video-out'
EDIT = json.loads((ROOT / 'tools/video/edit.json').read_text())
TL = json.loads((OUT / 'timeline.json').read_text())
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

BEAT = 60 / EDIT['bpm']
DUR = TL['duration']
N = int(round(DUR * RATE))


def read_wav(path):
    with wave.open(str(path)) as w:
        ch, sr = w.getnchannels(), w.getframerate()
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    a = a.reshape(-1, ch)
    if ch == 1:
        a = np.repeat(a, 2, axis=1)
    assert sr == RATE, f'{path} is {sr} Hz'
    out = np.zeros((N, 2), np.float32)
    out[:min(N, len(a))] = a[:N]
    return out


def place(track, clip, t, gain=1.0):
    i = int(round(t * RATE))
    j = min(N, i + len(clip))
    if i < N:
        track[i:j] += clip[: j - i, None] * gain


# ---- voices: tutor callout at each bar + the puffs' own lines from the game log
voices = np.zeros((N, 2), np.float32)
spoken = []
for line in TL['tutor']:
    clip = synth(line['text'], 'tutor')
    place(voices, clip, line['t'], 0.95)
    spoken.append((line['t'], len(clip) / RATE, 'Narrator', line['text']))
    if len(clip) / RATE > BEAT * 4:
        print(f"warning: tutor line runs past its bar ({len(clip) / RATE:.2f}s): {line['text']}")
for v in TL['voice']:
    if v['who'] != 'puff':
        continue  # the tutor voice replaces the in-game narrator in the video
    clip = synth(v['text'], 'puff')
    place(voices, clip, v['t'], 0.75)
    spoken.append((v['t'], len(clip) / RATE, 'Puff', v['text']))
spoken.sort()

# ---- SFX, ducked a little under speech
sfx = read_wav(OUT / 'sfx.wav')
env = np.abs(voices[:, 0])
win = int(0.08 * RATE)
env = np.convolve(env, np.ones(win) / win, mode='same')
duck = 1 - 0.45 * np.clip(env * 12, 0, 1)
sfx *= duck[:, None]

# ---- 77 BPM click (accented downbeats) for sync checking
click = np.zeros((N, 2), np.float32)
tt = np.arange(int(0.03 * RATE)) / RATE
for b in range(int(DUR / BEAT) + 1):
    f = 1600 if b % EDIT['beatsPerBar'] == 0 else 1000
    tick = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 120)
    place(click, tick.astype(np.float32), b * BEAT, 0.6 if b % 4 == 0 else 0.35)

mix = voices + sfx
peak = max(1e-6, np.abs(mix).max())
if peak > 0.98:
    mix *= 0.98 / peak


def save_stereo(path, a):
    save_wav(path, a.reshape(-1), channels=2)


save_stereo(OUT / 'voices.wav', voices)
save_stereo(OUT / 'sfx.wav', sfx)
save_stereo(OUT / 'click-77bpm.wav', click)
save_stereo(OUT / 'mix.wav', mix)
save_stereo(OUT / 'mix-click.wav', np.clip(mix + click, -1, 1))


def ts(t, sep=','):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f'{int(h):02d}:{int(m):02d}:{s:06.3f}'.replace('.', sep)


srt, script = [], []
for i, (t, d, who, text) in enumerate(spoken, 1):
    srt.append(f'{i}\n{ts(t)} --> {ts(min(DUR, t + d))}\n{text}\n')
    script.append(f'{t:6.2f}s  (beat {t / BEAT:5.2f})  {who:8s} {text}')
(OUT / 'prism-puff-28s.srt').write_text('\n'.join(srt))
(OUT / 'script.txt').write_text(
    f"Prism Puff 28s edit at {EDIT['bpm']} BPM ({BEAT:.4f}s per beat). Level n starts on bar n (bar = {BEAT * 4:.4f}s).\n"
    'Put your song so its first downbeat is at 0:00.\n\n' + '\n'.join(script) + '\n')

for audio, name in (('mix.wav', 'prism-puff-28s.mp4'), ('mix-click.wav', 'prism-puff-28s-click.mp4')):
    subprocess.run([FFMPEG, '-v', 'error', '-y', '-framerate', str(EDIT['fps']), '-i', str(OUT / 'frames/%05d.png'),
                    '-i', str(OUT / audio), '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '192k', '-t', f'{DUR:.4f}', '-movflags', '+faststart', str(OUT / name)], check=True)
    print('wrote', OUT / name)
