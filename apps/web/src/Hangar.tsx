import { useEffect, useRef, useState } from "react";
import {
  F15_UNLOCK_COST,
  JET_EFFECTS,
  JET_EMBLEMS,
  currentLoadout,
  setAaWeapon,
  setAgWeapon,
  setEffect,
  setEmblem,
  setSkin,
  tryUnlockF15,
  weaponById,
  weaponsForAircraft,
  type LocalProgress,
} from "@afd/game-core";
import {
  createJetHangarPreview,
  type JetHangarPreviewHandle,
} from "@afd/game-render";
import { Aircraft } from "@afd/shared-types";
import { fetchMastery, purchaseAircraftApi, type MasteryRow } from "./api/economyClient";
import type { HubId } from "./HubNav";
import { MenuTop } from "./MenuTop";

type Tab = "fleet" | "equip" | "mastery";

interface Props {
  progress: LocalProgress;
  onProgress: (p: LocalProgress) => void;
  apiToken: string | null;
  dashiCoins?: number;
  onNavigate: (hub: HubId) => void;
}

const SKIN_CHIPS = [
  { id: "factory" as const, label: "Default" },
  { id: "ghost" as const, label: "Lake Dusk" },
  { id: "night" as const, label: "Night Ops" },
];

export function Hangar({
  progress,
  onProgress,
  apiToken,
  dashiCoins = 0,
  onNavigate,
}: Props) {
  const ownsF15 = progress.ownedAircraft.includes(Aircraft.F15_EAGLE);
  const [tab, setTab] = useState<Tab>("fleet");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [mastery, setMastery] = useState<MasteryRow[]>([]);
  /** Preview focado no GLB do míssil (scroll + inspeção). */
  const [focusWeaponId, setFocusWeaponId] = useState<string | null>(null);
  const stageRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<JetHangarPreviewHandle | null>(null);

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
    if (tab !== "equip") {
      previewRef.current?.dispose();
      previewRef.current = null;
      setFocusWeaponId(null);
      return;
    }
    const canvas = stageRef.current;
    if (!canvas) return;
    const preview = createJetHangarPreview(canvas, progress.aircraft, {
      skinId: progress.skinId,
      emblemId: progress.emblemId,
      effectId: progress.effectId,
      loadout: currentLoadout(progress),
    });
    previewRef.current = preview;
    return () => {
      preview.dispose();
      if (previewRef.current === preview) previewRef.current = null;
    };
    // Remount when opening Equipar; look updates via setters below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || tab !== "equip") return;
    preview.setAircraft(progress.aircraft);
    preview.setSkin(progress.skinId);
    preview.setEmblem(progress.emblemId);
    preview.setEffect(progress.effectId);
    preview.setLoadout(currentLoadout(progress));
    preview.focusWeapon(focusWeaponId);
  }, [
    tab,
    progress.aircraft,
    progress.skinId,
    progress.emblemId,
    progress.effectId,
    progress.loadouts,
    focusWeaponId,
  ]);

  const loadout = currentLoadout(progress);
  const aaOptions = weaponsForAircraft(progress.aircraft, "aa");
  const agOptions = weaponsForAircraft(progress.aircraft, "ag");
  const focusedWeapon = weaponById(focusWeaponId);

  const showAircraftPreview = () => setFocusWeaponId(null);

  const equip = (a: Aircraft) => {
    if (!progress.ownedAircraft.includes(a)) return;
    setFocusWeaponId(null);
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
        if (!res.ok)
          setErr(res.reason === "funds" ? "Credits insuficientes" : "Já possuída");
        onProgress(res.progress);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "falha");
    } finally {
      setBusy(false);
    }
  };

  const pickStarter = (a: Aircraft) => {
    if (a === Aircraft.F15_EAGLE && !ownsF15) {
      void buyF15();
    } else {
      equip(a);
    }
    setOnboardOpen(false);
  };

  const acLabel =
    progress.aircraft === Aircraft.F15_EAGLE ? "F-15 EAGLE" : "F-22 RAPTOR";

  const activeMastery =
    mastery.find((m) =>
      progress.aircraft === Aircraft.F15_EAGLE
        ? m.aircraftId === "f15"
        : m.aircraftId === "f22",
    ) ?? null;
  const masteryLv = activeMastery?.level ?? 4;
  const masteryXp = activeMastery?.xp ?? 1240;
  const masteryNext = 3000;
  const masteryPct = Math.min(100, Math.round((masteryXp / masteryNext) * 100));

  return (
    <>
      <MenuTop
        mode="hub"
        kicker="ARMORY"
        title="Hangar"
        credits={progress.credits}
        dashiCoins={dashiCoins}
        onBack={() => onNavigate("menu")}
        onNavigate={onNavigate}
      />

      <main className="hub-shell">
        <nav className="hub-side" aria-label="Hangar">
          <button
            type="button"
            className={`hub-side__item${tab === "fleet" ? " is-on" : ""}`}
            data-sfx="select"
              onClick={() => setTab("fleet")}
          >
            Frota
          </button>
          <button
            type="button"
            className={`hub-side__item${tab === "equip" ? " is-on" : ""}`}
            data-sfx="select"
              onClick={() => setTab("equip")}
          >
            Equipar
          </button>
          <button
            type="button"
            className={`hub-side__item${tab === "mastery" ? " is-on" : ""}`}
            data-sfx="select"
              onClick={() => setTab("mastery")}
          >
            Mastery
          </button>
        </nav>

        <section className="hub-main">
          <div
            className={`hub-panel${tab === "fleet" ? " is-on" : ""}`}
            hidden={tab !== "fleet"}
          >
            <p className="pre-col__label glitch-el">Aeronaves</p>
            <div className="shop__grid hangar-fleet">
              <button
                type="button"
                className={`hangar__card glitch-el${
                  progress.aircraft === Aircraft.F22_RAPTOR ? " hangar__card--on" : ""
                }`}
                data-sfx="select"
              onClick={() => equip(Aircraft.F22_RAPTOR)}
              >
                <span className="hangar__name">F-22 RAPTOR</span>
                <span className="hangar__meta">Starter · owned</span>
                <span className="tag tag--ok">
                  {progress.aircraft === Aircraft.F22_RAPTOR ? "ACTIVE" : "OWNED"}
                </span>
              </button>
              <button
                type="button"
                className={`hangar__card glitch-el${
                  progress.aircraft === Aircraft.F15_EAGLE ? " hangar__card--on" : ""
                }`}
                disabled={busy}
                data-sfx={ownsF15 ? "select" : "confirm"}
                onClick={() => (ownsF15 ? equip(Aircraft.F15_EAGLE) : void buyF15())}
              >
                <span className="hangar__name">F-15 EAGLE</span>
                <span className="hangar__meta">
                  {ownsF15
                    ? "Owned · click to equip"
                    : `Meta · ${F15_UNLOCK_COST.toLocaleString("pt-BR")} CR`}
                </span>
                <span className={`tag ${ownsF15 ? "tag--ok" : "tag--warn"}`}>
                  {ownsF15
                    ? progress.aircraft === Aircraft.F15_EAGLE
                      ? "ACTIVE"
                      : "OWNED"
                    : "LOCKED"}
                </span>
              </button>
            </div>
            <div className="row wrap" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                data-sfx="select"
              onClick={() => setOnboardOpen(true)}
              >
                Onboarding 1ª vez
              </button>
            </div>
            {err ? <p className="hub__empty">{err}</p> : null}
          </div>

          <div
            className={`hub-panel${tab === "equip" ? " is-on" : ""}`}
            hidden={tab !== "equip"}
          >
            <div className="equip-grid">
              <div className="equip-preview panel panel--pad">
                <div className="header-bar">
                  <span>
                    {focusedWeapon ? focusedWeapon.label : acLabel}
                  </span>
                  {focusedWeapon ? (
                    <button
                      type="button"
                      className="chip chip--on"
                      data-sfx="select"
                      onClick={showAircraftPreview}
                    >
                      Aeronave
                    </button>
                  ) : null}
                </div>
                <div className="equip-stage">
                  <canvas
                    ref={stageRef}
                    className="equip-stage__canvas"
                    aria-label={`Preview 3D ${focusedWeapon?.label ?? acLabel}`}
                  />
                </div>
                <p className="meta">
                  {focusedWeapon
                    ? "Scroll para zoom · arraste para girar"
                    : `Loadout · ${
                        loadout.aaWeaponId || loadout.agWeaponId
                          ? [
                              loadout.aaWeaponId && "AA",
                              loadout.agWeaponId && "AG",
                            ]
                              .filter(Boolean)
                              .join(" + ")
                          : "vazio"
                      } · scroll = zoom`}
                </p>
              </div>
              <div>
                <p className="settings__label">Armamento AA</p>
                <div className="row wrap" style={{ marginBottom: 12 }}>
                  {aaOptions.length === 0 ? (
                    <p className="meta">Nenhum AA compatível nesta aeronave</p>
                  ) : (
                    aaOptions.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className={
                          loadout.aaWeaponId === w.id || focusWeaponId === w.id
                            ? "chip chip--on"
                            : "chip"
                        }
                        data-sfx="toggle"
                        title={`Equipar e ver ${w.label}`}
                        onClick={() => {
                          onProgress(setAaWeapon(progress, w.id));
                          setFocusWeaponId(w.id);
                        }}
                      >
                        {w.shortLabel}
                      </button>
                    ))
                  )}
                </div>
                <p className="settings__label">Armamento AG</p>
                <div className="row wrap" style={{ marginBottom: 12 }}>
                  {agOptions.length === 0 ? (
                    <p className="meta">Nenhum AG compatível nesta aeronave</p>
                  ) : (
                    agOptions.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className={
                          loadout.agWeaponId === w.id || focusWeaponId === w.id
                            ? "chip chip--on"
                            : "chip"
                        }
                        data-sfx="toggle"
                        title={`Equipar e ver ${w.label}`}
                        onClick={() => {
                          onProgress(setAgWeapon(progress, w.id));
                          setFocusWeaponId(w.id);
                        }}
                      >
                        {w.shortLabel}
                      </button>
                    ))
                  )}
                </div>
                <p className="settings__label">Skin</p>
                <div className="row wrap" style={{ marginBottom: 12 }}>
                  {SKIN_CHIPS.map((skin) => (
                    <button
                      key={skin.id}
                      type="button"
                      className={
                        progress.skinId === skin.id ? "chip chip--on" : "chip"
                      }
                      data-sfx="toggle"
                      onClick={() => {
                        showAircraftPreview();
                        onProgress(setSkin(progress, skin.id));
                      }}
                    >
                      {skin.label}
                    </button>
                  ))}
                </div>
                <p className="settings__label">Emblema</p>
                <div className="row wrap" style={{ marginBottom: 12 }}>
                  {JET_EMBLEMS.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={
                        progress.emblemId === e.id ? "chip chip--on" : "chip"
                      }
                      data-sfx="toggle"
                      onClick={() => {
                        showAircraftPreview();
                        onProgress(setEmblem(progress, e.id));
                      }}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
                <p className="settings__label">Efeito</p>
                <div className="row wrap">
                  {JET_EFFECTS.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={
                        progress.effectId === e.id ? "chip chip--on" : "chip"
                      }
                      data-sfx="toggle"
                      onClick={() => {
                        showAircraftPreview();
                        onProgress(setEffect(progress, e.id));
                      }}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`hub-panel${tab === "mastery" ? " is-on" : ""}`}
            hidden={tab !== "mastery"}
          >
            <div className="panel panel--pad">
              <p className="title">
                MASTERY ·{" "}
                {progress.aircraft === Aircraft.F15_EAGLE ? "F-15" : "F-22"}
              </p>
              <div className="meter meter--solid" style={{ margin: "12px 0" }}>
                <div className="meter__fill" style={{ width: `${masteryPct}%` }} />
              </div>
              <p className="meta">
                Lv {masteryLv} · {masteryXp.toLocaleString("pt-BR")} /{" "}
                {masteryNext.toLocaleString("pt-BR")} XP · só cosmético
              </p>
              <ul className="hub__list" style={{ marginTop: 12 }}>
                <li>
                  <span>Trail Ember</span>
                  <strong>Lv 5</strong>
                </li>
                <li>
                  <span>Emblem Raptor Spec</span>
                  <strong>Lv 8</strong>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <div className="modal" id="onboard-modal" hidden={!onboardOpen}>
        <div
          className="modal__backdrop"
          onClick={() => setOnboardOpen(false)}
          aria-hidden
        />
        <div
          className="modal__panel panel panel--pad"
          role="dialog"
          aria-labelledby="onboard-title"
        >
          <h3 id="onboard-title" className="hub__title">
            ESCOLHA SUA AERONAVE
          </h3>
          <div className="pre__accent" />
          <p className="hub__sub">Uma gratuita agora · a outra por 8.000 Credits</p>
          <div className="shop__grid">
            <button
              type="button"
              className="hangar__card hangar__card--on"
              data-sfx="select"
              onClick={() => pickStarter(Aircraft.F22_RAPTOR)}
            >
              <span className="hangar__name">F-22 RAPTOR</span>
              <span className="hangar__meta">GRÁTIS · starter</span>
            </button>
            <button
              type="button"
              className="hangar__card"
              data-sfx="select"
              onClick={() => pickStarter(Aircraft.F15_EAGLE)}
            >
              <span className="hangar__name">F-15 EAGLE</span>
              <span className="hangar__meta">GRÁTIS · starter</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
