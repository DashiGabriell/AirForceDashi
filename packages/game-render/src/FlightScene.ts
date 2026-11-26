import {
  Aircraft,
  AntiDroneCourse,
  AttackCourse,
  Cam,
  CheckpointCourse,
  JetSimulation,
  CountermeasureSystem,
  MissileSystem,
  PlayMode,
  TargetLockTracker,
  TargetPracticeCourse,
  CHECKPOINT_START,
  MAP_SPAWN,
  RWR_LOCK_ACQUIRE,
  RWR_PAINT_MAX,
  RWR_PAINT_MIN,
  WATER_LEVEL,
  Vec3,
  buildingHitQuery,
  cycleCamera,
  DLZ_RAERO,
  DLZ_RMIN,
  emptyRwr,
  evaluateRwr,
  internalHeightForQuality,
  resolveLoadoutPerformance,
  sampleAim,
  sampleHeight,
  sensorFor,
  viewCamera,
  weaponById,
  type AimSample,
  type FlareMode,
  type LockCandidate,
  type AntiDroneState,
  type AttackState,
  type CheckpointState,
  type DayPhase,
  type FlightInput,
  type GameSession,
  type JetTelemetry,
  type PlaceOfInterest,
  type RwrState,
  type TargetPracticeState,
} from "@afd/game-core";
import type { QualityProfile } from "@afd/shared-types";
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { AdaptiveScale } from "./AdaptiveScale";
import { FlightCamera } from "./cameras/FlightCamera";
import { createAimMarker } from "./combat/AimMarker";
import { DebrisField } from "./combat/DebrisField";
import { FlareField } from "./combat/FlareField";
import { MissileFx } from "./combat/MissileFx";
import { ExhaustFx } from "./jet/ExhaustFx";
import { setJetAfterburner, setJetExternalVisible } from "./jet/JetMesh";
import { attachFlightJet } from "./jet/JetModel";
import { bakeJetPlanform, type JetPlanform } from "./jet/JetShadow";
import { DestructibleField } from "./missions/DestructibleField";
import { DroneField } from "./missions/DroneField";
import { RingField } from "./missions/RingField";
import { TargetField } from "./missions/TargetField";
import { AbRibbonTrail } from "./trails/AbRibbonTrail";
import { TrailPool } from "./trails/TrailPool";
import { NavBeacon, type NavWaypoint } from "./world/NavBeacon";
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
  vx: number;
  vy: number;
  vz: number;
}

export type FlightSfxEvent =
  | "missile"
  | "boom"
  | "boom_water"
  | "flare"
  | "roll"
  | "checkpoint_ok"
  | "level_clear"
  | {
      id: "missile" | "boom" | "boom_water" | "flare";
      x: number;
      y: number;
      z: number;
      vx?: number;
      vy?: number;
      vz?: number;
    };

/** Screen-space CCIP / FPM / bore — CSS pixels relative to canvas. */
export interface AimHudState {
  valid: boolean;
  ready: boolean;
  inDlz: boolean;
  range: number;
  /** Hide ground CCIP + A/G pipper (CheckPoint race). */
  raceMode: boolean;
  aim: { x: number; y: number; on: boolean };
  fpm: { x: number; y: number; on: boolean };
  bore: { x: number; y: number; on: boolean };
  /** Single-target lock (Attack / Anti-Drone). */
  lock: {
    phase: "none" | "acquiring" | "locked";
    progress: number;
    kind: "aa" | "ag" | null;
    range: number;
    screen: { x: number; y: number; on: boolean };
  };
}

export interface RadarHudContact {
  x: number;
  y: number;
  z: number;
  primary?: boolean;
}

export interface FlightFrameState {
  telemetry: JetTelemetry;
  session: GameSession;
  view: Cam;
  /** Segurando Q — órbita próxima do jato. */
  inspecting: boolean;
  place: PlaceOfInterest | null;
  dayFactor: number;
  /** Game clock hour 0..24 (1h = 1 real minute). */
  hour: number;
  phase: DayPhase;
  missilesReady: number;
  flaresReady: number;
  flaresMax: number;
  /** Hostile paint / inbound seeker (RWR). */
  rwr: RwrState;
  aim: AimSample | null;
  aimHud: AimHudState | null;
  jet: JetPose;
  sfx: FlightSfxEvent[];
  /** Free-flight radar blips (POIs + traffic). */
  radarContacts: RadarHudContact[];
  checkpoint: CheckpointState | null;
  antidrone: AntiDroneState | null;
  attack: AttackState | null;
  targetPractice: TargetPracticeState | null;
}

export interface FlightSceneOptions {
  quality?: QualityProfile;
  mouseSens?: number;
  /** Livrea do material Paint. Default: factory. */
  skinId?: string;
  /** ID do armamento AA equipado (visual do míssil em voo). */
  aaWeaponId?: string;
  /** ID do armamento AG equipado (reservado para modo A/G). */
  agWeaponId?: string;
  /** Flare dump mode (settings). */
  flareMode?: FlareMode;
  /** 0..1 while the approach corridor is made resident. */
  onBootProgress?: (progress: number) => void;
}

export interface FlightVfxStats {
  particles: number;
  booms: number;
  dropped: number;
}

export interface FlightSceneHandle {
  resize: (w: number, h: number) => void;
  tick: (dt: number, input: FlightInput) => FlightFrameState;
  setPaused: (paused: boolean) => void;
  /** Live mouse look sensitivity (pause Config). */
  setMouseSens: (sens: number) => void;
  /** Live flare mode from pause Config. */
  setFlareMode: (mode: FlareMode) => void;
  /** Pause-map nav pin (ground beacon when near). */
  setNavWaypoint: (wp: NavWaypoint | null) => void;
  dispose: () => void;
  renderer: WebGLRenderer;
  vfxStats: () => FlightVfxStats;
  /** Current adaptive internal-resolution scale (0.6–1). */
  adaptiveScale: () => number;
}

export async function createFlightScene(
  canvas: HTMLCanvasElement,
  session: GameSession,
  options: FlightSceneOptions = {},
): Promise<FlightSceneHandle> {
  options.onBootProgress?.(0.02);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

  const quality = options.quality ?? "medium";
  let mouseSens = options.mouseSens ?? 1;
  let flareMode: FlareMode = options.flareMode ?? "manual";
  const baseInternalH = internalHeightForQuality(quality);
  const adaptive = new AdaptiveScale();
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
    alpha: false,
  });
  renderer.setClearColor(new Color(0x1a222c), 1);
  renderer.autoClear = true;
  renderer.setPixelRatio(1);

  const scene = new Scene();
  const world = new WorldSystem(scene);
  options.onBootProgress?.(0.1);
  const navBeacon = new NavBeacon();
  scene.add(navBeacon.group);

  let spawnX = MAP_SPAWN.x;
  let spawnZ = MAP_SPAWN.z;
  let heading = MAP_SPAWN.heading;
  if (session.playMode === PlayMode.CHECKPOINT) {
    spawnX = CHECKPOINT_START.x;
    spawnZ = CHECKPOINT_START.z;
    heading = CHECKPOINT_START.heading;
  }
  let groundY = sampleHeight(spawnX, spawnZ);
  let spawnY = Math.max(groundY, WATER_LEVEL) + 280;

  if (session.playMode === PlayMode.CHECKPOINT) {
    spawnY = Math.max(groundY, WATER_LEVEL) + 320;
  } else if (session.playMode === PlayMode.ANTI_DRONE) {
    spawnY = groundY + 400;
  } else if (session.playMode === PlayMode.TARGET_PRACTICE) {
    spawnY = groundY + 420;
  } else if (session.playMode === PlayMode.ATTACK) {
    spawnY = groundY + 360;
  }

  const aircraft = session.aircraft ?? Aircraft.F22_RAPTOR;

  const jetRoot = new Group();
  jetRoot.name = "JetRoot";
  const shadowMat = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  shadowMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        diffuseColor.a *= sampledDiffuseColor.r;
      #endif`,
    );
  };
  shadowMat.customProgramCacheKey = () => "jet-planform-shadow";
  const shadow = new Mesh(new PlaneGeometry(1, 1), shadowMat);
  shadow.rotation.x = -Math.PI * 0.5;
  shadow.renderOrder = 2;
  const shadowRig = new Group();
  shadowRig.name = "JetShadow";
  shadowRig.add(shadow);
  scene.add(shadowRig);
  let planform: JetPlanform | null = null;

  const flightJet = attachFlightJet(
    jetRoot,
    aircraft,
    options.skinId ?? "factory",
    () => applyPlanform(),
  );
  scene.add(jetRoot);

  const applyPlanform = () => {
    const next = bakeJetPlanform(renderer, jetRoot, [exhaust.group]);
    if (!next) return;
    planform?.dispose();
    planform = next;
    shadowMat.map = next.texture;
    shadowMat.needsUpdate = true;
    shadow.scale.set(next.spanX, next.spanZ, 1);
    shadow.position.set(next.cx, 0, next.cz);
  };

  const abTrails = new AbRibbonTrail(2, 56, 0xffb060, 0.55, 0.38);
  const contrails = new TrailPool(2, 64, 0xddeeff, 0.35);
  scene.add(abTrails.group);
  scene.add(contrails.group);
  const abL = abTrails.acquire();
  const abR = abTrails.acquire();
  const ctL = contrails.acquire();
  const ctR = contrails.acquire();
  const exhaust = new ExhaustFx(aircraft);
  jetRoot.add(exhaust.group);
  applyPlanform();

  const loadoutPerf = resolveLoadoutPerformance(aircraft, {
    aaWeaponId: options.aaWeaponId ?? "",
    agWeaponId: options.agWeaponId ?? "",
  });
  const combatProfile =
    session.playMode === PlayMode.ATTACK
      ? loadoutPerf.agCombat
      : loadoutPerf.aaCombat;
  const fxWeapon =
    session.playMode === PlayMode.ATTACK
      ? loadoutPerf.ag ?? loadoutPerf.aa
      : loadoutPerf.aa ?? weaponById(options.aaWeaponId ?? "aim-9-sidewinder");

  const missileFx = new MissileFx(12, quality);
  scene.add(missileFx.group);
  missileFx.setModelUrl(fxWeapon?.modelUrl ?? null);
  const debris = new DebrisField();
  scene.add(debris.group);
  const flareFx = new FlareField();
  scene.add(flareFx.group);
  const missiles = new MissileSystem();
  missiles.setProfile(combatProfile);
  const flares = new CountermeasureSystem();
  const flaresEnabled =
    session.playMode !== PlayMode.CHECKPOINT &&
    session.playMode !== PlayMode.TARGET_PRACTICE;
  /** Drone ids that already launched a seeker this sortie. */
  const droneSeekersFired = new Set<number>();
  /** Paint acquire time (s) per drone id — LOCK warning before launch. */
  const dronePaintAcc = new Map<number, number>();
  let rwr: RwrState = emptyRwr();

  const aimFx = createAimMarker();
  scene.add(aimFx.group);
  const projectTmp = new Vector3();
  let aimHud: AimHudState | null = null;

  const rings = new RingField();
  scene.add(rings.group);
  const drones = new DroneField();
  scene.add(drones.group);
  const practiceField = new TargetField();
  scene.add(practiceField.group);
  const destructibles = new DestructibleField();
  scene.add(destructibles.group);

  const checkpoint =
    session.playMode === PlayMode.CHECKPOINT ? new CheckpointCourse() : null;
  const antidrone =
    session.playMode === PlayMode.ANTI_DRONE ? new AntiDroneCourse() : null;
  const attack =
    session.playMode === PlayMode.ATTACK ? new AttackCourse() : null;
  const practice =
    session.playMode === PlayMode.TARGET_PRACTICE
      ? new TargetPracticeCourse()
      : null;

  const jet = new JetSimulation();
  jet.setHandling(loadoutPerf.handling);
  jet.setGroundSampler(world.sampleFloor);
  jet.resetPose(
    new Vec3(spawnX, spawnY, spawnZ),
    heading,
    jet.getHandling().baseSpeed,
  );
  const targetLock = new TargetLockTracker();
  targetLock.setProfile(sensorFor(aircraft));
  await world.warm(
    spawnX,
    spawnZ,
    {
      vx: jet.velocity.x,
      vz: jet.velocity.z,
      altitude: spawnY - groundY,
    },
    (t) => options.onBootProgress?.(0.12 + t * 0.88),
  );

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
  if (practice) {
    practice.start(
      session.missionLevel,
      { x: spawnX, y: spawnY, z: spawnZ },
      heading,
    );
    practiceField.sync(practice.state.targets);
  }

  const flightCam = new FlightCamera();
  flightCam.setMode(session.cameraMode);
  const fwdX = -Math.sin(heading);
  const fwdZ = -Math.cos(heading);
  flightCam.chasePivot.set(spawnX - fwdX * 18, spawnY + 5, spawnZ - fwdZ * 18);
  flightCam.lookAhead.set(spawnX + fwdX * 24, spawnY, spawnZ + fwdZ * 24);

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
  let hour = world.clock.hour;
  let phase: DayPhase = world.clock.phase;
  let aim: AimSample | null = null;
  let radarContacts: RadarHudContact[] = [];

  const projectWorld = (
    wx: number,
    wy: number,
    wz: number,
  ): { x: number; y: number; on: boolean } => {
    projectTmp.set(wx, wy, wz).project(flightCam.camera);
    const on =
      projectTmp.z > -1 &&
      projectTmp.z < 1 &&
      Math.abs(projectTmp.x) <= 1.15 &&
      Math.abs(projectTmp.y) <= 1.15;
    return {
      x: (projectTmp.x * 0.5 + 0.5) * cssW,
      y: (-projectTmp.y * 0.5 + 0.5) * cssH,
      on: on && projectTmp.x >= -1 && projectTmp.x <= 1 && projectTmp.y >= -1 && projectTmp.y <= 1,
    };
  };

  const rebuildRt = (w: number, h: number) => {
    const aspect = w / Math.max(1, h);
    const ih = Math.max(180, Math.round(baseInternalH * adaptive.scale));
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
  let frameSfx: FlightSfxEvent[] = [];
  let prevCpRing = checkpoint?.state.ringIndex ?? 0;
  let prevCpStatus = checkpoint?.state.status ?? "IDLE";
  let prevAdKills = antidrone?.state.kills ?? 0;
  let prevAdStatus = antidrone?.state.status ?? "IDLE";
  let prevAtDestroyed = attack?.state.destroyed ?? 0;
  let prevAtStatus = attack?.state.status ?? "IDLE";
  let prevTpStatus = practice?.state.status ?? "IDLE";

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

  const pushBoom = (x: number, y: number, z: number) => {
    frameSfx.push({
      id: y <= WATER_LEVEL + 4 ? "boom_water" : "boom",
      x,
      y,
      z,
    });
  };

  /** Classifica impacto: água / solo / ar (para VFX distinto). */
  const resolveBoomSurface = (
    x: number,
    y: number,
    z: number,
  ): "air" | "ground" | "water" => {
    const floor = world.sampleFloor(x, z);
    if (y <= WATER_LEVEL + 3.5 && floor <= WATER_LEVEL + 1.5) return "water";
    if (y <= floor + 3.5) return "ground";
    return "air";
  };

  const detonate = (x: number, y: number, z: number) => {
    let sx = x;
    let sy = y;
    let sz = z;
    const surface = resolveBoomSurface(sx, sy, sz);
    if (surface === "ground") sy = world.sampleFloor(sx, sz) + 0.55;
    else if (surface === "water") sy = WATER_LEVEL + 0.45;
    missileFx.boom(sx, sy, sz, surface);
    pushBoom(sx, sy, sz);
  };

  const tick = (dt: number, input: FlightInput): FlightFrameState => {
    frameSfx = [];
    if (input.pause) session.paused = !session.paused;

    if (session.paused) {
      flightCam.setInspect(false);
      renderFrame();
      return frameState();
    }

    const camTarget = {
      position: jet.position,
      basis: jet.basis,
      telemetry,
    };
    const wantInspect = input.inspectHold && !session.paused;

    if (input.cycleCamera && !wantInspect) {
      cycleCamera(session);
      flightCam.setMode(session.cameraMode);
    }
    session.lookBackHold = input.lookBack && !wantInspect;

    const missionOver =
      (checkpoint && checkpoint.state.status !== "RUN" && checkpoint.state.status !== "IDLE") ||
      (antidrone && antidrone.state.status !== "RUN" && antidrone.state.status !== "IDLE") ||
      (attack && attack.state.status !== "RUN" && attack.state.status !== "IDLE") ||
      (practice && practice.state.status !== "RUN" && practice.state.status !== "IDLE");

    if (
      !missionOver ||
      checkpoint?.state.status === "RUN" ||
      antidrone?.state.status === "RUN" ||
      attack?.state.status === "RUN" ||
      practice?.state.status === "RUN"
    ) {
      jet.updateInput(dt, input.bank, input.pitch, input.afterburner, input.airbrake);
      if (input.barrelRoll && !wantInspect) {
        jet.triggerBarrelRoll();
        frameSfx.push("roll");
      }
      const prevX = jet.position.x;
      const prevY = jet.position.y;
      const prevZ = jet.position.z;
      jet.integrate(dt);
      const noseReach = 11;
      const noseNow = jet.basis.nose();
      const hull = world.constructions.segment(
        prevX,
        prevY,
        prevZ,
        jet.position.x + noseNow.x * noseReach,
        jet.position.y + noseNow.y * noseReach,
        jet.position.z + noseNow.z * noseReach,
      );
      if (hull) jet.resolveSurface(hull, noseReach);
      else {
        const deck = world.constructions.segment(
          jet.position.x,
          jet.position.y,
          jet.position.z,
          jet.position.x,
          jet.position.y - 10,
          jet.position.z,
        );
        if (deck && deck.ny > 0.5) jet.resolveSurface(deck, noseReach);
      }
      telemetry = jet.tickTelemetry(dt);
      const liveTarget = {
        position: jet.position,
        basis: jet.basis,
        telemetry,
      };
      flightCam.setInspect(wantInspect, liveTarget);
      flightCam.update(
        dt,
        viewCamera(session),
        liveTarget,
        wantInspect
          ? {
              dx: input.mouseDx * mouseSens,
              dy: input.mouseDy * mouseSens,
              wheel: input.wheel,
            }
          : undefined,
      );
    } else {
      flightCam.setInspect(wantInspect, camTarget);
      flightCam.update(
        dt,
        viewCamera(session),
        { position: jet.position, basis: jet.basis, telemetry },
        wantInspect
          ? {
              dx: input.mouseDx * mouseSens,
              dy: input.mouseDy * mouseSens,
              wheel: input.wheel,
            }
          : undefined,
      );
    }

    const nose = jet.basis.nose();
    const aimOrigin = {
      x: jet.position.x + nose.x * 4,
      y: jet.position.y + nose.y * 4,
      z: jet.position.z + nose.z * 4,
    };
    const cityBoxesEarly = world.buildings.getCollisionAabbs(
      { x: jet.position.x, z: jet.position.z },
      1100,
    );
    const raceMode = session.playMode === PlayMode.CHECKPOINT;
    aim = sampleAim(aimOrigin, nose, world.sampleFloor, {
      velocity: jet.velocity,
      missilesReady: missiles.ready,
      buildings: cityBoxesEarly,
      waterLevel: WATER_LEVEL,
    });
    const aimReach = aim.range > 1 ? aim.range : DLZ_RAERO + 400;
    const meshAim = world.constructions.segment(
      aimOrigin.x,
      aimOrigin.y,
      aimOrigin.z,
      aimOrigin.x + nose.x * aimReach,
      aimOrigin.y + nose.y * aimReach,
      aimOrigin.z + nose.z * aimReach,
    );
    if (meshAim && meshAim.dist < aim.range) {
      aim = {
        ...aim,
        x: meshAim.x,
        y: meshAim.y,
        z: meshAim.z,
        range: meshAim.dist,
        valid: true,
        inDlz: aim.ready && meshAim.dist >= DLZ_RMIN && meshAim.dist <= DLZ_RAERO,
      };
    }

    const lockCandidates: LockCandidate[] = [];
    if (
      attack?.state.active &&
      (attack.state.status === "RUN" || attack.state.status === "IDLE")
    ) {
      for (const t of attack.state.targets) {
        if (!t.promoted || t.destroyed) continue;
        lockCandidates.push({
          id: t.id,
          kind: "ag",
          x: t.aabb.cx,
          y: t.aabb.cy + t.aabb.hy * 0.35,
          z: t.aabb.cz,
        });
      }
    }
    if (
      antidrone?.state.active &&
      (antidrone.state.status === "RUN" || antidrone.state.status === "IDLE")
    ) {
      for (const d of antidrone.state.drones) {
        if (!d.alive) continue;
        lockCandidates.push({
          id: `drone_${d.id}`,
          kind: "aa",
          x: d.x,
          y: d.y,
          z: d.z,
        });
      }
    }
    const practiceAllowsLock =
      practice != null && practice.state.lockPolicy !== "lock_forbidden";
    if (
      practiceAllowsLock &&
      practice.state.active &&
      (practice.state.status === "RUN" || practice.state.status === "IDLE")
    ) {
      for (const t of practice.state.targets) {
        if (!t.alive) continue;
        lockCandidates.push({
          id: `tp_${t.id}`,
          kind: "aa",
          x: t.x,
          y: t.y,
          z: t.z,
        });
      }
    }

    const lockMission =
      session.playMode === PlayMode.ATTACK ||
      session.playMode === PlayMode.ANTI_DRONE ||
      session.playMode === PlayMode.TARGET_PRACTICE;
    let lockState = targetLock.state;
    if (lockMission) {
      lockState = targetLock.tick(dt, aimOrigin, nose, lockCandidates);
    } else if (lockState.phase !== "none") {
      targetLock.clear();
      lockState = targetLock.state;
    }

    const showGroundMark = aim.valid && !raceMode && !session.paused;
    aimFx.group.visible = showGroundMark;
    if (showGroundMark) {
      if (lockState.phase === "locked") {
        aimFx.group.position.set(lockState.x, lockState.y, lockState.z);
        aimFx.setColor(0x59ff73, 0.85);
      } else {
        aimFx.group.position.set(aim.x, aim.y, aim.z);
        if (aim.inDlz) aimFx.setColor(0x59ff73, 0.7);
        else if (aim.ready) aimFx.setColor(0xffd93d, 0.55);
        else aimFx.setColor(0xff4d40, 0.45);
      }
    }

    const lockScreen =
      lockState.phase !== "none"
        ? projectWorld(lockState.x, lockState.y, lockState.z)
        : { x: 0, y: 0, on: false };

    aimHud = {
      valid: aim.valid,
      ready: aim.ready,
      inDlz: aim.inDlz || lockState.phase === "locked",
      range: lockState.phase !== "none" ? lockState.range : aim.range,
      raceMode,
      aim: projectWorld(aim.x, aim.y, aim.z),
      fpm: projectWorld(aim.fpmX, aim.fpmY, aim.fpmZ),
      bore: projectWorld(aim.boreX, aim.boreY, aim.boreZ),
      lock: {
        phase: lockState.phase,
        progress: lockState.progress,
        kind: lockState.kind,
        range: lockState.range,
        screen: lockScreen,
      },
    };

    if (input.fire && !missionOver) {
      const policy = practice?.state.lockPolicy ?? null;
      const locked = lockState.phase === "locked";
      const allowFire =
        policy !== "lock_required" || locked;
      const useLock =
        locked && policy !== "lock_forbidden";
      if (allowFire) {
        const dir = useLock
          ? {
              x: lockState.x - aimOrigin.x,
              y: lockState.y - aimOrigin.y,
              z: lockState.z - aimOrigin.z,
            }
          : aim.valid
            ? {
                x: aim.x - aimOrigin.x,
                y: aim.y - aimOrigin.y,
                z: aim.z - aimOrigin.z,
              }
            : nose;
        const bay = nozzleWorld(0, -0.2, 2.5);
        const fired = missiles.tryFire(
          { x: bay.x, y: bay.y, z: bay.z },
          dir,
          useLock
            ? { x: lockState.x, y: lockState.y, z: lockState.z }
            : null,
        );
        if (fired) {
          frameSfx.push({
            id: "missile",
            x: bay.x,
            y: bay.y,
            z: bay.z,
            vx: jet.velocity.x,
            vy: jet.velocity.y,
            vz: jet.velocity.z,
          });
        }
      }
    }

    // --- Flares (off in Checkpoint / Tiro ao alvo) ---
    if (flaresEnabled && !missionOver && !session.paused) {
      const wantManual =
        input.flare && (flareMode === "manual" || flareMode === "both");
      let wantAuto = false;
      if (flareMode === "auto" || flareMode === "both") {
        const threat = missiles.nearestSeekerThreat({
          x: jet.position.x,
          y: jet.position.y,
          z: jet.position.z,
        });
        if (threat) {
          wantAuto = flares.shouldAutoDeploy(threat.dist, threat.closingDot);
        }
      }
      if (wantManual || wantAuto) {
        const dumped = flares.tryDeploy({
          x: jet.position.x,
          y: jet.position.y,
          z: jet.position.z,
          vx: jet.velocity.x,
          vy: jet.velocity.y,
          vz: jet.velocity.z,
        });
        if (dumped) {
          frameSfx.push({
            id: "flare",
            x: jet.position.x,
            y: jet.position.y,
            z: jet.position.z,
            vx: jet.velocity.x,
            vy: jet.velocity.y,
            vz: jet.velocity.z,
          });
        }
      }
    }
    if (flaresEnabled) {
      flares.tick(dt);
    }

    // Anti-Drone: paint (LOCK) then one slow seeker (MISSILE).
    let painted = false;
    if (
      antidrone?.state.active &&
      antidrone.state.status === "RUN" &&
      !missionOver
    ) {
      for (const d of antidrone.state.drones) {
        if (!d.alive || droneSeekersFired.has(d.id)) {
          dronePaintAcc.delete(d.id);
          continue;
        }
        const dist = Math.hypot(
          d.x - jet.position.x,
          d.y - jet.position.y,
          d.z - jet.position.z,
        );
        if (dist > RWR_PAINT_MAX || dist < RWR_PAINT_MIN) {
          dronePaintAcc.delete(d.id);
          continue;
        }
        painted = true;
        const acc = (dronePaintAcc.get(d.id) ?? 0) + dt;
        dronePaintAcc.set(d.id, acc);
        if (acc < RWR_LOCK_ACQUIRE) continue;
        const shot = missiles.tryFireHostile(
          { x: d.x, y: d.y, z: d.z },
          {
            x: jet.position.x,
            y: jet.position.y,
            z: jet.position.z,
          },
        );
        if (shot) {
          droneSeekersFired.add(d.id);
          dronePaintAcc.delete(d.id);
          frameSfx.push({
            id: "missile",
            x: d.x,
            y: d.y,
            z: d.z,
          });
        }
      }
    } else {
      dronePaintAcc.clear();
    }

    const seekerThreat = missiles.nearestSeekerThreat({
      x: jet.position.x,
      y: jet.position.y,
      z: jet.position.z,
    });
    rwr = {
      level: evaluateRwr({
        missileThreat: !!seekerThreat,
        painted,
      }),
    };

    const cam = flightCam.camera.position;
    missileFx.setViewOrigin(cam.x, cam.y, cam.z);
    if (flaresEnabled) {
      flareFx.setViewOrigin(cam.x, cam.y, cam.z);
      flareFx.sync(flares.state.pellets);
      flareFx.tick(dt);
    }

    const guideCtx =
      flaresEnabled && flares.windowOpen
        ? {
            player: {
              x: jet.position.x,
              y: jet.position.y,
              z: jet.position.z,
            },
            flareDecoy: flares.decoyPoint(),
            flareWindowOpen: true,
          }
        : {
            player: {
              x: jet.position.x,
              y: jet.position.y,
              z: jet.position.z,
            },
            flareDecoy: null,
            flareWindowOpen: false,
          };
    const impacts = missiles.tick(dt, world.sampleFloor, guideCtx);
    for (const m of impacts) {
      detonate(m.x, m.y, m.z);
      antidrone?.tryBlast(m.x, m.y, m.z, m.blastRadius);
      if (practice) {
        const hits = practice.tryBlast(
          m.x,
          m.y,
          m.z,
          m.blastRadius,
          m.guided,
        );
        for (const h of hits) {
          practiceField.explode(h.x, h.y, h.z, h.radius);
          debris.burst(h.x, h.y, h.z, 18);
        }
        if (hits.length) practiceField.sync(practice.state.targets);
      }
      if (attack) {
        const n = attack.tryBlast(m.x, m.y, m.z, m.blastRadius, m.damage);
        if (n) {
          debris.burst(m.x, m.y, m.z, 10);
          destructibles.sync(attack.state.targets);
        }
      }
    }
    const cityBoxes = cityBoxesEarly;
    for (const m of missiles.missiles) {
      if (!m.active) continue;

      // Hostile seeker proximity → player hit (counts as Anti-Drone leak).
      if (m.hostile) {
        const hitR = m.hitRadius + 10;
        const dJet = Math.hypot(
          m.x - jet.position.x,
          m.y - jet.position.y,
          m.z - jet.position.z,
        );
        if (dJet <= hitR) {
          m.active = false;
          detonate(m.x, m.y, m.z);
          antidrone?.registerPlayerHit();
          continue;
        }
      }

      antidrone?.tryHitSegment(m.px, m.py, m.pz, m.x, m.y, m.z, m.hitRadius);

      if (practice) {
        const hit = practice.tryHitSegment(
          m.px,
          m.py,
          m.pz,
          m.x,
          m.y,
          m.z,
          m.hitRadius,
          m.guided,
        );
        if (hit) {
          m.active = false;
          detonate(hit.x, hit.y, hit.z);
          practiceField.explode(hit.x, hit.y, hit.z, hit.radius);
          debris.burst(hit.x, hit.y, hit.z, 22);
          practiceField.sync(practice.state.targets);
          continue;
        }
      }

      if (attack) {
        const r = attack.tryHitSegment(
          m.px,
          m.py,
          m.pz,
          m.x,
          m.y,
          m.z,
          m.damage,
        );
        if (r.hit) {
          m.active = false;
          detonate(m.x, m.y, m.z);
          if (r.destroyed && r.target) {
            debris.burst(r.target.aabb.cx, r.target.aabb.cy, r.target.aabb.cz, 16);
          } else {
            debris.burst(m.x, m.y, m.z, 6);
          }
          destructibles.sync(attack.state.targets);
          continue;
        }
      }

      const built = world.constructions.segment(m.px, m.py, m.pz, m.x, m.y, m.z);
      if (built) {
        m.active = false;
        m.x = built.x;
        m.y = built.y;
        m.z = built.z;
        detonate(m.x, m.y, m.z);
        continue;
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
        detonate(m.x, m.y, m.z);
      }
    }
    missileFx.sync(missiles.missiles);
    missileFx.tick(dt);
    debris.tick(dt);

    if (checkpoint?.state.active) {
      checkpoint.tick(dt, jet.position);
      rings.update(checkpoint.state.ringIndex, dt);
      if (checkpoint.state.ringIndex > prevCpRing) {
        frameSfx.push("checkpoint_ok");
      }
      prevCpRing = checkpoint.state.ringIndex;
    }
    if (checkpoint && checkpoint.state.status === "WIN" && prevCpStatus !== "WIN") {
      frameSfx.push("level_clear");
    }
    if (checkpoint) prevCpStatus = checkpoint.state.status;

    if (antidrone?.state.active) {
      antidrone.tick(dt);
      drones.sync(antidrone.state.drones);
      if (antidrone.state.kills > prevAdKills) {
        frameSfx.push("checkpoint_ok");
      }
      prevAdKills = antidrone.state.kills;
    }
    if (antidrone && antidrone.state.status === "WIN" && prevAdStatus !== "WIN") {
      frameSfx.push("level_clear");
    }
    if (antidrone) prevAdStatus = antidrone.state.status;

    if (attack?.state.active) {
      attack.tick(dt);
      destructibles.sync(attack.state.targets);
      if (attack.state.destroyed > prevAtDestroyed) {
        frameSfx.push("boom");
      }
      prevAtDestroyed = attack.state.destroyed;
    }
    if (attack && attack.state.status === "WIN" && prevAtStatus !== "WIN") {
      frameSfx.push("level_clear");
    }
    if (attack) prevAtStatus = attack.state.status;

    if (practice?.state.active) {
      practice.tick(dt);
      practiceField.sync(practice.state.targets);
    }
    practiceField.tick(dt);
    if (practice && practice.state.status === "WIN" && prevTpStatus !== "WIN") {
      frameSfx.push("level_clear");
    }
    if (practice) prevTpStatus = practice.state.status;

    const worldInfo = world.update(
      dt,
      jet.position.x,
      jet.position.z,
      jet.position.y,
      {
        vx: jet.velocity.x,
        vz: jet.velocity.z,
        altitude: telemetry.radarHeight,
      },
    );
    place = worldInfo.place;
    dayFactor = worldInfo.dayFactor;
    hour = worldInfo.hour;
    phase = worldInfo.phase;
    radarContacts = worldInfo.radarContacts;
    navBeacon.update(dt, jet.position.x, jet.position.z, world.sampleFloor);

    if (adaptive.tick(dt, dt * 1000)) {
      rebuildRt(cssW, cssH);
    }

    const b = jet.basis;
    jetRoot.matrixAutoUpdate = false;
    jetRoot.matrix.set(
      b.x.x, b.y.x, b.z.x, jet.position.x,
      b.x.y, b.y.y, b.z.y, jet.position.y,
      b.x.z, b.y.z, b.z.z, jet.position.z,
      0, 0, 0, 1,
    );
    jetRoot.matrixWorldNeedsUpdate = true;

    exhaust.setDrive(telemetry.afterburner, telemetry.speedNorm);
    exhaust.update(dt);
    setJetAfterburner(jetRoot, exhaust.intensity);
    const view = viewCamera(session);
    setJetExternalVisible(jetRoot, view !== Cam.COCKPIT);
    exhaust.group.visible = exhaust.group.visible && view !== Cam.COCKPIT;

    const floorY = world.sampleFloor(jet.position.x, jet.position.z);
    const agl = Math.max(0, telemetry.radarHeight);
    const lift = Math.min(1, agl / 380);
    shadowRig.position.set(
      jet.position.x + lift * 6,
      floorY + 0.35,
      jet.position.z + lift * 4,
    );
    shadowRig.rotation.y = Math.atan2(b.z.x, b.z.z);
    const fit = 1 - lift * 0.4;
    shadowRig.scale.set(fit, fit, fit);
    shadowMat.opacity = planform ? 0.5 * (1 - lift * 0.82) : 0;
    shadowRig.visible = shadowMat.opacity > 0.05 && view !== Cam.COCKPIT;

    trailAcc += dt;
    if (trailAcc >= 1 / 45) {
      trailAcc = 0;
      const nozzles = exhaust.nozzleLocals();
      if (telemetry.afterburner && nozzles.length > 0) {
        // Soft ribbon wake rooted at the real nozzle exits (not 1px lines).
        const a = nozzles[0]!;
        const la = nozzleWorld(a.x, a.y, a.z + 1.4);
        abTrails.push(abL, la.x, la.y, la.z);
        if (nozzles.length > 1 && abR >= 0) {
          const b = nozzles[1]!;
          const lb = nozzleWorld(b.x, b.y, b.z + 1.4);
          abTrails.push(abR, lb.x, lb.y, lb.z);
        }
      }
      if (jet.position.y > 900 && nozzles.length > 0) {
        const a = nozzles[0]!;
        const la = nozzleWorld(a.x, a.y, a.z);
        contrails.push(ctL, la.x, la.y, la.z);
        if (nozzles.length > 1) {
          const b = nozzles[1]!;
          const lb = nozzleWorld(b.x, b.y, b.z);
          contrails.push(ctR, lb.x, lb.y, lb.z);
        }
      }
    }

    renderFrame();
    return frameState();
  };

  const frameState = (): FlightFrameState => {
    const b = jet.basis;
    const sfx = frameSfx;
    frameSfx = [];
    return {
      telemetry,
      session,
      view: viewCamera(session),
      inspecting: flightCam.isInspecting,
      place,
      dayFactor,
      hour,
      phase,
      missilesReady: missiles.ready,
      flaresReady: flaresEnabled ? flares.ready : 0,
      flaresMax: flaresEnabled ? flares.state.maxReady : 0,
      rwr,
      aim,
      aimHud,
      radarContacts,
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
        vx: jet.velocity.x,
        vy: jet.velocity.y,
        vz: jet.velocity.z,
      },
      sfx,
      checkpoint: checkpoint?.state ?? null,
      antidrone: antidrone?.state ?? null,
      attack: attack?.state ?? null,
      targetPractice: practice?.state ?? null,
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

  const setMouseSens = (sens: number) => {
    mouseSens = Math.min(2, Math.max(0.35, sens));
  };

  const setFlareMode = (mode: FlareMode) => {
    flareMode = mode;
  };

  const setNavWaypoint = (wp: NavWaypoint | null) => {
    navBeacon.setTarget(wp);
  };

  const dispose = () => {
    flightJet.dispose();
    rt?.dispose();
    exhaust.dispose();
    abTrails.dispose();
    contrails.dispose();
    missileFx.dispose();
    debris.dispose();
    flareFx.dispose();
    rings.dispose();
    drones.dispose();
    practiceField.dispose();
    destructibles.dispose();
    navBeacon.dispose();
    world.dispose();
    shadow.geometry.dispose();
    shadowMat.dispose();
    planform?.dispose();
    aimFx.dispose();
    quad.geometry.dispose();
    quadMat.dispose();
    renderer.dispose();
  };

  const vfxStats = (): FlightVfxStats => {
    const s = missileFx.stats();
    return {
      particles: s.particles,
      booms: s.booms,
      dropped: s.dropped,
    };
  };

  return {
    resize,
    tick,
    setPaused,
    setMouseSens,
    setFlareMode,
    setNavWaypoint,
    dispose,
    renderer,
    vfxStats,
    adaptiveScale: () => adaptive.scale,
  };
}
