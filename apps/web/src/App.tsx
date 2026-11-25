import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  currentLoadout,
  loadProgress,
  saveProgress,
  updateSettings,
  type LocalProgress,
  type PlayerSettings,
} from "@afd/game-core";
import {
  ensureSession,
  fetchOperations,
  loadApiToken,
  snapshotToProgress,
} from "./api/economyClient";
import { gameAudio } from "./audio/GameAudio";
import { Career } from "./Career";
import { FreeFlight } from "./FreeFlight";
import { Gameplay } from "./Gameplay";
import { Hangar } from "./Hangar";
import type { HubId } from "./HubNav";
import { Lobby } from "./Lobby";
import { MainMenu } from "./MainMenu";
import { PreMission, type MissionLaunch } from "./PreMission";
import { Profile } from "./Profile";
import { Settings } from "./Settings";
import { Shop } from "./Shop";
import { HubFx } from "./HubFx";
import { TitleBgCycle } from "./TitleBgCycle";

type Screen =
  | "menu"
  | "pre"
  | "free"
  | "mission"
  | "hangar"
  | "career"
  | "shop"
  | "profile"
  | "settings"
  | "lobby";

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [careerTab, setCareerTab] = useState<"ops" | "season" | "rank" | "board">(
    "ops",
  );
  const [progress, setProgress] = useState<LocalProgress>(() => loadProgress());
  const [dashiCoins, setDashiCoins] = useState(0);
  const [apiToken, setApiToken] = useState<string | null>(() => loadApiToken());
  const [apiOnline, setApiOnline] = useState(false);
  const [rank, setRank] = useState("Cadete");
  const [level, setLevel] = useState(1);
  const [opsReady, setOpsReady] = useState(0);
  const [launch, setLaunch] = useState<MissionLaunch | null>(null);
  const [runId, setRunId] = useState(0);

  const updateProgress = useCallback((p: LocalProgress) => {
    saveProgress(p);
    setProgress(p);
    gameAudio.applyPlayerSettings(p.settings);
  }, []);

  useEffect(() => {
    gameAudio.bindUnlockGestures();
    gameAudio.applyPlayerSettings(progress.settings);
    gameAudio.setMode("menu");
    // menu theme: tick leve enquanto estamos nos hubs
    let raf = 0;
    let alive = true;
    let last = performance.now();
    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (screen !== "free" && screen !== "mission") {
        gameAudio.setMode("menu");
        gameAudio.tick(dt, null);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
    // screen drives menu vs flight duck
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const local = loadProgress();
        const { token, snapshot } = await ensureSession(local.callsign);
        if (cancelled) return;
        setApiToken(token);
        setApiOnline(true);
        setRank(snapshot.progression.rank);
        setLevel(snapshot.progression.level);
        setDashiCoins(snapshot.wallet.dashiCoins);
        updateProgress(snapshotToProgress(snapshot, local));
        try {
          const ops = await fetchOperations(token);
          if (!cancelled) setOpsReady(ops.claimable);
        } catch {
          if (!cancelled) setOpsReady(0);
        }
      } catch {
        if (!cancelled) setApiOnline(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [updateProgress]);

  const refreshOpsBadge = useCallback(async (token: string | null) => {
    if (!token) {
      setOpsReady(0);
      return;
    }
    try {
      const ops = await fetchOperations(token);
      setOpsReady(ops.claimable);
    } catch {
      setOpsReady(0);
    }
  }, []);

  const goHub = (hub: HubId) => {
    if (hub === "menu") void refreshOpsBadge(apiToken);
    if (hub === "career") setCareerTab("ops");
    setScreen(hub === "menu" ? "menu" : hub);
  };

  const hubShell = (
    body: ReactNode,
    opts?: { veil?: string; mod?: string },
  ) => (
    <div className={`shell shell--ui tela ${opts?.mod ?? ""}`.trim()}>
      <div className="tela__bg" aria-hidden>
        <TitleBgCycle />
        <div className={`tela__bg-veil ${opts?.veil ?? "tela__bg-veil--hub"}`} />
        <div className="tela__bg-grain" />
      </div>
      <HubFx screenKey={screen}>{body}</HubFx>
    </div>
  );

  if (screen === "free") {
    return (
      <FreeFlight
        settings={progress.settings}
        onSettingsChange={(partial: Partial<PlayerSettings>) => {
          setProgress((prev) => {
            const next = updateSettings(prev, partial);
            saveProgress(next);
            gameAudio.applyPlayerSettings(next.settings);
            return next;
          });
        }}
        aircraft={progress.aircraft}
        callsign={progress.callsign}
        avatarId={progress.avatarId}
        skinId={progress.skinId}
        aaWeaponId={currentLoadout(progress).aaWeaponId}
        agWeaponId={currentLoadout(progress).agWeaponId}
        onExitMenu={() => setScreen("menu")}
      />
    );
  }

  if (screen === "mission" && launch) {
    return (
      <Gameplay
        key={runId}
        sessionSeed={{
          playMode: launch.playMode,
          missionLevel: launch.level,
          aircraft: launch.aircraft,
          playerName: launch.callsign,
        }}
        progress={progress}
        onProgress={updateProgress}
        apiToken={apiToken}
        onExitMenu={() => setScreen("menu")}
        onRetry={() => setRunId((n) => n + 1)}
        onNextLevel={(level) => {
          setLaunch((prev) => (prev ? { ...prev, level } : prev));
          setRunId((n) => n + 1);
        }}
      />
    );
  }

  if (screen === "pre") {
    return hubShell(
      <PreMission
        progress={progress}
        onProgress={updateProgress}
        credits={progress.credits}
        dashiCoins={dashiCoins}
        rank={rank}
        pilotLevel={level}
        onBack={() => setScreen("menu")}
        onNavigate={goHub}
        onLaunch={(m) => {
          setLaunch(m);
          setRunId((n) => n + 1);
          setScreen("mission");
        }}
        onFreeFlight={() => setScreen("free")}
      />,
      { veil: "tela__bg-veil--pre", mod: "tela--pre" },
    );
  }

  if (screen === "hangar") {
    return hubShell(
      <Hangar
        progress={progress}
        onProgress={updateProgress}
        apiToken={apiToken}
        dashiCoins={dashiCoins}
        onNavigate={goHub}
      />,
      { mod: "tela--hub tela--hangar" },
    );
  }

  if (screen === "career") {
    return hubShell(
      <Career
        progress={progress}
        rank={rank}
        dashiCoins={dashiCoins}
        apiToken={apiToken}
        initialTab={careerTab}
        onProgress={updateProgress}
        onDashiCoins={setDashiCoins}
        onNavigate={goHub}
      />,
      { mod: "tela--hub tela--career" },
    );
  }

  if (screen === "shop") {
    return hubShell(
      <Shop
        progress={progress}
        dashiCoins={dashiCoins}
        onProgress={updateProgress}
        onDashiCoins={setDashiCoins}
        apiToken={apiToken}
        onNavigate={goHub}
        onOpenSeason={() => {
          setCareerTab("season");
          setScreen("career");
        }}
      />,
      { mod: "tela--hub tela--shop" },
    );
  }

  if (screen === "lobby") {
    return hubShell(
      <Lobby
        apiToken={apiToken}
        callsign={progress.callsign}
        credits={progress.credits}
        dashiCoins={dashiCoins}
        onCredits={(credits) => updateProgress({ ...progress, credits })}
        onNavigate={goHub}
        onBack={() => setScreen("pre")}
      />,
      { veil: "tela__bg-veil--lobby", mod: "tela--hub tela--lobby" },
    );
  }

  if (screen === "profile") {
    return hubShell(
      <Profile
        progress={progress}
        rank={rank}
        apiOnline={apiOnline}
        apiToken={apiToken}
        dashiCoins={dashiCoins}
        onProgress={updateProgress}
        onNavigate={goHub}
      />,
      { veil: "tela__bg-veil--profile", mod: "tela--hub tela--profile" },
    );
  }

  if (screen === "settings") {
    return hubShell(
      <Settings
        progress={progress}
        onProgress={updateProgress}
        onNavigate={goHub}
      />,
      { veil: "tela__bg-veil--config", mod: "tela--hub tela--config" },
    );
  }

  return hubShell(
    <MainMenu
      credits={progress.credits}
      dashiCoins={dashiCoins}
      opsReady={opsReady}
      callsign={progress.callsign}
      rank={rank}
      level={level}
      avatarId={progress.avatarId}
      onPlay={() => setScreen("pre")}
      onFreeFlight={() => setScreen("free")}
      onNavigate={goHub}
    />,
    { veil: "tela__bg-veil--menu", mod: "tela--menu" },
  );
}
