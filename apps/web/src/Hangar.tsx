import { useEffect, useRef, useState } from "react";
import {
  AIRCRAFT_ROLE_LABEL,
  FLEET,
  WEAPON_CATEGORY_LABEL,
  aircraftIdOf,
  aircraftProfile,
  currentLoadout,
  defaultLoadoutFor,
  fleetByGeneration,
  fleetEntry,
  resolveLoadoutPerformance,
  setAaWeapon,
  setAgWeapon,
  setEffect,
  setEmblem,
  setSkin,
  tryUnlockAircraft,
  weaponById,
  weaponsForAircraft,
  type LocalProgress,
  JET_EFFECTS,
  JET_EMBLEMS,
} from "@afd/game-core";
import {
  createJetHangarPreview,
  type JetHangarPreviewHandle,
} from "@afd/game-render";
import { Aircraft } from "@afd/shared-types";
import { fetchMastery, purchaseAircraftApi, type MasteryRow } from "./api/economyClient";
import { FleetCardThumb } from "./FleetCardThumb";
import type { HubId } from "./HubNav";
import { MenuTop } from "./MenuTop";
import { StatRadar, type StatRadarPoint } from "./StatRadar";

type Tab = "fleet" | "equip" | "mastery";

const JET_RADAR_AXIS = [
  "speed",
  "acceleration",
  "maneuver",
  "energy",
  "payload",
  "rcs",
] as const;

function jetRadarPoints(
  perf: ReturnType<typeof resolveLoadoutPerformance>,
  deltas: number[],
): StatRadarPoint[] {
  return JET_RADAR_AXIS.map((id, i) => {
    const s = perf.displayStats.find((row) => row.id === id);
    const raw = s?.value ?? 50;
    const value = Math.round(id === "rcs" ? 100 - raw : raw);
    const delta = deltas[i] ?? 0;
    const point: StatRadarPoint = {
      label:
        id === "rcs"
          ? "Furtiv."
          : id === "acceleration"
            ? "Acel."
            : id === "maneuver"
              ? "Manobra"
              : id === "payload"
                ? "Carga"
                : id === "speed"
                  ? "Veloc."
                  : id === "energy"
                    ? "Energia"
                    : (s?.label ?? id),
      value,
    };
    if (delta !== 0) point.delta = delta;
    return point;
  });
}

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
  const [tab, setTab] = useState<Tab>("fleet");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [onboardOpen, setOnboardOpen] = useState(false);
  /** Ficha da Frota (país / ano / radar do loadout padrão). */
  const [infoAircraft, setInfoAircraft] = useState<Aircraft | null>(null);
  const [mastery, setMastery] = useState<MasteryRow[]>([]);
  /** Preview focado no GLB do míssil (scroll + inspeção). */
  const [focusWeaponId, setFocusWeaponId] = useState<string | null>(null);
  /** Deltas do radar do jato vs loadout anterior (+ verde / − vermelho). */
  const [jetStatDeltas, setJetStatDeltas] = useState<number[]>(() =>
    JET_RADAR_AXIS.map(() => 0),
  );
  const prevJetValuesRef = useRef<number[] | null>(null);
  const prevJetKeyRef = useRef<string>("");
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
    if (tab !== "fleet") setInfoAircraft(null);
  }, [tab]);

  useEffect(() => {
    // F-22 = Aircraft enum 0 — nunca usar truthiness em Aircraft.
    if (infoAircraft == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") setInfoAircraft(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [infoAircraft]);

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
  const activeEntry = fleetEntry(progress.aircraft);
  const loadoutPerf = resolveLoadoutPerformance(progress.aircraft, loadout);
  const jetKey = `${progress.aircraft}:${loadout.aaWeaponId}:${loadout.agWeaponId}`;

  useEffect(() => {
    if (prevJetKeyRef.current === jetKey) return;
    const values = jetRadarPoints(
      resolveLoadoutPerformance(progress.aircraft, {
        aaWeaponId: loadout.aaWeaponId,
        agWeaponId: loadout.agWeaponId,
      }),
      [],
    ).map((p) => p.value);
    const sameAircraft = prevJetKeyRef.current.startsWith(
      `${progress.aircraft}:`,
    );
    if (prevJetValuesRef.current && sameAircraft) {
      setJetStatDeltas(
        values.map((v, i) => v - (prevJetValuesRef.current?.[i] ?? v)),
      );
    } else {
      setJetStatDeltas(JET_RADAR_AXIS.map(() => 0));
    }
    prevJetValuesRef.current = values;
    prevJetKeyRef.current = jetKey;
  }, [
    jetKey,
    progress.aircraft,
    loadout.aaWeaponId,
    loadout.agWeaponId,
  ]);

  const dossierStats = jetRadarPoints(loadoutPerf, jetStatDeltas);
  // F-22 = 0 — `infoAircraft ?` / `&&` quebram a ficha.
  const infoProfile =
    infoAircraft != null ? aircraftProfile(infoAircraft) : null;
  const infoPerf =
    infoAircraft != null
      ? resolveLoadoutPerformance(infoAircraft, defaultLoadoutFor(infoAircraft))
      : null;
  const infoRadar = infoPerf ? jetRadarPoints(infoPerf, []) : [];
  const infoOwned =
    infoAircraft != null
      ? progress.ownedAircraft.includes(infoAircraft)
      : false;
  const infoEntry = infoAircraft != null ? fleetEntry(infoAircraft) : null;

  const showAircraftPreview = () => setFocusWeaponId(null);

  const equip = (a: Aircraft) => {
    if (!progress.ownedAircraft.includes(a)) return;
    setFocusWeaponId(null);
    onProgress({ ...progress, aircraft: a });
  };

  const buyAircraft = async (a: Aircraft) => {
    const entry = fleetEntry(a);
    if (entry.unlockCost <= 0) {
      equip(a);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      if (apiToken) {
        const res = await purchaseAircraftApi(apiToken, entry.id);
        onProgress({
          ...progress,
          credits: res.wallet.credits,
          ownedAircraft: progress.ownedAircraft.includes(a)
            ? progress.ownedAircraft
            : [...progress.ownedAircraft, a],
          aircraft: a,
        });
      } else {
        const res = tryUnlockAircraft(progress, a);
        if (!res.ok)
          setErr(
            res.reason === "funds"
              ? "Credits insuficientes"
              : res.reason === "already"
                ? "Já possuída"
                : "Indisponível",
          );
        onProgress(res.progress);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "falha");
    } finally {
      setBusy(false);
    }
  };

  const pickStarter = (a: Aircraft) => {
    if (!progress.ownedAircraft.includes(a) && fleetEntry(a).unlockCost > 0) {
      void buyAircraft(a);
    } else {
      equip(a);
    }
    setOnboardOpen(false);
  };

  const activeMastery =
    mastery.find((m) => m.aircraftId === aircraftIdOf(progress.aircraft)) ?? null;
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
            <div className="hangar-fleet-sections">
              {fleetByGeneration().map((gen) => (
                <section key={gen.id} className="hangar-gen">
                  <header className="hangar-gen__head">
                    <h3 className="hangar-gen__title">{gen.label}</h3>
                    <span className="hangar-gen__count">
                      {gen.entries.length}
                    </span>
                  </header>
                  <div className="shop__grid hangar-fleet">
                    {gen.entries.map((entry) => {
                      const owned = progress.ownedAircraft.includes(
                        entry.aircraft,
                      );
                      const active = progress.aircraft === entry.aircraft;
                      return (
                        <div
                          key={entry.id}
                          className={`hangar__card glitch-el${
                            active ? " hangar__card--on" : ""
                          }${owned ? "" : " hangar__card--locked"}`}
                        >
                          <button
                            type="button"
                            className="hangar__card-main"
                            disabled={busy}
                            data-sfx={owned ? "select" : "confirm"}
                            onClick={() =>
                              owned
                                ? equip(entry.aircraft)
                                : void buyAircraft(entry.aircraft)
                            }
                          >
                            <FleetCardThumb
                              aircraft={entry.aircraft}
                              label={entry.label}
                              active={tab === "fleet"}
                            />
                            <span className="hangar__name">{entry.label}</span>
                            <span className="hangar__meta">
                              {owned
                                ? `${AIRCRAFT_ROLE_LABEL[aircraftProfile(entry.aircraft).role]} · ${
                                    entry.unlockCost <= 0 ? "starter" : "owned"
                                  }`
                                : `${entry.tierLabel} · ${entry.unlockCost.toLocaleString("pt-BR")} CR`}
                            </span>
                            <span
                              className={`tag ${owned ? "tag--ok" : "tag--warn"}`}
                            >
                              {owned
                                ? active
                                  ? "ACTIVE"
                                  : "OWNED"
                                : "LOCKED"}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="hangar__info-btn"
                            data-sfx="select"
                            aria-label={`Informações de ${entry.label}`}
                            title="Informações"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setInfoAircraft(entry.aircraft);
                            }}
                          >
                            i
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
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
                    {focusedWeapon ? focusedWeapon.label : activeEntry.label}
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
                    aria-label={`Preview 3D ${focusedWeapon?.label ?? activeEntry.label}`}
                  />
                </div>
                <p className="meta">
                  {focusedWeapon
                    ? "Scroll para zoom · arraste para girar"
                    : `Loadout · ${loadoutPerf.loadoutSummary} · scroll = zoom`}
                </p>
                <div className="loadout-dossier" aria-live="polite">
                  <p className="loadout-dossier__kicker">
                    {focusedWeapon
                      ? WEAPON_CATEGORY_LABEL[focusedWeapon.category]
                      : loadoutPerf.roleLabel}
                  </p>
                  <p className="loadout-dossier__blurb">
                    {focusedWeapon
                      ? focusedWeapon.blurb
                      : loadoutPerf.aircraftBlurb}
                  </p>
                  <p className="loadout-dossier__trade">
                    {focusedWeapon
                      ? focusedWeapon.tradeoff
                      : `${loadoutPerf.strengths} · ${loadoutPerf.limitations}`}
                  </p>
                  <StatRadar stats={dossierStats} className="loadout-dossier__radar" />
                </div>
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
                MASTERY · {activeEntry.shortLabel}
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
                  <span>Emblem Spec</span>
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
          <p className="hub__sub">Uma gratuita agora · as outras no Hangar</p>
          <div className="shop__grid">
            {FLEET.filter((e) => e.unlockCost === 0 || e.aircraft === Aircraft.F15_EAGLE).map(
              (entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`hangar__card hangar__card--plain${
                    progress.aircraft === entry.aircraft ? " hangar__card--on" : ""
                  }`}
                  data-sfx="select"
                  onClick={() => pickStarter(entry.aircraft)}
                >
                  <span className="hangar__name">{entry.label}</span>
                  <span className="hangar__meta">
                    {entry.unlockCost <= 0
                      ? "GRÁTIS · starter"
                      : `${entry.unlockCost.toLocaleString("pt-BR")} CR · starter`}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      <div
        className="modal"
        id="fleet-info-modal"
        hidden={infoAircraft == null}
      >
        <div
          className="modal__backdrop"
          onClick={() => setInfoAircraft(null)}
          aria-hidden
        />
        <div
          className="modal__panel modal__panel--fleet-info panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fleet-info-title"
        >
          {infoAircraft != null && infoProfile && infoPerf && infoEntry ? (
            <div className="fleet-info">
              <header className="fleet-info__head">
                <span className="fleet-info__flag" aria-hidden>
                  {infoProfile.origin.flag}
                </span>
                <div className="fleet-info__titles">
                  <h3 id="fleet-info-title" className="fleet-info__title">
                    {infoEntry.label}
                  </h3>
                  <p className="fleet-info__meta">
                    <span>{infoProfile.origin.label}</span>
                    <span aria-hidden>·</span>
                    <span>{infoProfile.origin.year}</span>
                    <span aria-hidden>·</span>
                    <span>{infoPerf.roleLabel}</span>
                  </p>
                </div>
                <button
                  type="button"
                  className="fleet-info__x"
                  data-sfx="select"
                  aria-label="Fechar"
                  onClick={() => setInfoAircraft(null)}
                >
                  ×
                </button>
              </header>

              <div className="fleet-info__body">
                <div className="fleet-info__copy">
                  <p className="fleet-info__blurb">{infoPerf.aircraftBlurb}</p>
                  {infoProfile.origin.note ? (
                    <p className="fleet-info__note">{infoProfile.origin.note}</p>
                  ) : null}
                  <p className="fleet-info__chip fleet-info__chip--ok">
                    {infoPerf.strengths}
                  </p>
                  <p className="fleet-info__chip fleet-info__chip--warn">
                    {infoPerf.limitations}
                  </p>
                  <p className="fleet-info__loadout">
                    Padrão · {infoPerf.loadoutSummary}
                  </p>
                  <div className="fleet-info__actions">
                    {infoOwned ? (
                      <button
                        type="button"
                        className="btn btn--sm"
                        data-sfx="confirm"
                        onClick={() => {
                          equip(infoAircraft);
                          setInfoAircraft(null);
                          setTab("equip");
                        }}
                      >
                        Equipar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--sm"
                        data-sfx="confirm"
                        disabled={busy}
                        onClick={() => {
                          void buyAircraft(infoAircraft);
                          setInfoAircraft(null);
                        }}
                      >
                        {infoEntry.unlockCost <= 0
                          ? "Desbloquear"
                          : `Comprar · ${infoEntry.unlockCost.toLocaleString("pt-BR")} CR`}
                      </button>
                    )}
                  </div>
                </div>
                <StatRadar
                  stats={infoRadar}
                  size={236}
                  className="fleet-info__radar"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
