import type { JetTelemetry } from "@afd/game-core";

export type AudioMode = "menu" | "flight" | "paused";

export type SfxId =
  | "missile"
  | "boom"
  | "boom_water"
  | "roll"
  | "checkpoint_ok"
  | "level_clear"
  | "alt_warn";

const SAMPLE_URLS: Record<string, string> = {
  engine: "/audio/engine_loop.wav",
  afterburner: "/audio/afterburner_loop.wav",
  menu: "/audio/menu_theme.wav",
  wind: "/audio/ambient_wind.wav",
  missile: "/audio/missile.wav",
  boom: "/audio/boom.wav",
  boom_water: "/audio/boom_water.wav",
  roll: "/audio/roll.wav",
  checkpoint_ok: "/audio/checkpoint_ok.wav",
  level_clear: "/audio/level_clear.wav",
  alt_warn: "/audio/alt_warn.wav",
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

  setMode(mode: AudioMode): void {
    this.mode = mode;
    void this.unlock();
    this.applyModeTargets(false);
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

  tick(dt: number, telemetry: JetTelemetry | null): void {
    if (!this.ctx || !this.unlocked || this.isMuted) return;

    const wantMenu = this.mode === "menu" || this.mode === "paused";
    this.flightDuck = lerp(
      this.flightDuck,
      wantMenu ? 0 : 1,
      1 - Math.exp(-2.2 * dt),
    );

    const menuTarget = wantMenu ? -9.5 : -80;
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
      : clamp((telemetry.airspeed - 50) / 160, 0.35, 0.95);
    const speedN = clamp(telemetry.airspeed / 240, 0, 1.3);
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
    windTarget += lerp(0, 6, clamp(telemetry.airspeed / 220, 0, 1.2));
    windTarget = lerp(-80, windTarget, this.flightDuck);
    this.wind?.start();
    this.windDb = lerp(this.windDb, windTarget, 1 - Math.exp(-2.8 * dt));
    this.wind?.setGainDb(this.windDb);
    this.wind?.setPitch(lerp(0.9, 1.15, clamp(telemetry.airspeed / 220, 0, 1)));

    // Low-alt warning beeps
    this.altWarnCd = Math.max(0, this.altWarnCd - dt);
    if (
      this.mode === "flight" &&
      telemetry.warnLowAlt &&
      this.altWarnCd <= 0
    ) {
      this.playSfx("alt_warn");
      this.altWarnCd = 0.85;
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
      this.menu?.start();
      if (forceStart) {
        this.menuDb = -9.5;
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
