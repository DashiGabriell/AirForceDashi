// Gera o heightmap 2049² e a máscara de zoneamento do Metropolitan.
// Uso: node tools/metropolitan/build-terrain.mjs
//
// Entradas:  assets/maps/metropolitan/zoning_polygons.json
// Saídas:    heightmap_2049.u16.gz     (uint16 LE, 0..200 m, linhas em z)
//            zoning_2049.u8.gz         (código de região por célula, 0 = água)
//            metropolitan_terrain.json (grade, áreas e platôs)
//            zoning_preview.png        (prévia para conferência visual)
//
// Grade: 2049 amostras por lado cobrindo o círculo de raio 29 km (58 km).
// Layout: quadrado de 40 × 40 km no centro. As regiões da imagem crescem
// para fora dos polígonos até atingir a fração de terra do quadrado.
// Fora do quadrado: oceano (altura 0, código 0).

import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync, deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "assets", "maps", "metropolitan");
const spec = JSON.parse(readFileSync(join(OUT, "zoning_polygons.json"), "utf8"));

const N = 2049;
const CIRCLE_R = spec.layout.circle_radius_m; // 29000
const SQUARE = spec.layout.square_m; // 40000
const HALF_SQ = SQUARE / 2; // 20000
const LAND_SHARE = spec.layout.land_share_of_square; // 0.8
const STEP = (2 * CIRCLE_R) / (N - 1); // ≈ 28.32 m
const H_MAX = 200; // metros no u16 = 65535
const TRANSITION = spec.transition_m; // 200 m
const NATURAL_BASE = 4; // m, terreno natural na costa
const WATER = 0;

const [OX, OY] = spec.frame.origin_px;
const MPP_X = SQUARE / spec.frame.width_px;
const MPP_Y = SQUARE / spec.frame.height_px;
const toWorld = ([px, py]) => [(px - OX) * MPP_X, (py - OY) * MPP_Y];

const regions = spec.regions.map((r) => ({
  code: r.code,
  id: r.id,
  name: r.name,
  plateau: r.plateau,
  poly: r.polygon_px.map(toWorld),
}));
const regionByCode = new Map(regions.map((r) => [r.code, r]));

const edges = [];
for (const r of regions) {
  for (let i = 0; i < r.poly.length; i++) {
    const a = r.poly[i];
    const b = r.poly[(i + 1) % r.poly.length];
    edges.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], code: r.code });
  }
}

function insidePoly(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

function segDist2(x, z, e) {
  const dx = e.bx - e.ax;
  const dz = e.bz - e.az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((x - e.ax) * dx + (z - e.az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = e.ax + dx * t - x;
  const pz = e.az + dz * t - z;
  return px * px + pz * pz;
}

// Ruído de valor com hash inteiro determinístico. fbm devolve 0..1.
function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function valueNoise(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x, z, seed) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    sum += amp * valueNoise(x * freq, z * freq, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth01 = (t) => t * t * (3 - 2 * t);

const naturalHeight = (x, z) => NATURAL_BASE + 6 * fbm(x / 900, z / 900, 11);
function regionHeight(region, x, z) {
  if (region.plateau !== null) return region.plateau; // platô plano
  const n = fbm(x / 1400, z / 1400, 29);
  return clamp(25 + 115 * Math.pow(n, 1.6), 0, H_MAX); // colinas do Green Zone
}

// Passo 1: distância de cada célula do quadrado até a região mais próxima.
// Dentro de um polígono, a distância é 0 e a prioridade decide.
const grid = new Float32Array(N * N).fill(Infinity);
const owner = new Uint8Array(N * N); // código da região mais próxima
const inSquare = new Uint8Array(N * N);
const squareDists = [];

for (let j = 0; j < N; j++) {
  const z = -CIRCLE_R + j * STEP;
  for (let i = 0; i < N; i++) {
    const x = -CIRCLE_R + i * STEP;
    if (Math.abs(x) > HALF_SQ || Math.abs(z) > HALF_SQ) continue;
    const idx = j * N + i;
    inSquare[idx] = 1;

    let inside = null;
    for (const r of regions) {
      if (insidePoly(r.poly, x, z)) {
        inside = r;
        break;
      }
    }
    if (inside) {
      grid[idx] = 0;
      owner[idx] = inside.code;
    } else {
      let best2 = Infinity;
      let nearest = 0;
      for (const e of edges) {
        const d2 = segDist2(x, z, e);
        if (d2 < best2) {
          best2 = d2;
          nearest = e.code;
        }
      }
      grid[idx] = Math.sqrt(best2);
      owner[idx] = nearest;
    }
    squareDists.push(grid[idx]);
  }
}

// Passo 2: o limiar de terra é o quantil que deixa 80% das células do quadrado
// como terra. Acima dele, é água.
squareDists.sort((a, b) => a - b);
const landCut = squareDists[Math.floor(LAND_SHARE * squareDists.length) - 1];

// Passo 3: alturas e códigos.
const codes = new Uint8Array(N * N);
const u16 = new Uint16Array(N * N);
for (let k = 0; k < N * N; k++) {
  if (!inSquare[k] || grid[k] > landCut) continue; // água
  const region = regionByCode.get(owner[k]);
  const x = -CIRCLE_R + (k % N) * STEP;
  const z = -CIRCLE_R + Math.floor(k / N) * STEP;
  codes[k] = region.code;
  let h = regionHeight(region, x, z);
  // Perto da costa (últimos 200 m de terra), a altura desce para o terreno natural.
  const toCoast = landCut - grid[k];
  if (toCoast < TRANSITION) {
    const t = 1 - smooth01(clamp(toCoast / TRANSITION, 0, 1));
    h = h + (naturalHeight(x, z) - h) * t;
  }
  u16[k] = Math.round((clamp(h, 0, H_MAX) / H_MAX) * 65535);
}

// Áreas e contagens.
const cellArea = STEP * STEP;
const counts = new Map();
for (let k = 0; k < N * N; k++) counts.set(codes[k], (counts.get(codes[k]) ?? 0) + 1);
const squareCells = squareDists.length;
const landInSquare = [...counts.entries()]
  .filter(([c]) => c !== WATER)
  .reduce((s, [, n]) => s + n, 0);
const circleArea = Math.PI * CIRCLE_R * CIRCLE_R;
const squareArea = SQUARE * SQUARE;

const regionStats = regions.map((r) => {
  const n = counts.get(r.code) ?? 0;
  return {
    code: r.code,
    id: r.id,
    name: r.name,
    plateau_m: r.plateau,
    cells: n,
    area_km2: +((n * cellArea) / 1e6).toFixed(1),
    share_of_square: +((n * cellArea) / squareArea).toFixed(3),
  };
});

// Gravação dos binários.
const u16Buf = Buffer.alloc(N * N * 2);
for (let k = 0; k < N * N; k++) u16Buf.writeUInt16LE(u16[k], k * 2);
writeFileSync(join(OUT, "heightmap_2049.u16.gz"), gzipSync(u16Buf, { level: 9 }));
writeFileSync(join(OUT, "zoning_2049.u8.gz"), gzipSync(Buffer.from(codes), { level: 9 }));

const urbanCodes = [1, 2, 3, 7];
const urbanShare = urbanCodes.reduce((s, c) => s + (counts.get(c) ?? 0), 0) / squareCells;
const stats = {
  grid: {
    size: N,
    step_m: +STEP.toFixed(4),
    span_m: 2 * CIRCLE_R,
    origin_m: [-CIRCLE_R, -CIRCLE_R],
    encoding: "uint16 little-endian, 0..200 m, linhas em z",
    h_max_m: H_MAX,
  },
  circle_radius_m: CIRCLE_R,
  circle_area_km2: +(circleArea / 1e6).toFixed(0),
  square_m: SQUARE,
  square_area_km2: +(squareArea / 1e6).toFixed(0),
  land_threshold_m: +landCut.toFixed(1),
  land_share_of_square: +(landInSquare / squareCells).toFixed(3),
  land_area_km2: +((landInSquare * cellArea) / 1e6).toFixed(0),
  urban_share_of_square: +urbanShare.toFixed(3),
  transition_m: TRANSITION,
  regions: regionStats,
  codes: {
    0: "água",
    1: "downtown",
    2: "financial",
    3: "residential",
    4: "industrial",
    5: "airport",
    6: "harbor",
    7: "coastal",
    8: "green",
  },
};
writeFileSync(join(OUT, "metropolitan_terrain.json"), JSON.stringify(stats, null, 2) + "\n");

// Prévia PNG 1025², cor por código.
const PALETTE = {
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

function previewRgb() {
  const P = (N + 1) / 2; // 1025
  const rgb = Buffer.alloc(P * P * 3);
  for (let j = 0; j < P; j++) {
    for (let i = 0; i < P; i++) {
      const k = 2 * j * N + 2 * i;
      const [r, g, b] = PALETTE[codes[k]];
      const o = (j * P + i) * 3;
      rgb[o] = r;
      rgb[o + 1] = g;
      rgb[o + 2] = b;
    }
  }
  return { w: P, h: P, rgb };
}

function encodePng({ w, h, rgb }) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filtro "none"
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // profundidade
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

writeFileSync(join(OUT, "zoning_preview.png"), encodePng(previewRgb()));

console.log(`grade ${N}x${N}, célula ${STEP.toFixed(2)} m, círculo raio ${CIRCLE_R / 1000} km`);
console.log(`quadrado ${SQUARE / 1000} km: terra ${(stats.land_share_of_square * 100).toFixed(1)}% (${stats.land_area_km2} km²), urbano ${(urbanShare * 100).toFixed(1)}%`);
for (const r of regionStats) {
  console.log(`  ${String(r.code).padStart(2)} ${r.name.padEnd(32)} ${String(r.area_km2).padStart(7)} km²  ${(r.share_of_square * 100).toFixed(1)}%`);
}
