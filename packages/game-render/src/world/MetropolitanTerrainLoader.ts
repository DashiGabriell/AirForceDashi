import {
  decodeMetroHeights,
  METRO_GRID_N,
  type MetroTerrainData,
} from "@afd/game-core";

const HEIGHT_URL = "/maps/metropolitan/heightmap_2049.u16.gz";
const ZONING_URL = "/maps/metropolitan/zoning_2049.u8.gz";

/** Downloads a gzip file and returns its inflated bytes. */
async function fetchGunzip(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`terreno: ${url} respondeu ${res.status}`);
  }
  const inflated = res.body.pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(inflated).arrayBuffer());
}

/** Loads the Metropolitan heightmap and zoning mask from the public folder. */
export async function loadMetroTerrain(): Promise<MetroTerrainData> {
  const n = METRO_GRID_N;
  const [heightBytes, zoneBytes] = await Promise.all([
    fetchGunzip(HEIGHT_URL),
    fetchGunzip(ZONING_URL),
  ]);
  if (zoneBytes.byteLength !== n * n) {
    throw new Error(
      `zoneamento com ${zoneBytes.byteLength} bytes, esperado ${n * n}`,
    );
  }
  return {
    n,
    heights: decodeMetroHeights(heightBytes, n),
    zones: zoneBytes,
  };
}
