import { useState } from "react";

interface Props {
  onResume: () => void;
  onMenu: () => void;
  /** Ex.: "CHECKPOINT · Lv 3 · tempo congelado" */
  meta?: string;
  onConfig?: () => void;
}

export function PauseMenu({ onResume, onMenu, meta, onConfig }: Props) {
  const [abandonOpen, setAbandonOpen] = useState(false);

  return (
    <>
      <div className="game-overlay" id="pause-overlay">
        <div className="overlay-card pause">
          <h3 className="pause__title">PAUSA</h3>
          <div className="pause__accent" />
          {meta ? <p className="pause__meta">{meta}</p> : null}
          <div className="pause__actions">
            <button
              type="button"
              className="btn btn--primary"
              data-sfx="confirm"
              onClick={onResume}
            >
              Retomar
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              data-sfx="toggle"
              data-audio-toggle
            >
              Som
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              data-sfx="select"
              onClick={() => onConfig?.()}
            >
              Config
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              data-sfx="deny"
              onClick={() => setAbandonOpen(true)}
            >
              Abandonar
            </button>
          </div>
        </div>
      </div>

      {abandonOpen ? (
        <div className="game-overlay" id="abandon-overlay">
          <div className="overlay-card abandon">
            <h3 className="pause__title">ABANDONAR?</h3>
            <div className="pause__accent" />
            <p className="body">
              Você perde a recompensa desta partida. Credits/XP já no perfil e
              itens comprados ficam intactos.
            </p>
            <div className="pause__actions">
              <button
                type="button"
                className="btn btn--primary"
                data-sfx="confirm"
                onClick={() => setAbandonOpen(false)}
              >
                Continuar voando
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                data-sfx="deny"
                onClick={onMenu}
              >
                Sair sem recompensa
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
