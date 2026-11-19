import { useState } from "react";
import { gameAudio } from "./audio/GameAudio";

interface Props {
  onResume: () => void;
  onMenu: () => void;
}

export function PauseMenu({ onResume, onMenu }: Props) {
  const [soundOn, setSoundOn] = useState(!gameAudio.isMuted);

  return (
    <div className="pause">
      <h2 className="pause__title">PAUSA</h2>
      <div className="pause__accent" />
      <div className="pause__actions">
        <button type="button" className="btn btn--primary" onClick={onResume}>
          Retomar
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            gameAudio.setMuted(!next);
            void gameAudio.unlock();
          }}
        >
          Som: {soundOn ? "ON" : "OFF"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onMenu}>
          Menu
        </button>
      </div>
    </div>
  );
}
