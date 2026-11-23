"""Pack heightmap_refined.npy into the game-core height module.

Re-run after the Pacific Islands heightmap changes:

    python tools/blender/export_pacific_heights.py
"""
from __future__ import annotations

import base64
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
NPY = ROOT / "assets" / "maps" / "pacific_islands" / "heightmap_refined.npy"
OUT = ROOT / "packages" / "game-core" / "src" / "world" / "pacificHeights.ts"


def main() -> None:
    height = np.load(NPY)
    if height.ndim != 2 or height.shape[0] != height.shape[1]:
        raise SystemExit(f"expected square heightmap, got {height.shape}")
    hmin = float(height.min())
    hmax = float(height.max())
    span = max(hmax - hmin, 1e-6)
    u16 = np.clip((height.astype(np.float64) - hmin) / span * 65535.0, 0, 65535).astype("<u2")
    b64 = base64.b64encode(np.ascontiguousarray(u16).tobytes()).decode("ascii")
    wrapped = ",\n".join(f'  "{b64[i:i+120]}"' for i in range(0, len(b64), 120))
    OUT.write_text(
        "\n".join(
            [
                "/** Baked Pacific Islands heightfield. Regenerate with tools/blender/export_pacific_heights.py */",
                f"export const PACIFIC_RES = {height.shape[0]};",
                f"export const PACIFIC_HMIN = {hmin!r};",
                f"export const PACIFIC_HMAX = {hmax!r};",
                "const B64 = [",
                wrapped,
                "].join('');",
                "function decodeU16(b64: string): Uint16Array {",
                "  const bin = atob(b64);",
                "  const bytes = new Uint8Array(bin.length);",
                "  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);",
                "  return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);",
                "}",
                "export const PACIFIC_U16: Uint16Array = decodeU16(B64);",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes) range {hmin:.1f}..{hmax:.1f}")


if __name__ == "__main__":
    main()
