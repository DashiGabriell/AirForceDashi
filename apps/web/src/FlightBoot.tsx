interface Props {
  /** 0..1, driven by the approach-corridor bake. */
  progress: number;
}

function statusFor(progress: number): string {
  if (progress >= 0.995) return "Pista pronta";
  if (progress >= 0.7) return "Preparando a pista";
  if (progress >= 0.22) return "Montando o terreno";
  return "Lendo o mapa";
}

/** Holds takeoff until the approach the player is already looking at is resident. */
export function FlightBoot({ progress }: Props) {
  const clamped = Math.min(1, Math.max(0, progress));
  const pct = Math.round(clamped * 100);

  return (
    <div className="flight-boot" role="status" aria-live="polite">
      <img className="flight-boot__logo" src="/ui/logo.png" alt="" />
      <p className="flight-boot__kicker">Dashi AFB</p>
      <h1 className="flight-boot__title">Aproximação</h1>
      <p className="flight-boot__status">{statusFor(clamped)}</p>
      <div
        className="flight-boot__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={statusFor(clamped)}
      >
        <div className="flight-boot__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
