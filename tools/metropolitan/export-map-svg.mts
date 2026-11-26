// Exporta o mapa do Metropolitan como SVG em escala real (1 unidade = 1 m).
// Uso: npx tsx tools/metropolitan/export-map-svg.mts
//
// Fonte: heightmap e zoneamento de assets/maps/metropolitan e os mesmos
// blockouts que o jogo desenha (game-core). Norte para cima: +x é leste,
// +z é sul. Saída: docs/Metropolitan/mapa-metropolitan.svg

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import {
  AIRPORT_CENTER,
  METRO_AIRPORT_SPAWN,
  buildAirportBlockout,
  type MetroSlab,
  type MetroSlabKind,
} from "../../packages/game-core/src/world/metroAirport.ts";
import {
  buildBridgesBlockout,
  buildMetroCheckpoint,
} from "../../packages/game-core/src/world/metroBridges.ts";
import { STADIUM_CENTER, buildCoastalBlockout } from "../../packages/game-core/src/world/metroCoastal.ts";
import {
  DOWNTOWN_CENTER,
  buildDowntownBlockout,
  type MetroBuilding,
  type MetroBuildingKind,
} from "../../packages/game-core/src/world/metroDowntown.ts";
import {
  METRO_CIRCLE_R,
  METRO_GRID_N,
  METRO_H_MAX,
  METRO_STEP,
  METRO_ZONE_RGB,
  decodeMetroHeights,
  type MetroTerrainData,
} from "../../packages/game-core/src/world/metroGrid.ts";
import { HARBOR_QUAY_X, buildHarborBlockout } from "../../packages/game-core/src/world/metroHarbor.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA = join(ROOT, "assets", "maps", "metropolitan");
const OUT = join(ROOT, "docs", "Metropolitan", "mapa-metropolitan.svg");

const N = METRO_GRID_N;
const R = METRO_CIRCLE_R;
const STEP = METRO_STEP;

const terrain: MetroTerrainData = {
  n: N,
  heights: decodeMetroHeights(
    new Uint8Array(gunzipSync(readFileSync(join(DATA, "heightmap_2049.u16.gz")))),
    N,
  ),
  zones: new Uint8Array(gunzipSync(readFileSync(join(DATA, "zoning_2049.u8.gz")))),
};
const stats = JSON.parse(readFileSync(join(DATA, "metropolitan_terrain.json"), "utf8")) as {
  regions: { code: number; name: string; plateau_m: number | null; area_km2: number }[];
};
const commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();

const downtown = buildDowntownBlockout(terrain);
const airport = buildAirportBlockout(terrain);
const harbor = buildHarborBlockout(terrain);
const coastal = buildCoastalBlockout(terrain);
const bridges = buildBridgesBlockout(terrain);
const gates = buildMetroCheckpoint(bridges.bridges);

/** Same palette as MetropolitanBlockoutMesh, so the SVG matches the test world. */
const KIND_COLOR: Record<MetroBuildingKind, string> = {
  icon: "#e4e8ee",
  tower: "#8fa9c4",
  mid: "#8c9096",
  low: "#b8aa92",
  terminal: "#c6d4e2",
  control: "#f2f2f2",
  hangar: "#9a9184",
  warehouse: "#a39a8c",
  container: "#c0392b",
  crane: "#d9541e",
  ship: "#3d4a5c",
  superstructure: "#eeeeea",
  stadium: "#d8d4cc",
  canopy: "#f6f6f2",
  mast: "#6d7178",
  resort: "#f0e6d2",
  deck: "#5e6168",
  column: "#8a8d92",
  pylon: "#c4472f",
  cable: "#c4472f",
  arch: "#eceae4",
};
const CONTAINER_COLORS = ["#c0392b", "#2e6fb5", "#e67e22", "#27ae60", "#7f8c8d", "#d4ac0d"];
const SLAB_COLOR: Record<MetroSlabKind, string> = {
  runway: "#3a3d42",
  taxiway: "#55585e",
  apron: "#8d9096",
  marking: "#f4f4f0",
  pier: "#7d7f84",
  pitch: "#3f8f3a",
  sand: "#e8d8a8",
  road: "#4a4d52",
};
const KIND_LABEL: Record<MetroBuildingKind, string> = {
  icon: "Ícone (260–450 m)",
  tower: "Torre comercial (80–200 m)",
  mid: "Prédio médio (30–78 m)",
  low: "Prédio baixo (18–40 m)",
  terminal: "Terminal",
  control: "Torre de controle",
  hangar: "Hangar / manutenção",
  warehouse: "Armazém",
  container: "Contêineres",
  crane: "Guindaste portuário",
  ship: "Navio",
  superstructure: "Ponte de comando",
  stadium: "Arquibancada",
  canopy: "Cobertura",
  mast: "Torre de iluminação",
  resort: "Resort (30–90 m)",
  deck: "Tabuleiro / rampa",
  column: "Pilar",
  pylon: "Torre / pilone",
  cable: "Cabo",
  arch: "Arco",
};
const SLAB_LABEL: Record<MetroSlabKind, string> = {
  runway: "Pista",
  taxiway: "Taxiway",
  apron: "Pátio / praça",
  marking: "Marcação",
  pier: "Píer / cais",
  pitch: "Campo",
  sand: "Areia",
  road: "Avenida",
};

const f = (v: number): string => (Math.round(v * 10) / 10).toString();
const rgb = (c: readonly [number, number, number]): string => `rgb(${c[0]},${c[1]},${c[2]})`;
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function containerColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return CONTAINER_COLORS[Math.abs(h) % CONTAINER_COLORS.length]!;
}

// Zonas: faixas horizontais por linha da grade (passo 2 = 56,6 m), um path por região.
function zonePaths(): string {
  const S = 2;
  const cell = S * STEP;
  const byCode = new Map<number, string[]>();
  for (let j = 0; j < N; j += S) {
    let i = 0;
    while (i < N) {
      const code = terrain.zones[j * N + i]!;
      let i1 = i;
      while (i1 + S < N && terrain.zones[j * N + i1 + S] === code) i1 += S;
      if (code !== 0) {
        const x0 = -R + i * STEP - cell / 2;
        const z0 = -R + j * STEP - cell / 2;
        const w = (i1 - i) * STEP + cell;
        const list = byCode.get(code) ?? [];
        // 2 m de sobra em cada faixa para não abrir fresta entre linhas vizinhas.
        list.push(`M${f(x0 - 1)} ${f(z0 - 1)}h${f(w + 2)}v${f(cell + 2)}h${f(-w - 2)}z`);
        byCode.set(code, list);
      }
      i = i1 + S;
    }
  }
  return [...byCode.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(
      ([code, d]) =>
        `<path id="zona-${code}" fill="${rgb(METRO_ZONE_RGB[code]!)}" d="${d.join("")}"/>`,
    )
    .join("\n");
}

// Curvas de nível por marching squares na grade de passo 4 (113 m).
function contourPaths(levels: readonly number[]): string {
  const S = 4;
  const n = Math.floor((N - 1) / S) + 1;
  const h = new Float32Array(n * n);
  const wet = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * S * N + i * S;
      h[j * n + i] = (terrain.heights[k]! / 65535) * METRO_H_MAX;
      wet[j * n + i] = terrain.zones[k] === 0 ? 1 : 0;
    }
  }
  const X = (i: number): number => -R + i * S * STEP;
  const out: string[] = [];
  for (const L of levels) {
    const segs: string[] = [];
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = h[j * n + i]!;
        const b = h[j * n + i + 1]!;
        const c = h[(j + 1) * n + i + 1]!;
        const d = h[(j + 1) * n + i]!;
        const idx = (a >= L ? 8 : 0) | (b >= L ? 4 : 0) | (c >= L ? 2 : 0) | (d >= L ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const lerp = (p: number, q: number): number => (L - p) / (q - p);
        const top = (): [number, number] => [X(i + lerp(a, b)), X(j)];
        const right = (): [number, number] => [X(i + 1), X(j + lerp(b, c))];
        const bottom = (): [number, number] => [X(i + lerp(d, c)), X(j + 1)];
        const left = (): [number, number] => [X(i), X(j + lerp(a, d))];
        const pairs: [() => [number, number], () => [number, number]][] = [];
        switch (idx) {
          case 1: case 14: pairs.push([left, bottom]); break;
          case 2: case 13: pairs.push([bottom, right]); break;
          case 3: case 12: pairs.push([left, right]); break;
          case 4: case 11: pairs.push([top, right]); break;
          case 5: pairs.push([left, top], [bottom, right]); break;
          case 6: case 9: pairs.push([top, bottom]); break;
          case 7: case 8: pairs.push([left, top]); break;
          case 10: pairs.push([left, bottom], [top, right]); break;
        }
        for (const [p, q] of pairs) {
          const [x1, z1] = p();
          const [x2, z2] = q();
          segs.push(`M${f(x1)} ${f(z1)}L${f(x2)} ${f(z2)}`);
        }
      }
    }
    const major = L % 100 === 0;
    out.push(
      `<path class="curva" stroke-width="${major ? 22 : 12}" stroke-opacity="${major ? 0.55 : 0.35}" d="${segs.join("")}"/>`,
    );
  }
  return out.join("\n");
}

function slabRect(s: MetroSlab): string {
  return `<rect x="${f(s.x - s.w / 2)}" y="${f(s.z - s.d / 2)}" width="${f(s.w)}" height="${f(s.d)}" fill="${SLAB_COLOR[s.kind]}"/>`;
}

function buildingRect(b: MetroBuilding): string {
  const fill = b.kind === "container" ? containerColor(b.id) : KIND_COLOR[b.kind];
  const rot = b.yaw ? ` transform="rotate(${f((-b.yaw * 180) / Math.PI)} ${f(b.x)} ${f(b.z)})"` : "";
  return `<rect x="${f(b.x - b.w / 2)}" y="${f(b.z - b.d / 2)}" width="${f(b.w)}" height="${f(b.d)}" fill="${fill}"${rot}><title>${esc(KIND_LABEL[b.kind])}: ${f(b.h)} m de altura, base ${f(b.base)} m</title></rect>`;
}

function label(x: number, z: number, text: string, size: number, cls = "rotulo"): string {
  return `<text class="${cls}" x="${f(x)}" y="${f(z)}" font-size="${size}">${esc(text)}</text>`;
}

// Rótulos das regiões no centro de massa das células de cada zona.
function regionLabels(): string {
  const sum = new Map<number, { x: number; z: number; n: number }>();
  for (let j = 0; j < N; j += 4) {
    for (let i = 0; i < N; i += 4) {
      const code = terrain.zones[j * N + i]!;
      if (code === 0) continue;
      const s = sum.get(code) ?? { x: 0, z: 0, n: 0 };
      s.x += -R + i * STEP;
      s.z += -R + j * STEP;
      s.n++;
      sum.set(code, s);
    }
  }
  const nudge: Record<number, [number, number]> = {
    1: [0, 2600],
    2: [-400, 3000],
    5: [5600, 800],
    6: [-1500, 2600],
    7: [0, -2600],
  };
  return stats.regions
    .map((r) => {
      const s = sum.get(r.code)!;
      const [dx, dz] = nudge[r.code] ?? [0, 0];
      const x = s.x / s.n + dx;
      const z = s.z / s.n + dz;
      const plat = r.plateau_m === null ? "colinas até 140 m" : `platô ${r.plateau_m} m`;
      return (
        label(x, z, r.name, 620, "regiao") +
        label(x, z + 620, `${plat} · ${r.area_km2.toLocaleString("pt-BR")} km²`, 380, "regiao-sub")
      );
    })
    .join("\n");
}

function gridAndFrame(): string {
  const parts: string[] = [];
  for (let v = -20000; v <= 20000; v += 4000) {
    parts.push(`<line class="grade" x1="${v}" y1="-20000" x2="${v}" y2="20000"/>`);
    parts.push(`<line class="grade" x1="-20000" y1="${v}" x2="20000" y2="${v}"/>`);
    parts.push(label(v, -20400, `${v / 1000} km`, 300, "coord"));
    parts.push(
      `<text class="coord" x="-20500" y="${v + 100}" font-size="300" text-anchor="end">${v / 1000} km</text>`,
    );
  }
  parts.push(`<rect class="quadrado" x="-20000" y="-20000" width="40000" height="40000"/>`);
  parts.push(`<circle class="borda" cx="0" cy="0" r="${R}"/>`);
  parts.push(`<circle class="aviso" cx="0" cy="0" r="${R - 2000}"/>`);
  parts.push(label(0, -R + 1300, "Aviso de borda (2 km)", 380, "nota"));
  return parts.join("\n");
}

function course(): string {
  const pts = [METRO_AIRPORT_SPAWN, ...gates];
  const line = `<polyline class="rota" points="${pts.map((p) => `${f(p.x)},${f(p.z)}`).join(" ")}"/>`;
  const marks = gates
    .map((g, i) => {
      const lx = -g.nz;
      const lz = g.nx;
      const seg = `<line class="portal" x1="${f(g.x - lx * g.radius)}" y1="${f(g.z - lz * g.radius)}" x2="${f(g.x + lx * g.radius)}" y2="${f(g.z + lz * g.radius)}"/>`;
      const mx = g.x + lx * 520;
      const mz = g.z + lz * 520;
      return (
        seg +
        `<g><title>Portal ${i + 1}: ${g.y} m de altitude, raio ${g.radius} m</title>` +
        `<circle class="portal-marca" cx="${f(mx)}" cy="${f(mz)}" r="230"/>` +
        `<text class="portal-num" x="${f(mx)}" y="${f(mz + 95)}" font-size="270">${i + 1}</text>` +
        `<text class="portal-alt" x="${f(mx)}" y="${f(mz + 470)}" font-size="200">${g.y} m</text></g>`
      );
    })
    .join("\n");
  const s = METRO_AIRPORT_SPAWN;
  const spawn =
    `<path class="partida" d="M${f(s.x)} ${f(s.z + 420)}L${f(s.x - 260)} ${f(s.z - 260)}L${f(s.x + 260)} ${f(s.z - 260)}z"/>` +
    label(s.x + 450, s.z + 120, "Partida: cruzeiro a 2.200 m, nariz na pista", 320, "nota-esq");
  return [line, marks, spawn].join("\n");
}

function poiLabels(): string {
  const b = (id: string) => bridges.bridges.find((x) => x.id === id)!;
  const bw = b("bridge-west");
  const be = b("bridge-east");
  const bh = b("bridge-harbor");
  return [
    label(AIRPORT_CENTER.x, AIRPORT_CENTER.z - 2300, "2 pistas de 3.000 m, terminal e torre", 340, "poi"),
    label(DOWNTOWN_CENTER.x, DOWNTOWN_CENTER.z - 3200, "5 ícones de 260–450 m no cruzamento central", 340, "poi"),
    label(bw.x - 300, bw.z + 1200, `Ponte pênsil · vão ${Math.round(bw.span)} m`, 300, "poi"),
    label(be.x + 300, be.z + 1200, `Ponte em arco · vão ${Math.round(be.span)} m`, 300, "poi"),
    label(bh.x - 1800, bh.z + 1500, `Ponte estaiada · vão ${Math.round(bh.span)} m · 45 m livres`, 300, "poi"),
    label(STADIUM_CENTER.x, STADIUM_CENTER.z - 700, "Estádio", 360, "poi"),
    label(HARBOR_QUAY_X - 1700, -7900, "Porto: 4 píeres, 16 guindastes", 340, "poi"),
    label(5000, 15900, "Orla: areia, avenida beira-mar e 87 resorts", 340, "poi"),
  ].join("\n");
}

function legend(x0: number): string {
  const parts: string[] = [];
  let y = -27600;
  const line = (text: string, size: number, cls = "leg"): void => {
    parts.push(`<text class="${cls}" x="${x0}" y="${y}" font-size="${size}">${esc(text)}</text>`);
    y += size * 1.45;
  };
  const swatch = (fill: string, text: string, stroke = false): void => {
    parts.push(
      `<rect x="${x0}" y="${y - 300}" width="520" height="360" fill="${fill}"${stroke ? ' stroke="#222" stroke-width="20"' : ""}/>`,
    );
    parts.push(`<text class="leg" x="${x0 + 700}" y="${y}" font-size="320">${esc(text)}</text>`);
    y += 500;
  };
  line("Metropolitan · Mapa 02", 900, "leg-titulo");
  line(`Escala real, gerado dos dados do jogo (commit ${commit})`, 300, "leg-nota");
  line("Círculo de 29 km de raio · layout no quadrado de 40 × 40 km", 300, "leg-nota");
  y += 500;
  line("Regiões", 480, "leg-sec");
  swatch(rgb(METRO_ZONE_RGB[0]!), "Água: mar e canais de 400 m");
  for (const r of stats.regions) {
    const plat = r.plateau_m === null ? "colinas" : `${r.plateau_m} m`;
    swatch(rgb(METRO_ZONE_RGB[r.code]!), `${r.name} · ${plat} · ${r.area_km2.toLocaleString("pt-BR")} km²`);
  }
  y += 300;
  line("Superfícies", 480, "leg-sec");
  for (const k of Object.keys(SLAB_COLOR) as MetroSlabKind[]) swatch(SLAB_COLOR[k], SLAB_LABEL[k]);
  y += 300;
  line("Volumes (planta, cor do teste 0)", 480, "leg-sec");
  const used = new Set<MetroBuildingKind>(
    [...downtown, ...airport.buildings, ...harbor.buildings, ...coastal.buildings, ...bridges.buildings].map(
      (b) => b.kind,
    ),
  );
  for (const k of Object.keys(KIND_COLOR) as MetroBuildingKind[]) {
    if (k === "cable" || !used.has(k)) continue;
    swatch(KIND_COLOR[k], k === "pylon" ? "Torre / pilone / cabo de ponte" : KIND_LABEL[k], true);
  }
  y += 300;
  line("CheckPoint (12 portais, Airport → Harbor)", 480, "leg-sec");
  parts.push(`<line class="rota" x1="${x0}" y1="${y - 120}" x2="${x0 + 520}" y2="${y - 120}"/>`);
  parts.push(`<text class="leg" x="${x0 + 700}" y="${y}" font-size="320">Rota, 44,6 km a partir do 1º portal</text>`);
  y += 500;
  parts.push(`<circle class="portal-marca" cx="${x0 + 260}" cy="${y - 120}" r="230"/>`);
  parts.push(`<text class="portal-num" x="${x0 + 260}" y="${y - 25}" font-size="270">1</text>`);
  parts.push(`<text class="leg" x="${x0 + 700}" y="${y}" font-size="320">Portal em pé, raio 45 m, com altitude</text>`);
  y += 700;
  line("Relevo", 480, "leg-sec");
  parts.push(`<line class="curva" stroke-width="22" stroke-opacity="0.55" x1="${x0}" y1="${y - 120}" x2="${x0 + 520}" y2="${y - 120}"/>`);
  parts.push(`<text class="leg" x="${x0 + 700}" y="${y}" font-size="320">Curvas de nível a cada 20 m (forte a cada 100 m)</text>`);
  y += 500;
  line("Platôs planos por região, margens de 200 m até 4–10 m", 300, "leg-nota");
  y += 600;

  // Escala de 5 km e norte.
  parts.push(`<rect x="${x0}" y="${y}" width="5000" height="180" fill="#f2f2f2"/>`);
  parts.push(`<rect x="${x0}" y="${y}" width="2500" height="180" fill="#333"/>`);
  parts.push(`<text class="leg" x="${x0}" y="${y + 600}" font-size="300">0</text>`);
  parts.push(`<text class="leg" x="${x0 + 2400}" y="${y + 600}" font-size="300">2,5</text>`);
  parts.push(`<text class="leg" x="${x0 + 4800}" y="${y + 600}" font-size="300">5 km</text>`);
  const nx = x0 + 7400;
  parts.push(`<path d="M${nx} ${y - 900}L${nx - 380} ${y + 300}L${nx} ${y}L${nx + 380} ${y + 300}z" fill="#f2f2f2"/>`);
  parts.push(`<text class="leg" x="${nx - 130}" y="${y - 1050}" font-size="420">N</text>`);
  y += 1300;
  line("Eixos do jogo: +x = leste, +z = sul (para baixo)", 300, "leg-nota");
  line("Passe o mouse num volume ou portal para ver altura e altitude", 300, "leg-nota");
  return parts.join("\n");
}

const PAD = 600;
const LEGEND_W = 16500;
const vx = -R - PAD;
const vy = -R - PAD;
const vw = 2 * (R + PAD) + LEGEND_W;
const vh = 2 * (R + PAD);

const slabs = [...airport.slabs, ...harbor.slabs, ...coastal.slabs];
const volumes = [...downtown, ...airport.buildings, ...harbor.buildings, ...coastal.buildings].sort(
  (a, b) => a.base + a.h - (b.base + b.h),
);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${Math.round(vw / 14)}" height="${Math.round(vh / 14)}">
<title>Metropolitan, mapa 02 do Air Force Dashi</title>
<style>
  text { font-family: "Segoe UI", Arial, sans-serif; paint-order: stroke; stroke: #10202c; stroke-linejoin: round; }
  .regiao { fill: #ffffff; stroke-width: 110; font-weight: 700; text-anchor: middle; }
  .regiao-sub { fill: #e8eef2; stroke-width: 80; text-anchor: middle; }
  .poi { fill: #ffe9a8; stroke-width: 80; font-weight: 600; text-anchor: middle; }
  .nota { fill: #ffb36b; stroke-width: 70; text-anchor: middle; }
  .nota-esq { fill: #ffffff; stroke-width: 70; }
  .coord { fill: #b9cbd8; stroke-width: 50; text-anchor: middle; }
  .grade { stroke: #ffffff; stroke-opacity: 0.16; stroke-width: 14; }
  .quadrado { fill: none; stroke: #ffffff; stroke-opacity: 0.45; stroke-width: 30; stroke-dasharray: 300 200; }
  .borda { fill: none; stroke: #8fb3cc; stroke-width: 60; }
  .aviso { fill: none; stroke: #ff9d3b; stroke-width: 40; stroke-dasharray: 500 300; stroke-opacity: 0.8; }
  .curva { fill: none; stroke: #0e3216; }
  .rota { fill: none; stroke: #0dffc7; stroke-width: 60; stroke-dasharray: 400 220; stroke-opacity: 0.9; }
  .portal { stroke: #0dffc7; stroke-width: 40; }
  .portal-marca { fill: #0b2a33; stroke: #0dffc7; stroke-width: 40; }
  .portal-num { fill: #0dffc7; stroke: none; font-weight: 700; text-anchor: middle; }
  .portal-alt { fill: #c9fff1; stroke-width: 50; text-anchor: middle; }
  .partida { fill: #ffffff; stroke: #10202c; stroke-width: 40; }
  .leg { fill: #e6edf2; stroke: none; }
  .leg-titulo { fill: #ffffff; stroke: none; font-weight: 700; }
  .leg-sec { fill: #9fd8ff; stroke: none; font-weight: 700; }
  .leg-nota { fill: #9fb2c0; stroke: none; }
  #volumes rect { stroke: #1b1f24; stroke-width: 2; }
</style>
<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#0c1820"/>
<circle cx="0" cy="0" r="${R}" fill="${rgb(METRO_ZONE_RGB[0]!)}"/>
<g id="zonas">
${zonePaths()}
</g>
<g id="relevo">
${contourPaths([20, 40, 60, 80, 100, 120, 140, 160, 180])}
</g>
<g id="grade">
${gridAndFrame()}
</g>
<g id="superficies">
${slabs.filter((s) => s.kind !== "marking").map(slabRect).join("\n")}
${slabs.filter((s) => s.kind === "marking").map(slabRect).join("\n")}
</g>
<g id="volumes">
${volumes.map(buildingRect).join("\n")}
</g>
<g id="pontes">
${bridges.buildings.map(buildingRect).join("\n")}
</g>
<g id="checkpoint">
${course()}
</g>
<g id="rotulos">
${regionLabels()}
${poiLabels()}
</g>
<g id="legenda">
<rect x="${R + PAD + 200}" y="${vy + 400}" width="${LEGEND_W - 800}" height="${vh - 800}" rx="400" fill="#13232e" stroke="#2c4656" stroke-width="40"/>
${legend(R + PAD + 1000)}
</g>
</svg>
`;

writeFileSync(OUT, svg, "utf8");
console.log(`${OUT}: ${(svg.length / 1024).toFixed(0)} KB, ${volumes.length + bridges.buildings.length} volumes, ${slabs.length} superfícies, ${gates.length} portais`);
