/** Discrete + axis flight controls (browser & tests). */

export interface FlightInput {
  /** A/D: -1 left … +1 right */
  bank: number;
  /** W/S: -1 climb … +1 dive (Godot climb/dive axis) */
  pitch: number;
  afterburner: boolean;
  fire: boolean;
  barrelRoll: boolean;
  cycleCamera: boolean;
  lookBack: boolean;
  pause: boolean;
  /** FREE cam extras */
  freeUp: boolean;
  freeDown: boolean;
  freeBoost: boolean;
  mouseDx: number;
  mouseDy: number;
  wheel: number;
}

export function emptyInput(): FlightInput {
  return {
    bank: 0,
    pitch: 0,
    afterburner: false,
    fire: false,
    barrelRoll: false,
    cycleCamera: false,
    lookBack: false,
    pause: false,
    freeUp: false,
    freeDown: false,
    freeBoost: false,
    mouseDx: 0,
    mouseDy: 0,
    wheel: 0,
  };
}

export class KeyboardFlightInput {
  private keys = new Set<string>();
  private edges = {
    fire: false,
    barrelRoll: false,
    cycleCamera: false,
    pause: false,
  };
  private mouseDx = 0;
  private mouseDy = 0;
  private wheel = 0;
  private abMouse = false;

  /** Virtual pad / touch — hold key codes without DOM keyboard. */
  setVirtual(code: string, down: boolean): void {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }

  pulseEdge(edge: "fire" | "barrelRoll" | "cycleCamera" | "pause"): void {
    this.edges[edge] = true;
  }

  attach(target: Window | HTMLElement = window): () => void {
    const onKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (e.code === "Space") {
        e.preventDefault();
        this.edges.cycleCamera = true;
      }
      if (e.code === "KeyF") this.edges.barrelRoll = true;
      if (e.code === "Escape") this.edges.pause = true;
      if (e.code === "KeyV") this.edges.fire = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) this.edges.fire = true;
      if (e.button === 2) this.abMouse = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) this.abMouse = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      this.mouseDx += e.movementX;
      this.mouseDy += e.movementY;
    };
    const onWheel = (e: WheelEvent) => {
      this.wheel += e.deltaY > 0 ? -1 : 1;
    };
    const onContext = (e: Event) => e.preventDefault();

    target.addEventListener("keydown", onKeyDown as EventListener);
    target.addEventListener("keyup", onKeyUp as EventListener);
    target.addEventListener("mousedown", onMouseDown as EventListener);
    target.addEventListener("mouseup", onMouseUp as EventListener);
    target.addEventListener("mousemove", onMouseMove as EventListener);
    target.addEventListener("wheel", onWheel as EventListener, { passive: true });
    target.addEventListener("contextmenu", onContext);

    return () => {
      target.removeEventListener("keydown", onKeyDown as EventListener);
      target.removeEventListener("keyup", onKeyUp as EventListener);
      target.removeEventListener("mousedown", onMouseDown as EventListener);
      target.removeEventListener("mouseup", onMouseUp as EventListener);
      target.removeEventListener("mousemove", onMouseMove as EventListener);
      target.removeEventListener("wheel", onWheel as EventListener);
      target.removeEventListener("contextmenu", onContext);
    };
  }

  sample(): FlightInput {
    const bank =
      (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
      (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
    const pitch =
      (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0) -
      (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0);

    const input: FlightInput = {
      bank,
      pitch,
      afterburner: this.abMouse || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      fire: this.edges.fire,
      barrelRoll: this.edges.barrelRoll,
      cycleCamera: this.edges.cycleCamera,
      lookBack: this.keys.has("KeyC"),
      pause: this.edges.pause,
      freeUp: this.keys.has("KeyE") || this.keys.has("PageUp"),
      freeDown: this.keys.has("KeyQ") || this.keys.has("PageDown"),
      freeBoost: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      mouseDx: this.mouseDx,
      mouseDy: this.mouseDy,
      wheel: this.wheel,
    };

    this.edges.fire = false;
    this.edges.barrelRoll = false;
    this.edges.cycleCamera = false;
    this.edges.pause = false;
    this.mouseDx = 0;
    this.mouseDy = 0;
    this.wheel = 0;
    return input;
  }
}
