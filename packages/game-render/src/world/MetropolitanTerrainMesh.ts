import {
  METRO_CIRCLE_R,
  METRO_H_MAX,
  METRO_STEP,
  METRO_ZONE_RGB,
  type MetroTerrainData,
} from "@afd/game-core";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshLambertMaterial,
  SRGBColorSpace,
} from "three";

/** Every 4th grid node: 513² vertices, about 113 m apart. */
export const METRO_MESH_STRIDE = 4;

/**
 * Builds the whole 58 km terrain as one lit mesh. Vertex colors come from the
 * zoning mask, so each area reads as its own color.
 */
export function buildMetroTerrainMesh(
  t: MetroTerrainData,
  stride = METRO_MESH_STRIDE,
): Mesh {
  const cells = Math.floor((t.n - 1) / stride);
  const m = cells + 1;
  const positions = new Float32Array(m * m * 3);
  const colors = new Float32Array(m * m * 3);
  const tint = new Color();

  for (let j = 0; j < m; j++) {
    for (let i = 0; i < m; i++) {
      const gi = i * stride;
      const gj = j * stride;
      const k = gj * t.n + gi;
      const v = (j * m + i) * 3;
      positions[v] = -METRO_CIRCLE_R + gi * METRO_STEP;
      positions[v + 1] = (t.heights[k]! * METRO_H_MAX) / 65535;
      positions[v + 2] = -METRO_CIRCLE_R + gj * METRO_STEP;

      const rgb = METRO_ZONE_RGB[t.zones[k]!] ?? METRO_ZONE_RGB[0]!;
      tint.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, SRGBColorSpace);
      colors[v] = tint.r;
      colors[v + 1] = tint.g;
      colors[v + 2] = tint.b;
    }
  }

  // Two counter-clockwise triangles per cell, facing up.
  const indices = new Uint32Array(cells * cells * 6);
  let p = 0;
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a = j * m + i;
      const b = a + 1;
      const c = a + m;
      const d = c + 1;
      indices[p++] = a;
      indices[p++] = c;
      indices[p++] = b;
      indices[p++] = b;
      indices[p++] = c;
      indices[p++] = d;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  const mesh = new Mesh(
    geometry,
    new MeshLambertMaterial({ vertexColors: true }),
  );
  mesh.name = "MetropolitanTerrain";
  return mesh;
}
