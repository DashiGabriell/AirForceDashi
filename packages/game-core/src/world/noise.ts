/** Deterministic value-noise FBM — no deps, worker-safe. */

export function hash2(x: number, y: number, seed = 0): number {
  let n = (x | 0) * 374761393 + (y | 0) * 668265263 + seed * 1274126177;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967295;
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise2(x: number, y: number, seed = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const ab = a + (b - a) * fx;
  const cd = c + (d - c) * fx;
  return ab + (cd - ab) * fy; // 0..1
}

/** Approx simplex-ish in −1..1 via value noise. */
export function noise2(x: number, y: number, seed = 0): number {
  return valueNoise2(x, y, seed) * 2 - 1;
}

export function fbm2(
  x: number,
  y: number,
  seed: number,
  octaves: number,
  freq: number,
  lac = 2,
  gain = 0.5,
): number {
  let amp = 1;
  let f = freq;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * f, y * f, seed + i * 1013) * amp;
    norm += amp;
    amp *= gain;
    f *= lac;
  }
  return sum / Math.max(norm, 1e-6);
}
