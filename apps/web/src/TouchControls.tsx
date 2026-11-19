import { useEffect, useState, type MouseEvent, type TouchEvent } from "react";
import type { KeyboardFlightInput } from "@afd/game-core";

interface Props {
  input: KeyboardFlightInput | null;
  visible: boolean;
}

export function TouchControls({ input, visible }: Props) {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!visible || !coarse || !input) return null;

  const hold =
    (code: string) =>
    (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      input.setVirtual(code, true);
    };
  const release =
    (code: string) =>
    (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      input.setVirtual(code, false);
    };

  return (
    <div className="touch" aria-label="Controles touch">
      <div className="touch__stick">
        <button
          type="button"
          className="touch__btn"
          aria-label="Subir"
          onTouchStart={hold("KeyW")}
          onTouchEnd={release("KeyW")}
          onMouseDown={hold("KeyW")}
          onMouseUp={release("KeyW")}
          onMouseLeave={release("KeyW")}
        >
          ▲
        </button>
        <div className="touch__row">
          <button
            type="button"
            className="touch__btn"
            aria-label="Esquerda"
            onTouchStart={hold("KeyA")}
            onTouchEnd={release("KeyA")}
            onMouseDown={hold("KeyA")}
            onMouseUp={release("KeyA")}
            onMouseLeave={release("KeyA")}
          >
            ◀
          </button>
          <button
            type="button"
            className="touch__btn"
            aria-label="Descer"
            onTouchStart={hold("KeyS")}
            onTouchEnd={release("KeyS")}
            onMouseDown={hold("KeyS")}
            onMouseUp={release("KeyS")}
            onMouseLeave={release("KeyS")}
          >
            ▼
          </button>
          <button
            type="button"
            className="touch__btn"
            aria-label="Direita"
            onTouchStart={hold("KeyD")}
            onTouchEnd={release("KeyD")}
            onMouseDown={hold("KeyD")}
            onMouseUp={release("KeyD")}
            onMouseLeave={release("KeyD")}
          >
            ▶
          </button>
        </div>
      </div>
      <div className="touch__actions">
        <button
          type="button"
          className="touch__btn touch__btn--fire"
          aria-label="Atirar"
          onTouchStart={(e) => {
            e.preventDefault();
            input.pulseEdge("fire");
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            input.pulseEdge("fire");
          }}
        >
          FIRE
        </button>
        <button
          type="button"
          className="touch__btn"
          aria-label="Afterburner"
          onTouchStart={hold("ShiftLeft")}
          onTouchEnd={release("ShiftLeft")}
          onMouseDown={hold("ShiftLeft")}
          onMouseUp={release("ShiftLeft")}
          onMouseLeave={release("ShiftLeft")}
        >
          AB
        </button>
        <button
          type="button"
          className="touch__btn"
          aria-label="Pausar"
          onTouchStart={(e) => {
            e.preventDefault();
            input.pulseEdge("pause");
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            input.pulseEdge("pause");
          }}
        >
          II
        </button>
      </div>
    </div>
  );
}
