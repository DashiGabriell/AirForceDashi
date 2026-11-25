"""Export the full Pacific Islands map as one GLB (terrain + vertex colors).

Source: packages/game-core/src/world/pacificHeights.ts (the live game heightfield).
"""
from __future__ import annotations

import base64
import json
import re
import struct
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
HEIGHTS = ROOT / "packages" / "game-core" / "src" / "world" / "pacificHeights.ts"
OUT = ROOT / "assets" / "maps" / "pacific_islands" / "pacific_islands_map.glb"

RES = 513
HMAX = 1662.8699951171875
WORLD = 16000.0
HALF = WORLD * 0.5


def load_heights() -> np.ndarray:
    text = HEIGHTS.read_text(encoding="utf-8")
    b64 = "".join(re.findall(r'"([A-Za-z0-9+/=]{8,})"', text))
    u16 = np.frombuffer(base64.b64decode(b64), dtype="<u2")
    if u16.size != RES * RES:
        raise SystemExit(f"expected {RES * RES} samples, got {u16.size}")
    return (u16.reshape(RES, RES).astype(np.float32) / 65535.0) * HMAX


def colors_for(h: np.ndarray) -> np.ndarray:
    c = np.empty((RES, RES, 4), dtype=np.uint8)
    c[:] = (10, 56, 82, 255)
    land = h >= 1.2
    c[land & (h < 28)] = (196, 176, 122, 255)
    c[land & (h >= 28) & (h < 180)] = (74, 138, 52, 255)
    c[land & (h >= 180) & (h < 700)] = (28, 92, 40, 255)
    c[land & (h >= 700) & (h < 1200)] = (118, 108, 96, 255)
    c[h >= 1200] = (232, 230, 224, 255)
    # Runway 09-27 and taxi, same anchors as the game.
    ax, az = -2200.0, -1800.0

    def stamp(cx: float, cz: float, w: float, d: float, rgba: tuple[int, int, int, int]) -> None:
        x0 = int(np.floor((cx - w * 0.5 + HALF) / WORLD * (RES - 1)))
        x1 = int(np.ceil((cx + w * 0.5 + HALF) / WORLD * (RES - 1)))
        z0 = int(np.floor((cz - d * 0.5 + HALF) / WORLD * (RES - 1)))
        z1 = int(np.ceil((cz + d * 0.5 + HALF) / WORLD * (RES - 1)))
        c[z0 : z1 + 1, x0 : x1 + 1] = rgba

    stamp(ax, az, 3500, 60, (214, 210, 198, 255))
    stamp(ax, az + 95, 3300, 28, (168, 164, 152, 255))
    return c


def normals_for(h: np.ndarray) -> np.ndarray:
    dz, dx = np.gradient(h, WORLD / (RES - 1))
    n = np.empty((RES, RES, 3), dtype=np.float32)
    n[..., 0] = -dx
    n[..., 1] = 1.0
    n[..., 2] = -dz
    length = np.maximum(np.linalg.norm(n, axis=2, keepdims=True), 1e-8)
    return (n / length).astype(np.float32)


def pad4(data: bytes) -> bytes:
    return data + b"\x00" * ((4 - len(data) % 4) % 4)


def main() -> None:
    h = load_heights()
    col = colors_for(h)
    xs = np.linspace(-HALF, HALF, RES, dtype=np.float32)
    zs = np.linspace(-HALF, HALF, RES, dtype=np.float32)
    xx, zz = np.meshgrid(xs, zs)
    pos = np.stack([xx, h.astype(np.float32), zz], axis=-1).reshape(-1, 3)
    nrm = normals_for(h).reshape(-1, 3)
    rgba = col.reshape(-1, 4)

    grid = np.arange(RES * RES, dtype=np.uint32).reshape(RES, RES)
    i0 = grid[:-1, :-1].reshape(-1)
    i1 = grid[:-1, 1:].reshape(-1)
    i2 = grid[1:, :-1].reshape(-1)
    i3 = grid[1:, 1:].reshape(-1)
    idx = np.empty((i0.size * 2, 3), dtype=np.uint32)
    idx[0::2, 0] = i0
    idx[0::2, 1] = i2
    idx[0::2, 2] = i1
    idx[1::2, 0] = i1
    idx[1::2, 1] = i2
    idx[1::2, 2] = i3
    indices = idx.reshape(-1)

    pos_b = pos.tobytes()
    nrm_b = nrm.tobytes()
    col_b = rgba.tobytes()
    idx_b = indices.tobytes()
    blob = pad4(pos_b + nrm_b + col_b + idx_b)

    def acc(buf, off, count, ctype, t, comps, extra=None):
        view = {"buffer": 0, "byteOffset": off, "byteLength": len(buf)}
        a = {
            "bufferView": view_i[0],
            "componentType": ctype,
            "count": count,
            "type": t,
        }
        if extra:
            a.update(extra)
        view_i[0] += 1
        return a

    # Build manually with known offsets.
    off_pos = 0
    off_nrm = off_pos + len(pos_b)
    off_col = off_nrm + len(nrm_b)
    off_idx = off_col + len(col_b)

    gltf = {
        "asset": {"version": "2.0", "generator": "AirForceDashi export_map_glb"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": "PacificIslands", "mesh": 0}],
        "meshes": [
            {
                "name": "Terrain_16km",
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2},
                        "indices": 3,
                        "material": 0,
                    }
                ],
            }
        ],
        "materials": [
            {
                "name": "MapVertexColor",
                "doubleSided": True,
                "pbrMetallicRoughness": {
                    "baseColorFactor": [1, 1, 1, 1],
                    "metallicFactor": 0,
                    "roughnessFactor": 0.92,
                },
            }
        ],
        "buffers": [{"byteLength": len(blob)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": off_pos, "byteLength": len(pos_b), "target": 34962},
            {"buffer": 0, "byteOffset": off_nrm, "byteLength": len(nrm_b), "target": 34962},
            {"buffer": 0, "byteOffset": off_col, "byteLength": len(col_b), "target": 34962},
            {"buffer": 0, "byteOffset": off_idx, "byteLength": len(idx_b), "target": 34963},
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": int(pos.shape[0]),
                "type": "VEC3",
                "min": pos.min(axis=0).tolist(),
                "max": pos.max(axis=0).tolist(),
            },
            {
                "bufferView": 1,
                "componentType": 5126,
                "count": int(nrm.shape[0]),
                "type": "VEC3",
            },
            {
                "bufferView": 2,
                "componentType": 5121,
                "count": int(rgba.shape[0]),
                "type": "VEC4",
                "normalized": True,
            },
            {
                "bufferView": 3,
                "componentType": 5125,
                "count": int(indices.size),
                "type": "SCALAR",
            },
        ],
    }

    j = pad4(json.dumps(gltf, separators=(",", ":")).encode("utf-8"))
    total = 12 + 8 + len(j) + 8 + len(blob)
    data = struct.pack("<4sII", b"glTF", 2, total)
    data += struct.pack("<I4s", len(j), b"JSON") + j
    data += struct.pack("<I4s", len(blob), b"BIN\x00") + blob

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(data)
    tris = indices.size // 3
    print(f"wrote {OUT}")
    print(f"bytes {OUT.stat().st_size} verts {pos.shape[0]} tris {tris}")


if __name__ == "__main__":
    main()
