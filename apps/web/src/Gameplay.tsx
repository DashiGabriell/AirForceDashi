import { useEffect, useRef, useState } from "react";
import {
  KeyboardFlightInput,
  applyMissionReward,
  createSession,
  previewReward,
  unlockAntidrone,
  unlockAttack,
  unlockCheckpoint,
  type GameSession,
  type JetTelemetry,
  type LocalProgress,
  type PlaceOfInterest,
} from "@afd/game-core";
import {
  Aircraft,
  Cam,
  PlayMode,
  type MissionRewardDto,
  type PerfSnapshot,
} from "@afd/shared-types";
import {
  PerfMonitor,
  createFlightScene,
  type FlightSceneHandle,
} from "@afd/game-render";
import { grantMatchReward } from "./api/economyClient";
import { FlightHud } from "./FlightHud";
import { PauseMenu } from "./PauseMenu";
import { PerfHud } from "./PerfHud";
import { ResultOverlay } from "./ResultOverlay";
import { TouchControls } from "./TouchControls";

interface Props {
  sessionSeed: Partial<GameSession>;
  progress: LocalProgress;
  onProgress: (p: LocalProgress) => void;
  apiToken: string | null;
  onExitMenu: () => void;
  onRetry: () => void;
}

export function Gameplay({
  sessionSeed,
  progress,
  onProgress,
  apiToken,
  onExitMenu,
  onRetry,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<FlightSceneHandle | null>(null);
  const inputRef = useRef<KeyboardFlightInput | null>(null);
  const [touchInput, setTouchInput] = useState<KeyboardFlightInput | null>(null);
  const [telemetry, setTelemetry] = useState<JetTelemetry | null>(null);
  const [view, setView] = useState(Cam.CHASE);
  const [paused, setPaused] = useState(false);
  const [perf, setPerf] = useState<PerfSnapshot | null>(null);
  const [place, setPlace] = useState<PlaceOfInterest | null>(null);
  const [missilesReady, setMissilesReady] = useState(4);
  const [cpInfo, setCpInfo] = useState<string | null>(null);
  const [adInfo, setAdInfo] = useState<string | null>(null);
  const [atInfo, setAtInfo] = useState<string | null>(null);
  const [reward, setReward] = useState<MissionRewardDto | null>(null);
  const endedRef = useRef(false);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const apiTokenRef = useRef(apiToken);
  apiTokenRef.current = apiToken;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    endedRef.current = false;
    setReward(null);

    const session = createSession({
      ...sessionSeed,
      playerName: sessionSeed.playerName || progressRef.current.callsign,
    });
    const scene = createFlightScene(canvas, session, {
      quality: progressRef.current.settings.quality,
      mouseSens: progressRef.current.settings.mouseSens,
    });
    sceneRef.current = scene;
    const input = new KeyboardFlightInput();
    inputRef.current = input;
    setTouchInput(input);
    const detach = input.attach(window);
    const monitor = new PerfMonitor();
    let raf = 0;
    let alive = true;

    const settleReward = async (
      rewardDto: MissionRewardDto,
      opts: {
        mode: "checkpoint" | "antidrone" | "attack";
        won: boolean;
        timeLeftSec?: number;
        kills?: number;
        unlockCp?: number;
        unlockAd?: number;
        unlockAt?: number;
      },
    ) => {
      let next = progressRef.current;
      if (opts.won && opts.unlockCp != null) {
        next = unlockCheckpoint(next, opts.unlockCp);
      }
      if (opts.won && opts.unlockAd != null) {
        next = unlockAntidrone(next, opts.unlockAd);
      }
      if (opts.won && opts.unlockAt != null) {
        next = unlockAttack(next, opts.unlockAt);
      }

      const token = apiTokenRef.current;
      if (token) {
        try {
          const matchId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const aircraftId =
            session.aircraft === Aircraft.F15_EAGLE ? "f15" : "f22";
          const res = await grantMatchReward(token, {
            matchId,
            mode: opts.mode,
            won: opts.won,
            aircraftId,
            ...(opts.timeLeftSec != null ? { timeLeftSec: opts.timeLeftSec } : {}),
            ...(opts.kills != null ? { kills: opts.kills } : {}),
          });
          next = {
            ...next,
            credits: res.wallet.credits,
            xp: next.xp + res.xp,
          };
          onProgressRef.current(next);
          return;
        } catch {
          /* fall through to local */
        }
      }

      next = applyMissionReward(
        next,
        rewardDto.creditsPreview,
        rewardDto.xpPreview,
      );
      onProgressRef.current(next);
    };

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
      setMissilesReady(frame.missilesReady);
      setPerf(monitor.snapshot(scene.renderer));

      if (frame.checkpoint && frame.checkpoint.status === "RUN") {
        setCpInfo(
          `CP ${frame.checkpoint.ringIndex}/${frame.checkpoint.ringTotal} · ${frame.checkpoint.timeLeft.toFixed(0)}s`,
        );
      } else if (frame.checkpoint) {
        setCpInfo(`CP ${frame.checkpoint.status}`);
      } else {
        setCpInfo(null);
      }

      if (frame.antidrone && frame.antidrone.status === "RUN") {
        setAdInfo(
          `AD ${frame.antidrone.kills}/${frame.antidrone.total} · leak ${frame.antidrone.leaks}/${frame.antidrone.maxLeaks}`,
        );
      } else if (frame.antidrone) {
        setAdInfo(`AD ${frame.antidrone.status}`);
      } else {
        setAdInfo(null);
      }

      if (frame.attack && frame.attack.status === "RUN") {
        setAtInfo(
          `ATK ${frame.attack.destroyed}/${frame.attack.total} · ${frame.attack.timeLeft.toFixed(0)}s`,
        );
      } else if (frame.attack) {
        setAtInfo(`ATK ${frame.attack.status}`);
      } else {
        setAtInfo(null);
      }

      if (!endedRef.current) {
        if (frame.checkpoint?.status === "WIN" || frame.checkpoint?.status === "FAIL") {
          endedRef.current = true;
          const won = frame.checkpoint.status === "WIN";
          const rewardDto = previewReward({
            mode: "checkpoint",
            level: frame.checkpoint.level,
            won,
            timeLeftSec: frame.checkpoint.timeLeft,
            callsign: session.playerName,
            aircraft: session.aircraft,
          });
          void settleReward(rewardDto, {
            mode: "checkpoint",
            won,
            timeLeftSec: frame.checkpoint.timeLeft,
            unlockCp: frame.checkpoint.level + 1,
          });
          setReward(rewardDto);
        }
        if (frame.antidrone?.status === "WIN" || frame.antidrone?.status === "FAIL") {
          endedRef.current = true;
          const won = frame.antidrone.status === "WIN";
          const rewardDto = previewReward({
            mode: "antidrone",
            level: frame.antidrone.level,
            won,
            kills: frame.antidrone.kills,
            callsign: session.playerName,
            aircraft: session.aircraft,
          });
          void settleReward(rewardDto, {
            mode: "antidrone",
            won,
            kills: frame.antidrone.kills,
            unlockAd: frame.antidrone.level + 1,
          });
          setReward(rewardDto);
        }
        if (frame.attack?.status === "WIN" || frame.attack?.status === "FAIL") {
          endedRef.current = true;
          const won = frame.attack.status === "WIN";
          const rewardDto = previewReward({
            mode: "attack",
            level: frame.attack.level,
            won,
            timeLeftSec: frame.attack.timeLeft,
            kills: frame.attack.destroyed,
            callsign: session.playerName,
            aircraft: session.aircraft,
          });
          void settleReward(rewardDto, {
            mode: "attack",
            won,
            timeLeftSec: frame.attack.timeLeft,
            kills: frame.attack.destroyed,
            unlockAt: frame.attack.level + 1,
          });
          setReward(rewardDto);
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      detach();
      inputRef.current = null;
      setTouchInput(null);
      sceneRef.current = null;
      scene.dispose();
    };
    // remount via parent key=runId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missionLabel =
    sessionSeed.playMode === PlayMode.CHECKPOINT
      ? cpInfo
      : sessionSeed.playMode === PlayMode.ANTI_DRONE
        ? adInfo
        : sessionSeed.playMode === PlayMode.ATTACK
          ? atInfo
          : null;

  return (
    <div className="shell">
      <canvas ref={canvasRef} className="boot-canvas flight-canvas" />
      <PerfHud snap={perf} />
      <FlightHud
        telemetry={telemetry}
        view={view}
        paused={paused || !!reward}
        place={place}
        missilesReady={missilesReady}
        missionLine={missionLabel}
      />
      {paused && !reward ? (
        <PauseMenu
          onResume={() => sceneRef.current?.setPaused(false)}
          onMenu={onExitMenu}
        />
      ) : null}
      {reward ? (
        <ResultOverlay reward={reward} onRetry={onRetry} onMenu={onExitMenu} />
      ) : null}
      <TouchControls input={touchInput} visible={!paused && !reward} />
    </div>
  );
}
