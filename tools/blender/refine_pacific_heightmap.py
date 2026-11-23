"""
High-quality Pacific Islands heightmap + colormap (16km).
Numpy vectorized — coasts via domain warp, ridges, crater, shelf.
"""
from __future__ import annotations

import math
import os
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(r"C:\Users\Gabriell\Documents\AirForceDashi\assets\maps\pacific_islands")
RES = 513  # authoring res (fast); upsample later if needed
WORLD = 16000.0
HALF = WORLD * 0.5
SEED = 42


def hash2(ix: np.ndarray, iy: np.ndarray, seed: float = 0.0) -> np.ndarray:
    # deterministic hash → [0,1)
    s = np.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453
    return s - np.floor(s)


def smooth(t: np.ndarray) -> np.ndarray:
    return t * t * (3.0 - 2.0 * t)


def value_noise(x: np.ndarray, y: np.ndarray, seed: float) -> np.ndarray:
    x0 = np.floor(x)
    y0 = np.floor(y)
    xf = x - x0
    yf = y - y0
    u = smooth(xf)
    v = smooth(yf)
    n00 = hash2(x0, y0, seed)
    n10 = hash2(x0 + 1, y0, seed)
    n01 = hash2(x0, y0 + 1, seed)
    n11 = hash2(x0 + 1, y0 + 1, seed)
    nx0 = n00 * (1 - u) + n10 * u
    nx1 = n01 * (1 - u) + n11 * u
    return nx0 * (1 - v) + nx1 * v


def fbm(x, y, octaves=5, lac=2.0, gain=0.5, seed=0.0):
    amp = 1.0
    freq = 1.0
    total = np.zeros_like(x, dtype=np.float64)
    norm = 0.0
    for i in range(octaves):
        total += value_noise(x * freq, y * freq, seed + i * 19.1) * amp
        norm += amp
        amp *= gain
        freq *= lac
    return total / norm


def ridged(x, y, octaves=5, seed=0.0):
    amp = 1.0
    freq = 1.0
    total = np.zeros_like(x, dtype=np.float64)
    norm = 0.0
    for i in range(octaves):
        n = 1.0 - np.abs(value_noise(x * freq, y * freq, seed + i * 23.7) * 2 - 1)
        n = n * n
        total += n * amp
        norm += amp
        amp *= 0.5
        freq *= 2.0
    return total / norm


def island_field(x, y, cx, cy, rx, ry, warp_amt=0.22, seed=1.0):
    """Soft irregular island mask with domain-warped shoreline."""
    # domain warp in meters-normalized space
    nx = (x - cx) / rx
    ny = (y - cy) / ry
    wx = fbm(nx * 1.6 + 10, ny * 1.6, 4, seed=seed) * 2 - 1
    wy = fbm(nx * 1.6 + 40, ny * 1.6, 4, seed=seed + 5) * 2 - 1
    nx2 = nx + warp_amt * wx
    ny2 = ny + warp_amt * wy
    # add lobe noise for bays / peninsulas
    lobes = 0.18 * (fbm(nx2 * 2.4, ny2 * 2.4, 3, seed=seed + 9) * 2 - 1)
    r = np.sqrt(nx2 * nx2 + ny2 * ny2) + lobes
    # smooth edge
    edge0, edge1 = 0.62, 1.08
    t = np.clip((r - edge0) / (edge1 - edge0), 0, 1)
    mask = 1.0 - t * t * (3 - 2 * t)
    mask = np.where(r >= edge1, 0.0, mask)
    mask = np.where(r <= edge0, 1.0, mask)
    return np.clip(mask, 0, 1)


def main():
    print("start refine", RES, flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)

    # world coords
    u = np.linspace(-HALF, HALF, RES)
    x, y = np.meshgrid(u, u)

    # Island defs — organic layout (not a ring), inspired by reference
    islands = [
        # Main large — irregular, with volcanic crater NE of airbase
        dict(name="main", cx=-400, cy=-200, rx=3600, ry=2800, peak=1800, warp=0.28, seed=11, kind="main"),
        # Western chain (3 stepped)
        dict(name="west_n", cx=-5200, cy=4200, rx=1400, ry=1100, peak=380, warp=0.30, seed=21, kind="sec"),
        dict(name="west_m", cx=-5600, cy=1800, rx=1200, ry=900, peak=260, warp=0.32, seed=22, kind="sec"),
        dict(name="west_s", cx=-4800, cy=-900, rx=900, ry=700, peak=220, warp=0.30, seed=23, kind="sec"),
        # SE rugged
        dict(name="se", cx=4200, cy=-4200, rx=1800, ry=1500, peak=720, warp=0.26, seed=31, kind="sec"),
        # NE village / flatter
        dict(name="ne", cx=3800, cy=3600, rx=1300, ry=1000, peak=240, warp=0.34, seed=41, kind="sec"),
        # North mountain / radar ridge
        dict(name="north", cx=600, cy=5200, rx=1100, ry=900, peak=980, warp=0.24, seed=51, kind="sec"),
        # East radar islet
        dict(name="east", cx=5600, cy=-200, rx=900, ry=700, peak=340, warp=0.28, seed=61, kind="sil"),
        # SW wild silhouette
        dict(name="sw", cx=-5400, cy=-5000, rx=700, ry=550, peak=140, warp=0.35, seed=71, kind="sil"),
        # tiny outliers (like reference islets)
        dict(name="islet_a", cx=2200, cy=5600, rx=350, ry=280, peak=60, warp=0.4, seed=81, kind="sil"),
        dict(name="islet_b", cx=-2000, cy=5800, rx=300, ry=250, peak=45, warp=0.4, seed=82, kind="sil"),
        dict(name="islet_c", cx=5800, cy=-5600, rx=280, ry=220, peak=40, warp=0.4, seed=83, kind="sil"),
    ]

    height = np.full((RES, RES), -55.0, dtype=np.float64)
    land = np.zeros((RES, RES), dtype=np.float64)

    # continental shelf gently rising near any land later
    for isl in islands:
        m = island_field(x, y, isl["cx"], isl["cy"], isl["rx"], isl["ry"], isl["warp"], isl["seed"])
        land = np.maximum(land, m)

        detail = fbm(x * 0.00025, y * 0.00025, 5, seed=isl["seed"] + 100)
        ridge = ridged(x * 0.00035, y * 0.00035, 5, seed=isl["seed"] + 200)

        if isl["kind"] == "main":
            # volcanic peak + crater
            px, py = 500.0, 400.0
            d = np.sqrt((x - px) ** 2 + (y - py) ** 2)
            peak = np.exp(-(d / 2600.0) ** 2) * isl["peak"]
            # crater bowl
            crater_r = 520.0
            crater = np.clip(1.0 - np.abs(d - crater_r) / 180.0, 0, 1)
            peak = peak - crater * 280.0 * np.exp(-((d - crater_r) / 260.0) ** 2)
            # secondary ridges
            peak = peak * (0.55 + 0.45 * ridge) + 180 * detail * m
            # airbase plateau flatten
            ax, ay = -1800.0, -900.0
            dpad = np.sqrt((x - ax) ** 2 + (y - ay) ** 2)
            flat = np.clip(1.0 - dpad / 1600.0, 0, 1) ** 1.4
            peak = peak * (1.0 - 0.93 * flat) + 14.0 * flat
            h = peak * m
        elif isl["name"] == "north":
            h = isl["peak"] * m * (0.4 + 0.6 * ridge)
        elif isl["name"] == "se":
            h = isl["peak"] * m * (0.35 + 0.65 * ridge) + 80 * detail * m
        else:
            h = isl["peak"] * m * (0.45 + 0.55 * (0.5 + detail))

        height = np.maximum(height, h)

    # shallow shelf around land
    shelf = land.copy()
    # dilate-ish via blur-like downsample upsample approximation: soft max with noise
    shelf_h = -6.0 + 22.0 * np.clip(land * 1.4, 0, 1)
    height = np.where((land > 0.02) & (height < 2), np.maximum(height, shelf_h), height)

    # seabed variation
    seabed = -48.0 + 22.0 * fbm(x * 0.00007, y * 0.00007, 4, seed=9)
    height = np.where(land < 0.01, seabed, height)

    # tiny rock islets scatter
    for _ in range(18):
        cx = float(rng.uniform(-7000, 7000))
        cy = float(rng.uniform(-7000, 7000))
        # skip if already on land
        ix = int((cx + HALF) / WORLD * (RES - 1))
        iy = int((cy + HALF) / WORLD * (RES - 1))
        if 0 <= ix < RES and 0 <= iy < RES and land[iy, ix] > 0.15:
            continue
        rr = float(rng.uniform(80, 220))
        m = island_field(x, y, cx, cy, rr, rr * 0.8, 0.45, float(rng.uniform(1, 99)))
        height = np.maximum(height, m * float(rng.uniform(8, 35)))

    hmin = float(height.min())
    hmax = float(height.max())
    print(f"height range {hmin:.1f} .. {hmax:.1f}")
    land_pct = 100.0 * float(np.mean(height > 0.5))
    print(f"land% ~ {land_pct:.1f}")

    # normalized heightmap 0..1
    span = max(hmax - hmin, 1e-3)
    hn = (height - hmin) / span
    hm_u8 = (np.clip(hn, 0, 1) * 65535).astype(np.uint16)
    # save 16-bit PNG via raw stretch to 8-bit for Blender simplicity + float npy
    hm8 = (np.clip(hn, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(hm8, mode="L").save(OUT / "heightmap_refined.png")
    np.save(OUT / "heightmap_refined.npy", height.astype(np.float32))
    np.save(OUT / "heightmap_meta.npy", np.array([hmin, hmax, span, float(RES)], dtype=np.float32))

    # colormap: deep / shallow / sand / grass / jungle / rock / peak
    color = np.zeros((RES, RES, 3), dtype=np.uint8)
    deep = height < -8
    shallow = (height >= -8) & (height < 1.5)
    sand = (height >= 1.5) & (height < 35)
    grass = (height >= 35) & (height < 220)
    jungle = (height >= 220) & (height < 700)
    rock = (height >= 700) & (height < 1400)
    peak = height >= 1400

    color[deep] = (8, 28, 70)
    color[shallow] = (40, 150, 170)
    color[sand] = (194, 178, 128)
    color[grass] = (62, 120, 48)
    color[jungle] = (28, 78, 36)
    color[rock] = (110, 100, 90)
    color[peak] = (230, 230, 225)
    # slope darkening approx via gradient
    gy, gx = np.gradient(height)
    slope = np.sqrt(gx * gx + gy * gy)
    slope_n = np.clip(slope / 40.0, 0, 1)[..., None]
    color = (color.astype(np.float32) * (1.0 - 0.35 * slope_n)).astype(np.uint8)
    Image.fromarray(color, mode="RGB").save(OUT / "colormap_refined.png")

    # also write a quick top preview from colormap (non-Blender)
    preview = color.copy()
    Image.fromarray(preview, mode="RGB").resize((2048, 2048), Image.Resampling.LANCZOS).save(
        OUT / "preview_top_hq.png"
    )
    print("wrote", OUT)
    print("files:", list(OUT.glob("*")))


if __name__ == "__main__":
    main()
