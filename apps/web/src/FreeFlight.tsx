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
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      detach();
      sceneRef.current = null;
      scene.dispose();
    };
  }, [aircraft, settings.quality, settings.mouseSens]);

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
