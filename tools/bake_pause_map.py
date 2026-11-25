"""Bake the pause tacmap from the live Pacific heightfield.

Ocean RGB must match --map-ocean-color in apps/web/src/reestilo-telas.css.
"""
from __future__ import annotations

import base64
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
HEIGHTS = ROOT / "packages" / "game-core" / "src" / "world" / "pacificHeights.ts"
OUT = ROOT / "apps" / "web" / "public" / "maps" / "pacific_islands" / "map.png"

RES = 513
HMAX = 1662.8699951171875
WORLD = 16000.0
HALF = WORLD * 0.5

# Locked to CSS --map-ocean-color
OCEAN = np.array([10, 56, 82], dtype=np.float32)  # #0A3852
SHELF = np.array([16, 72, 98], dtype=np.float32)  # #104862
SAND = np.array([196, 176, 122], dtype=np.float32)
GRASS = np.array([74, 138, 52], dtype=np.float32)
JUNGLE = np.array([28, 92, 40], dtype=np.float32)
ROCK = np.array([118, 108, 96], dtype=np.float32)
PEAK = np.array([232, 230, 224], dtype=np.float32)
RUNWAY = (214, 210, 198)
TAXI = (168, 164, 152)


def load_heights() -> np.ndarray:
    text = HEIGHTS.read_text(encoding="utf-8")
    b64 = "".join(re.findall(r'"([A-Za-z0-9+/=]{8,})"', text))
    raw = base64.b64decode(b64)
    u16 = np.frombuffer(raw, dtype="<u2")
    if u16.size != RES * RES:
        raise SystemExit(f"expected {RES*RES} samples, got {u16.size}")
    h = u16.reshape(RES, RES).astype(np.float32) / 65535.0 * HMAX
    return h


def world_to_px(x: float, z: float) -> tuple[int, int]:
    ix = int(round((x + HALF) / WORLD * (RES - 1)))
    iz = int(round((z + HALF) / WORLD * (RES - 1)))
    return ix, iz


def main() -> None:
    h = load_heights()
    color = np.empty((RES, RES, 3), dtype=np.float32)
    color[:] = OCEAN

    land = h >= 1.2
    color[land & (h < 28)] = SAND
    color[land & (h >= 28) & (h < 180)] = GRASS
    color[land & (h >= 180) & (h < 700)] = JUNGLE
    color[land & (h >= 700) & (h < 1200)] = ROCK
    color[h >= 1200] = PEAK

    # One-pixel shelf so the coast reads, still the same blue family.
    shelf = np.zeros_like(land)
    shelf[1:, :] |= land[:-1, :]
    shelf[:-1, :] |= land[1:, :]
    shelf[:, 1:] |= land[:, :-1]
    shelf[:, :-1] |= land[:, 1:]
    color[(~land) & shelf] = SHELF

    gy, gx = np.gradient(h)
    slope = np.clip(np.sqrt(gx * gx + gy * gy) / 48.0, 0, 1)[..., None]
    color = color * (1.0 - 0.28 * slope * land[..., None])
    img = Image.fromarray(np.clip(color, 0, 255).astype(np.uint8), mode="RGB")
    draw = ImageDraw.Draw(img)

    # Dashi AFB — runway 09-27 and parallel taxi (world metres).
    ax, az = -2200.0, -1800.0
    rw, rh = 3500.0, 60.0
    tw, th = 3300.0, 28.0
    x0, y0 = world_to_px(ax - rw * 0.5, az - rh * 0.5)
    x1, y1 = world_to_px(ax + rw * 0.5, az + rh * 0.5)
    draw.rectangle([x0, y0, x1, y1], fill=RUNWAY)
    tz = az + 95.0
    tx0, ty0 = world_to_px(ax - tw * 0.5, tz - th * 0.5)
    tx1, ty1 = world_to_px(ax + tw * 0.5, tz + th * 0.5)
    draw.rectangle([tx0, ty0, tx1, ty1], fill=TAXI)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, optimize=True)
    print("wrote", OUT, img.size)


if __name__ == "__main__":
    main()
