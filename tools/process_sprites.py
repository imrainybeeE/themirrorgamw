"""Turn hand-drawn puff sketches into game textures.

Input: a drawing with a round face in the middle and scribbles around it.
Output (per drawing, all 512x512, aligned so faces overlap between drawings):
  <name>_face.png  the face disc: white body, dark ink, transparent outside
  <name>_aura.png  everything outside the face (scribbles, glow) as white/colored strokes on transparent

Usage: python3 tools/process_sprites.py      (needs: pip install pillow numpy scipy)
Re-run after replacing anything in assets/sprites/src/.
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent / 'assets' / 'sprites'
SOURCES = {'puff_sleep': 'src/puff_sleep.jpg', 'puff_awake': 'src/puff_awake.png'}
OUT = 512
AURA_SCALE = 1.7  # crop half-size relative to face radius (how much scribble to keep around the face)
INK_GROW = 0.006  # thicken lines by this fraction of image width so they survive the pixel filter
INK_RGB = np.array([74, 46, 78], dtype=np.float32) / 255  # plum ink instead of pure black


def process(name, rel):
    im = Image.open(ROOT / rel).convert('RGB')
    rgb = np.asarray(im).astype(np.float32) / 255
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    ink = np.clip((0.75 - lum) / 0.5, 0, 1)  # 1 = dark line
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    yellow = np.clip(((r + g) / 2 - b - 0.25) / 0.3, 0, 1) * (lum > 0.35)

    # Face interior = light region connected to the image center, bounded by the face outline.
    h, w = lum.shape
    light = ink < 0.5
    labels, _ = ndimage.label(light)
    interior = labels == labels[h // 2, w // 2]
    interior = ndimage.binary_fill_holes(interior)  # swallow eyes and mouth
    face = ndimage.binary_dilation(interior, iterations=max(4, w // 80))  # include the outline stroke
    face = ndimage.binary_fill_holes(face)

    ys, xs = np.nonzero(face)
    cy, cx = ys.mean(), xs.mean()
    radius = np.sqrt(face.sum() / np.pi)
    half = radius * AURA_SCALE

    def crop(arr, fill):
        # Square crop around the face center, padded, resized to OUT.
        x0, y0 = int(round(cx - half)), int(round(cy - half))
        size = int(round(half * 2))
        pad = size
        padded = np.pad(arr, [(pad, pad), (pad, pad)] + [(0, 0)] * (arr.ndim - 2), constant_values=fill)
        c = padded[y0 + pad:y0 + pad + size, x0 + pad:x0 + pad + size]
        img = Image.fromarray((np.clip(c, 0, 1) * 255).astype(np.uint8))
        return np.asarray(img.resize((OUT, OUT), Image.LANCZOS)).astype(np.float32) / 255

    faceA = ndimage.gaussian_filter(face.astype(np.float32), 1.2)
    grow = max(1, int(w * INK_GROW))
    thick = ndimage.grey_dilation(ink, size=(grow * 2 + 1, grow * 2 + 1))
    thick = ndimage.gaussian_filter(thick, 0.8)
    ch = [crop(1 - thick * (1 - INK_RGB[i]), 1) for i in range(3)]  # white body, plum lines
    face_rgba = np.dstack(ch + [crop(faceA, 0)])

    outside = 1 - faceA
    # Round the aura off so it reads as a halo, not a square of scribbles.
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.hypot(xx - cx, yy - cy) / radius
    outside = outside * np.clip((AURA_SCALE * 0.95 - d) / (AURA_SCALE * 0.95 - 1.15), 0, 1)
    stroke = np.maximum(ndimage.grey_dilation(ink, size=(grow + 1, grow + 1)), yellow) * outside
    # White strokes (tinted in-engine), yellow kept as yellow so the awake glow survives.
    ar = np.ones_like(lum)
    ag = np.ones_like(lum)
    ab = 1 - yellow * 0.75
    aura_rgba = np.dstack([crop(ar, 1), crop(ag, 1), crop(ab, 1), crop(stroke, 0)])

    for suffix, arr in (('face', face_rgba), ('aura', aura_rgba)):
        Image.fromarray((arr * 255).astype(np.uint8), 'RGBA').save(ROOT / f'{name}_{suffix}.png', optimize=True)
    print(f'{name}: face center=({cx:.0f},{cy:.0f}) r={radius:.0f}px of {w}x{h}')


def make_icons():
    # App icon for iPad/phone home screens: an awake (butter) puff on a pink tile.
    face = Image.open(ROOT / 'puff_awake_face.png').convert('RGBA')
    for size in (180, 512):
        f = face.resize((int(size * 1.3), int(size * 1.3)), Image.LANCZOS)  # face fills ~75% of the tile
        r, g, b, a = f.split()
        f = Image.merge('RGBA', (r, g.point(lambda v: v * 232 // 255), b.point(lambda v: v * 163 // 255), a))
        tile = Image.new('RGBA', (size, size), (255, 214, 232, 255))
        off = (size - f.size[0]) // 2
        tile.alpha_composite(f, (off, off))
        tile.convert('RGB').save(ROOT.parent / f'icon-{size}.png', optimize=True)


if __name__ == '__main__':
    for n, p in SOURCES.items():
        process(n, p)
    make_icons()
