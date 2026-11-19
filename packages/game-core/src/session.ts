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

export function viewCamera(session: GameSession): Cam {
  if (
    session.lookBackHold &&
    session.cameraMode !== Cam.TOP &&
    session.cameraMode !== Cam.FREE
  ) {
    return Cam.REAR;
  }
  return session.cameraMode;
}

export function cycleCamera(session: GameSession): Cam {
  session.cameraMode = ((session.cameraMode + 1) % 5) as Cam;
  return session.cameraMode;
}
