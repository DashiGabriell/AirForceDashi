import {
  BUILDING_COLLISION_XZ,
  CRUISE_ALT,
  DayClock,
  WATER_LEVEL,
  sampleMetroHeight,
  type BuildingAabb,
  type DayPhase,
  type MetroTerrainData,
  type PlaceOfInterest,
  type StreamMotion,
} from "@afd/game-core";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  Scene,
} from "three";
import { CloudField } from "./CloudField";
import type { SurfaceHit } from "./ConstructionHit";
import { loadMetroTerrain } from "./MetropolitanTerrainLoader";
import { buildMetroTerrainMesh } from "./MetropolitanTerrainMesh";
import { SkySystem } from "./SkySystem";
import type { WorldFrameInfo } from "./WorldSystem";

/** Start on the airport, nose toward Downtown (+Z). */
export const METRO_TEST_SPAWN = { x: -859, z: -13266, heading: Math.PI };

interface TestTower {
  id: string;
  x: number;
  z: number;
  h: number;
  w: number;
}

/** Test towers in Downtown. Two at 200 m, two at 450 m. */
export const METRO_TEST_TOWERS: readonly TestTower[] = [
  { id: "test-200-a", x: -650, z: -5000, h: 200, w: 70 },
  { id: "test-200-b", x: -300, z: -5000, h: 200, w: 70 },
  { id: "test-450-a", x: -470, z: -5250, h: 450, w: 70 },
  { id: "test-450-b", x: -470, z: -4850, h: 450, w: 70 },
];

/** Towers are the only buildings on the test map. Their boxes follow the ground. */
class TestBuildings {
  private aabbs: BuildingAabb[] = [];

  replace(aabbs: BuildingAabb[]): void {
    this.aabbs = aabbs;
  }

  getCollisionAabbs(
    _origin?: { x: number; z: number },
    _radius?: number,
  ): BuildingAabb[] {
    return this.aabbs;
  }

  hideBuilding(_id: string): void {}
}

/** No authored constructions beyond the test towers. */
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
 * Metropolitan teste 1: the real 58 km terrain, painted by area, with four test
 * towers standing on it, and a late-afternoon sky. Terrain loads in warm().
 */
export class MetropolitanTestWorld {
  readonly buildings = new TestBuildings();
  readonly constructions = new EmptyConstructions();
  readonly clouds: CloudField;
  readonly sky: SkySystem;
  /** Locked at late afternoon. The clock does not advance. */
  readonly clock = new DayClock(17.3);
  private readonly scene: Scene;
  private terrain: MetroTerrainData | null = null;
  private terrainMesh: Mesh | null = null;
  private readonly towers = new Group();
  private readonly towerMeshes: Mesh<BoxGeometry, MeshLambertMaterial>[] = [];
  private readonly towerMaterials: MeshLambertMaterial[] = [];

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
    this.towers.name = "MetropolitanTestTowers";
    scene.add(this.towers);
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
      this.buildTowers(terrain);
      onProgress?.(0.9);
    }
    this.sky.update(this.clock, wx, wz, CRUISE_ALT);
    this.clouds.seed(wx, wz);
    onProgress?.(1);
  }

  private buildTowers(terrain: MetroTerrainData): void {
    const aabbs: BuildingAabb[] = [];
    for (const t of METRO_TEST_TOWERS) {
      const base = sampleMetroHeight(terrain, t.x, t.z);
      const material = new MeshLambertMaterial({
        color: t.h >= 400 ? 0xb0503c : 0x8a9098,
      });
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
      mesh.name = t.id;
      mesh.scale.set(t.w, t.h, t.w);
      mesh.position.set(t.x, base + t.h * 0.5, t.z);
      this.towers.add(mesh);
      this.towerMeshes.push(mesh);
      this.towerMaterials.push(material);
      aabbs.push({
        id: t.id,
        cx: t.x,
        cy: base + t.h * 0.5,
        cz: t.z,
        hx: t.w * 0.5 * BUILDING_COLLISION_XZ,
        hy: t.h * 0.5,
        hz: t.w * 0.5 * BUILDING_COLLISION_XZ,
      });
    }
    this.buildings.replace(aabbs);
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
    for (const mesh of this.towerMeshes) mesh.geometry.dispose();
    for (const material of this.towerMaterials) material.dispose();
  }
}
