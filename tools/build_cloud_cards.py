"""Paint two cumulus cards with soft alpha for the flight sky.

Run:
  blender --background --python tools/build_cloud_cards.py
"""

from __future__ import annotations

import math
import os
import random
import shutil
import struct
import zlib

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC = os.path.join(ROOT, "apps", "web", "public", "sky")
ASSETS = os.path.join(ROOT, "assets", "sky")
SIZE = 512


def fade(t: float) -> float:
    return t * t * t * (t * (t * 6 - 15) + 10)


def value_noise(x: float, y: float, seed: int) -> float:
    x0 = math.floor(x)
    y0 = math.floor(y)
    xf = x - x0
    yf = y - y0

    def h(ix: int, iy: int) -> float:
        n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) & 0xFFFFFFFF
        n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
        return (n & 0xFFFFFF) / 0xFFFFFF

    v00 = h(x0, y0)
    v10 = h(x0 + 1, y0)
    v01 = h(x0, y0 + 1)
    v11 = h(x0 + 1, y0 + 1)
    u = fade(xf)
    v = fade(yf)
    return (v00 * (1 - u) + v10 * u) * (1 - v) + (v01 * (1 - u) + v11 * u) * v


def fbm(x: float, y: float, seed: int) -> float:
    total = 0.0
    amp = 0.55
    freq = 1.0
    norm = 0.0
    for i in range(5):
        total += amp * value_noise(x * freq, y * freq, seed + i * 17)
        norm += amp
        freq *= 2.05
        amp *= 0.5
    return total / norm


def smooth(edge0: float, edge1: float, x: float) -> float:
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def blob(px: float, py: float, cx: float, cy: float, rx: float, ry: float) -> float:
    dx = (px - cx) / rx
    dy = (py - cy) / ry
    d = math.sqrt(dx * dx + dy * dy)
    return smooth(1.0, 0.15, d)


def paint(seed: int, kind: str) -> bytes:
    rng = random.Random(seed)
    # Round puffs. rx ~= ry so the card is a soft ball, not a flattened bank.
    core = 0.32 if kind == "tower" else 0.28
    blobs = [(0.50, 0.50, core, core)]
    count = 6 if kind == "tower" else 5
    spread = 0.14 if kind == "tower" else 0.12
    for _ in range(count):
        ang = rng.random() * math.tau
        dist = rng.uniform(0.02, spread)
        radius = rng.uniform(0.12, 0.20)
        blobs.append(
            (
                0.50 + math.cos(ang) * dist,
                0.50 + math.sin(ang) * dist,
                radius,
                radius * rng.uniform(0.92, 1.08),
            )
        )

    raw = bytearray()
    for y in range(SIZE - 1, -1, -1):
        raw.append(0)
        row = bytearray()
        py = y / (SIZE - 1)
        for x in range(SIZE):
            px = x / (SIZE - 1)
            dens = 0.0
            for cx, cy, rx, ry in blobs:
                dens = max(dens, blob(px, py, cx, cy, rx, ry))
            n = fbm(px * 2.4 + seed, py * 2.4, seed)
            dens *= 0.72 + 0.38 * n
            alpha = smooth(0.28, 0.7, dens)
            shade = max(0.0, min(1.0, 0.78 + dens * 0.22 + (n - 0.5) * 0.08))
            r = int(shade * 255)
            g = int(min(1.0, shade * 0.99 + 0.01) * 255)
            b = int(min(1.0, shade * 0.96 + 0.03) * 255)
            a = int(alpha * 255)
            row.extend((r, g, b, a))
        raw.extend(row)
    return png_rgba(SIZE, SIZE, bytes(raw))


def png_chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png_rgba(w: int, h: int, raw: bytes) -> bytes:
    return b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            png_chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)),
            png_chunk(b"IDAT", zlib.compress(raw, 9)),
            png_chunk(b"IEND", b""),
        ]
    )


def write_pair(name: str, data: bytes) -> None:
    os.makedirs(PUBLIC, exist_ok=True)
    os.makedirs(ASSETS, exist_ok=True)
    public = os.path.join(PUBLIC, name)
    asset = os.path.join(ASSETS, name)
    with open(public, "wb") as f:
        f.write(data)
    shutil.copyfile(public, asset)
    print(f"[cloud] {public} ({len(data)} bytes)", flush=True)


def main() -> None:
    # Touch Blender so this stays a Blender-side asset build, not a loose script.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    write_pair("cloud_a.png", paint(11, "tower"))
    write_pair("cloud_b.png", paint(29, "bank"))


if __name__ == "__main__":
    main()
