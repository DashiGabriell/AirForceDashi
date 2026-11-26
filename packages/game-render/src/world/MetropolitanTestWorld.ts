import {
  BUILDING_COLLISION_XZ,
  CRUISE_ALT,
  DayClock,
  WATER_LEVEL,
  buildDowntownBlockout,
  sampleMetroHeight,
  type BuildingAabb,
  type DayPhase,
  type MetroBuilding,
  type MetroTerrainData,
  type PlaceOfInterest,
  type StreamMotion,
} from "@afd/game-core";
import { InstancedMesh, Mesh, MeshLambertMaterial, Scene } from "three";
import { CloudField } from "./CloudField";
import type { SurfaceHit } from "./ConstructionHit";
import { buildBlockoutMesh } from "./MetropolitanBlockoutMesh";
import { loadMetroTerrain } from "./MetropolitanTerrainLoader";
import { buildMetroTerrainMesh } from "./MetropolitanTerrainMesh";
import { SkySystem } from "./SkySystem";
import type { WorldFrameInfo } from "./WorldSystem";

/** Start on the airport, nose toward Downtown (+Z). */
export const METRO_TEST_SPAWN = { x: -859, z: -13266, heading: Math.PI };

/** Blockout volumes as collision boxes. Their bases follow the ground. */
class BlockoutBuildings {
  private aabbs: BuildingAabb[] = [];

  replace(buildings: readonly MetroBuilding[]): void {
    this.aabbs = buildings.map((b) => ({
      id: b.id,
      cx: b.x,
      cy: b.base + b.h * 0.5,
      cz: b.z,
      hx: b.w * 0.5 * BUILDING_COLLISION_XZ,
      hy: b.h * 0.5,
      hz: b.d * 0.5 * BUILDING_COLLISION_XZ,
    }));
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
 * Downtown blockout standing on it, and a late-afternoon sky. Terrain and
 * buildings load in warm().
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
  private downtownMesh: InstancedMesh | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
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

      const downtown = buildDowntownBlockout(terrain);
      this.downtownMesh = buildBlockoutMesh(downtown);
      this.scene.add(this.downtownMesh);
      this.buildings.replace(downtown);
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

  dispose(): void {
    this.clouds.dispose();
    this.sky.dispose();
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as MeshLambertMaterial).dispose();
    }
    if (this.downtownMesh) {
      this.scene.remove(this.downtownMesh);
      this.downtownMesh.geometry.dispose();
      (this.downtownMesh.material as MeshLambertMaterial).dispose();
      this.downtownMesh.dispose();
    }
  }
}
