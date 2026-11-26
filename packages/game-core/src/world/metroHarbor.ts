import { groundRange, groundUnder, type MetroSlab } from "./metroAirport";
import type { MetroBuilding } from "./metroDowntown";
import type { MetroTerrainData } from "./metroGrid";

export interface MetroHarborLayout {
  slabs: MetroSlab[];
  buildings: MetroBuilding[];
}

export const HARBOR_CODE = 6;
/** Quay face: the Harbor's straight east coast runs at x ≈ 20 km from z -8.5 to 1.5 km. */
export const HARBOR_QUAY_X = 19990;
/** Terminal stretch along the quay. */
const QUAY_Z_MIN = -7200;
const QUAY_Z_MAX = 200;
/** Paved strip along the water, in the 200 m coastal transition. */
const QUAY_DEPTH = 200;
/** Container yard behind the strip, on the 3 m plateau. */
const YARD_DEPTH = 1000;
const SLAB_THICKNESS = 0.6;

export const HARBOR_PIERS_Z: readonly number[] = [-6000, -4300, -2600, -900];
export const PIER_LENGTH = 650;
const PIER_WIDTH = 110;
const CRANE_LEG_H = 50;
const CRANE_BOOM_H = 6;

/**
 * Harbor blockout facing east: quay strip and container yard along a 7.4 km
 * terminal, four piers into the sea with two ship-to-shore cranes on each
 * side, one moored ship per pier, and warehouses behind the yard.
 * Fixed layout, no randomness.
 */
export function buildHarborBlockout(t: MetroTerrainData): MetroHarborLayout {
  const slabs: MetroSlab[] = [];
  const buildings: MetroBuilding[] = [];
  const qx = HARBOR_QUAY_X;
  const zMid = (QUAY_Z_MIN + QUAY_Z_MAX) / 2;
  const zLen = QUAY_Z_MAX - QUAY_Z_MIN;

  /** Slab drawn from the lowest ground up to the highest plus its thickness, so it never floats. */
  const groundSlab = (id: string, x: number, z: number, w: number, d: number): number => {
    const r = { id, x, z, w, d };
    const { min, max } = groundRange(t, r);
    slabs.push({ ...r, kind: "apron", base: min, h: max - min + SLAB_THICKNESS });
    return max + SLAB_THICKNESS;
  };

  const quayTop = groundSlab("quay", qx - QUAY_DEPTH / 2, zMid, QUAY_DEPTH, zLen);
  const yardTop = groundSlab(
    "yard",
    qx - QUAY_DEPTH - YARD_DEPTH / 2,
    zMid,
    YARD_DEPTH,
    zLen,
  );

  HARBOR_PIERS_Z.forEach((pz, p) => {
    const px = qx + PIER_LENGTH / 2;
    slabs.push({
      id: `pier-${p}`,
      kind: "pier",
      x: px,
      z: pz,
      w: PIER_LENGTH,
      d: PIER_WIDTH,
      base: 0,
      h: quayTop,
    });

    for (const side of [-1, 1] as const) {
      const edge = pz + side * (PIER_WIDTH / 2);
      for (const [c, dx] of [[0, 200], [1, 450]] as const) {
        const cx = qx + dx;
        const id = `crane-${p}-${side < 0 ? "s" : "n"}-${c}`;
        for (const [l, inset] of [[0, 8], [1, 36]] as const) {
          buildings.push({
            id: `${id}-leg-${l}`,
            kind: "crane",
            x: cx,
            z: edge - side * inset,
            w: 8,
            d: 8,
            h: CRANE_LEG_H,
            base: quayTop,
          });
        }
        buildings.push({
          id: `${id}-boom`,
          kind: "crane",
          x: cx,
          z: edge + side * 5,
          w: 12,
          d: 100,
          h: CRANE_BOOM_H,
          base: quayTop + CRANE_LEG_H - 2,
        });
      }
    }

    const hullZ = pz + PIER_WIDTH / 2 + 25 + 22.5;
    buildings.push({
      id: `ship-${p}`,
      kind: "ship",
      x: px + 5,
      z: hullZ,
      w: 300,
      d: 45,
      h: 14,
      base: 0,
    });
    buildings.push({
      id: `ship-${p}-bridge`,
      kind: "superstructure",
      x: px + 5 + 120,
      z: hullZ,
      w: 30,
      d: 40,
      h: 22,
      base: 14,
    });

    for (let col = 0; col < 3; col++) {
      for (let row = -4; row <= 4; row++) {
        const tiers = 2 + ((p * 7 + col * 3 + (row + 4) * 5) % 4);
        buildings.push({
          id: `box-${p}-${col}-${row + 4}`,
          kind: "container",
          x: qx - QUAY_DEPTH - 150 - col * 250,
          z: pz + row * 60,
          w: 200,
          d: 30,
          h: tiers * 2.6,
          base: yardTop,
        });
      }
    }
  });

  for (let k = 0; k < 7; k++) {
    const r = {
      id: `warehouse-${k}`,
      x: qx - QUAY_DEPTH - YARD_DEPTH - 250,
      z: -6000 + k * 850,
      w: 200,
      d: 300,
    };
    buildings.push({ ...r, kind: "warehouse", h: 18, base: groundUnder(t, r) });
  }

  return { slabs, buildings };
}
