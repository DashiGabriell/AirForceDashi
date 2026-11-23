import type { JetTelemetry } from "@afd/game-core";

/** Glass bottom as fraction of viewport — parity Godot cockpit.gd GLASS_FRAC. */
export const COCKPIT_GLASS_FRAC = 0.56;

interface Props {
  telemetry: JetTelemetry;
  aircraftLabel: string;
}

/**
 * 2D canopy + coaming + dash for Cam.COCKPIT.
 * World airframe is hidden; this frame owns the “inside” read.
 */
export function CockpitOverlay({ telemetry, aircraftLabel }: Props) {
  const spd = Math.round(telemetry.airspeed);
  const alt = Math.round(telemetry.altitude).toString().padStart(5, "0");
  const hdg = (((telemetry.headingDeg % 360) + 360) % 360)
    .toFixed(0)
    .padStart(3, "0");
  const g = telemetry.gForce.toFixed(1);
  const pitch = telemetry.pitchDeg;
  const roll = telemetry.rollDeg;
  const ab = telemetry.afterburner;
  const pitchOff = Math.max(-22, Math.min(22, pitch * 0.55));

  return (
    <div className="cockpit" aria-hidden>
      <div className="cockpit__glass" />
      <div className="cockpit__bow" />
      <div className="cockpit__bow-rim" />
      <div className="cockpit__fillet cockpit__fillet--l" />
      <div className="cockpit__fillet cockpit__fillet--r" />
      <div className="cockpit__pillar cockpit__pillar--l" />
      <div className="cockpit__pillar cockpit__pillar--r" />
      <div className="cockpit__combiner" />

      <div className="cockpit__coaming">
        <div className="cockpit__brow" />
      </div>

      <div className="cockpit__dash">
        <div className="cockpit__dash-bevel" />
        <div className="cockpit__console">
          <div className="cockpit__gauge">
            <span className="cockpit__gauge-label">ASI</span>
            <span className="cockpit__gauge-value">{spd}</span>
          </div>

          <div className="cockpit__ah">
            <span className="cockpit__gauge-label cockpit__gauge-label--ah">AH</span>
            <div
              className="cockpit__ah-ball"
              style={{ transform: `rotate(${-roll}deg)` }}
            >
              <div
                className="cockpit__ah-sky"
                style={{ transform: `translateY(${pitchOff}px)` }}
              />
              <div
                className="cockpit__ah-ground"
                style={{
                  top: `calc(50% + ${pitchOff}px)`,
                }}
              />
            </div>
            <div className="cockpit__ah-ref" />
          </div>

          <div className="cockpit__gauge">
            <span className="cockpit__gauge-label">ALT</span>
            <span className="cockpit__gauge-value">{alt}</span>
          </div>

          <div className="cockpit__gauge cockpit__gauge--center">
            <span className="cockpit__gauge-label">HDG</span>
            <span className="cockpit__gauge-value">{hdg}</span>
          </div>

          <div className={`cockpit__gauge${ab ? " cockpit__gauge--hot" : ""}`}>
            <span className="cockpit__gauge-label">ENG</span>
            <span className="cockpit__gauge-value">{ab ? "AB" : "MIL"}</span>
          </div>

          <div className="cockpit__gauge">
            <span className="cockpit__gauge-label">G</span>
            <span className="cockpit__gauge-value">{g}</span>
          </div>
        </div>
        <div className="cockpit__plate">AF DASHI · {aircraftLabel}</div>
      </div>
    </div>
  );
}
