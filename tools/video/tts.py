"""Offline text-to-speech with eSpeak NG (via the espeakng-loader wheel), styled "cute retro".

    python3 tools/video/tts.py "Hello there" out.wav --who narrator

Import use: synth(text, who) -> (samples float32 mono @ 48 kHz).
Needs: pip install espeakng-loader imageio-ffmpeg numpy
"""
import ctypes
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
import espeakng_loader
import imageio_ffmpeg

RATE = 48000
# Voice styles. eSpeak pitch/range are 0-100; the ffmpeg chain adds the cute pitch-up + echo.
STYLES = {
    'narrator': dict(voice='en-us+m3', rate=150, pitch=55, range=70, shift=1.12, echo='0.8:0.6:40:0.18'),
    'tutor': dict(voice='en-us+f2', rate=155, pitch=60, range=80, shift=1.08, echo='0.8:0.5:35:0.12'),
    'puff': dict(voice='en-us+f4', rate=175, pitch=85, range=95, shift=1.45, echo='0.8:0.6:25:0.2'),
}

_lib = None
_rate = 22050
_chunks = []
_CB = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)


@_CB
def _collect(wav, n, events):
    if n > 0:
        _chunks.append(np.ctypeslib.as_array(wav, shape=(n,)).copy())
    return 0


def _init():
    global _lib, _rate
    if _lib:
        return
    _lib = ctypes.CDLL(espeakng_loader.get_library_path())
    _lib.espeak_Initialize.restype = ctypes.c_int
    _rate = _lib.espeak_Initialize(2, 0, espeakng_loader.get_data_path().encode(), 0)  # AUDIO_OUTPUT_SYNCHRONOUS
    if _rate <= 0:
        raise RuntimeError('espeak_Initialize failed')
    _lib.espeak_SetSynthCallback(_collect)


def _raw(text, style):
    _init()
    _chunks.clear()
    _lib.espeak_SetVoiceByName(style['voice'].encode())
    _lib.espeak_SetParameter(1, style['rate'], 0)   # espeakRATE
    _lib.espeak_SetParameter(3, style['pitch'], 0)  # espeakPITCH
    _lib.espeak_SetParameter(4, style['range'], 0)  # espeakRANGE
    data = text.encode('utf-8') + b'\0'
    _lib.espeak_Synth(data, len(data), 0, 1, 0, 0x1000, None, None)  # POS_CHARACTER, espeakENDPAUSE
    _lib.espeak_Synchronize()
    return (np.concatenate(_chunks) if _chunks else np.zeros(1, np.int16)).astype(np.int16)


def synth(text, who='narrator'):
    """Returns float32 mono samples at 48 kHz."""
    style = STYLES[who]
    raw = _raw(text, style)
    # Pitch up without changing speed (asetrate + atempo), add a soft echo, resample to 48k.
    af = (f"asetrate={int(_rate * style['shift'])},atempo={1 / style['shift']:.4f},"
          f"aecho={style['echo']},highpass=f=90,aresample={RATE},volume=1.6")
    cmd = [imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-f', 's16le', '-ar', str(_rate), '-ac', '1', '-i', '-',
           '-af', af, '-f', 'f32le', '-ac', '1', '-']
    out = subprocess.run(cmd, input=raw.tobytes(), capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).copy()


def save_wav(path, samples, channels=1):
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())


if __name__ == '__main__':
    text, out = sys.argv[1], Path(sys.argv[2])
    who = sys.argv[4] if len(sys.argv) > 4 and sys.argv[3] == '--who' else 'narrator'
    s = synth(text, who)
    save_wav(out, s)
    print(f'{out}: {len(s) / RATE:.2f}s')
