import { useEffect, useRef, useState } from "react";
import { gameAudio, type UiSfxRole } from "./audio/GameAudio";

interface Props {
  onResume: () => void;
  onMenu: () => void;
  /** Ex.: "CHECKPOINT · Lv 3 · tempo congelado" */
  meta?: string;
  onConfig?: () => void;
}

function punch(el: HTMLElement): void {
  el.classList.remove("is-punch");
  void el.offsetWidth;
  el.classList.add("is-punch");
}

export function PauseMenu({ onResume, onMenu, meta, onConfig }: Props) {
  const [abandonOpen, setAbandonOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onPointerDown = (ev: PointerEvent) => {
      const target = (ev.target as Element | null)?.closest?.(
        "[data-sfx]",
      ) as HTMLElement | null;
      if (!target || !root.contains(target)) return;

      const isToggle = target.hasAttribute("data-audio-toggle");
      let role = (target.getAttribute("data-sfx") || "select") as UiSfxRole;
      if (
        (target as HTMLButtonElement).disabled ||
        target.getAttribute("aria-disabled") === "true"
      ) {
        role = "deny";
      }

      void (async () => {
        if (isToggle) {
          await gameAudio.toggleUi();
          return;
        }
        await gameAudio.armUi();
        gameAudio.playUi(role);
        punch(target);
      })();
    };

    const onPointerEnter = (ev: PointerEvent) => {
      if (ev.pointerType === "touch") return;
      const target = (ev.target as Element | null)?.closest?.(
        "button[data-sfx]",
      ) as HTMLElement | null;
      if (!target || !root.contains(target)) return;
      if (target.hasAttribute("data-audio-toggle")) return;
      void gameAudio.armUi().then(() => gameAudio.playUi("select"));
    };

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointerenter", onPointerEnter, true);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointerenter", onPointerEnter, true);
    };
  }, []);

  return (
    <div ref={rootRef} className="pause-root">
      <div className="game-overlay game-overlay--pause" id="pause-overlay">
        <div className="game-overlay__bg" aria-hidden="true">
          <img
            className="game-overlay__bg-img"
            src="/ui/title_bg.jpg"
            alt=""
            decoding="async"
          />
          <div className="game-overlay__veil" />
        </div>
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
        <div className="game-overlay game-overlay--pause" id="abandon-overlay">
          <div className="game-overlay__bg" aria-hidden="true">
            <img
              className="game-overlay__bg-img"
              src="/ui/title_bg.jpg"
              alt=""
              decoding="async"
            />
            <div className="game-overlay__veil" />
          </div>
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
    </div>
  );
}
