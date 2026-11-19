import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  loadProgress,
  saveProgress,
  type LocalProgress,
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
  const [opsReady, setOpsReady] = useState(0);
  const [launch, setLaunch] = useState<MissionLaunch | null>(null);
  const [runId, setRunId] = useState(0);

  const updateProgress = useCallback((p: LocalProgress) => {
    saveProgress(p);
    setProgress(p);
    gameAudio.setVolumes(p.settings.masterVolume, p.settings.sfxVolume);
  }, []);

  useEffect(() => {
    gameAudio.bindUnlockGestures();
    gameAudio.setVolumes(progress.settings.masterVolume, progress.settings.sfxVolume);
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

  const hubShell = (body: ReactNode) => (
    <div className="shell shell--ui">
      <TitleBgCycle />
      {body}
    </div>
  );

  if (screen === "free") {
    return (
      <FreeFlight
        settings={progress.settings}
        aircraft={progress.aircraft}
        callsign={progress.callsign}
        avatarId={progress.avatarId}
        skinId={progress.skinId}
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
      />
    );
  }

  if (screen === "pre") {
    return hubShell(
      <PreMission
        progress={progress}
        onProgress={updateProgress}
        onBack={() => setScreen("menu")}
        onLaunch={(m) => {
          setLaunch(m);
          setRunId((n) => n + 1);
          setScreen("mission");
        }}
      />,
    );
  }

  if (screen === "hangar") {
    return hubShell(
      <Hangar
        progress={progress}
        onProgress={updateProgress}
        apiToken={apiToken}
        onNavigate={goHub}
      />,
    );
  }

  if (screen === "career") {
    return hubShell(
      <Career
        progress={progress}
        rank={rank}
        apiToken={apiToken}
        initialTab={careerTab}
        onProgress={updateProgress}
        onDashiCoins={setDashiCoins}
        onNavigate={goHub}
      />,
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
    );
  }

  if (screen === "lobby") {
    return hubShell(
      <Lobby
        apiToken={apiToken}
        callsign={progress.callsign}
        onCredits={(credits) => updateProgress({ ...progress, credits })}
        onNavigate={goHub}
      />,
    );
  }

  if (screen === "profile") {
    return hubShell(
      <Profile
        progress={progress}
        rank={rank}
        apiOnline={apiOnline}
        apiToken={apiToken}
        onProgress={updateProgress}
        onNavigate={goHub}
      />,
    );
  }

  if (screen === "settings") {
    return hubShell(
      <Settings
        progress={progress}
        onProgress={updateProgress}
        onNavigate={goHub}
      />,
    );
  }

  return hubShell(
    <MainMenu
      credits={progress.credits}
      dashiCoins={dashiCoins}
      opsReady={opsReady}
      onPlay={() => setScreen("pre")}
      onFreeFlight={() => setScreen("free")}
      onNavigate={goHub}
    />,
  );
}
