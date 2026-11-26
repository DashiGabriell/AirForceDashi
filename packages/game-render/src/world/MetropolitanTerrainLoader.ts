import {
  decodeMetroHeights,
  METRO_GRID_N,
  type MetroTerrainData,
} from "@afd/game-core";

const HEIGHT_URL = "/maps/metropolitan/heightmap_2049.u16.gz";
const ZONING_URL = "/maps/metropolitan/zoning_2049.u8.gz";

/**
 * Downloads a .gz file and returns its inflated bytes. Some servers (Vite dev)
 * send .gz with Content-Encoding: gzip, so the browser has already inflated it;
 * only inflate here when the gzip magic bytes are still present.
 */
async function fetchGunzip(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`terreno: ${url} respondeu ${res.status}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const inflated = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
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
