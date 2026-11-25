import {
  Cam,
  DLZ_RAERO,
  DLZ_ROPT,
  type AltWarnLevel,
  type JetTelemetry,
  type RwrLevel,
} from "@afd/game-core";

/** menu = hubs · loading = FlightBoot (silêncio) · flight · paused */
export type AudioMode = "menu" | "loading" | "flight" | "paused";

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
  | "ab_ignite"
  | "ab_cutoff"
  | "airbrake"
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
  engine: "/audio/AFD-engine-42.wav",
  engine_idle: "/audio/AFD-engine-idle-74.wav",
  afterburner: "/audio/AFD-ab-74.wav",
  ab_ignite: "/audio/AFD-ab-ignite-74.wav",
  ab_cutoff: "/audio/AFD-ab-cutoff-74.wav",
  menu: "/audio/AFD-menu-1.wav",
  fight: "/audio/AFD-fight-1.wav",
  wind: "/audio/AFD-wind-74.wav",
  missile: "/audio/AFD-missile-74.wav",
  boom: "/audio/AFD-boom-air-74.wav",
  boom_water: "/audio/boom_water.wav",
  flare: "/audio/AFD-flare-74.wav",
  roll: "/audio/AFD-roll-74.wav",
  airbrake: "/audio/AFD-airbrake-74.wav",
  lock: "/audio/AFD-lock-51.wav",
  checkpoint_ok: "/audio/checkpoint_ok.wav",
  level_clear: "/audio/win.wav",
  alt_warn: "/audio/alt_warn.wav",
  ui_select: "/audio/AFD-ui-click-51.wav",
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

/** Onde o ouvinte está neste frame. Nariz = fx, cauda = tx, cima = u. */
export interface HearState {
  view: "cockpit" | "chase" | "rear";
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fx: number;
  fy: number;
  fz: number;
  ux: number;
  uy: number;
  uz: number;
  tx: number;
  ty: number;
  tz: number;
}

export interface SpatialSfx {
  id: "missile" | "boom" | "boom_water" | "flare";
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

export type PlayableSfx = SfxId | SpatialSfx;

/** Ouve o jato de onde a câmera está. Nariz = −Basis.z. */
export function hearFromJet(
  view: Cam,
  jet: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    bx: number;
    by: number;
    bz: number;
    ux: number;
    uy: number;
    uz: number;
  },
): HearState {
  const name =
    view === Cam.COCKPIT ? "cockpit" : view === Cam.REAR ? "rear" : "chase";
  return {
    view: name,
    x: jet.x,
    y: jet.y,
    z: jet.z,
    vx: jet.vx,
    vy: jet.vy,
    vz: jet.vz,
    fx: -jet.bx,
    fy: -jet.by,
    fz: -jet.bz,
    ux: jet.ux,
    uy: jet.uy,
    uz: jet.uz,
    tx: jet.bx,
    ty: jet.by,
    tz: jet.bz,
  };
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
  private limiter: DynamicsCompressorNode | null = null;
  private engineBus: GainNode | null = null;
  private airBus: GainNode | null = null;
  private weaponsBus: GainNode | null = null;
  private uiBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private engineLow: BiquadFilterNode | null = null;
  private airHigh: BiquadFilterNode | null = null;
  private airLow: BiquadFilterNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loadPromise: Promise<void> | null = null;
  private unlocked = false;
  private gestureBound = false;
  /** Espelho de telas.js `audio.enabled` — theme + UI SFX só após armar. */
  private uiArmed = false;
  private lastToggleTick = 0;

  private engine: LoopVoice | null = null;
  private idle: LoopVoice | null = null;
  private ab: LoopVoice | null = null;
  private menu: LoopVoice | null = null;
  private fight: LoopVoice | null = null;
  private wind: LoopVoice | null = null;
  private brake: LoopVoice | null = null;
  private hear: HearState | null = null;
  private cabin = 0;
  private lastAlt = 0;
  private brakeDb = -80;

  private mode: AudioMode = "menu";
  private masterVol = 0.8;
  private sfxVol = 0.85;
  private musicVol = 0.28;
  private fightMusicEnabled = true;
  private fightMusicVol = 0.55;
  private muted = false;
  private prevAb = false;

  private engineDb = -48;
  private idleDb = -80;
  private abDb = -80;
  private menuDb = -80;
  private fightDb = -80;
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

  /** Theme de menu + musica de combate (persistidos em PlayerSettings). */
  setMusicSettings(
    musicVolume: number,
    fightMusicEnabled: boolean,
    fightMusicVolume: number,
  ): void {
    this.musicVol = clamp(musicVolume, 0, 1);
    this.fightMusicEnabled = fightMusicEnabled;
    this.fightMusicVol = clamp(fightMusicVolume, 0, 1);
    this.applyModeTargets(false);
  }

  /** Aplica master/SFX/musica a partir de PlayerSettings. */
  applyPlayerSettings(s: {
    masterVolume: number;
    sfxVolume: number;
    musicVolume: number;
    fightMusicEnabled: boolean;
    fightMusicVolume: number;
  }): void {
    this.setVolumes(s.masterVolume, s.sfxVolume);
    this.setMusicSettings(
      s.musicVolume,
      s.fightMusicEnabled,
      s.fightMusicVolume,
    );
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMasterGain();
    if (muted) {
      this.engine?.stop();
      this.idle?.stop();
      this.ab?.stop();
      this.menu?.stop();
      this.fight?.stop();
      this.wind?.stop();
      this.brake?.stop();
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
      this.fight?.stop();
      this.playUi("deny", { force: true });
    }
    this.syncUiChrome();
    return this.uiArmed;
  }

  /** SFX de hub (select/confirm/toggle/deny/arm). */
  playUi(role: UiSfxRole, opts?: { force?: boolean }): void {
    if (!opts?.force && !this.uiArmed) return;
    if (!opts?.force && this.isMuted) return;
    if (!this.ctx || !this.uiBus || !this.unlocked) return;
    const buf = this.buffers.get(`ui_${role}`);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = UI_VOL[role] ?? 0.7;
    src.buffer = buf;
    src.connect(g);
    g.connect(this.uiBus);
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
    if (id === "airbrake") return;
    if (this.isMuted || !this.ctx || !this.unlocked) return;
    const bus = this.busFor(id);
    if (!bus) return;
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
            ? -6
            : id === "boom" || id === "boom_water"
              ? -12
            : id === "ab_ignite"
              ? -5
              : id === "ab_cutoff"
                ? -7
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
    g.gain.value = dbToGain(baseDb);
    src.buffer = buf;
    src.playbackRate.value = pitch;
    src.connect(g);
    g.connect(bus);
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

  playEvents(events: PlayableSfx[], hear?: HearState): void {
    if (hear) this.noteHear(hear);
    for (const e of events) {
      if (typeof e === "string") this.playSfx(e);
      else this.playSpatial(e);
    }
  }

  noteHear(hear: HearState): void {
    this.hear = hear;
    this.placeListener(hear);
  }

  private placeListener(hear: HearState): void {
    if (!this.ctx) return;
    let x = hear.x;
    let y = hear.y;
    let z = hear.z;
    let fx = hear.fx;
    let fy = hear.fy;
    let fz = hear.fz;
    if (hear.view === "chase") {
      x += hear.tx * 16 + hear.ux * 4;
      y += hear.ty * 16 + hear.uy * 4;
      z += hear.tz * 16 + hear.uz * 4;
    } else if (hear.view === "rear") {
      x += hear.fx * 10 + hear.ux * 2.8;
      y += hear.fy * 10 + hear.uy * 2.8;
      z += hear.fz * 10 + hear.uz * 2.8;
      fx = hear.tx;
      fy = hear.ty;
      fz = hear.tz;
    } else {
      x += hear.ux * 0.9;
      y += hear.uy * 0.9;
      z += hear.uz * 0.9;
    }
    const l = this.ctx.listener;
    const now = this.ctx.currentTime;
    if (l.positionX) {
      const tc = 0.04;
      l.positionX.setTargetAtTime(x, now, tc);
      l.positionY.setTargetAtTime(y, now, tc);
      l.positionZ.setTargetAtTime(z, now, tc);
      l.forwardX.setTargetAtTime(fx, now, tc);
      l.forwardY.setTargetAtTime(fy, now, tc);
      l.forwardZ.setTargetAtTime(fz, now, tc);
      l.upX.setTargetAtTime(hear.ux, now, tc);
      l.upY.setTargetAtTime(hear.uy, now, tc);
      l.upZ.setTargetAtTime(hear.uz, now, tc);
      return;
    }
    const legacy = l as AudioListener & {
      setPosition(x: number, y: number, z: number): void;
      setOrientation(
        fx: number,
        fy: number,
        fz: number,
        ux: number,
        uy: number,
        uz: number,
      ): void;
    };
    legacy.setPosition(x, y, z);
    legacy.setOrientation(fx, fy, fz, hear.ux, hear.uy, hear.uz);
  }

  private updateCabin(dt: number, altN: number): void {
    if (!this.ctx || !this.engineLow || !this.airLow || !this.airHigh) return;
    const want = this.hear?.view === "cockpit" ? 1 : 0;
    this.cabin = lerp(this.cabin, want, 1 - Math.exp(-8 * dt));
    this.lastAlt = lerp(this.lastAlt, altN, 1 - Math.exp(-1.6 * dt));
    const now = this.ctx.currentTime;
    const tc = 0.07;
    this.engineLow.frequency.setTargetAtTime(lerp(15000, 2600, this.cabin), now, tc);
    this.airLow.frequency.setTargetAtTime(lerp(14000, 1900, this.cabin), now, tc);
    this.airHigh.frequency.setTargetAtTime(lerp(60, 480, this.lastAlt), now, tc);
  }

  private playSpatial(e: SpatialSfx): void {
    const hear = this.hear;
    if (!hear) {
      this.playSfx(e.id);
      return;
    }
    if (this.isMuted || !this.ctx || !this.weaponsBus || !this.unlocked) return;
    const buf = this.buffers.get(e.id);
    if (!buf) return;
    const dx = e.x - hear.x;
    const dy = e.y - hear.y;
    const dz = e.z - hear.z;
    const dist = Math.hypot(dx, dy, dz);
    const inv = dist > 0.5 ? 1 / dist : 0;
    const dirx = dx * inv;
    const diry = dy * inv;
    const dirz = dz * inv;
    const relx = (e.vx ?? 0) - hear.vx;
    const rely = (e.vy ?? 0) - hear.vy;
    const relz = (e.vz ?? 0) - hear.vz;
    const closing = -(relx * dirx + rely * diry + relz * dirz);
    let rate = clamp(1 + closing / 343, 0.84, 1.16);
    if (e.id === "flare") rate = clamp(rate * 1.15, 0.84, 1.22);

    const src = this.ctx.createBufferSource();
    const lp = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    const panner = this.ctx.createPanner();
    lp.type = "lowpass";
    lp.Q.value = 0.6;
    lp.frequency.value = lerp(15000, 650, clamp(dist / 2400, 0, 1));
    const baseDb =
      e.id === "flare" ? -8 : e.id === "missile" ? -4 : e.id === "boom_water" ? -1 : -2;
    g.gain.value = dbToGain(baseDb);
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 40;
    panner.maxDistance = 5000;
    panner.rolloffFactor = 1.15;
    if (panner.positionX) {
      panner.positionX.value = e.x;
      panner.positionY.value = e.y;
      panner.positionZ.value = e.z;
    } else {
      panner.setPosition(e.x, e.y, e.z);
    }
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.connect(lp);
    lp.connect(g);
    g.connect(panner);
    panner.connect(this.weaponsBus);
    src.start();
    src.onended = () => {
      try {
        src.disconnect();
        lp.disconnect();
        g.disconnect();
        panner.disconnect();
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

  private busFor(id: SfxId): GainNode | null {
    if (id === "missile" || id === "boom" || id === "boom_water" || id === "flare") {
      return this.weaponsBus;
    }
    if (id === "roll") return this.airBus;
    if (id === "ab_ignite" || id === "ab_cutoff") return this.engineBus;
    return this.uiBus;
  }

  /** Progressive lock bip — sample when available, else synth. */
  private playLockTone(level: Exclude<LockToneLevel, "none">): void {
    if (this.isMuted || !this.ctx || !this.uiBus || !this.unlocked) return;
    const lockBuf = this.buffers.get("lock");
    if (lockBuf) {
      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      const rate =
        level === "critical"
          ? 1.18
          : level === "close"
            ? 1.08
            : level === "far"
              ? 1.0
              : 0.92;
      const db =
        level === "critical"
          ? -14
          : level === "close"
            ? -17
            : level === "far"
              ? -20
              : -24;
      g.gain.value = dbToGain(db);
      src.buffer = lockBuf;
      src.playbackRate.value = rate;
      src.connect(g);
      g.connect(this.uiBus);
      src.start();
      src.onended = () => {
        try {
          src.disconnect();
          g.disconnect();
        } catch {
          /* noop */
        }
      };
      return;
    }
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
      if (!this.ctx || !this.uiBus) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const start = t0 + offset;
      osc.type = profile.type;
      osc.frequency.setValueAtTime(profile.f0, start);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(80, profile.f1),
        start + profile.dur * 0.85,
      );
      const peak = dbToGain(profile.db);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, peak),
        start + 0.012,
      );
      g.gain.exponentialRampToValueAtTime(0.0001, start + profile.dur);
      osc.connect(g);
      g.connect(this.uiBus);
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
    if (this.isMuted || !this.ctx || !this.uiBus || !this.unlocked) return;
    const t0 = this.ctx.currentTime;
    const missile = level === "missile";
    const fire = (offset: number, f0: number, f1: number, db: number, dur: number) => {
      if (!this.ctx || !this.uiBus) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const start = t0 + offset;
      osc.type = missile ? "square" : "sawtooth";
      osc.frequency.setValueAtTime(f0, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(80, f1), start + dur * 0.8);
      const peak = dbToGain(db);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g);
      g.connect(this.uiBus);
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
    if (this.isMuted || !this.ctx || !this.uiBus || !this.unlocked) return;
    const t0 = this.ctx.currentTime;
    const profile =
      level === "pullup"
        ? { f0: 980, f1: 720, db: -14, dur: 0.11, type: "square" as OscillatorType }
        : level === "warning"
          ? { f0: 780, f1: 620, db: -18, dur: 0.1, type: "triangle" as OscillatorType }
          : { f0: 620, f1: 540, db: -22, dur: 0.09, type: "sine" as OscillatorType };

    const fire = (offset: number) => {
      if (!this.ctx || !this.uiBus) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const start = t0 + offset;
      osc.type = profile.type;
      osc.frequency.setValueAtTime(profile.f0, start);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(80, profile.f1),
        start + profile.dur * 0.85,
      );
      const peak = dbToGain(profile.db);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, peak),
        start + 0.012,
      );
      g.gain.exponentialRampToValueAtTime(0.0001, start + profile.dur);
      osc.connect(g);
      g.connect(this.uiBus);
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
    opts?: { lock?: LockToneInput | null; rwrLevel?: RwrLevel; hear?: HearState },
  ): void {
    if (!this.ctx || !this.unlocked || this.isMuted) return;
    if (opts?.hear) this.noteHear(opts.hear);

    const wantMenu =
      (this.mode === "menu" && this.uiArmed) || this.mode === "paused";
    const wantFight =
      this.mode === "flight" &&
      this.fightMusicEnabled &&
      this.fightMusicVol > 0.01;
    this.flightDuck = lerp(
      this.flightDuck,
      this.mode === "menu" ||
        this.mode === "paused" ||
        this.mode === "loading"
        ? 0
        : 1,
      1 - Math.exp(-2.2 * dt),
    );

    // Menu peak ~-11 dB scaled by musicVolume (1.0 → -11 dB, 0 → silence).
    const menuPeakDb = this.musicVol <= 0.01 ? -80 : lerp(-28, -11, this.musicVol);
    const menuTarget = wantMenu ? menuPeakDb : -80;
    this.menuDb = lerp(this.menuDb, menuTarget, 1 - Math.exp(-2.4 * dt));
    if (this.menu) {
      if (menuTarget > -50) this.menu.start();
      this.menu.setGainDb(this.menuDb);
      if (!wantMenu && this.menuDb <= -70) this.menu.stop();
    }

    // Fight bed ~-14 dB at full fightMusicVolume; ducks out in menu/pause.
    const fightPeakDb =
      this.fightMusicVol <= 0.01 ? -80 : lerp(-26, -14, this.fightMusicVol);
    const fightTarget = wantFight ? fightPeakDb : -80;
    this.fightDb = lerp(this.fightDb, fightTarget, 1 - Math.exp(-2.6 * dt));
    if (this.fight) {
      if (fightTarget > -50) this.fight.start();
      this.fight.setGainDb(this.fightDb);
      if (!wantFight && this.fightDb <= -70) this.fight.stop();
    }

    if (!telemetry || this.mode === "menu" || this.mode === "loading") {
      this.updateCabin(dt, 0);
      this.engineDb = lerp(this.engineDb, -48, 1 - Math.exp(-5 * dt));
      this.idleDb = lerp(this.idleDb, -80, 1 - Math.exp(-5 * dt));
      this.abDb = lerp(this.abDb, -80, 1 - Math.exp(-6 * dt));
      this.windDb = lerp(this.windDb, -80, 1 - Math.exp(-3 * dt));
      this.brakeDb = lerp(this.brakeDb, -80, 1 - Math.exp(-4 * dt));
      this.engine?.setGainDb(this.engineDb);
      this.idle?.setGainDb(this.idleDb);
      this.ab?.setGainDb(this.abDb);
      this.wind?.setGainDb(this.windDb);
      this.brake?.setGainDb(this.brakeDb);
      if (this.abDb <= -70) this.ab?.stop();
      if (this.idleDb <= -70) this.idle?.stop();
      if (this.windDb <= -70) this.wind?.stop();
      if (this.brakeDb <= -70) this.brake?.stop();
      this.prevAb = false;
      return;
    }

    const speedN = clamp(telemetry.speedNorm, 0, 1);
    const altN = clamp(telemetry.altitude / 8000, 0, 1);
    this.updateCabin(dt, altN);
    const throttle = telemetry.airbrake
      ? clamp(speedN * 0.28, 0, 0.3)
      : telemetry.afterburner
        ? 1
        : clamp(0.38 + speedN * 0.55, 0.38, 0.92);
    const idleMix = clamp(1 - (throttle - 0.15) / 0.7, 0, 1);
    const powerMix = clamp((throttle - 0.12) / 0.75, 0, 1);
    const pitch = clamp(lerp(0.99, 1.04, throttle), 0.97, 1.06);
    this.enginePitch = lerp(this.enginePitch, pitch, 1 - Math.exp(-4 * dt));
    const body = this.cabin * 2;
    const duck = this.flightDuck;

    const idleTarget = lerp(-80, -16 + body + 20 * Math.log10(Math.max(0.04, idleMix)), duck);
    const powerTarget = lerp(-80, -14 + body + 20 * Math.log10(Math.max(0.04, powerMix)), duck);

    this.engine?.start();
    this.engineDb = lerp(this.engineDb, powerTarget, 1 - Math.exp(-5 * dt));
    this.engine?.setGainDb(this.engineDb);
    this.engine?.setPitch(this.enginePitch);

    if (idleMix > 0.04) this.idle?.start();
    this.idleDb = lerp(this.idleDb, idleTarget, 1 - Math.exp(-5 * dt));
    this.idle?.setGainDb(this.idleDb);
    this.idle?.setPitch(this.enginePitch);
    if (idleMix <= 0.04 && this.idleDb <= -70) this.idle?.stop();

    const wantAb = telemetry.afterburner && this.mode === "flight";
    if (this.mode === "flight") {
      if (wantAb && !this.prevAb) this.playSfx("ab_ignite");
      if (!wantAb && this.prevAb) this.playSfx("ab_cutoff");
    }
    this.prevAb = wantAb;

    const abTarget = wantAb ? lerp(-80, -15 + body, duck) : -80;
    this.abDb = this.moveToward(this.abDb, abTarget, (wantAb ? 14 : 8) * 12 * dt);
    if (wantAb || this.abDb > -70) this.ab?.start();
    this.ab?.setPitch(clamp(this.enginePitch * 1.015, 0.97, 1.06));
    this.ab?.setGainDb(this.abDb);
    if (!wantAb && this.abDb <= -70) this.ab?.stop();

    const windTarget = lerp(-80, lerp(-32, -16, speedN) - altN * 7 - this.cabin * 4, duck);
    this.wind?.start();
    this.windDb = lerp(this.windDb, windTarget, 1 - Math.exp(-2.4 * dt));
    this.wind?.setGainDb(this.windDb);
    this.wind?.setPitch(lerp(0.99, 1.03, speedN));

    const brakeOn = telemetry.airbrake && this.mode === "flight";
    const brakeTarget = brakeOn ? lerp(-80, -15, duck) : -80;
    if (brakeOn) this.brake?.start();
    this.brakeDb = lerp(this.brakeDb, brakeTarget, 1 - Math.exp(-6 * dt));
    this.brake?.setGainDb(this.brakeDb);
    this.brake?.setPitch(1);
    if (!brakeOn && this.brakeDb <= -70) this.brake?.stop();

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
    this.idle?.stop();
    this.ab?.stop();
    this.menu?.stop();
    this.fight?.stop();
    this.wind?.stop();
    this.brake?.stop();
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
    // FlightBoot: uma theme dona = nenhuma. Corta menu+fight sem esperar tick.
    if (this.mode === "loading") {
      this.menu?.stop();
      this.menuDb = -80;
      this.fight?.stop();
      this.fightDb = -80;
      return;
    }
    if (this.mode === "menu" || this.mode === "paused") {
      this.fight?.stop();
      this.fightDb = -80;
      if (!this.uiArmed && this.mode === "menu") {
        this.menu?.stop();
        return;
      }
      if (this.musicVol <= 0.01) {
        this.menu?.stop();
        this.menuDb = -80;
        return;
      }
      this.menu?.start();
      if (forceStart) {
        this.menuDb = lerp(-28, -11, this.musicVol);
        this.menu?.setGainDb(this.menuDb);
      }
    }
    if (this.mode === "flight") {
      this.menu?.stop();
      this.menuDb = -80;
      this.engine?.start();
      this.wind?.start();
      if (this.fightMusicEnabled && this.fightMusicVol > 0.01) {
        this.fight?.start();
        if (forceStart) {
          this.fightDb = lerp(-26, -14, this.fightMusicVol);
          this.fight?.setGainDb(this.fightDb);
        }
      } else {
        this.fight?.stop();
        this.fightDb = -80;
      }
    }
  }

  private applyMasterGain(): void {
    if (!this.master) return;
    const v = this.muted ? 0 : this.masterVol;
    this.master.gain.value = v;
    const sfx = this.muted ? 0 : this.sfxVol;
    if (this.engineBus) this.engineBus.gain.value = sfx;
    if (this.airBus) this.airBus.gain.value = sfx;
    if (this.weaponsBus) this.weaponsBus.gain.value = sfx;
    if (this.uiBus) this.uiBus.gain.value = sfx;
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
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.12;

    this.engineBus = this.ctx.createGain();
    this.airBus = this.ctx.createGain();
    this.weaponsBus = this.ctx.createGain();
    this.uiBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();

    this.engineLow = this.ctx.createBiquadFilter();
    this.engineLow.type = "lowpass";
    this.engineLow.frequency.value = 15000;
    this.engineLow.Q.value = 0.5;

    this.airHigh = this.ctx.createBiquadFilter();
    this.airHigh.type = "highpass";
    this.airHigh.frequency.value = 70;
    this.airHigh.Q.value = 0.5;

    this.airLow = this.ctx.createBiquadFilter();
    this.airLow.type = "lowpass";
    this.airLow.frequency.value = 14000;
    this.airLow.Q.value = 0.5;

    this.engineBus.connect(this.engineLow);
    this.engineLow.connect(this.master);
    this.airBus.connect(this.airHigh);
    this.airHigh.connect(this.airLow);
    this.airLow.connect(this.master);
    this.weaponsBus.connect(this.master);
    this.uiBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(this.limiter);
    this.limiter.connect(this.ctx.destination);
    this.applyMasterGain();

    this.engine = new LoopVoice(this.ctx, this.engineBus);
    this.idle = new LoopVoice(this.ctx, this.engineBus);
    this.ab = new LoopVoice(this.ctx, this.engineBus);
    this.wind = new LoopVoice(this.ctx, this.airBus);
    this.brake = new LoopVoice(this.ctx, this.airBus);
    this.menu = new LoopVoice(this.ctx, this.musicBus);
    this.fight = new LoopVoice(this.ctx, this.musicBus);

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
    this.idle?.setBuffer(this.buffers.get("engine_idle") ?? null);
    this.ab?.setBuffer(this.buffers.get("afterburner") ?? null);
    this.menu?.setBuffer(this.buffers.get("menu") ?? null);
    this.fight?.setBuffer(this.buffers.get("fight") ?? null);
    this.wind?.setBuffer(this.buffers.get("wind") ?? null);
    this.brake?.setBuffer(this.buffers.get("airbrake") ?? null);
  }
}

/** Singleton do bus de áudio do cliente web. */
export const gameAudio = new GameAudioBus();
