import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Binários gerados por tools/metropolitan/build-terrain.mjs.
const DIR = fileURLToPath(new URL("../../../../assets/maps/metropolitan/", import.meta.url));
const N = 2049;
const CIRCLE_R = 29000;
const SQUARE_HALF = 20000;
const STEP = (2 * CIRCLE_R) / (N - 1);
const H_MAX = 200;
const PLATEAU_CODES = [1, 2, 3, 4, 5, 6, 7];

// Little-endian, como o gerador grava. Lido como view sobre o Buffer descomprimido.
const hBuf = gunzipSync(readFileSync(DIR + "heightmap_2049.u16.gz"));
const heights = new Uint16Array(hBuf.buffer, hBuf.byteOffset, (hBuf.byteLength / 2) | 0);
const codes = new Uint8Array(gunzipSync(readFileSync(DIR + "zoning_2049.u8.gz")));

function worldOf(k: number): { x: number; z: number } {
  const i = k % N;
  const j = Math.floor(k / N);
  return { x: -CIRCLE_R + i * STEP, z: -CIRCLE_R + j * STEP };
}

describe("Metropolitan terrain binaries", () => {
  it("has a full 2049² grid for heights and zoning", () => {
    expect(heights.length).toBe(N * N);
    expect(codes.length).toBe(N * N);
  });

  it("is ocean at the corners of the 58 km grid", () => {
    expect(codes[0]).toBe(0);
    expect(heights[0]).toBe(0);
    expect(codes[N * N - 1]).toBe(0);
  });

  it("only places land inside the 40 km square, which fits in the 29 km circle", () => {
    let outside = 0;
    for (let k = 0; k < N * N; k++) {
      if (codes[k] === 0) continue;
      const { x, z } = worldOf(k);
      if (Math.abs(x) > SQUARE_HALF + STEP || Math.abs(z) > SQUARE_HALF + STEP) outside++;
      if (x * x + z * z > CIRCLE_R * CIRCLE_R) outside++;
    }
    expect(outside).toBe(0);
  });

  it("holds 80% land inside the 40 km square", () => {
    let land = 0;
    let square = 0;
    for (let k = 0; k < N * N; k++) {
      const { x, z } = worldOf(k);
      if (Math.abs(x) > SQUARE_HALF || Math.abs(z) > SQUARE_HALF) continue;
      square++;
      if (codes[k] !== 0) land++;
    }
    expect(land / square).toBeGreaterThan(0.79);
    expect(land / square).toBeLessThan(0.81);
  });

  it("contains all 8 regions and no other code", () => {
    const seen = new Set<number>(codes);
    for (let c = 1; c <= 8; c++) expect(seen.has(c), `região ${c}`).toBe(true);
    for (const c of seen) expect(c).toBeLessThanOrEqual(8);
  });

  it("gives each urban plateau one dominant flat height", () => {
    for (const code of PLATEAU_CODES) {
      const counts = new Map<number, number>();
      let cells = 0;
      for (let k = 0; k < N * N; k++) {
        if (codes[k] !== code) continue;
        cells++;
        counts.set(heights[k]!, (counts.get(heights[k]!) ?? 0) + 1);
      }
      const dominant = Math.max(...counts.values());
      expect(cells, `região ${code} tem células`).toBeGreaterThan(0);
      // Pelo menos 60% das células são platô exato. O resto é a faixa de 200 m da costa.
      expect(dominant / cells, `região ${code} platô plano`).toBeGreaterThan(0.6);
    }
  });

  it("keeps the Green Zone as natural hills, not a plateau", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let k = 0; k < N * N; k++) {
      if (codes[k] !== 8) continue;
      min = Math.min(min, heights[k]!);
      max = Math.max(max, heights[k]!);
    }
    expect(max - min).toBeGreaterThan(20);
  });

  it("stays inside the 0..200 m height range", () => {
    let max = 0;
    for (let k = 0; k < N * N; k++) max = Math.max(max, heights[k]!);
    expect((max / 65535) * H_MAX).toBeLessThanOrEqual(H_MAX);
  });
});
