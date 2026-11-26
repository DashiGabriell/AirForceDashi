import type { GatePoint } from "../missions/checkpointLevels";
import { AIRPORT_CENTER, METRO_AIRPORT_SPAWN, RUNWAY_OFFSET } from "./metroAirport";
import { DOWNTOWN_CENTER, type MetroBuilding } from "./metroDowntown";
import { metroZoneAt, sampleMetroHeight, type MetroTerrainData } from "./metroGrid";

export type MetroBridgeStyle = "suspension" | "arch" | "cable-stayed";

export interface MetroBridge {
  id: string;
  style: MetroBridgeStyle;
  /** Centre over the water. */
  x: number;
  z: number;
  /** Unit crossing axis, pointing in CheckPoint travel order. */
  ax: number;
  az: number;
  /** Water width along the axis. */
  span: number;
  deckTop: number;
  /** Region codes on the bank the axis leaves from and the bank it reaches. */
  from: number;
  to: number;
}

export interface MetroBridgesLayout {
  bridges: MetroBridge[];
  buildings: MetroBuilding[];
}

const WATER = 0;
const DECK_W = 36;
const DECK_T = 4;
/** Main deck runs this far onto each bank before the ramps start. */
const BANK_OVERLAP = 60;
const MAIN_PIECE = 100;
const RAMP_PIECE = 40;
/** Ramp length per metre of rise (about 7%). */
const RAMP_RUN = 14;
const SCAN_REACH = 1500;
const SCAN_STEP = 5;
const ARCH_RISE = 55;

interface BridgeSpec {
  id: string;
  style: MetroBridgeStyle;
  probe: { x: number; z: number };
  /** Fixed crossing axis, or measured square to the canal. */
  axis: { x: number; z: number } | "across-canal";
  /** Deck underside above the water. Ships pass under the Harbor bridge. */
  clearance: number;
}

const SPECS: readonly BridgeSpec[] = [
  {
    id: "bridge-west",
    style: "suspension",
    probe: { x: -5050, z: DOWNTOWN_CENTER.z },
    axis: { x: 1, z: 0 },
    clearance: 25,
  },
  {
    id: "bridge-east",
    style: "arch",
    probe: { x: 4400, z: DOWNTOWN_CENTER.z },
    axis: { x: 1, z: 0 },
    clearance: 25,
  },
  {
    id: "bridge-harbor",
    style: "cable-stayed",
    probe: { x: 14000, z: 1100 },
    axis: "across-canal",
    clearance: 45,
  },
];

/** Axis-aligned half extents of a building footprint, rotation included. */
export function footprintHalfExtents(b: Pick<MetroBuilding, "w" | "d" | "yaw">): {
  hx: number;
  hz: number;
} {
  const c = Math.abs(Math.cos(b.yaw ?? 0));
  const s = Math.abs(Math.sin(b.yaw ?? 0));
  return { hx: (c * b.w + s * b.d) / 2, hz: (s * b.w + c * b.d) / 2 };
}

/** Water run along (dx, dz) through p, the one whose middle is closest to p. Signed distances. */
function waterRun(
  t: MetroTerrainData,
  px: number,
  pz: number,
  dx: number,
  dz: number,
): [number, number] {
  let best: [number, number] | null = null;
  let start: number | null = null;
  for (let s = -SCAN_REACH; s <= SCAN_REACH; s += SCAN_STEP) {
    const wet = metroZoneAt(t, px + dx * s, pz + dz * s) === WATER;
    if (wet && start === null) start = s;
    const last = s + SCAN_STEP > SCAN_REACH;
    if (start !== null && (!wet || last)) {
      const end = wet ? s : s - SCAN_STEP;
      if (!best || Math.abs(start + end) < Math.abs(best[0] + best[1])) best = [start, end];
      start = null;
    }
  }
  if (!best) throw new Error(`ponte: sem água perto de (${px}, ${pz})`);
  return best;
}

function placeBridge(t: MetroTerrainData, spec: BridgeSpec): MetroBridge {
  let { x: px, z: pz } = spec.probe;
  let ax: number;
  let az: number;
  if (spec.axis === "across-canal") {
    const mid = (x: number): number => {
      const [s0, s1] = waterRun(t, x, pz, 0, 1);
      return pz + (s0 + s1) / 2;
    };
    const tx = 600;
    const tz = mid(px + 300) - mid(px - 300);
    const len = Math.hypot(tx, tz);
    // Square to the canal, toward the Harbor bank (north, -z).
    ax = tz / len;
    az = -tx / len;
    pz = mid(px);
  } else {
    ax = spec.axis.x;
    az = spec.axis.z;
  }
  const [s0, s1] = waterRun(t, px, pz, ax, az);
  const x = px + ax * ((s0 + s1) / 2);
  const z = pz + az * ((s0 + s1) / 2);
  const span = s1 - s0 + SCAN_STEP;
  const bank = span / 2 + 40;
  return {
    id: spec.id,
    style: spec.style,
    x,
    z,
    ax,
    az,
    span,
    deckTop: spec.clearance + DECK_T,
    from: metroZoneAt(t, x - ax * bank, z - az * bank),
    to: metroZoneAt(t, x + ax * bank, z + az * bank),
  };
}

function bridgePieces(t: MetroTerrainData, b: MetroBridge): MetroBuilding[] {
  const out: MetroBuilding[] = [];
  const yaw = Math.atan2(-b.az, b.ax);
  /** Point s metres along the axis and `lat` metres to its side. */
  const at = (s: number, lat: number): { x: number; z: number } => ({
    x: b.x + b.ax * s - b.az * lat,
    z: b.z + b.az * s + b.ax * lat,
  });
  const box = (
    id: string,
    kind: MetroBuilding["kind"],
    s: number,
    lat: number,
    len: number,
    wid: number,
    base: number,
    h: number,
  ): void => {
    const p = at(s, lat);
    out.push({ id: `${b.id}-${id}`, kind, x: p.x, z: p.z, w: len, d: wid, h, base, yaw });
  };
  const groundAlong = (s0: number, s1: number): { min: number; max: number } => {
    let min = Infinity;
    let max = -Infinity;
    for (const s of [s0, (s0 + s1) / 2, s1]) {
      for (const lat of [-DECK_W / 2, 0, DECK_W / 2]) {
        const p = at(s, lat);
        const g = sampleMetroHeight(t, p.x, p.z);
        min = Math.min(min, g);
        max = Math.max(max, g);
      }
    }
    return { min, max };
  };

  const mainHalf = b.span / 2 + BANK_OVERLAP;
  const mainN = Math.ceil((2 * mainHalf) / MAIN_PIECE);
  const mainLen = (2 * mainHalf) / mainN;
  for (let k = 0; k < mainN; k++) {
    const s = -mainHalf + (k + 0.5) * mainLen;
    box(`deck-${k}`, "deck", s, 0, mainLen + 0.5, DECK_W, b.deckTop - DECK_T, DECK_T);
  }

  for (const side of [-1, 1]) {
    const groundEnd0 = groundAlong(side * mainHalf, side * mainHalf).max;
    const run = Math.max(RAMP_PIECE * 4, (b.deckTop - groundEnd0) * RAMP_RUN);
    const n = Math.ceil(run / RAMP_PIECE);
    const len = run / n;
    const endGround = groundAlong(side * (mainHalf + run), side * (mainHalf + run)).max;
    for (let k = 0; k < n; k++) {
      const s0 = side * (mainHalf + k * len);
      const s1 = side * (mainHalf + (k + 1) * len);
      const g = groundAlong(s0, s1);
      const top = Math.max(b.deckTop + (endGround + 1 - b.deckTop) * ((k + 0.5) / n), g.max + 1);
      const base = Math.max(top - DECK_T, g.min);
      const s = (s0 + s1) / 2;
      box(`ramp-${side}-${k}`, "deck", s, 0, len + 0.5, DECK_W, base, top - base);
      if (k % 2 === 0 && base - g.min > 3) {
        box(`col-${side}-${k}`, "column", s, 0, 8, 8, g.min, base - g.min);
      }
    }
  }

  const legLat = DECK_W / 2 + 5;
  const pylons = (sp: number, top: number): void => {
    for (const side of [-1, 1]) {
      for (const lat of [-legLat, legLat]) {
        box(`pylon-${side}-${lat > 0 ? "r" : "l"}`, "pylon", side * sp, lat, 10, 8, 0, top);
      }
      box(`beam-${side}`, "pylon", side * sp, 0, 10, 2 * legLat + 8, top - 6, 6);
    }
  };

  if (b.style === "suspension") {
    const sp = b.span / 2 - 30;
    const top = b.deckTop + 85;
    pylons(sp, top);
    const piece = 25;
    for (const lat of [-legLat, legLat]) {
      const tag = lat > 0 ? "r" : "l";
      for (let s = -sp; s < sp - 0.1; s += piece) {
        const sm = s + piece / 2;
        const y = b.deckTop + 4 + (top - 6 - b.deckTop) * (sm / sp) ** 2;
        box(`cable-${tag}-${Math.round(s)}`, "cable", sm, lat, piece + 0.5, 1.5, y - 0.75, 1.5);
      }
      for (const side of [-1, 1]) {
        const back = mainHalf - sp;
        const n = Math.ceil(back / piece);
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5) / n;
          const y = top - 6 + (b.deckTop + 1 - (top - 6)) * u;
          box(
            `back-${tag}-${side}-${k}`,
            "cable",
            side * (sp + back * u),
            lat,
            back / n + 0.5,
            1.5,
            y - 0.75,
            1.5,
          );
        }
      }
    }
  } else if (b.style === "arch") {
    const sa = b.span / 2;
    const piece = 20;
    const n = Math.ceil((2 * sa) / piece);
    const len = (2 * sa) / n;
    for (const lat of [-(DECK_W / 2 + 2), DECK_W / 2 + 2]) {
      for (let k = 0; k < n; k++) {
        const s = -sa + (k + 0.5) * len;
        const y = b.deckTop + ARCH_RISE * (1 - (s / sa) ** 2);
        box(`arch-${lat > 0 ? "r" : "l"}-${k}`, "arch", s, lat, len + 0.5, 3, y - 2, 4);
      }
    }
  } else {
    pylons(b.span / 2 - 60, b.deckTop + 100);
  }
  return out;
}

/**
 * The three V1 bridges over the canals (Q17): suspension Residential ↔
 * Downtown and arch Downtown ↔ Financial, both on the main Downtown avenue,
 * and a cable-stayed Harbor ↔ Coastal bridge with ship clearance. Each finds
 * its canal on the terrain. Decks, ramps, columns and towers are soft
 * collision volumes, like the buildings (Q10). Deterministic for a given terrain.
 */
export function buildBridgesBlockout(t: MetroTerrainData): MetroBridgesLayout {
  const bridges = SPECS.map((spec) => placeBridge(t, spec));
  return { bridges, buildings: bridges.flatMap((b) => bridgePieces(t, b)) };
}

export const METRO_GATE_RADIUS = 45;

/**
 * The V1 CheckPoint course (Q16): 12 upright gates from the Airport to the
 * Harbor, between 150 and 400 m, crossing the three bridges in order and the
 * main Downtown crossing between the icons.
 */
export function buildMetroCheckpoint(bridges: readonly MetroBridge[]): GatePoint[] {
  const byId = (id: string): MetroBridge => {
    const b = bridges.find((x) => x.id === id);
    if (!b) throw new Error(`checkpoint: ponte ${id} ausente`);
    return b;
  };
  const west = byId("bridge-west");
  const east = byId("bridge-east");
  const harbor = byId("bridge-harbor");
  const BRIDGE_ALT = 160;
  type Stop = { x: number; z: number; y: number; axis?: MetroBridge };
  const stops: Stop[] = [
    { x: AIRPORT_CENTER.x - RUNWAY_OFFSET, z: AIRPORT_CENTER.z, y: 400 },
    { x: -4600, z: -11000, y: 330 },
    { x: -7400, z: -8200, y: 260 },
    { x: -7600, z: -5600, y: 200 },
    { x: west.x, z: west.z, y: BRIDGE_ALT, axis: west },
    { x: DOWNTOWN_CENTER.x, z: DOWNTOWN_CENTER.z, y: 200 },
    { x: east.x, z: east.z, y: BRIDGE_ALT, axis: east },
    { x: 7200, z: -3200, y: 230 },
    { x: 10500, z: 3500, y: 250 },
    { x: harbor.x - harbor.ax * 2000, z: harbor.z - harbor.az * 2000, y: 200 },
    { x: harbor.x, z: harbor.z, y: BRIDGE_ALT, axis: harbor },
    { x: 19400, z: -2600, y: 220 },
  ];
  return stops.map((p, i) => {
    let nx: number;
    let nz: number;
    if (p.axis) {
      nx = p.axis.ax;
      nz = p.axis.az;
    } else {
      const from = i === 0 ? METRO_AIRPORT_SPAWN : stops[i - 1]!;
      const to = i === stops.length - 1 ? p : stops[i + 1]!;
      const len = Math.hypot(to.x - from.x, to.z - from.z);
      nx = (to.x - from.x) / len;
      nz = (to.z - from.z) / len;
    }
    return { x: p.x, y: p.y, z: p.z, nx, ny: 0, nz, radius: METRO_GATE_RADIUS };
  });
}
