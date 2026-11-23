"""Paint soft cotton-ball cumulus cards (round silhouette, no spikes).

Run:
  python tools/build_cloud_cards.py
"""

from __future__ import annotations

import math
import os
import shutil
import struct
import zlib

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


def fbm(x: float, y: float, seed: int, octaves: int = 3) -> float:
    total = 0.0
    amp = 0.5
    freq = 1.0
    norm = 0.0
    for i in range(octaves):
        total += amp * value_noise(x * freq, y * freq, seed + i * 19)
        norm += amp
        freq *= 2.0
        amp *= 0.5
    return total / max(norm, 1e-6)


def smooth(edge0: float, edge1: float, x: float) -> float:
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def paint(seed: int, rx: float, ry: float) -> bytes:
    """Nearly circular soft puff. Tiny edge wobble only — never star/diamond tips."""
    raw = bytearray()
    for y in range(SIZE - 1, -1, -1):
        raw.append(0)
        row = bytearray()
        py = y / (SIZE - 1)
        for x in range(SIZE):
            px = x / (SIZE - 1)
            dx = (px - 0.5) / rx
            dy = (py - 0.50) / ry
            r2 = dx * dx + dy * dy
            radius = math.sqrt(r2)

            # Very mild domain warp (keeps silhouette round).
            n = fbm(px * 1.8 + seed * 0.03, py * 1.8, seed, 3)
            warp = 1.0 + (n - 0.5) * 0.06
            d = radius / warp

            # Cosine-like soft disc — no hard lobes.
            dens = 0.0
            if d < 1.0:
                # smootherstep falloff from core to rim
                dens = smooth(1.0, 0.22, d)
                dens = dens * dens * (3.0 - 2.0 * dens)

            n_body = fbm(px * 2.0 + 2.2, py * 2.0, seed + 5, 3)
            dens *= 0.90 + 0.12 * n_body

            alpha = dens
            shade = max(0.0, min(1.0, 0.88 + dens * 0.10 + (0.5 - py) * 0.06 + (n_body - 0.5) * 0.03))
            r = int(shade * 255)
            g = int(min(1.0, shade * 0.995 + 0.004) * 255)
            b = int(min(1.0, shade * 0.975 + 0.015) * 255)
            a = int(max(0.0, min(1.0, alpha)) * 255)
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
            png_chunk(b"IDAT", zlib.compress(raw, 6)),
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
    # Round cotton balls — slight aspect variation only.
    write_pair("cloud_a.png", paint(11, rx=0.36, ry=0.34))
    write_pair("cloud_b.png", paint(29, rx=0.40, ry=0.34))
    write_pair("cloud_c.png", paint(47, rx=0.34, ry=0.34))
    write_pair("cloud_d.png", paint(63, rx=0.38, ry=0.33))


if __name__ == "__main__":
    main()
