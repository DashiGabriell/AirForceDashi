/**
 * Metropolitan terrain grid, as written by tools/metropolitan/build-terrain.mjs.
 * Cell (i, j) sits at x = -R + i·STEP, z = -R + j·STEP. Index k = j·N + i.
 */
export const METRO_GRID_N = 2049;
/** Half span of the grid (circle radius), metres. */
export const METRO_CIRCLE_R = 29000;
export const METRO_STEP = (2 * METRO_CIRCLE_R) / (METRO_GRID_N - 1);
/** Height that u16 65535 stands for, metres. */
export const METRO_H_MAX = 200;

/** Area colors, same codes and RGB as the generator's preview. 0 = water. */
export const METRO_ZONE_RGB: Readonly<
  Record<number, readonly [number, number, number]>
> = {
  0: [28, 86, 128],
  1: [230, 80, 80],
  2: [240, 160, 60],
  3: [240, 222, 110],
  4: [150, 120, 96],
  5: [176, 180, 190],
  6: [96, 166, 226],
  7: [118, 222, 196],
  8: [58, 150, 72],
};

export interface MetroTerrainData {
  readonly n: number;
  /** Raw u16 heights, row-major. Multiply by METRO_H_MAX / 65535 for metres. */
  readonly heights: Uint16Array;
  /** Zone code per cell, row-major. */
  readonly zones: Uint8Array;
}

/** Reads the little-endian u16 file. Throws when the byte count is not n²·2. */
export function decodeMetroHeights(bytes: Uint8Array, n: number): Uint16Array {
  if (bytes.byteLength !== n * n * 2) {
    throw new Error(
      `heightmap com ${bytes.byteLength} bytes, esperado ${n * n * 2}`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Uint16Array(n * n);
  for (let k = 0; k < out.length; k++) out[k] = view.getUint16(k * 2, true);
  return out;
}

/** Height in metres of one raw sample. */
export function metroRawToMetres(raw: number): number {
  return (raw * METRO_H_MAX) / 65535;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Bilinear ground height in metres at world (x, z). Clamps past the grid edge. */
export function sampleMetroHeight(t: MetroTerrainData, x: number, z: number): number {
  const n = t.n;
  const fx = clamp((x + METRO_CIRCLE_R) / METRO_STEP, 0, n - 1);
  const fz = clamp((z + METRO_CIRCLE_R) / METRO_STEP, 0, n - 1);
  const i0 = Math.min(Math.floor(fx), n - 2);
  const j0 = Math.min(Math.floor(fz), n - 2);
  const tx = fx - i0;
  const tz = fz - j0;
  const k = j0 * n + i0;
  const h = t.heights;
  const top = h[k]! + (h[k + 1]! - h[k]!) * tx;
  const bottom = h[k + n]! + (h[k + n + 1]! - h[k + n]!) * tx;
  return metroRawToMetres(top + (bottom - top) * tz);
}

/** Zone code of the nearest grid cell to world (x, z). */
export function metroZoneAt(t: MetroTerrainData, x: number, z: number): number {
  const n = t.n;
  const i = clamp(Math.round((x + METRO_CIRCLE_R) / METRO_STEP), 0, n - 1);
  const j = clamp(Math.round((z + METRO_CIRCLE_R) / METRO_STEP), 0, n - 1);
  return t.zones[j * n + i]!;
}
