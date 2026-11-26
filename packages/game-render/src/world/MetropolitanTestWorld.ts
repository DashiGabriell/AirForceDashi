import {
  BUILDING_COLLISION_XZ,
  CRUISE_ALT,
  DayClock,
  WATER_LEVEL,
  type BuildingAabb,
  type DayPhase,
  type PlaceOfInterest,
  type StreamMotion,
} from "@afd/game-core";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import { CloudField } from "./CloudField";
import type { SurfaceHit } from "./ConstructionHit";
import { SkySystem } from "./SkySystem";
import type { WorldFrameInfo } from "./WorldSystem";

/** Zoning preview: one flat color per area, same 58 km grid as the heightmap. */
const ZONING_URL = "/maps/metropolitan/zoning_preview.png";
/** Full grid side (2 × 29 km circle). */
const GROUND_SIDE = 58000;

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

/** Towers are the only buildings on the test map. */
class TestBuildings {
  private readonly aabbs: BuildingAabb[];

  constructor(towers: readonly TestTower[]) {
    this.aabbs = towers.map((t) => ({
      id: t.id,
      cx: t.x,
      cy: t.h * 0.5,
      cz: t.z,
      hx: t.w * 0.5 * BUILDING_COLLISION_XZ,
      hy: t.h * 0.5,
      hz: t.w * 0.5 * BUILDING_COLLISION_XZ,
    }));
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
 * Metropolitan teste 0: flat ground at sea level painted by area, four test
 * towers, and a late-afternoon sky. No terrain data, no streaming.
 */
export class MetropolitanTestWorld {
  readonly buildings: TestBuildings;
  readonly constructions = new EmptyConstructions();
  readonly clouds: CloudField;
  readonly sky: SkySystem;
  /** Locked at late afternoon. The clock does not advance. */
  readonly clock = new DayClock(17.3);
  private readonly ground: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly towers: Group;
  private readonly towerMeshes: Mesh<BoxGeometry, MeshLambertMaterial>[] = [];
  private readonly towerMaterials: MeshLambertMaterial[] = [];

  constructor(scene: Scene) {
    this.sky = new SkySystem(scene);
    this.clouds = new CloudField({
      clusters: 24,
      deck: { min: 5500, max: 7000 },
      fixedDensity: 0.55,
      windAngle: 0.55,
    });
    scene.add(this.clouds.group);

    const zoning = new TextureLoader().load(ZONING_URL);
    zoning.colorSpace = SRGBColorSpace;
    this.ground = new Mesh(
      new PlaneGeometry(GROUND_SIDE, GROUND_SIDE),
      new MeshBasicMaterial({ map: zoning }),
    );
    this.ground.rotation.x = -Math.PI * 0.5;
    this.ground.position.y = WATER_LEVEL;
    this.ground.name = "MetropolitanZoning";
    scene.add(this.ground);

    this.towers = new Group();
    this.towers.name = "MetropolitanTestTowers";
    for (const t of METRO_TEST_TOWERS) {
      const material = new MeshLambertMaterial({
        color: t.h >= 400 ? 0xb0503c : 0x8a9098,
      });
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
      mesh.name = t.id;
      mesh.scale.set(t.w, t.h, t.w);
      mesh.position.set(t.x, t.h * 0.5, t.z);
      this.towers.add(mesh);
      this.towerMeshes.push(mesh);
      this.towerMaterials.push(material);
    }
    scene.add(this.towers);

    this.buildings = new TestBuildings(METRO_TEST_TOWERS);
  }

  sampleFloor = (_x: number, _z: number): number => WATER_LEVEL;

  async warm(
    wx: number,
    wz: number,
    _motion?: StreamMotion,
    onProgress?: (t: number) => void,
  ): Promise<void> {
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
    this.ground.geometry.dispose();
    this.ground.material.map?.dispose();
    this.ground.material.dispose();
    for (const mesh of this.towerMeshes) mesh.geometry.dispose();
    for (const material of this.towerMaterials) material.dispose();
  }
}
