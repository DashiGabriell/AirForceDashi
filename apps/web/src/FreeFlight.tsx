import { useEffect, useRef, useState } from "react";
import {
  KeyboardFlightInput,
  createFreeFlightSession,
  type JetTelemetry,
  type PlaceOfInterest,
  type PlayerSettings,
} from "@afd/game-core";
import { Aircraft, Cam, type PerfSnapshot } from "@afd/shared-types";
import {
  PerfMonitor,
  createFlightScene,
  type FlightSceneHandle,
  type JetPose,
} from "@afd/game-render";
import { gameAudio } from "./audio/GameAudio";
import { FlightHud } from "./FlightHud";
import { PauseMenu } from "./PauseMenu";
import { PerfHud } from "./PerfHud";

interface Props {
  onExitMenu: () => void;
  settings: PlayerSettings;
  aircraft: Aircraft;
  callsign?: string;
}

export function FreeFlight({
  onExitMenu,
  settings,
  aircraft,
  callsign = "DASHI-1",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<FlightSceneHandle | null>(null);
  const [telemetry, setTelemetry] = useState<JetTelemetry | null>(null);
  const [view, setView] = useState(Cam.CHASE);
  const [paused, setPaused] = useState(false);
  const [perf, setPerf] = useState<PerfSnapshot | null>(null);
  const [place, setPlace] = useState<PlaceOfInterest | null>(null);
  const [jetPose, setJetPose] = useState<JetPose | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    gameAudio.bindUnlockGestures();
    gameAudio.setVolumes(settings.masterVolume, settings.sfxVolume);
    gameAudio.setMode("flight");
    void gameAudio.unlock();

    const session = createFreeFlightSession({ aircraft });
    const scene = createFlightScene(canvas, session, {
      quality: settings.quality,
      mouseSens: settings.mouseSens,
    });
    sceneRef.current = scene;
    const input = new KeyboardFlightInput();
    const detach = input.attach(window);
    const monitor = new PerfMonitor();
    let raf = 0;
    let alive = true;

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyM" || e.repeat) return;
      if (gameAudio.isMuted) {
        gameAudio.setMuted(false);
        gameAudio.setVolumes(Math.max(settings.masterVolume, 0.8), settings.sfxVolume);
      } else {
        gameAudio.setMuted(true);
      }
    };
    window.addEventListener("keydown", onKey);

    const resize = () => {
      scene.resize(canvas.clientWidth, canvas.clientHeight);
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      if (!alive) return;
      const dt = monitor.beginFrame();
      scene.renderer.info.reset();
      const frame = scene.tick(dt, input.sample());
      setPaused(frame.session.paused);
      setTelemetry(frame.telemetry);
      setView(frame.view);
      setPlace(frame.place);
      setJetPose(frame.jet);
      setPerf(monitor.snapshot(scene.renderer));
      gameAudio.setMode(frame.session.paused ? "paused" : "flight");
      gameAudio.playEvents(frame.sfx);
      gameAudio.tick(dt, frame.telemetry);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      detach();
      sceneRef.current = null;
      scene.dispose();
      gameAudio.setMode("menu");
    };
  }, [aircraft, settings.quality, settings.mouseSens, settings.masterVolume, settings.sfxVolume]);

  return (
    <div className="shell">
      <canvas ref={canvasRef} className="boot-canvas flight-canvas" />
      <PerfHud snap={perf} />
      <FlightHud
        telemetry={telemetry}
        view={view}
        paused={paused}
        place={place}
        jet={jetPose}
        callsign={callsign}
        aircraft={aircraft}
        soundOn={settings.masterVolume > 0.01}
      />
      {paused ? (
        <PauseMenu
          onResume={() => sceneRef.current?.setPaused(false)}
          onMenu={onExitMenu}
        />
      ) : null}
    </div>
  );
}
