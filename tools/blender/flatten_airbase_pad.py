"""Flatten a large coastal pad under Dashi AFB and re-export game heights."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
NPY = ROOT / "assets" / "maps" / "pacific_islands" / "heightmap_refined.npy"
EXPORT = ROOT / "tools" / "blender" / "export_pacific_heights.py"

# Match packages/game-core/src/world/airbaseLayout.ts
CX, CZ = -2200.0, -1800.0
PAD_Y = 58.0
RX, RZ = 2100.0, 1000.0  # metres


def main() -> None:
    h = np.load(NPY).astype(np.float64)
    res = h.shape[0]
    xs = np.linspace(-8000, 8000, res)
    zs = np.linspace(-8000, 8000, res)
    X, Z = np.meshgrid(xs, zs)
    dx = (X - CX) / RX
    dz = (Z - CZ) / RZ
    d2 = dx * dx + dz * dz
    t = np.clip(1.0 - d2, 0, 1)
    t = t * t * (3 - 2 * t)
    h2 = h * (1.0 - t) + PAD_Y * t
    # Keep ocean cells wet
    ocean = h < 1.5
    h2 = np.where(ocean & (t < 0.15), h, h2)
    np.save(NPY, h2.astype(np.float32))
    print(f"flattened pad ({CX},{CZ}) y={PAD_Y} cells={int((t > 0.2).sum())}")
    print(f"center height now {float(h2[int(round((CZ+8000)/16000*(res-1))), int(round((CX+8000)/16000*(res-1)))]):.1f}")
    subprocess.check_call([sys.executable, str(EXPORT)])


if __name__ == "__main__":
    main()
