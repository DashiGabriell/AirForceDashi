import {
  CRUISE_ALT,
  DayClock,
  WATER_LEVEL,
  type BuildingAabb,
  type DayPhase,
  type PlaceOfInterest,
  type StreamMotion,
} from "@afd/game-core";
import { Scene } from "three";
import { CloudField } from "./CloudField";
import type { SurfaceHit } from "./ConstructionHit";
import { SkySystem } from "./SkySystem";
import { WaterSurface } from "./WaterSurface";
import type { WorldFrameInfo } from "./WorldSystem";

/** No city on the arena. Keeps the flight loop's building queries valid. */
class EmptyBuildings {
  getCollisionAabbs(
    _origin?: { x: number; z: number },
    _radius?: number,
  ): BuildingAabb[] {
    return [];
  }

  hideBuilding(_id: string): void {}
}

/** No authored meshes. The sea is the only surface, and the jet already samples it. */
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
 * Combat arena: sky, a high thin cloud deck, and an animated ocean.
 * Floor is y = 0 everywhere. Nothing here is gameplay state.
 */
export class ArenaWorld {
  readonly buildings = new EmptyBuildings();
  readonly constructions = new EmptyConstructions();
  readonly clouds: CloudField;
  readonly sky: SkySystem;
  /** Locked at noon. The clock does not advance. */
  readonly clock = new DayClock(12);
  private readonly water: WaterSurface;

  constructor(scene: Scene) {
    this.sky = new SkySystem(scene);
    this.clouds = new CloudField({
      clusters: 24,
      deck: { min: 5500, max: 7000 },
      fixedDensity: 0.55,
      windAngle: 0.55,
    });
    this.water = new WaterSurface(this.sky.haze, { animate: true });
    scene.add(this.clouds.group);
    scene.add(this.water.mesh);
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
    this.water.update(0, wx, wz, this.clock.sunDir, this.clock.dayFactor, CRUISE_ALT);
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
        duskFactor: 0,
        dawnFactor: 0,
        altitude: wy,
      },
    );
    this.water.update(dt, wx, wz, this.clock.sunDir, this.clock.dayFactor, wy);
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
    this.water.dispose();
  }
}
