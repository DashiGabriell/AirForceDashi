import { useEffect, useRef, useState } from "react";
import {
  KeyboardFlightInput,
  MapId,
  createFreeFlightSession,
  type JetTelemetry,
  type MapId as MapIdValue,
  type PlaceOfInterest,
  type PlayerSettings,
  type RwrLevel,
} from "@afd/game-core";
import { Aircraft, Cam, type PerfSnapshot } from "@afd/shared-types";
import {
  PerfMonitor,
  createFlightScene,
  type AimHudState,
  type FlightSceneHandle,
  type JetPose,
  type RadarHudContact,
} from "@afd/game-render";
import { gameAudio, hearFromJet } from "./audio/GameAudio";
import { FlightBoot } from "./FlightBoot";
import { FlightHud } from "./FlightHud";
import { PauseMenu } from "./PauseMenu";
import { PerfHud } from "./PerfHud";

interface Props {
  onExitMenu: () => void;
  settings: PlayerSettings;
  onSettingsChange: (partial: Partial<PlayerSettings>) => void;
  aircraft: Aircraft;
  callsign?: string;
  avatarId?: number;
  skinId?: string;
  aaWeaponId?: string;
  agWeaponId?: string;
  mapId?: MapIdValue;
}

export function FreeFlight({
  onExitMenu,
  settings,
  onSettingsChange,
  aircraft,
  callsign = "DASHI-1",
  avatarId = 0,
  skinId = "factory",
  aaWeaponId = "aim-9-sidewinder",
  agWeaponId = "jdam",
  mapId = MapId.PACIFIC,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<FlightSceneHandle | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [telemetry, setTelemetry] = useState<JetTelemetry | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const [view, setView] = useState(Cam.CHASE);
  const [inspecting, setInspecting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [perf, setPerf] = useState<PerfSnapshot | null>(null);
  const [place, setPlace] = useState<PlaceOfInterest | null>(null);
  const [jetPose, setJetPose] = useState<JetPose | null>(null);
  const [aimHud, setAimHud] = useState<AimHudState | null>(null);
  const [radarContacts, setRadarContacts] = useState<RadarHudContact[]>([]);
  const [missilesReady, setMissilesReady] = useState(4);
  const [flaresReady, setFlaresReady] = useState(0);
  const [flaresMax, setFlaresMax] = useState(0);
  const [rwrLevel, setRwrLevel] = useState<RwrLevel>("none");
  const [clockHour, setClockHour] = useState(7.5);
  const [clockPhase, setClockPhase] = useState<
    import("@afd/game-core").DayPhase
  >("morning");
  const [navWaypoint, setNavWaypoint] = useState<{ x: number; z: number } | null>(
    null,
  );
  const navWaypointRef = useRef(navWaypoint);
  navWaypointRef.current = navWaypoint;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const s0 = settingsRef.current;
    gameAudio.bindUnlockGestures();
    gameAudio.applyPlayerSettings(s0);
    // FlightBoot: silêncio até a cena hidratar (evita menu+fight juntos).
    gameAudio.setMode("loading");
    void gameAudio.unlock();

    const session = createFreeFlightSession({ aircraft, mapId });
    const monitor = new PerfMonitor();
    let raf = 0;
    let alive = true;
    let detach = () => {};
    let removeResize = () => {};
    let scene: FlightSceneHandle | null = null;

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyM" || e.repeat) return;
      const s = settingsRef.current;
      if (gameAudio.isMuted) {
        gameAudio.setMuted(false);
        gameAudio.applyPlayerSettings({
          ...s,
          masterVolume: Math.max(s.masterVolume, 0.8),
        });
      } else {
        gameAudio.setMuted(true);
      }
    };
    window.addEventListener("keydown", onKey);

    // Mantém tick no loading para amortecer leftovers (sem ligar themes).
    let lastBoot = performance.now();
    const bootTick = (now: number) => {
      if (!alive || scene) return;
      const dt = Math.min(0.05, (now - lastBoot) / 1000);
      lastBoot = now;
      gameAudio.tick(dt, null);
      raf = requestAnimationFrame(bootTick);
    };
    raf = requestAnimationFrame(bootTick);

    void (async () => {
      const created = await createFlightScene(canvas, session, {
        quality: s0.quality,
        mouseSens: s0.mouseSens,
        flareMode: s0.flareMode,
        skinId,
        aaWeaponId,
        agWeaponId,
        onBootProgress: (p) => setBootProgress(p),
      });
      if (!alive) {
        created.dispose();
        return;
      }
      cancelAnimationFrame(raf);
      scene = created;
      sceneRef.current = scene;
      scene.setNavWaypoint(navWaypointRef.current);
      const input = new KeyboardFlightInput();
      detach = input.attach(window);

      const resize = () => {
        scene!.resize(canvas.clientWidth, canvas.clientHeight);
      };
      resize();
      window.addEventListener("resize", resize);
      removeResize = () => window.removeEventListener("resize", resize);

      gameAudio.setMode("flight");
      let bootOpen = true;
      const loop = () => {
        if (!alive || !scene) return;
        const dt = monitor.beginFrame();
        scene.renderer.info.reset();
        const frame = scene.tick(dt, input.sample());
        if (bootOpen) {
          bootOpen = false;
          setBooting(false);
        }
        const isPaused = frame.session.paused;
        setPaused(isPaused);
        // While paused, skip React state spam — PauseMenu must not re-render at 60fps.
        if (!isPaused) {
          setTelemetry(frame.telemetry);
          setView(frame.view);
          setInspecting(frame.inspecting);
          setPlace(frame.place);
          setJetPose(frame.jet);
          setAimHud(frame.aimHud);
          setRadarContacts(frame.radarContacts);
          setMissilesReady(frame.missilesReady);
          setFlaresReady(frame.flaresReady);
          setFlaresMax(frame.flaresMax);
          setRwrLevel(frame.rwr.level);
          setClockHour(frame.hour);
          setClockPhase(frame.phase);
          {
            const base = monitor.snapshot(scene.renderer);
            const vfx = scene.vfxStats();
            setPerf({
              ...base,
              adaptiveScale: scene.adaptiveScale(),
              vfxParticles: vfx.particles,
              vfxBooms: vfx.booms,
              vfxDropped: vfx.dropped,
            });
          }
        }
        gameAudio.setMode(isPaused ? "paused" : "flight");
        const hear = hearFromJet(frame.view, frame.jet);
        gameAudio.playEvents(frame.sfx, hear);
        gameAudio.tick(dt, frame.telemetry, {
          lock: frame.aimHud
            ? {
                phase: frame.aimHud.lock.phase,
                range: frame.aimHud.lock.range,
                inDlz: frame.aimHud.inDlz,
              }
            : null,
          rwrLevel: frame.rwr.level,
          hear,
        });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      removeResize();
      window.removeEventListener("keydown", onKey);
      detach();
      sceneRef.current = null;
      scene?.dispose();
      gameAudio.setMode("menu");
    };
  }, [aircraft, skinId, aaWeaponId, agWeaponId, settings.quality, mapId]);

  useEffect(() => {
    gameAudio.applyPlayerSettings(settings);
  }, [
    settings.masterVolume,
    settings.sfxVolume,
    settings.musicVolume,
    settings.fightMusicEnabled,
    settings.fightMusicVolume,
  ]);

  useEffect(() => {
    sceneRef.current?.setMouseSens(settings.mouseSens);
  }, [settings.mouseSens]);

  useEffect(() => {
    sceneRef.current?.setFlareMode(settings.flareMode);
  }, [settings.flareMode]);

  useEffect(() => {
    sceneRef.current?.setNavWaypoint(navWaypoint);
  }, [navWaypoint]);

  return (
    <div className="shell">
      <canvas ref={canvasRef} className="boot-canvas flight-canvas" />
      {booting && <FlightBoot progress={bootProgress} />}
      <PerfHud snap={perf} />
      <FlightHud
        telemetry={telemetry}
        view={view}
        paused={paused}
        inspecting={inspecting}
        place={place}
        jet={jetPose}
        callsign={callsign}
        aircraft={aircraft}
        avatarId={avatarId}
        soundOn={settings.masterVolume > 0.01}
        missilesReady={missilesReady}
        flaresReady={flaresReady}
        flaresMax={flaresMax}
        rwrLevel={rwrLevel}
        aimHud={aimHud}
        radarContacts={radarContacts}
        navWaypoint={navWaypoint}
        clockHour={clockHour}
        clockPhase={clockPhase}
      />
      {paused ? (
        <PauseMenu
          jet={
            jetPose && telemetry
              ? {
                  x: jetPose.x,
                  z: jetPose.z,
                  headingDeg: telemetry.headingDeg,
                }
              : jetPose
                ? { x: jetPose.x, z: jetPose.z, headingDeg: 0 }
                : null
          }
          settings={settings}
          onSettingsChange={onSettingsChange}
          navWaypoint={navWaypoint}
          onNavWaypointChange={setNavWaypoint}
          onResume={() => sceneRef.current?.setPaused(false)}
          onMenu={onExitMenu}
        />
      ) : null}
    </div>
  );
}
