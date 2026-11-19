import { useEffect, useRef, type ReactNode } from "react";
import { gameAudio, type UiSfxRole } from "./audio/GameAudio";

function playGlitch(root: ParentNode | null): void {
  if (!root || typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const nodes = [...root.querySelectorAll(".glitch-el")];
  nodes.forEach((el, i) => {
    const node = el as HTMLElement;
    node.classList.remove("is-glitching");
    node.style.removeProperty("--g");
    void node.offsetWidth;
    node.style.setProperty("--g", String(i));
    node.classList.add("is-glitching");
    const clear = () => {
      node.classList.remove("is-glitching");
      node.style.removeProperty("--g");
      node.removeEventListener("animationend", clear);
    };
    node.addEventListener("animationend", clear);
  });
}

function punch(el: HTMLElement): void {
  el.classList.remove("is-punch");
  void el.offsetWidth;
  el.classList.add("is-punch");
}

interface Props {
  /** Muda a cada troca de tela hub — dispara glitch de entrada. */
  screenKey: string;
  children: ReactNode;
}

/**
 * Espelho de reestilo/telas/telas.js:
 * - glitch de entrada em `.glitch-el`
 * - SFX via `[data-sfx]` no pointerdown (capture)
 * - toggle ♪ via `[data-audio-toggle]`
 */
export function HubFx({ screenKey, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      playGlitch(rootRef.current);
    });
    return () => window.cancelAnimationFrame(id);
  }, [screenKey]);

  useEffect(() => {
    const dailyEl = document.querySelector('[data-countdown="daily"]');
    const weeklyEl = document.querySelector('[data-countdown="weekly"]');
    if (!dailyEl && !weeklyEl) return;
    const pad = (n: number) => String(n).padStart(2, "0");
    let dailyLeft = 5 * 3600 + 12 * 60 + 44;
    let weeklyLeft = 2 * 86400 + 11 * 3600;
    const tick = window.setInterval(() => {
      if (dailyEl) {
        dailyLeft = Math.max(0, dailyLeft - 1);
        const h = Math.floor(dailyLeft / 3600);
        const m = Math.floor((dailyLeft % 3600) / 60);
        const s = dailyLeft % 60;
        dailyEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
      }
      if (weeklyEl && dailyLeft % 60 === 0) {
        weeklyLeft = Math.max(0, weeklyLeft - 60);
        const d = Math.floor(weeklyLeft / 86400);
        const h = Math.floor((weeklyLeft % 86400) / 3600);
        weeklyEl.textContent = `${d}d ${h}h`;
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [screenKey]);

  useEffect(() => {
    const onPointerDown = (ev: PointerEvent) => {
      const target = (ev.target as Element | null)?.closest?.(
        "[data-sfx]",
      ) as HTMLElement | null;
      if (!target) return;

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

    const onInput = (ev: Event) => {
      const target = ev.target as HTMLElement | null;
      if (!target?.matches?.("input[type='range']")) return;
      if (!target.closest(".cfg-shell, .cfg-panel, .settings__block")) return;
      gameAudio.playUiToggleTick();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("input", onInput, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("input", onInput, true);
    };
  }, []);

  return (
    <div ref={rootRef} className="hub-fx" style={{ display: "contents" }}>
      {children}
    </div>
  );
}
