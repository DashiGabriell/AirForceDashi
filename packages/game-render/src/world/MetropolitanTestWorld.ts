import {
  BUILDING_COLLISION_XZ,
  CRUISE_ALT,
  DayClock,
  METRO_AIRPORT_SPAWN,
  WATER_LEVEL,
  buildAirportBlockout,
  buildBridgesBlockout,
  buildCoastalBlockout,
  buildDowntownBlockout,
  buildHarborBlockout,
  buildMetroCheckpoint,
  footprintHalfExtents,
  isThroughGate,
  sampleMetroHeight,
  type BuildingAabb,
  type DayPhase,
  type GatePoint,
  type MetroBuilding,
  type MetroTerrainData,
  type PlaceOfInterest,
  type StreamMotion,
} from "@afd/game-core";
import { InstancedMesh, Mesh, MeshLambertMaterial, Scene } from "three";
import { RingField } from "../missions/RingField";
import { CloudField } from "./CloudField";
import type { SurfaceHit } from "./ConstructionHit";
import { buildBlockoutMesh, buildSlabMesh } from "./MetropolitanBlockoutMesh";
import { loadMetroTerrain } from "./MetropolitanTerrainLoader";
import { buildMetroTerrainMesh } from "./MetropolitanTerrainMesh";
import { SkySystem } from "./SkySystem";
import type { WorldFrameInfo } from "./WorldSystem";

/** Cruise start lined up with the west runway, nose toward Downtown (+Z). */
export const METRO_TEST_SPAWN = METRO_AIRPORT_SPAWN;

/** Blockout volumes as collision boxes. Their bases follow the ground. */
class BlockoutBuildings {
  private aabbs: BuildingAabb[] = [];

  replace(buildings: readonly MetroBuilding[]): void {
    this.aabbs = buildings.map((b) => {
      const { hx, hz } = footprintHalfExtents(b);
      return {
        id: b.id,
        cx: b.x,
        cy: b.base + b.h * 0.5,
        cz: b.z,
        hx: hx * BUILDING_COLLISION_XZ,
        hy: b.h * 0.5,
        hz: hz * BUILDING_COLLISION_XZ,
      };
    });
  }

  getCollisionAabbs(
    origin?: { x: number; z: number },
    radius?: number,
  ): BuildingAabb[] {
    if (!origin || radius === undefined) return this.aabbs;
    return this.aabbs.filter(
      (a) =>
        Math.abs(a.cx - origin.x) <= radius + a.hx &&
        Math.abs(a.cz - origin.z) <= radius + a.hz,
    );
  }

  hideBuilding(_id: string): void {}
}

/** No authored constructions beyond the blockout volumes. */
class EmptyConstructions {
  segment(
    _ax: number,
    _ay: number,
    _az: number,
    _bx: number,
    _by: number,
    _bz: number,
  ): SurfaceHit | null {
    return null;
  }
}

/**
 * Metropolitan test world: the real 58 km terrain painted by area, the
 * Downtown, Airport, Harbor and Coastal blockouts standing on it, the three
 * bridges over the canals, the 12-gate CheckPoint course, and a late-afternoon sky.
 * Terrain and buildings load in warm().
 */
export class MetropolitanTestWorld {
  readonly buildings = new BlockoutBuildings();
  readonly constructions = new EmptyConstructions();
  readonly clouds: CloudField;
  readonly sky: SkySystem;
  /** Locked at late afternoon. The clock does not advance. */
  readonly clock = new DayClock(17.3);
  private readonly scene: Scene;
  private terrain: MetroTerrainData | null = null;
  private terrainMesh: Mesh | null = null;
  private readonly blockoutMeshes: InstancedMesh[] = [];
  /** CheckPoint course shown in free flight. Gates light up in order as the jet passes. */
  private readonly rings = new RingField();
  private gates: GatePoint[] = [];
  private gateIndex = 0;
  private courseDoneFor = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    scene.add(this.rings.group);
    this.sky = new SkySystem(scene);
    this.clouds = new CloudField({
      clusters: 24,
      deck: { min: 5500, max: 7000 },
      fixedDensity: 0.55,
      windAngle: 0.55,
    });
    scene.add(this.clouds.group);
  }

  /** Ground height under the jet. Sea level until the terrain has loaded. */
  sampleFloor = (x: number, z: number): number =>
    this.terrain ? sampleMetroHeight(this.terrain, x, z) : WATER_LEVEL;

  async warm(
    wx: number,
    wz: number,
    _motion?: StreamMotion,
    onProgress?: (t: number) => void,
  ): Promise<void> {
    if (!this.terrain) {
      onProgress?.(0.05);
      const terrain = await loadMetroTerrain();
      this.terrain = terrain;
      onProgress?.(0.6);
      this.terrainMesh = buildMetroTerrainMesh(terrain);
      this.scene.add(this.terrainMesh);

      const airport = buildAirportBlockout(terrain);
      const harbor = buildHarborBlockout(terrain);
      const coastal = buildCoastalBlockout(terrain);
      const bridges = buildBridgesBlockout(terrain);
      const buildings = [
        ...buildDowntownBlockout(terrain),
        ...airport.buildings,
        ...harbor.buildings,
        ...coastal.buildings,
        ...bridges.buildings,
      ];
      this.gates = buildMetroCheckpoint(bridges.bridges);
      this.rings.setGates(this.gates);
      this.gateIndex = 0;
      const slabs = [...airport.slabs, ...harbor.slabs, ...coastal.slabs];
      this.blockoutMeshes.push(
        buildBlockoutMesh(buildings),
        buildSlabMesh(
          "MetropolitanPavement",
          slabs.filter((s) => s.kind !== "marking"),
          1,
        ),
        buildSlabMesh(
          "MetropolitanMarkings",
          slabs.filter((s) => s.kind === "marking"),
          2,
        ),
      );
      for (const mesh of this.blockoutMeshes) this.scene.add(mesh);
      this.buildings.replace(buildings);
      onProgress?.(0.9);
    }
    this.sky.update(this.clock, wx, wz, CRUISE_ALT);
    this.clouds.seed(wx, wz);
    onProgress?.(1);
  }

  update(
    dt: number,
    wx: number,
    wz: number,
    wy = CRUISE_ALT,
    _motion?: StreamMotion,
  ): WorldFrameInfo {
    this.sky.update(this.clock, wx, wz, wy);
    this.updateCourse(dt, wx, wy, wz);
    this.clouds.update(
      dt,
      wx,
      wz,
      this.clock.dayFactor,
      this.clock.sunDir,
      {
        color: this.sky.fogTint,
        near: 5200,
        far: 12000,
      },
      {
        phase: this.clock.phase,
        duskFactor: this.clock.duskFactor,
        dawnFactor: this.clock.dawnFactor,
        altitude: wy,
      },
    );
    const place: PlaceOfInterest | null = null;
    const phase: DayPhase = this.clock.phase;
    return {
      place,
      dayFactor: this.clock.dayFactor,
      hour: this.clock.hour,
      phase,
      radarContacts: [],
    };
  }

  /** After the last gate the course stays lit for a few seconds, then resets. */
  private updateCourse(dt: number, x: number, y: number, z: number): void {
    if (this.gates.length === 0) return;
    if (this.gateIndex >= this.gates.length) {
      this.courseDoneFor += dt;
      if (this.courseDoneFor > 6) {
        this.gateIndex = 0;
        this.courseDoneFor = 0;
      }
    } else if (isThroughGate(this.gates[this.gateIndex]!, { x, y, z })) {
      this.gateIndex++;
    }
    this.rings.update(this.gateIndex, dt);
  }

  dispose(): void {
    this.scene.remove(this.rings.group);
    this.rings.dispose();
    this.clouds.dispose();
    this.sky.dispose();
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as MeshLambertMaterial).dispose();
    }
    for (const mesh of this.blockoutMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshLambertMaterial).dispose();
      mesh.dispose();
    }
  }
}
