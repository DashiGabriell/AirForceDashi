import { useEffect, useRef, useState } from "react";
import {
  KeyboardFlightInput,
  applyMissionReward,
  createSession,
  currentLoadout,
  previewReward,
  unlockAntidrone,
  unlockAttack,
  unlockCheckpoint,
  type AntiDroneState,
  type AttackState,
  type CheckpointState,
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
  type AimHudState,
  type FlightSceneHandle,
  type JetPose,
} from "@afd/game-render";
import { grantMatchReward } from "./api/economyClient";
import { gameAudio } from "./audio/GameAudio";
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
  const [inspecting, setInspecting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [perf, setPerf] = useState<PerfSnapshot | null>(null);
  const [place, setPlace] = useState<PlaceOfInterest | null>(null);
  const [missilesReady, setMissilesReady] = useState(4);
  const [jetPose, setJetPose] = useState<JetPose | null>(null);
  const [aimHud, setAimHud] = useState<AimHudState | null>(null);
  const [checkpoint, setCheckpoint] = useState<CheckpointState | null>(null);
  const [antidrone, setAntidrone] = useState<AntiDroneState | null>(null);
  const [attack, setAttack] = useState<AttackState | null>(null);
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

    gameAudio.bindUnlockGestures();
    gameAudio.setVolumes(
      progressRef.current.settings.masterVolume,
      progressRef.current.settings.sfxVolume,
    );
    gameAudio.setMode("flight");
    void gameAudio.unlock();

    const session = createSession({
      ...sessionSeed,
      playerName: sessionSeed.playerName || progressRef.current.callsign,
    });
    const equipped = currentLoadout({
      ...progressRef.current,
      aircraft: session.aircraft ?? progressRef.current.aircraft,
    });
    const scene = createFlightScene(canvas, session, {
      quality: progressRef.current.settings.quality,
      mouseSens: progressRef.current.settings.mouseSens,
      skinId: progressRef.current.skinId,
      aaWeaponId: equipped.aaWeaponId || "aim-9-sidewinder",
      agWeaponId: equipped.agWeaponId || "jdam",
    });
    sceneRef.current = scene;
    const input = new KeyboardFlightInput();
    inputRef.current = input;
    setTouchInput(input);
    const detach = input.attach(window);
    const monitor = new PerfMonitor();
    let raf = 0;
    let alive = true;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyM" || e.repeat) return;
      if (gameAudio.isMuted) {
        gameAudio.setMuted(false);
        gameAudio.setVolumes(
          Math.max(progressRef.current.settings.masterVolume, 0.8),
          progressRef.current.settings.sfxVolume,
        );
      } else {
        gameAudio.setMuted(true);
      }
    };
    window.addEventListener("keydown", onKey);

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
      setInspecting(frame.inspecting);
      setPlace(frame.place);
      setMissilesReady(frame.missilesReady);
      setJetPose(frame.jet);
      setAimHud(frame.aimHud);
      setCheckpoint(frame.checkpoint);
      setAntidrone(frame.antidrone);
      setAttack(frame.attack);
      setPerf(monitor.snapshot(scene.renderer));

      gameAudio.setMode(
        frame.session.paused || endedRef.current ? "paused" : "flight",
      );
      gameAudio.playEvents(frame.sfx);
      gameAudio.tick(dt, frame.telemetry);

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
      window.removeEventListener("keydown", onKey);
      detach();
      inputRef.current = null;
      setTouchInput(null);
      sceneRef.current = null;
      scene.dispose();
      gameAudio.setMode("menu");
    };
    // remount via parent key=runId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="shell shell--play tela--game">
      <canvas ref={canvasRef} className="boot-canvas flight-canvas" />
      <PerfHud snap={perf} />
      <FlightHud
        telemetry={telemetry}
        view={view}
        paused={paused || !!reward}
        inspecting={inspecting}
        place={place}
        jet={jetPose}
        callsign={sessionSeed.playerName || progress.callsign || "DASHI-1"}
        aircraft={sessionSeed.aircraft ?? progress.aircraft}
        avatarId={progress.avatarId}
        soundOn={progress.settings.masterVolume > 0.01}
        missilesReady={missilesReady}
        aimHud={aimHud}
        checkpoint={
          sessionSeed.playMode === PlayMode.CHECKPOINT ? checkpoint : null
        }
        antidrone={
          sessionSeed.playMode === PlayMode.ANTI_DRONE ? antidrone : null
        }
        attack={sessionSeed.playMode === PlayMode.ATTACK ? attack : null}
      />
      {paused && !reward ? (
        <PauseMenu
          meta={`${String(sessionSeed.playMode ?? "mission").toUpperCase()} · Lv ${
            sessionSeed.missionLevel ?? 1
          } · tempo congelado`}
          onResume={() => sceneRef.current?.setPaused(false)}
          onMenu={onExitMenu}
        />
      ) : null}
      {reward ? (
        <ResultOverlay
          reward={reward}
          credits={progress.credits}
          onRetry={onRetry}
          onMenu={onExitMenu}
          onModes={onExitMenu}
          onHangar={onExitMenu}
        />
      ) : null}
      <TouchControls input={touchInput} visible={!paused && !reward} />
    </div>
  );
}
