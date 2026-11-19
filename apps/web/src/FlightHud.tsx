import type { JetTelemetry, PlaceOfInterest } from "@afd/game-core";
import { Cam } from "@afd/shared-types";

interface Props {
  telemetry: JetTelemetry | null;
  view: Cam;
  paused: boolean;
  place: PlaceOfInterest | null;
  missilesReady?: number;
  missionLine?: string | null;
}

const CAM_LABEL: Record<Cam, string> = {
  [Cam.TOP]: "TOP",
  [Cam.CHASE]: "CHASE",
  [Cam.REAR]: "REAR",
  [Cam.COCKPIT]: "COCKPIT",
  [Cam.FREE]: "FREE",
};

export function FlightHud({
  telemetry,
  view,
  paused,
  place,
  missilesReady,
  missionLine,
}: Props) {
  if (!telemetry || paused) return null;
  const spd = telemetry.airspeed.toFixed(0).padStart(3, " ");
  const alt = telemetry.altitude.toFixed(0).padStart(5, " ");
  const hdg = ((telemetry.headingDeg % 360) + 360) % 360;
  const hdgStr = hdg.toFixed(0).padStart(3, "0");
  const pitch = telemetry.pitchDeg.toFixed(0);

  return (
    <div className="fhud" aria-hidden>
      <div className="fhud__waterline" />
      <div className="fhud__tape fhud__tape--spd">
        <span className="fhud__label">SPD</span>
        <span className="fhud__value">{spd}</span>
      </div>
      <div className="fhud__tape fhud__tape--alt">
        <span className="fhud__label">ALT</span>
        <span className="fhud__value">{alt}</span>
      </div>
      <div className="fhud__hdg">
        HDG {hdgStr}
        <span className="fhud__pitch"> P {pitch}°</span>
      </div>
      <div className="fhud__cam">{CAM_LABEL[view]}</div>
      {place ? (
        <div className="fhud__place">
          <span className="fhud__place-kind">{place.kind}</span>
          {place.name}
        </div>
      ) : null}
      {missionLine ? <div className="fhud__mission">{missionLine}</div> : null}
      {missilesReady != null ? (
        <div className="fhud__msl">MSL {missilesReady}/4</div>
      ) : null}
      {telemetry.afterburner ? <div className="fhud__ab">AB</div> : null}
      {telemetry.warnLowAlt ? <div className="fhud__warn">LOW</div> : null}
      <div className="fhud__hint">
        WASD · LMB fire · RMB AB · Space cam · C look-aft · F roll · Esc pause
      </div>
    </div>
  );
}
