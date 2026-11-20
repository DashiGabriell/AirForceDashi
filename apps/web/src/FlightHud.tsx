import {
  AT_LEVEL_COUNT,
  Aircraft,
  Cam,
  DLZ_RAERO,
  DLZ_RMIN,
  DLZ_ROPT,
  DLZ_RPI,
  aircraftLabel,
  avatarPublicPath,
  clampAvatarId,
  fleetEntry,
  type AntiDroneState,
  type AttackState,
  type CheckpointState,
  type JetTelemetry,
  type PlaceOfInterest,
} from "@afd/game-core";
import type { AimHudState, JetPose } from "@afd/game-render";

interface Props {
  telemetry: JetTelemetry | null;
  view: Cam;
  paused: boolean;
  inspecting?: boolean;
  place: PlaceOfInterest | null;
  jet: JetPose | null;
  callsign: string;
  aircraft: Aircraft;
  avatarId?: number;
  soundOn?: boolean;
  missilesReady?: number;
  aimHud?: AimHudState | null;
  checkpoint?: CheckpointState | null;
  antidrone?: AntiDroneState | null;
  attack?: AttackState | null;
}

const HUD = "#59ff73";
const HUD_WARN = "#ffd93d";
const HUD_BAD = "#ff4d40";
const HUD_DIM = "rgba(89, 255, 115, 0.45)";

const CAM_LABEL: Record<Cam, string> = {
  [Cam.TOP]: "TOP",
  [Cam.CHASE]: "CHASE",
  [Cam.REAR]: "REAR",
  [Cam.COCKPIT]: "COCKPIT",
  [Cam.FREE]: "FREE",
};


const RADAR_RANGE_CP = 900;
const RADAR_R = 78;

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

function formatTime(sec: number): string {
  const t = Math.max(0, sec);
  const mins = Math.floor(t / 60);
  let secs = Math.ceil(t % 60);
  let m = mins;
  if (secs === 60) {
    m += 1;
    secs = 0;
  }
  if (m <= 0) return String(Math.ceil(t)).padStart(2, "0");
  return `${m}:${String(secs).padStart(2, "0")}`;
}

/** Mundo → local do jato (Basis ortonormal: local = Bᵀ · world). */
function toLocal(
  jet: JetPose,
  wx: number,
  wy: number,
  wz: number,
): { x: number; y: number; z: number } {
  const dx = wx - jet.x;
  const dy = wy - jet.y;
  const dz = wz - jet.z;
  return {
    x: jet.rx * dx + jet.ry * dy + jet.rz * dz,
    y: jet.ux * dx + jet.uy * dy + jet.uz * dz,
    z: jet.bx * dx + jet.by * dy + jet.bz * dz,
  };
}

function radarBlip(
  jet: JetPose,
  tx: number,
  ty: number,
  tz: number,
  range: number,
): { x: number; y: number; dist: number; bearing: number; onRim: boolean } {
  const local = toLocal(jet, tx, ty, tz);
  const dist = Math.hypot(tx - jet.x, ty - jet.y, tz - jet.z);
  const flatX = local.x;
  const flatZ = local.z;
  let flatLen = Math.hypot(flatX, flatZ);
  let fx = flatX;
  let fz = flatZ;
  if (flatLen < 0.001) {
    fx = 0;
    fz = -1;
    flatLen = 1;
  }
  const scale = (RADAR_R - 8) / range;
  let bx = fx * scale;
  let by = fz * scale;
  let onRim = false;
  const blipLen = Math.hypot(bx, by);
  if (blipLen > RADAR_R - 8) {
    const n = (RADAR_R - 8) / blipLen;
    bx *= n;
    by *= n;
    onRim = true;
  }
  const bearing = (Math.atan2(local.x, -local.z) * 180) / Math.PI;
  return { x: bx, y: by, dist, bearing, onRim };
}

function TimeChip({
  timeLeft,
  timeLimit,
  label = "TIME",
  hot = false,
}: {
  timeLeft: number;
  timeLimit: number;
  label?: string;
  hot?: boolean;
}) {
  const urgent = hot || timeLeft <= 12;
  const ratio =
    timeLimit > 0.001 ? clamp(timeLeft / timeLimit, 0, 1) : 0;
  return (
    <div className={`fhud__time${urgent ? " fhud__time--urgent" : ""}`}>
      <span className="fhud__time-label">{label}</span>
      <span className="fhud__time-value">{formatTime(timeLeft)}</span>
      <div className="fhud__time-bar">
        <div
          className={`fhud__time-bar-fill${urgent ? " fhud__time-bar-fill--hot" : ""}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

function CheckpointStrip({ cp }: { cp: CheckpointState }) {
  const total = Math.max(cp.ringTotal, 1);
  const done = clamp(cp.ringIndex, 0, total);
  return (
    <div className="fhud__strip">
      <div className="fhud__strip-meta">CP · Lv {cp.level}</div>
      <div className="fhud__strip-primary">
        <div className="fhud__strip-title">CHECKPOINT</div>
        <div className="fhud__strip-ticks" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`fhud__tick${i < done ? " fhud__tick--on" : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AntidroneStrip({ ad }: { ad: AntiDroneState }) {
  return (
    <div className="fhud__strip">
      <div className="fhud__strip-meta">
        AD · WAVE {ad.level}
      </div>
      <div className="fhud__strip-primary">
        <div className="fhud__strip-title">ANTI-DRONE</div>
        <div className="fhud__score">
          <span className="fhud__score-label">SCORE</span>
          <span className="fhud__score-value">
            {ad.kills.toLocaleString("pt-BR")}
          </span>
        </div>
      </div>
    </div>
  );
}

function AntidroneStack({
  ad,
  missilesReady,
}: {
  ad: AntiDroneState;
  missilesReady: number;
}) {
  const ammoPct = Math.round((clamp(missilesReady, 0, 4) / 4) * 100);
  const streak = Math.max(0, ad.kills - ad.leaks);
  return (
    <div className="fhud__ad-stack">
      <div className="fhud__ad-stat">
        <span>KILLS</span>
        <strong>{ad.kills}</strong>
      </div>
      <div className="fhud__ad-stat">
        <span>STREAK</span>
        <strong>{streak}</strong>
      </div>
      <div className="fhud__ad-stat">
        <span>AMMO</span>
        <strong>{ammoPct}%</strong>
      </div>
    </div>
  );
}

function AttackStrip({ at }: { at: AttackState }) {
  return (
    <div className="fhud__strip">
      <div className="fhud__strip-meta">
        ATK {at.level} / {AT_LEVEL_COUNT}
      </div>
      <div className="fhud__strip-primary">
        <div className="fhud__strip-title">
          TARGETS {at.destroyed} / {at.total}
        </div>
      </div>
    </div>
  );
}

interface RadarTarget {
  x: number;
  y: number;
  z: number;
  primary?: boolean;
}

function MissionRadar({
  jet,
  targets,
  range,
  soundOn,
}: {
  jet: JetPose;
  targets: RadarTarget[];
  range: number;
  soundOn: boolean;
}) {
  const primary = targets.find((t) => t.primary) ?? targets[0] ?? null;
  const readout = primary
    ? radarBlip(jet, primary.x, primary.y, primary.z, range)
    : null;

  return (
    <div className="fhud__radar">
      <div className="fhud__radar-label">RADAR</div>
      <div className="fhud__radar-scope">
        <svg viewBox={`0 0 ${RADAR_R * 2} ${RADAR_R * 2}`} className="fhud__radar-svg">
          <circle
            cx={RADAR_R}
            cy={RADAR_R}
            r={RADAR_R - 1}
            className="fhud__radar-ring fhud__radar-ring--outer"
          />
          <circle
            cx={RADAR_R}
            cy={RADAR_R}
            r={RADAR_R * 0.66}
            className="fhud__radar-ring"
          />
          <circle
            cx={RADAR_R}
            cy={RADAR_R}
            r={RADAR_R * 0.33}
            className="fhud__radar-ring"
          />
          <line
            x1={0}
            y1={RADAR_R}
            x2={RADAR_R * 2}
            y2={RADAR_R}
            className="fhud__radar-cross"
          />
          <line
            x1={RADAR_R}
            y1={0}
            x2={RADAR_R}
            y2={RADAR_R * 2}
            className="fhud__radar-cross"
          />
          <line
            x1={RADAR_R}
            y1={2}
            x2={RADAR_R}
            y2={12}
            className="fhud__radar-north"
          />
          <circle cx={RADAR_R} cy={RADAR_R} r={3} className="fhud__radar-own" />
          {targets.map((t, i) => {
            const b = radarBlip(jet, t.x, t.y, t.z, range);
            const cx = RADAR_R + b.x;
            const cy = RADAR_R + b.y;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={8} className="fhud__radar-blip-glow" />
                <circle cx={cx} cy={cy} r={4.5} className="fhud__radar-blip" />
                <circle cx={cx} cy={cy} r={2} className="fhud__radar-blip-core" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="fhud__radar-footer">
        {readout ? (
          <span>
            BRG{" "}
            <span className={readout.onRim ? "fhud__radar-brg--hot" : undefined}>
              {String(Math.round(((readout.bearing % 360) + 360) % 360)).padStart(
                3,
                "0",
              )}
              °
            </span>
          </span>
        ) : (
          <span>BRG —</span>
        )}
        <span className="fhud__radar-sound">
          SFX {soundOn ? "ON" : "OFF"}
        </span>
      </div>
    </div>
  );
}

/** Godot `hud.gd` CCIP / FPM / bore / DLZ overlay. */
function AimOverlay({
  aim,
  view,
  missilesReady,
  vspeed,
  afterburner,
}: {
  aim: AimHudState;
  view: Cam;
  missilesReady: number;
  vspeed: number;
  afterburner: boolean;
}) {
  const col = aim.inDlz ? HUD : aim.ready ? HUD_WARN : HUD_BAD;
  const flash =
    aim.inDlz &&
    aim.range < DLZ_RPI &&
    aim.range > DLZ_ROPT &&
    Math.floor(Date.now() / 180) % 2 === 1;

  let aseR = 38;
  if (aim.inDlz) {
    const t = clamp((aim.range - DLZ_ROPT) / (DLZ_RAERO - DLZ_ROPT), 0, 1);
    // Godot: inverse_lerp(RAERO, ROPT, range) → shrink toward optimal
    const tGodot = clamp((DLZ_RAERO - aim.range) / (DLZ_RAERO - DLZ_ROPT), 0, 1);
    aseR = 36 + (14 - 36) * tGodot;
    void t;
  }

  const showWeapon =
    !aim.raceMode && view !== Cam.REAR && view !== Cam.FREE && aim.valid;
  const showFpm =
    aim.fpm.on && view !== Cam.TOP && view !== Cam.FREE && view !== Cam.REAR;
  const showBore =
    !aim.raceMode &&
    aim.bore.on &&
    view !== Cam.FREE &&
    view !== Cam.REAR &&
    Math.hypot(aim.bore.x - aim.fpm.x, aim.bore.y - aim.fpm.y) > 8;

  const dlzH = 160;
  const dlzTop = 12;
  const dlzX = 14;
  const yOf = (r: number) =>
    dlzTop + dlzH - clamp(r / DLZ_RAERO, 0, 1) * dlzH;

  const st = aim.inDlz ? "RDY" : aim.ready ? "WAIT" : "SAFE";
  const stCol = aim.inDlz ? HUD : aim.ready ? HUD_WARN : HUD_BAD;

  let chev = afterburner ? 6 : 0;
  if (Math.abs(vspeed) > 8) chev += clamp(vspeed * 0.15, -8, 8);

  const showStatus = !aim.raceMode && view !== Cam.FREE && view !== Cam.REAR;

  return (
    <>
      <svg className="fhud__aim" aria-hidden>
        {showFpm ? (
          <g stroke={HUD} fill="none" strokeWidth={1.5}>
            <circle cx={aim.fpm.x} cy={aim.fpm.y} r={9} />
            <line
              x1={aim.fpm.x - 19}
              y1={aim.fpm.y}
              x2={aim.fpm.x - 9}
              y2={aim.fpm.y}
            />
            <line
              x1={aim.fpm.x + 9}
              y1={aim.fpm.y}
              x2={aim.fpm.x + 19}
              y2={aim.fpm.y}
            />
            <line
              x1={aim.fpm.x}
              y1={aim.fpm.y + 9}
              x2={aim.fpm.x}
              y2={aim.fpm.y + 17}
            />
            {Math.abs(chev) > 0.5 ? (
              <>
                <line
                  x1={aim.fpm.x - 16}
                  y1={aim.fpm.y - chev}
                  x2={aim.fpm.x - 10}
                  y2={aim.fpm.y - chev * 0.3}
                  stroke={HUD_DIM}
                  strokeWidth={1}
                />
                <line
                  x1={aim.fpm.x + 16}
                  y1={aim.fpm.y - chev}
                  x2={aim.fpm.x + 10}
                  y2={aim.fpm.y - chev * 0.3}
                  stroke={HUD_DIM}
                  strokeWidth={1}
                />
              </>
            ) : null}
          </g>
        ) : null}

        {showBore ? (
          <g stroke={HUD_DIM} strokeWidth={1}>
            <line
              x1={aim.bore.x - 6}
              y1={aim.bore.y}
              x2={aim.bore.x - 2}
              y2={aim.bore.y}
            />
            <line
              x1={aim.bore.x + 2}
              y1={aim.bore.y}
              x2={aim.bore.x + 6}
              y2={aim.bore.y}
            />
            <line
              x1={aim.bore.x}
              y1={aim.bore.y - 6}
              x2={aim.bore.x}
              y2={aim.bore.y - 2}
            />
            <line
              x1={aim.bore.x}
              y1={aim.bore.y + 2}
              x2={aim.bore.x}
              y2={aim.bore.y + 6}
            />
          </g>
        ) : null}

        {showWeapon && aim.ready ? (
          <>
            {showFpm && aim.aim.on ? (
              <line
                x1={aim.fpm.x}
                y1={aim.fpm.y}
                x2={aim.aim.x}
                y2={aim.aim.y}
                stroke={col}
                strokeWidth={1}
                strokeDasharray="4 5"
                opacity={0.85}
              />
            ) : null}

            {aim.aim.on ? (
              <g stroke={col} fill="none">
                {!flash ? (
                  <circle
                    cx={aim.aim.x}
                    cy={aim.aim.y}
                    r={aseR}
                    strokeWidth={aim.inDlz ? 1.5 : 1}
                  />
                ) : null}
                <line
                  x1={aim.aim.x - 11}
                  y1={aim.aim.y}
                  x2={aim.aim.x - 3}
                  y2={aim.aim.y}
                  strokeWidth={1.5}
                />
                <line
                  x1={aim.aim.x + 3}
                  y1={aim.aim.y}
                  x2={aim.aim.x + 11}
                  y2={aim.aim.y}
                  strokeWidth={1.5}
                />
                <line
                  x1={aim.aim.x}
                  y1={aim.aim.y - 11}
                  x2={aim.aim.x}
                  y2={aim.aim.y - 3}
                  strokeWidth={1.5}
                />
                <line
                  x1={aim.aim.x}
                  y1={aim.aim.y + 3}
                  x2={aim.aim.x}
                  y2={aim.aim.y + 11}
                  strokeWidth={1.5}
                />
                <circle cx={aim.aim.x} cy={aim.aim.y} r={4} strokeWidth={1.2} />
                <circle
                  cx={aim.aim.x}
                  cy={aim.aim.y}
                  r={1.2}
                  fill={col}
                  stroke="none"
                />
                <text
                  x={aim.aim.x + aseR + 6}
                  y={aim.aim.y + 4}
                  fill={col}
                  fontSize={11}
                  fontFamily="ui-monospace, Menlo, Consolas, monospace"
                >
                  {Math.round(aim.range)}
                </text>
              </g>
            ) : null}
          </>
        ) : null}
      </svg>

      {showWeapon && aim.ready ? (
        <svg className="fhud__dlz" viewBox="0 0 48 190" aria-hidden>
          <line
            x1={dlzX}
            y1={dlzTop}
            x2={dlzX}
            y2={dlzTop + dlzH}
            stroke={HUD_DIM}
            strokeWidth={1}
          />
          <polygon
            points={`${dlzX + 2},${yOf(DLZ_RAERO)} ${dlzX + 8},${yOf(DLZ_RAERO) - 4} ${dlzX + 8},${yOf(DLZ_RAERO) + 4}`}
            fill={HUD}
          />
          <circle
            cx={dlzX + 6}
            cy={yOf(DLZ_ROPT)}
            r={3}
            stroke={HUD}
            fill="none"
            strokeWidth={1}
          />
          <line
            x1={dlzX + 2}
            y1={yOf(DLZ_RPI)}
            x2={dlzX + 9}
            y2={yOf(DLZ_RPI)}
            stroke={HUD}
            strokeWidth={1}
          />
          <line
            x1={dlzX + 2}
            y1={yOf(DLZ_RMIN)}
            x2={dlzX + 9}
            y2={yOf(DLZ_RMIN)}
            stroke={HUD_WARN}
            strokeWidth={1.5}
          />
          <polygon
            points={`${dlzX - 1},${yOf(aim.range)} ${dlzX - 7},${yOf(aim.range) - 4} ${dlzX - 7},${yOf(aim.range) + 4}`}
            fill={col}
          />
          <text x={dlzX - 6} y={dlzTop - 2} fill={HUD_DIM} fontSize={9}>
            DLZ
          </text>
          <text x={dlzX + 10} y={yOf(DLZ_RAERO) + 3} fill={HUD_DIM} fontSize={8}>
            RA
          </text>
          <text x={dlzX + 10} y={yOf(DLZ_RMIN) + 3} fill={HUD_DIM} fontSize={8}>
            RM
          </text>
        </svg>
      ) : null}

      {showStatus ? (
        <div className="fhud__weapon">
          <div>A/G CCIP</div>
          <div style={{ color: stCol }}>{`MSL ${missilesReady}  ${st}`}</div>
        </div>
      ) : null}
    </>
  );
}

function PilotBadge({
  callsign,
  aircraft,
  avatarId,
  view,
  inspecting = false,
  antidrone,
  missilesReady,
}: {
  callsign: string;
  aircraft: Aircraft;
  avatarId: number;
  view: Cam;
  inspecting?: boolean;
  antidrone?: AntiDroneState | null;
  missilesReady?: number;
}) {
  const id = clampAvatarId(avatarId);
  const camLabel = inspecting ? "INSPECT" : CAM_LABEL[view];
  const acLine = antidrone
    ? `${fleetEntry(aircraft).shortLabel} · LOCK ×${missilesReady ?? 0}`
    : `${aircraftLabel(aircraft)} · ${camLabel}`;
  const hint = antidrone
    ? "Locks · burst · afterburner"
    : inspecting
      ? "Segure Q · mouse órbita · scroll zoom"
      : "WASD · Q inspecionar · Espaço mísseis";
  return (
    <div className="fhud__pilot">
      <img
        className="fhud__pilot-avatar"
        src={avatarPublicPath(id)}
        alt=""
        width={47}
        height={47}
        draggable={false}
      />
      <div className="fhud__pilot-text">
        <span className="fhud__pilot-name">{callsign.toUpperCase()}</span>
        <span className="fhud__pilot-ac">{acLine}</span>
      </div>
      <span className="fhud__pilot-hint">{hint}</span>
    </div>
  );
}

export function FlightHud({
  telemetry,
  view,
  paused,
  inspecting = false,
  place,
  jet,
  callsign,
  aircraft,
  avatarId = 0,
  soundOn = true,
  missilesReady,
  aimHud = null,
  checkpoint = null,
  antidrone = null,
  attack = null,
}: Props) {
  if (!telemetry || paused) return null;
  if (view === Cam.FREE) return null;

  const spd = telemetry.airspeed.toFixed(0).padStart(3, " ");
  const alt = telemetry.altitude.toFixed(0).padStart(5, " ");
  const hdg = ((telemetry.headingDeg % 360) + 360) % 360;
  const hdgStr = hdg.toFixed(0).padStart(3, "0");
  const pitch = telemetry.pitchDeg.toFixed(0);

  const cpLive =
    checkpoint &&
    (checkpoint.status === "RUN" || checkpoint.status === "IDLE") &&
    checkpoint.active;
  const adLive =
    antidrone &&
    (antidrone.status === "RUN" || antidrone.status === "IDLE") &&
    antidrone.active;
  const atLive =
    attack &&
    (attack.status === "RUN" || attack.status === "IDLE") &&
    attack.active;

  const missionMode = !!(cpLive || adLive || atLive);
  const showPilot = view === Cam.CHASE || view === Cam.TOP || view === Cam.COCKPIT;

  const cpTargets: RadarTarget[] =
    cpLive && checkpoint.next
      ? [
          {
            x: checkpoint.next.x,
            y: checkpoint.next.y,
            z: checkpoint.next.z,
            primary: true,
          },
        ]
      : [];

  return (
    <div
      className={`fhud${missionMode ? " fhud--mission" : ""}${
        adLive ? " fhud--ad" : ""
      }`}
      aria-hidden
    >
      {cpLive ? <CheckpointStrip cp={checkpoint} /> : null}
      {adLive ? <AntidroneStrip ad={antidrone} /> : null}
      {atLive ? <AttackStrip at={attack} /> : null}

      {cpLive && checkpoint.timeLimit > 0 ? (
        <TimeChip timeLeft={checkpoint.timeLeft} timeLimit={checkpoint.timeLimit} />
      ) : null}
      {atLive && attack.timeLimit > 0 ? (
        <TimeChip timeLeft={attack.timeLeft} timeLimit={attack.timeLimit} />
      ) : null}

      <div className="fhud__waterline" />
      {aimHud ? (
        <AimOverlay
          aim={aimHud}
          view={view}
          missilesReady={missilesReady ?? 0}
          vspeed={telemetry.vspeed}
          afterburner={telemetry.afterburner}
        />
      ) : null}

      {!missionMode || view === Cam.COCKPIT ? (
        <>
          <div className="fhud__tape fhud__tape--spd">
            <span className="fhud__label">SPD</span>
            <span className="fhud__value">{spd}</span>
          </div>
          <div className="fhud__tape fhud__tape--alt">
            <span className="fhud__label">ALT</span>
            <span className="fhud__value">{alt}</span>
          </div>
        </>
      ) : (
        <>
          <div className="fhud__tape fhud__tape--spd fhud__tape--slim">
            <span className="fhud__label">SPD</span>
            <span className="fhud__value">{spd.trim()}</span>
          </div>
          <div className="fhud__tape fhud__tape--alt fhud__tape--slim">
            <span className="fhud__label">ALT</span>
            <span className="fhud__value">{alt.trim()}</span>
          </div>
        </>
      )}

      {!missionMode ? (
        <div className="fhud__hdg">
          HDG {hdgStr}
          <span className="fhud__pitch"> P {pitch}°</span>
        </div>
      ) : null}

      <div className={`fhud__cam${missionMode ? " fhud__cam--mission" : ""}`}>
        {inspecting ? "INSPECT" : CAM_LABEL[view]}
      </div>

      {!missionMode && place ? (
        <div className="fhud__place">
          <span className="fhud__place-kind">{place.kind}</span>
          {place.name}
        </div>
      ) : null}

      {!missionMode && missilesReady != null && !aimHud ? (
        <div className="fhud__msl">MSL {missilesReady}/4</div>
      ) : null}

      {telemetry.afterburner ? <div className="fhud__ab">AB</div> : null}
      {telemetry.warnLowAlt ? <div className="fhud__warn">LOW</div> : null}

      {jet && cpLive ? (
        <MissionRadar
          jet={jet}
          targets={cpTargets}
          range={RADAR_RANGE_CP}
          soundOn={soundOn}
        />
      ) : null}
      {adLive ? (
        <AntidroneStack ad={antidrone} missilesReady={missilesReady ?? 0} />
      ) : null}

      {showPilot ? (
        <PilotBadge
          callsign={callsign}
          aircraft={aircraft}
          avatarId={avatarId}
          view={view}
          inspecting={inspecting}
          antidrone={adLive ? antidrone : null}
          {...(missilesReady != null ? { missilesReady } : {})}
        />
      ) : null}
    </div>
  );
}
