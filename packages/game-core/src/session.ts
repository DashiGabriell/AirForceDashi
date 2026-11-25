import { Aircraft, Cam, PlayMode } from "@afd/shared-types";

export interface GameSession {
  playMode: PlayMode;
  aircraft: Aircraft;
  cameraMode: Cam;
  lookBackHold: boolean;
  paused: boolean;
  playerName: string;
  missionLevel: number;
}

export function createSession(partial?: Partial<GameSession>): GameSession {
  return {
    playMode: PlayMode.FREE_FLIGHT,
    aircraft: Aircraft.F22_RAPTOR,
    cameraMode: Cam.CHASE,
    lookBackHold: false,
    paused: false,
    playerName: "DASHI-1",
    missionLevel: 1,
    ...partial,
  };
}

export function createFreeFlightSession(
  partial?: Partial<GameSession>,
): GameSession {
  return createSession({ playMode: PlayMode.FREE_FLIGHT, ...partial });
}

/** Play cameras, in Space-cycle order. */
const PLAY_CAMERAS: Cam[] = [Cam.CHASE, Cam.COCKPIT, Cam.REAR];

export function viewCamera(session: GameSession): Cam {
  if (session.lookBackHold) return Cam.REAR;
  return session.cameraMode;
}

export function cycleCamera(session: GameSession): Cam {
  const i = PLAY_CAMERAS.indexOf(session.cameraMode);
  const next = PLAY_CAMERAS[(i + 1) % PLAY_CAMERAS.length] ?? Cam.CHASE;
  session.cameraMode = next;
  return next;
}
