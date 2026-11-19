import { useEffect, useRef, useState } from "react";
import {
  F15_UNLOCK_COST,
  JET_SKINS,
  jetSkinSwatch,
  setSkin,
  tryUnlockF15,
  type LocalProgress,
} from "@afd/game-core";
import { createJetPreview, type JetPreviewHandle } from "@afd/game-render";
import { Aircraft } from "@afd/shared-types";
import { fetchMastery, purchaseAircraftApi, type MasteryRow } from "./api/economyClient";
import { HubNav, type HubId } from "./HubNav";

type Tab = "fleet" | "mastery";

interface Props {
  progress: LocalProgress;
  onProgress: (p: LocalProgress) => void;
  apiToken: string | null;
  onNavigate: (hub: HubId) => void;
}

export function Hangar({ progress, onProgress, apiToken, onNavigate }: Props) {
  const ownsF15 = progress.ownedAircraft.includes(Aircraft.F15_EAGLE);
  const [tab, setTab] = useState<Tab>("fleet");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mastery, setMastery] = useState<MasteryRow[]>([]);
  const stageRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<JetPreviewHandle | null>(null);

  useEffect(() => {
    if (!apiToken || tab !== "mastery") return;
    let cancelled = false;
    fetchMastery(apiToken)
      .then((rows) => {
        if (!cancelled) setMastery(rows);
      })
      .catch(() => {
        if (!cancelled) setErr("Mastery indisponível");
      });
    return () => {
      cancelled = true;
    };
  }, [apiToken, tab]);

  useEffect(() => {
    const canvas = stageRef.current;
    if (!canvas) return;
    const preview = createJetPreview(canvas, progress.aircraft, progress.skinId);
    previewRef.current = preview;
    return () => {
      preview.dispose();
      previewRef.current = null;
    };
    // Mount once; aircraft and skin push through the setters below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    previewRef.current?.setAircraft(progress.aircraft);
    previewRef.current?.setSkin(progress.skinId);
  }, [progress.aircraft, progress.skinId]);

  const equip = (a: Aircraft) => {
    if (!progress.ownedAircraft.includes(a)) return;
    onProgress({ ...progress, aircraft: a });
  };

  const buyF15 = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (apiToken) {
        const res = await purchaseAircraftApi(apiToken, "f15");
        onProgress({
          ...progress,
          credits: res.wallet.credits,
          ownedAircraft: [...progress.ownedAircraft, Aircraft.F15_EAGLE],
          aircraft: Aircraft.F15_EAGLE,
        });
      } else {
        const res = tryUnlockF15(progress);
        if (!res.ok) setErr(res.reason === "funds" ? "Credits insuficientes" : "Já possuída");
        onProgress(res.progress);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "falha");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hub hub--hangar">
      <button type="button" className="pre__back" onClick={() => onNavigate("menu")}>
        ← Menu
      </button>
      <HubNav active="hangar" onNavigate={onNavigate} />
      <h1 className="hub__title">HANGAR</h1>
      <div className="pre__accent" />

      <div className="hangar__stage">
        <canvas ref={stageRef} aria-label="Preview da aeronave" />
      </div>
      <div className="hangar__skins" role="listbox" aria-label="Skins">
        {JET_SKINS.map((skin) => {
          const on = progress.skinId === skin.id;
          return (
            <button
              key={skin.id}
              type="button"
              role="option"
              aria-selected={on}
              title={skin.label}
              className={on ? "hangar__skin hangar__skin--on" : "hangar__skin"}
              style={{ background: jetSkinSwatch(skin.id) }}
              onClick={() => onProgress(setSkin(progress, skin.id))}
            >
              <span className="hangar__skin-label">{skin.label}</span>
            </button>
          );
        })}
      </div>

      <div className="hub__tabs" role="tablist" aria-label="Hangar">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "fleet"}
          className={tab === "fleet" ? "hub__tab hub__tab--on" : "hub__tab"}
          onClick={() => setTab("fleet")}
        >
          Frota
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mastery"}
          className={tab === "mastery" ? "hub__tab hub__tab--on" : "hub__tab"}
          onClick={() => setTab("mastery")}
        >
          Mastery
        </button>
      </div>

      {tab === "fleet" ? (
        <>
          <p className="hub__sub">
            Frota · {apiToken ? "wallet API" : "offline fallback"}
          </p>
          <div className="hangar__fleet">
            <button
              type="button"
              className={
                progress.aircraft === Aircraft.F22_RAPTOR
                  ? "hangar__card hangar__card--on"
                  : "hangar__card"
              }
              onClick={() => equip(Aircraft.F22_RAPTOR)}
            >
              <span className="hangar__name">F-22 RAPTOR</span>
              <span className="hangar__meta">Starter · owned</span>
            </button>

            <button
              type="button"
              className={
                progress.aircraft === Aircraft.F15_EAGLE
                  ? "hangar__card hangar__card--on"
                  : "hangar__card"
              }
              disabled={busy}
              onClick={() => (ownsF15 ? equip(Aircraft.F15_EAGLE) : void buyF15())}
            >
              <span className="hangar__name">F-15 EAGLE</span>
              <span className="hangar__meta">
                {ownsF15
                  ? "Owned · click to equip"
                  : `Unlock · ${F15_UNLOCK_COST.toLocaleString("pt-BR")} Credits`}
              </span>
            </button>
          </div>
          {!ownsF15 && progress.credits < F15_UNLOCK_COST ? (
            <p className="hub__empty">
              Faltam {(F15_UNLOCK_COST - progress.credits).toLocaleString("pt-BR")} Credits
            </p>
          ) : null}
        </>
      ) : (
        <div className="hub__panel">
          <p className="hub__sub">Níveis 1–10 · só cosmético/Credits · sem buff de combate</p>
          {!apiToken ? (
            <p className="hub__empty">API offline — mastery server-side.</p>
          ) : mastery.length === 0 ? (
            <p className="hub__empty">Carregando…</p>
          ) : (
            <ul className="hub__list">
              {mastery.map((m) => (
                <li key={m.aircraftId}>
                  <span>
                    {m.aircraftId === "f15" ? "F-15" : "F-22"} · Nv {m.level}
                    <br />
                    <small>
                      XP {m.xp}
                      {m.nextReward
                        ? ` · próximo L${m.nextReward.level}: ${m.nextReward.label}`
                        : " · max"}
                    </small>
                  </span>
                  <strong>no buff</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {err ? <p className="hub__empty">{err}</p> : null}
    </div>
  );
}
