import {
  Aircraft,
  AntiDroneCourse,
  AttackCourse,
  Cam,
  CheckpointCourse,
  JetSimulation,
  MissileSystem,
  PlayMode,
  Vec3,
  buildingHitQuery,
  cycleCamera,
  internalHeightForQuality,
  sampleAim,
  sampleHeight,
  viewCamera,
  type AimSample,
  type AntiDroneState,
  type AttackState,
  type CheckpointState,
  type FlightInput,
  type GameSession,
  type JetTelemetry,
  type PlaceOfInterest,
} from "@afd/game-core";
import type { QualityProfile } from "@afd/shared-types";
import {
  Color,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { FlightCamera } from "./cameras/FlightCamera";
import { DebrisField } from "./combat/DebrisField";
import { MissileFx } from "./combat/MissileFx";
import { createJetMesh, setJetAfterburner, setJetExternalVisible } from "./jet/JetMesh";
import { DestructibleField } from "./missions/DestructibleField";
import { DroneField } from "./missions/DroneField";
import { RingField } from "./missions/RingField";
import { TrailPool } from "./trails/TrailPool";
import { WorldSystem } from "./world/WorldSystem";

/** Pose do jato para radar / cues em heading-up (eixos = Basis local). */
export interface JetPose {
  x: number;
  y: number;
  z: number;
  /** Basis.x (direita) */
  rx: number;
  ry: number;
  rz: number;
  /** Basis.y (cima) */
  ux: number;
  uy: number;
  uz: number;
  /** Basis.z (traseira; nariz = -Z) */
  bx: number;
  by: number;
  bz: number;
}

export interface FlightFrameState {
  telemetry: JetTelemetry;
  session: GameSession;
  view: Cam;
  place: PlaceOfInterest | null;
  dayFactor: number;
  missilesReady: number;
  aim: AimSample | null;
  jet: JetPose;
  checkpoint: CheckpointState | null;
  antidrone: AntiDroneState | null;
  attack: AttackState | null;
}

export interface FlightSceneOptions {
  quality?: QualityProfile;
  mouseSens?: number;
}

export interface FlightSceneHandle {
  resize: (w: number, h: number) => void;
  tick: (dt: number, input: FlightInput) => FlightFrameState;
  setPaused: (paused: boolean) => void;
  dispose: () => void;
  renderer: WebGLRenderer;
}

export function createFlightScene(
  canvas: HTMLCanvasElement,
  session: GameSession,
  options: FlightSceneOptions = {},
): FlightSceneHandle {
  const quality = options.quality ?? "medium";
  const mouseSens = options.mouseSens ?? 1;
  const internalH = internalHeightForQuality(quality);
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
    alpha: false,
  });
  renderer.setClearColor(new Color(0x1a222c), 1);
  renderer.autoClear = true;

  const scene = new Scene();
  const world = new WorldSystem(scene);

  const spawnX = 1200;
  const spawnZ = -800;
  const groundY = sampleHeight(spawnX, spawnZ);
  let spawnY = groundY + 320;
  let heading = 0.35;

  if (session.playMode === PlayMode.CHECKPOINT) {
    spawnY = groundY + 280;
  } else if (session.playMode === PlayMode.ANTI_DRONE) {
    spawnY = groundY + 400;
  } else if (session.playMode === PlayMode.ATTACK) {
    spawnY = groundY + 360;
  }

  const jetRoot = createJetMesh(session.aircraft ?? Aircraft.F22_RAPTOR);
  scene.add(jetRoot);

  const shadow = new Mesh(
    new PlaneGeometry(10, 14),
    new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI * 0.5;
  scene.add(shadow);

  const abTrails = new TrailPool(2, 48, 0xffa040, 0.85);
  const contrails = new TrailPool(2, 64, 0xddeeff, 0.45);
  scene.add(abTrails.group);
  scene.add(contrails.group);
  const abL = abTrails.acquire();
  const abR = abTrails.acquire();
  const ctL = contrails.acquire();
  const ctR = contrails.acquire();

  const missileFx = new MissileFx();
  scene.add(missileFx.group);
  const debris = new DebrisField();
  scene.add(debris.group);
  const missiles = new MissileSystem();

  const aimMarker = new Mesh(
    new SphereGeometry(2.2, 8, 6),
    new MeshBasicMaterial({ color: 0x66ffaa, transparent: true, opacity: 0.7 }),
  );
  scene.add(aimMarker);

  const rings = new RingField();
  scene.add(rings.group);
  const drones = new DroneField();
  scene.add(drones.group);
  const destructibles = new DestructibleField();
  scene.add(destructibles.group);

  const checkpoint =
    session.playMode === PlayMode.CHECKPOINT ? new CheckpointCourse() : null;
  const antidrone =
    session.playMode === PlayMode.ANTI_DRONE ? new AntiDroneCourse() : null;
  const attack =
    session.playMode === PlayMode.ATTACK ? new AttackCourse() : null;

  const jet = new JetSimulation();
  jet.setGroundSampler(world.sampleFloor);
  jet.resetPose(new Vec3(spawnX, spawnY, spawnZ), heading, 95);
  world.warm(spawnX, spawnZ);

  if (checkpoint) {
    checkpoint.start(
      session.missionLevel,
      { x: spawnX, y: spawnY, z: spawnZ },
      heading,
      world.sampleFloor,
    );
    rings.setGates(checkpoint.state.gates);
  }
  if (antidrone) {
    antidrone.start(
      session.missionLevel,
      { x: spawnX, y: spawnY, z: spawnZ },
      heading,
    );
  }
  if (attack) {
    attack.start(
      session.missionLevel,
      { x: spawnX, y: spawnY, z: spawnZ },
      heading,
    );
    for (const t of attack.state.targets) {
      world.buildings.hideBuilding(t.buildingId);
    }
    destructibles.sync(attack.state.targets);
  }

  const flightCam = new FlightCamera();
  flightCam.setMode(session.cameraMode);
  flightCam.chasePivot.set(spawnX, spawnY + 5, spawnZ + 20);
  flightCam.lookAhead.set(spawnX, spawnY, spawnZ - 14);

  let cssW = 1;
  let cssH = 1;
  let rt: WebGLRenderTarget | null = null;
  const quadScene = new Scene();
  const quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadMat = new MeshBasicMaterial({ depthTest: false, depthWrite: false });
  const quad = new Mesh(new PlaneGeometry(2, 2), quadMat);
  quadScene.add(quad);

  const worldNozzle = new Vector3();
  let place: PlaceOfInterest | null = null;
  let dayFactor = 1;
  let aim: AimSample | null = null;

  const rebuildRt = (w: number, h: number) => {
    const aspect = w / Math.max(1, h);
    const ih = internalH;
    const iw = Math.max(2, Math.round(ih * aspect));
    if (rt) rt.dispose();
    rt = new WebGLRenderTarget(iw, ih, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: true,
    });
    quadMat.map = rt.texture;
    quadMat.needsUpdate = true;
    flightCam.camera.aspect = aspect;
    flightCam.camera.updateProjectionMatrix();
  };

  const resize = (w: number, h: number) => {
    cssW = Math.max(1, w);
    cssH = Math.max(1, h);
    renderer.setSize(cssW, cssH, false);
    rebuildRt(cssW, cssH);
  };

  let telemetry: JetTelemetry = jet.tickTelemetry(1 / 60);
  let trailAcc = 0;

  const nozzleWorld = (localX: number, localY: number, localZ: number) => {
    const b = jet.basis;
    const p = jet.position;
    worldNozzle.set(
      p.x + b.x.x * localX + b.y.x * localY + b.z.x * localZ,
      p.y + b.x.y * localX + b.y.y * localY + b.z.y * localZ,
      p.z + b.x.z * localX + b.y.z * localY + b.z.z * localZ,
    );
    return worldNozzle;
  };

  const tick = (dt: number, input: FlightInput): FlightFrameState => {
    if (input.pause) session.paused = !session.paused;

    if (session.paused) {
      renderFrame();
      return frameState();
    }

    if (input.cycleCamera) {
      cycleCamera(session);
      if (session.cameraMode === Cam.FREE) {
        flightCam.enterFree({
          position: jet.position,
          basis: jet.basis,
          telemetry,
        });
      } else {
        flightCam.setMode(session.cameraMode);
      }
    }
    session.lookBackHold = input.lookBack;

    const missionOver =
      (checkpoint && checkpoint.state.status !== "RUN" && checkpoint.state.status !== "IDLE") ||
      (antidrone && antidrone.state.status !== "RUN" && antidrone.state.status !== "IDLE") ||
      (attack && attack.state.status !== "RUN" && attack.state.status !== "IDLE");

    if (session.cameraMode === Cam.FREE) {
      flightCam.update(
        dt,
        Cam.FREE,
        { position: jet.position, basis: jet.basis, telemetry },
        {
          x: input.bank,
          y: (input.freeUp ? 1 : 0) - (input.freeDown ? 1 : 0),
          z: -input.pitch,
          boost: input.freeBoost,
        },
        {
          dx: input.mouseDx * mouseSens,
          dy: input.mouseDy * mouseSens,
          wheel: input.wheel,
        },
      );
    } else if (
      !missionOver ||
      checkpoint?.state.status === "RUN" ||
      antidrone?.state.status === "RUN" ||
      attack?.state.status === "RUN"
    ) {
      jet.updateInput(dt, input.bank, input.pitch, input.afterburner);
      if (input.barrelRoll) jet.triggerBarrelRoll();
      jet.integrate(dt);
      telemetry = jet.tickTelemetry(dt);
      flightCam.update(dt, viewCamera(session), {
        position: jet.position,
        basis: jet.basis,
        telemetry,
      });
    } else {
      flightCam.update(dt, viewCamera(session), {
        position: jet.position,
        basis: jet.basis,
        telemetry,
      });
    }

    const nose = jet.basis.nose();
    const aimOrigin = {
      x: jet.position.x + nose.x * 4,
      y: jet.position.y + nose.y * 4,
      z: jet.position.z + nose.z * 4,
    };
    aim = sampleAim(aimOrigin, nose, world.sampleFloor);
    aimMarker.position.set(aim.x, aim.y, aim.z);

    if (input.fire && !missionOver) {
      const dir = aim.valid
        ? { x: aim.x - aimOrigin.x, y: aim.y - aimOrigin.y, z: aim.z - aimOrigin.z }
        : nose;
      const bay = nozzleWorld(0, -0.2, 2.5);
      missiles.tryFire({ x: bay.x, y: bay.y, z: bay.z }, dir);
    }

    const impacts = missiles.tick(dt, world.sampleFloor);
    for (const m of impacts) {
      missileFx.boom(m.x, m.y, m.z);
      antidrone?.tryBlast(m.x, m.y, m.z, 16);
      if (attack) {
        const n = attack.tryBlast(m.x, m.y, m.z, 22);
        if (n) {
          debris.burst(m.x, m.y, m.z, 10);
          destructibles.sync(attack.state.targets);
        }
      }
    }
    const cityBoxes = world.buildings.getCollisionAabbs();
    for (const m of missiles.missiles) {
      if (!m.active) continue;
      antidrone?.tryHitSegment(m.px, m.py, m.pz, m.x, m.y, m.z, 12);

      if (attack) {
        const r = attack.tryHitSegment(m.px, m.py, m.pz, m.x, m.y, m.z);
        if (r.hit) {
          m.active = false;
          missileFx.boom(m.x, m.y, m.z);
          if (r.destroyed && r.target) {
            debris.burst(r.target.aabb.cx, r.target.aabb.cy, r.target.aabb.cz, 16);
          } else {
            debris.burst(m.x, m.y, m.z, 6);
          }
          destructibles.sync(attack.state.targets);
          continue;
        }
      }

      const cityHit = buildingHitQuery(
        { x: m.px, y: m.py, z: m.pz },
        { x: m.x, y: m.y, z: m.z },
        cityBoxes,
      );
      if (cityHit) {
        m.active = false;
        m.x = cityHit.x;
        m.y = cityHit.y;
        m.z = cityHit.z;
        missileFx.boom(m.x, m.y, m.z);
      }
    }
    missileFx.sync(missiles.missiles);
    missileFx.tick(dt);
    debris.tick(dt);

    if (checkpoint?.state.active) {
      checkpoint.tick(dt, jet.position);
      rings.update(checkpoint.state.ringIndex, dt);
    }
    if (antidrone?.state.active) {
      antidrone.tick(dt);
      drones.sync(antidrone.state.drones);
    }
    if (attack?.state.active) {
      attack.tick(dt);
      destructibles.sync(attack.state.targets);
    }

    const worldInfo = world.update(dt, jet.position.x, jet.position.z);
    place = worldInfo.place;
    dayFactor = worldInfo.dayFactor;

    const b = jet.basis;
    jetRoot.matrixAutoUpdate = false;
    jetRoot.matrix.set(
      b.x.x, b.y.x, b.z.x, jet.position.x,
      b.x.y, b.y.y, b.z.y, jet.position.y,
      b.x.z, b.y.z, b.z.z, jet.position.z,
      0, 0, 0, 1,
    );
    jetRoot.matrixWorldNeedsUpdate = true;

    setJetAfterburner(jetRoot, telemetry.afterburner);
    const view = viewCamera(session);
    setJetExternalVisible(jetRoot, view !== Cam.COCKPIT);

    const floorY = world.sampleFloor(jet.position.x, jet.position.z);
    shadow.position.set(jet.position.x + 8, floorY + 0.5, jet.position.z + 6);
    const s = Math.min(1.6, Math.max(0.4, 1.5 - telemetry.radarHeight / 200));
    shadow.scale.set(s, s, s);
    shadow.visible = view !== Cam.COCKPIT;

    trailAcc += dt;
    if (trailAcc >= 1 / 40) {
      trailAcc = 0;
      if (telemetry.afterburner) {
        const l = nozzleWorld(-0.58, -0.08, 4.05);
        abTrails.push(abL, l.x, l.y, l.z);
        const r = nozzleWorld(0.58, -0.08, 4.05);
        abTrails.push(abR, r.x, r.y, r.z);
      }
      if (jet.position.y > 900) {
        const l = nozzleWorld(-0.58, -0.08, 4.15);
        contrails.push(ctL, l.x, l.y, l.z);
        const r = nozzleWorld(0.58, -0.08, 4.15);
        contrails.push(ctR, r.x, r.y, r.z);
      }
    }

    renderFrame();
    return frameState();
  };

  const frameState = (): FlightFrameState => {
    const b = jet.basis;
    return {
      telemetry,
      session,
      view: viewCamera(session),
      place,
      dayFactor,
      missilesReady: missiles.ready,
      aim,
      jet: {
        x: jet.position.x,
        y: jet.position.y,
        z: jet.position.z,
        rx: b.x.x,
        ry: b.x.y,
        rz: b.x.z,
        ux: b.y.x,
        uy: b.y.y,
        uz: b.y.z,
        bx: b.z.x,
        by: b.z.y,
        bz: b.z.z,
      },
      checkpoint: checkpoint?.state ?? null,
      antidrone: antidrone?.state ?? null,
      attack: attack?.state ?? null,
    };
  };

  const renderFrame = () => {
    if (!rt) return;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, flightCam.camera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(quadScene, quadCam);
  };

  const setPaused = (paused: boolean) => {
    session.paused = paused;
  };

  const dispose = () => {
    rt?.dispose();
    abTrails.dispose();
    contrails.dispose();
    missileFx.dispose();
    debris.dispose();
    rings.dispose();
    drones.dispose();
    destructibles.dispose();
    world.dispose();
    shadow.geometry.dispose();
    (shadow.material as MeshBasicMaterial).dispose();
    aimMarker.geometry.dispose();
    (aimMarker.material as MeshBasicMaterial).dispose();
    quad.geometry.dispose();
    quadMat.dispose();
    renderer.dispose();
  };

  return { resize, tick, setPaused, dispose, renderer };
}
