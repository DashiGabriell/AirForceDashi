import {
  DayClock,
  WATER_LEVEL,
  buildPlaces,
  nearestPlace,
  solidFloor,
  type PlaceOfInterest,
} from "@afd/game-core";
import {
  CircleGeometry,
  Color,
  Mesh,
  Scene,
  ShaderMaterial,
} from "three";
import { HORIZON_COLOR_GLSL, HORIZON_FAR, HORIZON_NEAR } from "./radialHorizon";
import { AirTraffic } from "./AirTraffic";
import { BuildingField } from "./BuildingField";
import { CloudField } from "./CloudField";
import { SkySystem } from "./SkySystem";
import { TerrainStreamer } from "./TerrainStreamer";
import { VegetationField } from "./VegetationField";

export interface WorldFrameInfo {
  place: PlaceOfInterest | null;
  dayFactor: number;
}

export class WorldSystem {
  readonly terrain = new TerrainStreamer();
  readonly buildings = new BuildingField();
  readonly vegetation = new VegetationField();
  readonly clouds = new CloudField();
  readonly traffic = new AirTraffic();
  readonly sky: SkySystem;
  readonly clock = new DayClock();
  readonly places = buildPlaces();
  private water: Mesh;
  private ground: Mesh;
  private refreshAcc = 0;

  constructor(scene: Scene) {
    this.sky = new SkySystem(scene);
    this.terrain.bindSky(this.sky.haze);
    this.buildings.bindSky(this.sky.haze);
    this.vegetation.bindSky(this.sky.haze);
    scene.add(this.terrain.group);
    scene.add(this.buildings.mesh);
    scene.add(this.vegetation.mesh);
    scene.add(this.clouds.group);
    scene.add(this.traffic.group);

    this.ground = new Mesh(
      new CircleGeometry(460000, 80),
      new ShaderMaterial({
        depthWrite: true,
        uniforms: { uHaze: { value: this.sky.haze } },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorld = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
            if (gl_Position.w > 0.0) gl_Position.z = gl_Position.w * 0.999;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          varying vec3 vWorld;
          uniform vec3 uHaze;
          ${HORIZON_COLOR_GLSL}
          void main() {
            gl_FragColor = vec4(afdHorizonColor(vWorld.xz, uHaze), 1.0);
          }
        `,
      }),
    );
    this.ground.rotation.x = -Math.PI * 0.5;
    this.ground.position.y = WATER_LEVEL - 1;
    this.ground.frustumCulled = false;
    this.ground.renderOrder = 0;
    scene.add(this.ground);

    const waterColor = new Color(0x2a4a5c);
    this.water = new Mesh(
      new CircleGeometry(HORIZON_FAR + 400, 96),
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uWater: { value: waterColor },
          uHaze: { value: this.sky.haze },
          uNear: { value: HORIZON_NEAR + 80 },
          uFar: { value: HORIZON_FAR },
        },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorld = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          varying vec3 vWorld;
          uniform vec3 uWater;
          uniform vec3 uHaze;
          uniform float uNear;
          uniform float uFar;
          ${HORIZON_COLOR_GLSL}
          void main() {
            float dist = distance(vWorld.xz, cameraPosition.xz);
            float fog = smoothstep(uNear, uFar, dist);
            vec3 col = mix(uWater, afdHorizonColor(vWorld.xz, uHaze), fog);
            float alpha = mix(0.92, 0.0, fog);
            if (alpha < 0.02) discard;
            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    );
    this.water.rotation.x = -Math.PI * 0.5;
    this.water.position.y = WATER_LEVEL + 0.2;
    this.water.frustumCulled = false;
    scene.add(this.water);
  }

  /** Sample height for jet ground clamp. */
  sampleFloor = (x: number, z: number): number => solidFloor(x, z);

  warm(wx: number, wz: number): void {
    this.terrain.warm(wx, wz, 16);
    this.buildings.update(wx, wz, true);
    this.vegetation.update(wx, wz, true);
    this.sky.update(this.clock, wx, wz, 400);
    this.clouds.seed(wx, wz);
  }

  update(dt: number, wx: number, wz: number, wy = 400): WorldFrameInfo {
    this.clock.tick(dt);
    this.sky.update(this.clock, wx, wz, wy);
    this.terrain.update(wx, wz);
    this.refreshAcc += dt;
    if (this.refreshAcc > 0.2) {
      this.refreshAcc = 0;
      this.buildings.update(wx, wz);
      this.vegetation.update(wx, wz);
    }
    this.clouds.update(dt, wx, wz, this.clock.dayFactor, this.clock.sunDir, {
      color: this.sky.fogTint,
      near: this.sky.fogNear,
      far: this.sky.fogFar,
    });
    this.traffic.update(dt, wx, wz);
    this.water.position.x = wx;
    this.water.position.z = wz;
    this.ground.position.x = wx;
    this.ground.position.z = wz;

    return {
      place: nearestPlace(wx, wz, this.places),
      dayFactor: this.clock.dayFactor,
    };
  }

  dispose(): void {
    this.terrain.dispose();
    this.buildings.dispose();
    this.vegetation.dispose();
    this.clouds.dispose();
    this.traffic.dispose();
    this.sky.dispose();
    this.water.geometry.dispose();
    (this.water.material as ShaderMaterial).dispose();
    this.ground.geometry.dispose();
    (this.ground.material as ShaderMaterial).dispose();
  }
}
