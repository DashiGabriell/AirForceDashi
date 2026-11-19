import { useState } from "react";
import {
  AD_LEVEL_COUNT,
  AT_LEVEL_COUNT,
  CP_LEVEL_COUNT,
  antidroneDef,
  attackDef,
  checkpointDef,
  type LocalProgress,
} from "@afd/game-core";
import { Aircraft, PlayMode } from "@afd/shared-types";

export interface MissionLaunch {
  playMode: PlayMode;
  level: number;
  aircraft: Aircraft;
  callsign: string;
}

interface Props {
  progress: LocalProgress;
  onProgress: (p: LocalProgress) => void;
  onLaunch: (launch: MissionLaunch) => void;
  onBack: () => void;
}

type Tab = "checkpoint" | "antidrone" | "attack";

export function PreMission({ progress, onProgress, onLaunch, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("checkpoint");
  const [level, setLevel] = useState(1);
  const unlocked =
    tab === "checkpoint"
      ? progress.cpUnlocked
      : tab === "antidrone"
        ? progress.adUnlocked
        : progress.atUnlocked;
  const max =
    tab === "checkpoint"
      ? CP_LEVEL_COUNT
      : tab === "antidrone"
        ? AD_LEVEL_COUNT
        : AT_LEVEL_COUNT;
  const def =
    tab === "checkpoint"
      ? checkpointDef(level)
      : tab === "antidrone"
        ? antidroneDef(level)
        : attackDef(level);

  const playMode =
    tab === "checkpoint"
      ? PlayMode.CHECKPOINT
      : tab === "antidrone"
        ? PlayMode.ANTI_DRONE
        : PlayMode.ATTACK;

  return (
    <div className="pre">
      <button type="button" className="pre__back" onClick={onBack}>
        ← Menu
      </button>
      <h1 className="pre__title">PRÉ-PARTIDA</h1>
      <div className="pre__accent" />

      <label className="pre__field">
        Callsign
        <input
          value={progress.callsign}
          maxLength={16}
          onChange={(e) =>
            onProgress({ ...progress, callsign: e.target.value.toUpperCase() })
          }
        />
      </label>

      <div className="pre__row">
        <span className="pre__label">Aeronave</span>
        <button
          type="button"
          className={
            progress.aircraft === Aircraft.F22_RAPTOR
              ? "pre__chip pre__chip--on"
              : "pre__chip"
          }
          onClick={() =>
            onProgress({ ...progress, aircraft: Aircraft.F22_RAPTOR })
          }
        >
          F-22
        </button>
        <button
          type="button"
          className={
            progress.aircraft === Aircraft.F15_EAGLE
              ? "pre__chip pre__chip--on"
              : "pre__chip"
          }
          disabled={!progress.ownedAircraft.includes(Aircraft.F15_EAGLE)}
          onClick={() =>
            onProgress({ ...progress, aircraft: Aircraft.F15_EAGLE })
          }
        >
          {progress.ownedAircraft.includes(Aircraft.F15_EAGLE)
            ? "F-15"
            : "F-15 · Hangar"}
        </button>
      </div>

      <div className="pre__tabs">
        <button
          type="button"
          className={tab === "checkpoint" ? "pre__tab pre__tab--on" : "pre__tab"}
          onClick={() => {
            setTab("checkpoint");
            setLevel(1);
          }}
        >
          CheckPoint
        </button>
        <button
          type="button"
          className={tab === "antidrone" ? "pre__tab pre__tab--on" : "pre__tab"}
          onClick={() => {
            setTab("antidrone");
            setLevel(1);
          }}
        >
          Anti-Drone
        </button>
        <button
          type="button"
          className={tab === "attack" ? "pre__tab pre__tab--on" : "pre__tab"}
          onClick={() => {
            setTab("attack");
            setLevel(1);
          }}
        >
          Ataque
        </button>
      </div>

      <p className="pre__mission">
        {def.name}
        <span>
          {" "}
          · Lv {level}/{max} · unlocked {unlocked}
          {tab === "attack" ? ` · ${attackDef(level).targetCount} alvos` : ""}
        </span>
      </p>

      <div className="pre__levels">
        {Array.from({ length: Math.min(unlocked, 10) }, (_, i) => i + 1).map(
          (lv) => (
            <button
              key={lv}
              type="button"
              className={lv === level ? "pre__lv pre__lv--on" : "pre__lv"}
              onClick={() => setLevel(lv)}
            >
              {lv}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        className="btn btn--primary pre__go"
        onClick={() =>
          onLaunch({
            playMode,
            level,
            aircraft: progress.aircraft,
            callsign: progress.callsign || "DASHI-1",
          })
        }
      >
        Iniciar
      </button>
    </div>
  );
}
