import {
  DLZ_RAERO,
  DLZ_ROPT,
  type AltWarnLevel,
  type JetTelemetry,
  type RwrLevel,
} from "@afd/game-core";

export type AudioMode = "menu" | "flight" | "paused";

/** Progressive lock-tone urgency (mirrors alt-warn rate scaling). */
export type LockToneLevel =
  | "none"
  | "acquiring"
  | "far"
  | "close"
  | "critical";

export type LockToneInput = {
  phase: "none" | "acquiring" | "locked";
  range: number;
  inDlz: boolean;
};

export function evaluateLockTone(lock: LockToneInput | null | undefined): LockToneLevel {
  if (!lock || lock.phase === "none") return "none";
  if (lock.phase === "acquiring") return "acquiring";
  const range = lock.range;
  if (range > 0 && range <= DLZ_ROPT) return "critical";
  if (lock.inDlz || (range > 0 && range <= DLZ_RAERO)) return "close";
  return "far";
}

export type SfxId =
  | "missile"
  | "boom"
  | "boom_water"
  | "flare"
  | "roll"
  | "checkpoint_ok"
  | "level_clear"
  | "alt_warn";

/** SFX de UI espelhando reestilo/telas/telas.js */
export type UiSfxRole = "select" | "confirm" | "toggle" | "deny" | "arm";

const UI_VOL: Record<UiSfxRole, number> = {
  select: 0.7,
  confirm: 0.85,
  toggle: 0.55,
  arm: 0.45,
  deny: 0.65,
};

const SAMPLE_URLS: Record<string, string> = {
  engine: "/audio/engine_loop.wav",
  afterburner: "/audio/afterburner_loop.wav",
  menu: "/audio/menu_theme.wav",
  wind: "/audio/ambient_wind.wav",
  missile: "/audio/missile.wav",
  boom: "/audio/boom.wav",
  boom_water: "/audio/boom_water.wav",
  /** Reuses boom sample — short / bright dump. */
  flare: "/audio/boom.wav",
  roll: "/audio/roll.wav",
  checkpoint_ok: "/audio/checkpoint_ok.wav",
  level_clear: "/audio/win.wav",
  alt_warn: "/audio/alt_warn.wav",
  ui_select: "/audio/ui_select.wav",
  ui_confirm: "/audio/ui_confirm.wav",
  ui_toggle: "/audio/ui_toggle.wav",
  ui_deny: "/audio/ui_deny.wav",
  ui_arm: "/audio/ui_arm.wav",
};

function dbToGain(db: number): number {
  if (db <= -70) return 0;
  return Math.pow(10, db / 20);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

class LoopVoice {
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode;
  private buffer: AudioBuffer | null = null;
  private playing = false;
  private pitch = 1;

  constructor(
    private ctx: AudioContext,
    private dest: AudioNode,
  ) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(dest);
  }

  setBuffer(buf: AudioBuffer | null): void {
    this.buffer = buf;
  }

  start(): void {
    if (!this.buffer || this.playing) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    src.playbackRate.value = this.pitch;
    src.connect(this.gain);
    src.start();
    this.source = src;
    this.playing = true;
  }

  stop(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* already stopped */
      }
      this.source.disconnect();
      this.source = null;
    }
    this.playing = false;
    this.gain.gain.value = 0;
  }

  setGainDb(db: number): void {
    this.gain.gain.value = dbToGain(db);
  }

  setPitch(p: number): void {
    this.pitch = p;
    if (this.source) this.source.playbackRate.value = p;
  }

  get isPlaying(): boolean {
    return this.playing;
  }
}

class GameAudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loadPromise: Promise<void> | null = null;
  private unlocked = false;
  private gestureBound = false;
  /** Espelho de telas.js `audio.enabled` — theme + UI SFX só após armar. */
  private uiArmed = false;
  private lastToggleTick = 0;

  private engine: LoopVoice | null = null;
  private ab: LoopVoice | null = null;
  private menu: LoopVoice | null = null;
  private wind: LoopVoice | null = null;

  private mode: AudioMode = "menu";
  private masterVol = 0.8;
  private sfxVol = 0.85;
  private muted = false;

  private engineDb = -48;
  private abDb = -80;
  private menuDb = -80;
  private windDb = -80;
  private flightDuck = 0;
  private altWarnCd = 0;
  /** Soft lock-tone interval while target is locked. */
  private lockToneCd = 0;
  /** Hostile RWR beep cadence. */
  private rwrToneCd = 0;
  private enginePitch = 1;

  private sfxPool: AudioBufferSourceNode[] = [];

  /** Liga listeners de gesto para desbloquear o AudioContext do browser. */
  bindUnlockGestures(): void {
    if (this.gestureBound || typeof window === "undefined") return;
    this.gestureBound = true;
    const unlock = () => {
      void this.unlock();
    };
    window.addEventListener("pointerdown", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });
  }

  async unlock(): Promise<void> {
    await this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        return;
      }
    }
    this.unlocked = this.ctx.state === "running";
    if (this.unlocked) this.applyModeTargets(true);
  }

  setVolumes(master: number, sfx: number): void {
    this.masterVol = clamp(master, 0, 1);
    this.sfxVol = clamp(sfx, 0, 1);
    this.applyMasterGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMasterGain();
    if (muted) {
      this.engine?.stop();
      this.ab?.stop();
      this.menu?.stop();
      this.wind?.stop();
    } else {
      void this.unlock();
      this.applyModeTargets(true);
    }
  }

  get isMuted(): boolean {
    return this.muted || this.masterVol <= 0.01;
  }

  get isUiArmed(): boolean {
    return this.uiArmed && !this.isMuted;
  }

  setMode(mode: AudioMode): void {
    this.mode = mode;
    void this.unlock();
    this.applyModeTargets(false);
  }

  /** Primeiro gesto de UI: unlock + arma theme/SFX (telas.js armAndPlay). */
  async armUi(): Promise<void> {
    await this.unlock();
    if (!this.uiArmed) {
      this.uiArmed = true;
      this.muted = false;
      this.applyMasterGain();
      this.applyModeTargets(true);
      this.syncUiChrome();
    }
  }

  /** Botão ♪ — liga/desliga theme + UI SFX. */
  async toggleUi(): Promise<boolean> {
    await this.unlock();
    this.uiArmed = !this.uiArmed;
    this.muted = !this.uiArmed;
    this.applyMasterGain();
    if (this.uiArmed) {
      this.applyModeTargets(true);
      this.playUi("confirm");
    } else {
      this.menu?.stop();
      this.playUi("deny", { force: true });
    }
    this.syncUiChrome();
    return this.uiArmed;
  }

  /** SFX de hub (select/confirm/toggle/deny/arm). */
  playUi(role: UiSfxRole, opts?: { force?: boolean }): void {
    if (!opts?.force && !this.uiArmed) return;
    if (!opts?.force && this.isMuted) return;
    if (!this.ctx || !this.sfxBus || !this.unlocked) return;
    const buf = this.buffers.get(`ui_${role}`);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = (UI_VOL[role] ?? 0.7) * this.sfxVol;
    src.buffer = buf;
    src.connect(g);
    g.connect(this.sfxBus);
    src.start();
    src.onended = () => {
      try {
        src.disconnect();
        g.disconnect();
      } catch {
        /* noop */
      }
    };
  }

  /** Throttle para sliders (telas.js data-range-out). */
  playUiToggleTick(): void {
    if (!this.uiArmed || this.isMuted) return;
    const now = performance.now();
    if (now - this.lastToggleTick < 50) return;
    this.lastToggleTick = now;
    this.playUi("toggle");
  }

  private syncUiChrome(): void {
    if (typeof document === "undefined") return;
    const on = this.isUiArmed;
    document.querySelectorAll("[data-audio-toggle]").forEach((btn) => {
      const el = btn as HTMLElement;
      el.textContent = on ? "♪" : "✕";
      el.setAttribute("aria-pressed", String(on));
      el.classList.toggle("is-active", on);
    });
    document.querySelectorAll(".ds-audio-hint").forEach((hint) => {
      hint.textContent = on
        ? "Áudio armado · menu theme + SFX"
        : "Clique em qualquer controle para armar o áudio do cockpit.";
    });
  }

  playSfx(id: SfxId): void {
    if (this.isMuted || !this.ctx || !this.sfxBus || !this.unlocked) return;
    const buf = this.buffers.get(id);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const baseDb =
      id === "roll"
        ? -8
        : id === "flare"
          ? -10
          : id === "missile"
            ? -4
            : id === "checkpoint_ok"
              ? -3.5
              : id === "level_clear"
                ? -2.5
                : id === "alt_warn"
                  ? -16
                  : -2;
    const pitch =
      id === "alt_warn"
        ? 1
        : id === "flare"
          ? 1.35 + Math.random() * 0.2
          : 0.94 + Math.random() * 0.12;
    g.gain.value = dbToGain(baseDb) * this.sfxVol;
    src.buffer = buf;
    src.playbackRate.value = pitch;
    src.connect(g);
    g.connect(this.sfxBus);
    src.start();
    src.onended = () => {
      try {
        src.disconnect();
        g.disconnect();
      } catch {
        /* noop */
      }
    };
    this.sfxPool.push(src);
    if (this.sfxPool.length > 12) {
      const old = this.sfxPool.shift();
      try {
        old?.stop();
      } catch {
        /* noop */
      }
    }
  }

  playEvents(events: SfxId[]): void {
    for (const e of events) this.playSfx(e);
  }

  /** Progressive lock bip — slower when acquiring / far, urgent when close. */
  private playLockTone(level: Exclude<LockToneLevel, "none">): void {
    if (this.isMuted || !this.ctx || !this.sfxBus || !this.unlocked) return;
    const t0 = this.ctx.currentTime;
    const profile =
      level === "critical"
        ? { f0: 1100, f1: 820, db: -16, dur: 0.08, type: "triangle" as OscillatorType }
        : level === "close"
          ? { f0: 980, f1: 760, db: -19, dur: 0.085, type: "sine" as OscillatorType }
          : level === "far"
            ? { f0: 900, f1: 720, db: -22, dur: 0.09, type: "sine" as OscillatorType }
            : { f0: 720, f1: 580, db: -26, dur: 0.1, type: "sine" as OscillatorType };

    const fire = (offset: number) => {
      if (!this.ctx || !this.sfxBus) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const start = t0 + offset;
      osc.type = profile.type;
      osc.frequency.setValueAtTime(profile.f0, start);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(80, profile.f1),
        start + profile.dur * 0.85,
      );
      const peak = dbToGain(profile.db) * this.sfxVol;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, peak),
        start + 0.012,
      );
      g.gain.exponentialRampToValueAtTime(0.0001, start + profile.dur);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(start);
      osc.stop(start + profile.dur + 0.02);
      osc.onended = () => {
        try {
          osc.disconnect();
          g.disconnect();
        } catch {
          /* noop */
        }
      };
    };

    fire(0);
    if (level === "critical") fire(0.1);
  }

  /** Hostile RWR: LOCK = slower chirp, MISSILE = urgent double tick. */
  private playRwrTone(level: Exclude<RwrLevel, "none">): void {
    if (this.isMuted || !this.ctx || !this.sfxBus || !this.unlocked) return;
    const t0 = this.ctx.currentTime;
    const missile = level === "missile";
    const fire = (offset: number, f0: number, f1: number, db: number, dur: number) => {
      if (!this.ctx || !this.sfxBus) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const start = t0 + offset;
      osc.type = missile ? "square" : "sawtooth";
      osc.frequency.setValueAtTime(f0, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(80, f1), start + dur * 0.8);
      const peak = dbToGain(db) * this.sfxVol;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(start);
      osc.stop(start + dur + 0.02);
      osc.onended = () => {
        try {
          osc.disconnect();
          g.disconnect();
        } catch {
          /* noop */
        }
      };
    };
    if (missile) {
      fire(0, 1680, 1120, -16, 0.07);
      fire(0.09, 1680, 1120, -16, 0.07);
    } else {
      fire(0, 1320, 880, -19, 0.1);
    }
  }

  /** Progressive altitude / terrain cue (pt-BR HUD phases). */
  private playAltWarnTone(level: Exclude<AltWarnLevel, "none">): void {
    if (this.isMuted || !this.ctx || !this.sfxBus || !this.unlocked) return;
    const t0 = this.ctx.currentTime;
    const profile =
      level === "pullup"
        ? { f0: 980, f1: 720, db: -14, dur: 0.11, type: "square" as OscillatorType }
        : level === "warning"
          ? { f0: 780, f1: 620, db: -18, dur: 0.1, type: "triangle" as OscillatorType }
          : { f0: 620, f1: 540, db: -22, dur: 0.09, type: "sine" as OscillatorType };

    const fire = (offset: number) => {
      if (!this.ctx || !this.sfxBus) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const start = t0 + offset;
      osc.type = profile.type;
      osc.frequency.setValueAtTime(profile.f0, start);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(80, profile.f1),
        start + profile.dur * 0.85,
      );
      const peak = dbToGain(profile.db) * this.sfxVol;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, peak),
        start + 0.012,
      );
      g.gain.exponentialRampToValueAtTime(0.0001, start + profile.dur);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(start);
      osc.stop(start + profile.dur + 0.02);
      osc.onended = () => {
        try {
          osc.disconnect();
          g.disconnect();
        } catch {
          /* noop */
        }
      };
    };

    fire(0);
    if (level === "pullup") fire(0.12);
  }

  tick(
    dt: number,
    telemetry: JetTelemetry | null,
    opts?: { lock?: LockToneInput | null; rwrLevel?: RwrLevel },
  ): void {
    if (!this.ctx || !this.unlocked || this.isMuted) return;

    const wantMenu =
      (this.mode === "menu" && this.uiArmed) || this.mode === "paused";
    this.flightDuck = lerp(
      this.flightDuck,
      this.mode === "menu" || this.mode === "paused" ? 0 : 1,
      1 - Math.exp(-2.2 * dt),
    );

    const menuTarget = wantMenu ? -11 : -80;
    this.menuDb = lerp(this.menuDb, menuTarget, 1 - Math.exp(-2.4 * dt));
    if (this.menu) {
      if (menuTarget > -50) this.menu.start();
      this.menu.setGainDb(this.menuDb);
      if (!wantMenu && this.menuDb <= -70) this.menu.stop();
    }

    if (!telemetry || this.mode === "menu") {
      this.engineDb = lerp(this.engineDb, -48, 1 - Math.exp(-5 * dt));
      this.abDb = lerp(this.abDb, -80, 1 - Math.exp(-6 * dt));
      this.windDb = lerp(this.windDb, -80, 1 - Math.exp(-3 * dt));
      this.engine?.setGainDb(this.engineDb);
      this.ab?.setGainDb(this.abDb);
      this.wind?.setGainDb(this.windDb);
      if (this.abDb <= -70) this.ab?.stop();
      if (this.windDb <= -70) this.wind?.stop();
      return;
    }

    // Flight / paused (duck): engine + wind still tick; AB follows afterburner
    const throttle = telemetry.afterburner
      ? 1
      : clamp(0.35 + telemetry.speedNorm * 0.55, 0.35, 0.95);
    const speedN = clamp(telemetry.speedNorm, 0, 1.05);
    const pitchN = clamp(Math.abs(telemetry.pitchDeg) / 45, 0, 1);
    const gN = clamp(Math.abs(telemetry.gForce - 1) / 3, 0, 1);
    const dive = clamp(-telemetry.pitchDeg / 40, 0, 1);

    let pitchScale = lerp(0.78, 1.18, throttle);
    pitchScale += speedN * 0.12;
    pitchScale += pitchN * 0.06;
    pitchScale += gN * 0.08;
    pitchScale -= dive * 0.03;
    if (telemetry.afterburner) pitchScale += 0.1;
    pitchScale = clamp(pitchScale, 0.7, 1.45);
    this.enginePitch = lerp(this.enginePitch, pitchScale, 1 - Math.exp(-6 * dt));

    let vol = lerp(-22, -8, throttle);
    vol += speedN * 2.5;
    vol += gN * 1.5;
    vol += dive * 1.2;
    vol = lerp(-48, vol, this.flightDuck);

    this.engine?.start();
    this.engineDb = lerp(this.engineDb, vol, 1 - Math.exp(-5 * dt));
    this.engine?.setGainDb(this.engineDb);
    this.engine?.setPitch(this.enginePitch);

    const wantAb = telemetry.afterburner && this.mode === "flight";
    const abTarget = wantAb
      ? lerp(-9, -2.5, throttle) + gN * 1.5
      : -80;
    const abSpeed = wantAb ? 10 : 6;
    this.abDb = this.moveToward(this.abDb, abTarget, abSpeed * 12 * dt);
    if (wantAb) {
      this.ab?.start();
      this.ab?.setPitch(lerp(0.92, 1.18, throttle) + speedN * 0.05);
    }
    this.ab?.setGainDb(this.abDb);
    if (!wantAb && this.abDb <= -70) this.ab?.stop();

    // Wind bed
    let windTarget = lerp(-28, -12, clamp(telemetry.altitude / 3500, 0, 1) * 0.65);
    windTarget += lerp(0, 6, clamp(telemetry.speedNorm * 1.15, 0, 1.2));
    windTarget = lerp(-80, windTarget, this.flightDuck);
    this.wind?.start();
    this.windDb = lerp(this.windDb, windTarget, 1 - Math.exp(-2.8 * dt));
    this.wind?.setGainDb(this.windDb);
    this.wind?.setPitch(lerp(0.9, 1.15, clamp(telemetry.airspeed / 220, 0, 1)));

    // Low-alt / terrain beeps — rate scales with urgency
    this.altWarnCd = Math.max(0, this.altWarnCd - dt);
    const altLevel = telemetry.altWarn ?? "none";
    if (this.mode === "flight" && altLevel !== "none" && this.altWarnCd <= 0) {
      this.playAltWarnTone(altLevel);
      this.altWarnCd =
        altLevel === "pullup" ? 0.28 : altLevel === "warning" ? 0.62 : 1.05;
    }

    // Hostile RWR — priority over friendly lock bip
    this.rwrToneCd = Math.max(0, this.rwrToneCd - dt);
    const rwr = opts?.rwrLevel ?? "none";
    if (this.mode === "flight" && rwr !== "none" && this.rwrToneCd <= 0) {
      this.playRwrTone(rwr);
      this.rwrToneCd = rwr === "missile" ? 0.22 : 0.48;
    }

    // Target-lock bip — rate scales with lock urgency (muted under RWR)
    this.lockToneCd = Math.max(0, this.lockToneCd - dt);
    const lockLevel = evaluateLockTone(opts?.lock);
    if (
      this.mode === "flight" &&
      rwr === "none" &&
      lockLevel !== "none" &&
      this.lockToneCd <= 0
    ) {
      this.playLockTone(lockLevel);
      this.lockToneCd =
        lockLevel === "critical"
          ? 0.2
          : lockLevel === "close"
            ? 0.32
            : lockLevel === "far"
              ? 0.55
              : 1.05;
    }
  }

  dispose(): void {
    this.engine?.stop();
    this.ab?.stop();
    this.menu?.stop();
    this.wind?.stop();
    for (const s of this.sfxPool) {
      try {
        s.stop();
      } catch {
        /* noop */
      }
    }
    this.sfxPool = [];
    void this.ctx?.close();
    this.ctx = null;
    this.unlocked = false;
  }

  private applyModeTargets(forceStart: boolean): void {
    if (!this.unlocked || this.isMuted) return;
    if (this.mode === "menu" || this.mode === "paused") {
      if (!this.uiArmed && this.mode === "menu") {
        this.menu?.stop();
        return;
      }
      this.menu?.start();
      if (forceStart) {
        // ~0.28 linear ≈ -11 dB — alinhado a VOL.menu do telas.js
        this.menuDb = -11;
        this.menu?.setGainDb(this.menuDb);
      }
    }
    if (this.mode === "flight") {
      this.engine?.start();
      this.wind?.start();
    }
  }

  private applyMasterGain(): void {
    if (!this.master) return;
    const v = this.muted ? 0 : this.masterVol;
    this.master.gain.value = v;
  }

  private moveToward(current: number, target: number, maxDelta: number): number {
    const d = target - current;
    if (Math.abs(d) <= maxDelta) return target;
    return current + Math.sign(d) * maxDelta;
  }

  private async ensure(): Promise<void> {
    if (this.ctx) {
      if (this.loadPromise) await this.loadPromise;
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyMasterGain();

    this.engine = new LoopVoice(this.ctx, this.musicBus);
    this.ab = new LoopVoice(this.ctx, this.musicBus);
    this.menu = new LoopVoice(this.ctx, this.musicBus);
    this.wind = new LoopVoice(this.ctx, this.musicBus);

    this.loadPromise = this.loadAll();
    await this.loadPromise;
  }

  private async loadAll(): Promise<void> {
    if (!this.ctx) return;
    await Promise.all(
      Object.entries(SAMPLE_URLS).map(async ([id, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const arr = await res.arrayBuffer();
          const buf = await this.ctx!.decodeAudioData(arr.slice(0));
          this.buffers.set(id, buf);
        } catch {
          console.warn(`[audio] failed to load ${url}`);
        }
      }),
    );
    this.engine?.setBuffer(this.buffers.get("engine") ?? null);
    this.ab?.setBuffer(this.buffers.get("afterburner") ?? null);
    this.menu?.setBuffer(this.buffers.get("menu") ?? null);
    this.wind?.setBuffer(this.buffers.get("wind") ?? null);
  }
}

/** Singleton do bus de áudio do cliente web. */
export const gameAudio = new GameAudioBus();
