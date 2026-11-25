import { useEffect, useRef, useState } from "react";
import {
  CP_LEVEL_COUNT,
  TP_LEVEL_COUNT,
  KeyboardFlightInput,
  aircraftIdOf,
  applyMissionReward,
  createSession,
  currentLoadout,
  previewReward,
  unlockAntidrone,
  unlockAttack,
  unlockCheckpoint,
  unlockTargetPractice,
  type AntiDroneState,
  type AttackState,
  type CheckpointState,
  type GameSession,
  type JetTelemetry,
  type LocalProgress,
  type PlaceOfInterest,
  type RwrLevel,
  type TargetPracticeState,
  updateSettings,
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
  /** Launch the following checkpoint level after a clear. */
  onNextLevel?: (level: number) => void;
}

export function Gameplay({
  sessionSeed,
  progress,
  onProgress,
  apiToken,
  onExitMenu,
  onRetry,
  onNextLevel,
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
  const [flaresReady, setFlaresReady] = useState(0);
  const [flaresMax, setFlaresMax] = useState(0);
  const [rwrLevel, setRwrLevel] = useState<RwrLevel>("none");
  const [jetPose, setJetPose] = useState<JetPose | null>(null);
  const [aimHud, setAimHud] = useState<AimHudState | null>(null);
  const [navWaypoint, setNavWaypoint] = useState<{ x: number; z: number } | null>(
    null,
  );
  const navWaypointRef = useRef(navWaypoint);
  navWaypointRef.current = navWaypoint;
  const [checkpoint, setCheckpoint] = useState<CheckpointState | null>(null);
  const [antidrone, setAntidrone] = useState<AntiDroneState | null>(null);
  const [attack, setAttack] = useState<AttackState | null>(null);
  const [targetPractice, setTargetPractice] =
    useState<TargetPracticeState | null>(null);
  const [clockHour, setClockHour] = useState(7.5);
  const [clockPhase, setClockPhase] = useState<
    import("@afd/game-core").DayPhase
  >("morning");
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
    const monitor = new PerfMonitor();
    let raf = 0;
    let alive = true;
    let detach = () => {};
    let removeResize = () => {};
    let scene: FlightSceneHandle | null = null;
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
        mode: "checkpoint" | "antidrone" | "attack" | "targetpractice";
        won: boolean;
        timeLeftSec?: number;
        kills?: number;
        unlockCp?: number;
        unlockAd?: number;
        unlockAt?: number;
        unlockTp?: number;
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
      if (opts.won && opts.unlockTp != null) {
        next = unlockTargetPractice(next, opts.unlockTp);
      }

      const token = apiTokenRef.current;
      if (token) {
        try {
          const matchId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const aircraftId = aircraftIdOf(session.aircraft);
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

    void (async () => {
      const created = await createFlightScene(canvas, session, {
        quality: progressRef.current.settings.quality,
        mouseSens: progressRef.current.settings.mouseSens,
        flareMode: progressRef.current.settings.flareMode,
        skinId: progressRef.current.skinId,
        aaWeaponId: equipped.aaWeaponId || "aim-9-sidewinder",
        agWeaponId: equipped.agWeaponId || "jdam",
      });
      if (!alive) {
        created.dispose();
        return;
      }
      scene = created;
      sceneRef.current = scene;
      scene.setNavWaypoint(navWaypointRef.current);
      const input = new KeyboardFlightInput();
      inputRef.current = input;
      setTouchInput(input);
      detach = input.attach(window);

      const resize = () => {
        scene!.resize(canvas.clientWidth, canvas.clientHeight);
      };
      resize();
      window.addEventListener("resize", resize);
      removeResize = () => window.removeEventListener("resize", resize);

      const loop = () => {
      if (!alive || !scene) return;
      const dt = monitor.beginFrame();
      scene.renderer.info.reset();
      const frame = scene.tick(dt, input.sample());
      const isPaused = frame.session.paused;
      setPaused(isPaused);
      // While paused, skip React state spam — PauseMenu must not re-render at 60fps.
      if (!isPaused) {
        setTelemetry(frame.telemetry);
        setView(frame.view);
        setInspecting(frame.inspecting);
        setPlace(frame.place);
      setMissilesReady(frame.missilesReady);
      setFlaresReady(frame.flaresReady);
      setFlaresMax(frame.flaresMax);
      setRwrLevel(frame.rwr.level);
      setJetPose(frame.jet);
        setAimHud(frame.aimHud);
        setCheckpoint(frame.checkpoint);
        setAntidrone(frame.antidrone);
        setAttack(frame.attack);
        setTargetPractice(frame.targetPractice);
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

      gameAudio.setMode(
        isPaused || endedRef.current ? "paused" : "flight",
      );
      gameAudio.playEvents(frame.sfx);
      gameAudio.tick(dt, frame.telemetry, {
        lock: frame.aimHud
          ? {
              phase: frame.aimHud.lock.phase,
              range: frame.aimHud.lock.range,
              inDlz: frame.aimHud.inDlz,
            }
          : null,
        rwrLevel: frame.rwr.level,
      });

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
        if (
          frame.targetPractice?.status === "WIN" ||
          frame.targetPractice?.status === "FAIL"
        ) {
          endedRef.current = true;
          const won = frame.targetPractice.status === "WIN";
          const rewardDto = previewReward({
            mode: "targetpractice",
            level: frame.targetPractice.level,
            won,
            timeLeftSec:
              frame.targetPractice.timeLimit > 0
                ? frame.targetPractice.timeLeft
                : null,
            kills: frame.targetPractice.kills,
            callsign: session.playerName,
            aircraft: session.aircraft,
          });
          void settleReward(rewardDto, {
            mode: "targetpractice",
            won,
            ...(frame.targetPractice.timeLimit > 0
              ? { timeLeftSec: frame.targetPractice.timeLeft }
              : {}),
            kills: frame.targetPractice.kills,
            unlockTp: frame.targetPractice.level + 1,
          });
          setReward(rewardDto);
        }
      }

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
      inputRef.current = null;
      setTouchInput(null);
      sceneRef.current = null;
      scene?.dispose();
      gameAudio.setMode("menu");
    };
    // remount via parent key=runId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.setNavWaypoint(navWaypoint);
  }, [navWaypoint]);

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
        flaresReady={flaresReady}
        flaresMax={flaresMax}
        rwrLevel={rwrLevel}
        aimHud={aimHud}
        navWaypoint={navWaypoint}
        checkpoint={
          sessionSeed.playMode === PlayMode.CHECKPOINT ? checkpoint : null
        }
        antidrone={
          sessionSeed.playMode === PlayMode.ANTI_DRONE ? antidrone : null
        }
        attack={sessionSeed.playMode === PlayMode.ATTACK ? attack : null}
        targetPractice={
          sessionSeed.playMode === PlayMode.TARGET_PRACTICE
            ? targetPractice
            : null
        }
        clockHour={clockHour}
        clockPhase={clockPhase}
      />
      {paused && !reward ? (
        <PauseMenu
          meta={`${String(sessionSeed.playMode ?? "mission").toUpperCase()} · Lv ${
            sessionSeed.missionLevel ?? 1
          } · tempo congelado`}
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
          settings={progress.settings}
          onSettingsChange={(partial) => {
            const next = updateSettings(progressRef.current, partial);
            onProgress(next);
            if (partial.mouseSens != null) {
              sceneRef.current?.setMouseSens(next.settings.mouseSens);
            }
            if (partial.flareMode != null) {
              sceneRef.current?.setFlareMode(next.settings.flareMode);
            }
          }}
          navWaypoint={navWaypoint}
          onNavWaypointChange={setNavWaypoint}
          onResume={() => sceneRef.current?.setPaused(false)}
          onMenu={onExitMenu}
        />
      ) : null}
      {reward ? (
        <ResultOverlay
          reward={reward}
          credits={progress.credits}
          nextLevel={
            reward.won &&
            ((reward.mode === "checkpoint" &&
              reward.level < CP_LEVEL_COUNT) ||
              (reward.mode === "targetpractice" &&
                reward.level < TP_LEVEL_COUNT))
              ? reward.level + 1
              : null
          }
          {...(reward.won &&
          ((reward.mode === "checkpoint" &&
            reward.level < CP_LEVEL_COUNT) ||
            (reward.mode === "targetpractice" &&
              reward.level < TP_LEVEL_COUNT)) &&
          onNextLevel
            ? { onNextLevel: () => onNextLevel(reward.level + 1) }
            : {})}
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
