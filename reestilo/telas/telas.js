(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* Sons em ../audio â€” funciona em file:// e http:// */
  const AUDIO_DIR = new URL("../audio/", window.location.href);

  const SFX_FILES = {
    select: "ui_select.wav",
    confirm: "ui_confirm.wav",
    toggle: "ui_toggle.wav",
    arm: "ui_arm.wav",
    deny: "ui_deny.wav",
  };

  const VOL = {
    select: 0.7,
    confirm: 0.85,
    toggle: 0.55,
    arm: 0.45,
    deny: 0.65,
    menu: 0.28,
  };

  const ROUTES = {
    menu: "./main-menu.html",
    pre: "./pre-partida.html",
    free: "./pre-partida.html#free",
    hangar: "./hangar.html",
    career: "./carreira.html",
    shop: "./loja.html",
    profile: "./perfil.html",
    config: "./config.html",
    lobby: "./lobby.html",
    gameplay: "./gameplay.html",
    result: "./resultado.html",
  };

  const audioUrl = (file) => new URL(file, AUDIO_DIR).href;

  const audio = {
    enabled: false,
    unlocked: false,
    templates: new Map(),
    menu: null,
    ready: false,

    boot() {
      if (this.ready) return;
      this.ready = true;

      for (const [id, file] of Object.entries(SFX_FILES)) {
        const key = file.replace(/\.wav$/, "");
        const domEl = document.querySelector(`audio[data-afd="${key}"]`);
        const el = domEl || new Audio(audioUrl(file));
        el.preload = "auto";
        if (!el.getAttribute("src")) el.src = audioUrl(file);
        this.templates.set(id, el);
        try {
          el.load();
        } catch {
          /* noop */
        }
      }

      this.menu =
        document.querySelector('audio[data-afd="menu_theme"]') ||
        new Audio(audioUrl("menu_theme.wav"));
      this.menu.preload = "auto";
      this.menu.loop = true;
      this.menu.volume = 0;
      if (!this.menu.getAttribute("src")) this.menu.src = audioUrl("menu_theme.wav");
      try {
        this.menu.load();
      } catch {
        /* noop */
      }
    },

    async unlock() {
      this.boot();
      const warm = this.templates.get("select");
      if (warm) {
        try {
          warm.muted = true;
          warm.volume = 0;
          await warm.play();
          warm.pause();
          warm.currentTime = 0;
          warm.muted = false;
        } catch {
          /* primeiro play no clique */
        }
      }
      this.unlocked = true;
    },

    setEnabled(on) {
      this.enabled = on;
      const btn = $("[data-audio-toggle]");
      if (btn) {
        btn.textContent = on ? "â™ª" : "âœ•";
        btn.setAttribute("aria-pressed", String(on));
        btn.classList.toggle("is-active", on);
      }
      const hint = $(".ds-audio-hint");
      if (hint) {
        hint.textContent = on
          ? "Ãudio armado Â· menu theme + SFX"
          : "Clique em qualquer controle para armar o Ã¡udio do cockpit.";
      }
      if (on) this.startMenu();
      else this.stopMenu();
    },

    startMenu() {
      if (!this.menu) return;
      this.menu.volume = VOL.menu;
      const p = this.menu.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    },

    stopMenu() {
      if (!this.menu) return;
      this.menu.pause();
      try {
        this.menu.currentTime = 0;
      } catch {
        /* noop */
      }
    },

    play(id) {
      if (!this.enabled) return;
      this.boot();
      const tpl = this.templates.get(id);
      if (!tpl) return;
      const src = tpl.currentSrc || tpl.src || audioUrl(SFX_FILES[id]);
      const shot = new Audio(src);
      shot.volume = VOL[id] ?? 0.7;
      const p = shot.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    },

    playRole(role) {
      if (role === "confirm") this.play("confirm");
      else if (role === "deny") this.play("deny");
      else if (role === "toggle") this.play("toggle");
      else if (role === "arm") this.play("arm");
      else this.play("select");
    },
  };

  audio.boot();

  const armAndPlay = async (role, { isToggle = false } = {}) => {
    await audio.unlock();
    if (!isToggle && !audio.enabled) audio.setEnabled(true);
    if (isToggle) return;
    audio.playRole(role);
  };

  document.addEventListener(
    "pointerdown",
    (ev) => {
      const target = ev.target.closest("[data-sfx]");
      if (!target) return;
      const isToggle = target.hasAttribute("data-audio-toggle");
      let role = target.getAttribute("data-sfx") || "select";
      if (target.disabled || target.getAttribute("aria-disabled") === "true") {
        role = "deny";
      }
      void armAndPlay(role, { isToggle }).then(() => {
        if (isToggle) return;
        target.classList.remove("is-punch");
        void target.offsetWidth;
        target.classList.add("is-punch");
      });
    },
    true,
  );

  $("[data-audio-toggle]")?.addEventListener("click", async () => {
    await audio.unlock();
    audio.setEnabled(!audio.enabled);
    audio.playRole(audio.enabled ? "confirm" : "deny");
  });

  /* Rail focus (Main Menu) */
  $$(".rail-item").forEach((item) => {
    item.addEventListener("mouseenter", () => {
      $$(".rail-item").forEach((el) => el.classList.remove("is-on"));
      item.classList.add("is-on");
    });
    item.addEventListener("focus", () => {
      $$(".rail-item").forEach((el) => el.classList.remove("is-on"));
      item.classList.add("is-on");
    });
  });

  /* Nav entre telas existentes */
  $$("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      let id = btn.getAttribute("data-nav");
      if (id === "gameplay") {
        const mode = $(".playlist__item.is-on")?.getAttribute("data-mode");
        if (mode === "tvt") id = "lobby";
      }
      const href = ROUTES[id];
      if (!href) {
        console.info("[AFD telas] destino pendente:", id);
        return;
      }
      window.setTimeout(() => {
        window.location.href = href;
      }, 120);
    });
  });

  /* Hub side tabs (Hangar / Carreira / Loja / Config) */
  const wireHubTabs = () => {
    const tabs = $$("[data-hub-tab]");
    if (!tabs.length) return;
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-hub-tab");
        const root = tab.closest(".tela") || document;
        $$("[data-hub-tab]", root).forEach((t) => t.classList.toggle("is-on", t === tab));
        $$("[data-hub-panel]", root).forEach((panel) => {
          const on = panel.getAttribute("data-hub-panel") === id;
          panel.hidden = !on;
          panel.classList.toggle("is-on", on);
        });
      });
    });
  };
  wireHubTabs();

  $$(".medal-card:not(:disabled)").forEach((card) => {
    card.addEventListener("click", () => {
      const wall = card.closest(".medal-wall") || document;
      $$(".medal-card", wall).forEach((c) => c.classList.remove("is-on"));
      card.classList.add("is-on");
    });
  });

  /* HUD tabs (gameplay) */
  $$("[data-hud-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.getAttribute("data-hud-tab");
      $$("[data-hud-tab]").forEach((t) => t.classList.toggle("hub__tab--on", t === tab));
      $$("[data-hud-panel]").forEach((panel) => {
        const on = panel.getAttribute("data-hud-panel") === id;
        panel.hidden = !on;
        panel.classList.toggle("is-on", on);
      });
    });
  });

  /* Chips / hangar cards / ranges / toggles */
  $$(".chip[data-sfx]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const row = chip.parentElement;
      if (!row) return;
      $$(".chip", row).forEach((c) => c.classList.remove("chip--on"));
      chip.classList.add("chip--on");
    });
  });

  $$(".hangar-fleet .hangar__card:not(:disabled), .shop__grid .hangar__card:not(:disabled)").forEach(
    (card) => {
      card.addEventListener("click", () => {
        const scope = card.closest(".shop__grid, .hangar-fleet, .modal__panel") || document;
        $$(".hangar__card", scope).forEach((c) => c.classList.remove("hangar__card--on"));
        card.classList.add("hangar__card--on");
      });
    },
  );

  $$("[data-range]").forEach((input) => {
    const kind = input.dataset.range;
    const sync = () => {
      if (kind === "vol") {
        const el = $("[data-vol]");
        if (el) el.textContent = input.value;
      }
      if (kind === "sens") {
        const el = $("[data-sens]");
        if (el) el.textContent = (Number(input.value) / 100).toFixed(2);
      }
    };
    input.addEventListener("input", sync);
    sync();
  });

  /* Config / generic labeled ranges */
  $$("[data-range-out]").forEach((input) => {
    const key = input.getAttribute("data-range-out");
    const label = key ? $(`[data-range-label="${key}"]`) : null;
    const sync = () => {
      if (!label) return;
      if (key === "sens") label.textContent = (Number(input.value) / 100).toFixed(2);
      else label.textContent = input.value;
    };
    input.addEventListener("input", () => {
      sync();
      const now = performance.now();
      if (!audio.lastToggleTick) audio.lastToggleTick = 0;
      if (now - audio.lastToggleTick > 50) {
        audio.lastToggleTick = now;
        if (audio.enabled) audio.playRole("toggle");
      }
    });
    sync();
  });

  $$("[data-toggle]").forEach((btn) => {
    if (btn.hasAttribute("data-audio-toggle")) return;
    btn.addEventListener("click", () => {
      const on = btn.classList.toggle("is-on");
      btn.setAttribute("aria-pressed", String(on));
      const textNode = [...btn.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (textNode) textNode.textContent = on ? " ON" : " OFF";
    });
  });

  $$(".cfg-bind").forEach((bind) => {
    bind.addEventListener("click", () => {
      $$(".cfg-bind").forEach((b) => b.classList.remove("is-on"));
      bind.classList.add("is-on");
    });
  });

  /* Onboarding modal */
  const onboard = $("#onboard-modal");
  $$("[data-open-onboard]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (onboard) onboard.hidden = false;
    });
  });
  $$("[data-close-onboard]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (onboard) onboard.hidden = true;
    });
  });

  /* Pause / Abandon */
  const pauseOverlay = $("#pause-overlay");
  const abandonOverlay = $("#abandon-overlay");
  const setPause = (on) => {
    if (pauseOverlay) pauseOverlay.hidden = !on;
  };
  const setAbandon = (on) => {
    if (abandonOverlay) abandonOverlay.hidden = !on;
  };
  $$("[data-open-pause]").forEach((btn) => btn.addEventListener("click", () => setPause(true)));
  $$("[data-close-pause]").forEach((btn) => btn.addEventListener("click", () => setPause(false)));
  $$("[data-open-abandon]").forEach((btn) =>
    btn.addEventListener("click", () => {
      setAbandon(true);
    }),
  );
  $$("[data-close-abandon]").forEach((btn) =>
    btn.addEventListener("click", () => setAbandon(false)),
  );

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      if (onboard && !onboard.hidden) {
        onboard.hidden = true;
        return;
      }
      if (abandonOverlay && !abandonOverlay.hidden) {
        setAbandon(false);
        return;
      }
      if (pauseOverlay) setPause(pauseOverlay.hidden);
    }
  });

  /* Daily / weekly countdown */
  const dailyEl = $('[data-countdown="daily"]');
  const weeklyEl = $('[data-countdown="weekly"]');
  const pad = (n) => String(n).padStart(2, "0");
  let dailyLeft = 5 * 3600 + 12 * 60 + 44;
  let weeklyLeft = 2 * 86400 + 11 * 3600;
  if (dailyEl || weeklyEl) {
    window.setInterval(() => {
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
  }

  /* PrÃ©-partida: briefing por modo */
  const BRIEF = {
    cp: {
      weight: "light",
      title: "CHECKPOINT",
      kind: "LEVE Â· Checkpoint",
      line: "Passe pelos anÃ©is antes do tempo zerar.",
      meta: "Lv 3 Â· F-22 RAPTOR Â· +120â€“420 CR base",
      reward: "+120â€“420 CR",
      weightLabel: "LEVE",
    },
    ad: {
      weight: "light",
      title: "ANTI-DRONE",
      kind: "LEVE Â· Anti-Drone",
      line: "Elimine drones e mantenha a streak â€” score sobe o reward.",
      meta: "Wave 4 Â· F-22 RAPTOR Â· +150â€“500 CR base",
      reward: "+150â€“500 CR",
      weightLabel: "LEVE",
    },
    free: {
      weight: "light",
      title: "VÃ”O LIVRE",
      kind: "LEVE Â· VÃ´o Livre",
      line: "Sandbox sem ranking â€” treine, explore, teste loadout.",
      meta: "Sem reward ranqueÃ¡vel Â· F-22 RAPTOR",
      reward: "â€”",
      weightLabel: "LEVE",
    },
    aa: {
      weight: "mid",
      title: "DEFESA AÃ‰REA",
      kind: "MÃ‰DIO Â· Defesa aÃ©rea",
      meta: "CenÃ¡rio: Lake Country Â· dusk Â· +200â€“600 CR",
      reward: "+200â€“600 CR",
      weightLabel: "MÃ‰DIO",
      goals: [
        ["PrimÃ¡rio", "Neutralizar 8 alvos aÃ©reos"],
        ["SecundÃ¡rio", "Sem colisÃ£o com solo"],
      ],
    },
    atk: {
      weight: "mid",
      title: "ATAQUE",
      kind: "MÃ‰DIO Â· Ataque",
      meta: "CenÃ¡rio: ridge run Â· dawn Â· +220â€“650 CR",
      reward: "+220â€“650 CR",
      weightLabel: "MÃ‰DIO",
      goals: [
        ["PrimÃ¡rio", "Destruir 3 estruturas marcadas"],
        ["SecundÃ¡rio", "Tempo sob 2:00"],
      ],
    },
    tvt: {
      weight: "mid",
      title: "TEAM VS TEAM",
      kind: "LOBBY Â· Team vs Team",
      meta: "PrÃ©-partida resume regras Â· matchmaking na expansÃ£o",
      reward: "servidor",
      weightLabel: "LOBBY",
      goals: [
        ["Regra", "Skill match por piloto â€” aviÃ£o pago nÃ£o dÃ¡ poder"],
        ["Reward", "Servidor / temporada â€” sem pay-to-win"],
      ],
    },
  };

  const applyBrief = (mode) => {
    const data = BRIEF[mode] || BRIEF.cp;
    const light = $('[data-brief="light"]');
    const mid = $('[data-brief="mid"]');
    if (!light || !mid) return;

    const showMid = data.weight === "mid";
    light.hidden = showMid;
    mid.hidden = !showMid;

    $$("[data-brief-mode]").forEach((el) => {
      el.textContent = data.title;
    });
    const reward = $("[data-brief-reward]");
    const weight = $("[data-brief-weight]");
    if (reward) reward.textContent = data.reward;
    if (weight) weight.textContent = data.weightLabel;

    if (!showMid) {
      const kind = $("[data-brief-kind]", light);
      const line = $("[data-brief-line]", light);
      const meta = $("[data-brief-meta]", light);
      if (kind) kind.textContent = data.kind;
      if (line) line.textContent = data.line || "";
      if (meta) meta.textContent = data.meta;
    } else {
      const kind = $("[data-brief-kind-mid]", mid);
      const meta = $("[data-brief-meta-mid]", mid);
      const goals = $("[data-brief-goals]", mid);
      if (kind) kind.textContent = data.kind;
      if (meta) meta.textContent = data.meta;
      if (goals && data.goals) {
        goals.innerHTML = data.goals
          .map(([k, v]) => `<li><strong>${k}</strong> â€” ${v}</li>`)
          .join("");
      }
    }
  };

  $$("[data-mode]").forEach((item) => {
    item.addEventListener("click", () => {
      $$("[data-mode]").forEach((el) => {
        el.classList.remove("is-on", "mode-card--on");
        el.setAttribute("aria-selected", "false");
      });
      item.classList.add("is-on");
      item.setAttribute("aria-selected", "true");
      applyBrief(item.getAttribute("data-mode") || "cp");
    });
  });

  /* Aeronave (escopo local) */
  $$(".pre-ac-row .hangar__card:not(:disabled)").forEach((card) => {
    card.addEventListener("click", () => {
      $$(".pre-ac-row .hangar__card").forEach((c) => c.classList.remove("hangar__card--on"));
      card.classList.add("hangar__card--on");
      const label = $("[data-ac-label]");
      const name = $(".hangar__name", card);
      if (label && name) label.textContent = name.textContent.trim();
    });
  });

  /* Deep-link #free do Main Menu */
  const hashMode = (window.location.hash || "").replace(/^#/, "");
  if (hashMode && BRIEF[hashMode]) {
    const target = $(`[data-mode="${hashMode}"]`);
    if (target) target.click();
  } else {
    applyBrief(($(".playlist__item.is-on")?.getAttribute("data-mode")) || "cp");
  }

  /* Glitch de entrada */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const playGlitch = (root) => {
    if (!root || reduceMotion) return;
    const nodes = $$(".glitch-el", root);
    nodes.forEach((el, i) => {
      el.classList.remove("is-glitching");
      el.style.removeProperty("--g");
      void el.offsetWidth;
      el.style.setProperty("--g", String(i));
      el.classList.add("is-glitching");
      const clear = () => {
        el.classList.remove("is-glitching");
        el.style.removeProperty("--g");
        el.removeEventListener("animationend", clear);
      };
      el.addEventListener("animationend", clear);
    });
  };

  /* Lobby ready toggle */
  const readyBtn = $("[data-lobby-ready]");
  const youSlot = $(".lobby-slot.is-you");
  const lobbyStatus = $("[data-lobby-status]");
  if (readyBtn && youSlot) {
    readyBtn.addEventListener("click", () => {
      const on = readyBtn.classList.toggle("is-ready");
      readyBtn.setAttribute("aria-pressed", String(on));
      readyBtn.textContent = on ? "Pronto" : "Não pronto";
      youSlot.classList.toggle("is-ready", on);
      const badge = $(".lobby-slot__ready", youSlot);
      if (badge) {
        badge.textContent = on ? "READY" : "WAIT";
        badge.className = "lobby-slot__ready tag " + (on ? "tag--ok" : "tag--warn");
      }
      if (lobbyStatus) {
        lobbyStatus.textContent = on
          ? "Aguardando prontos · 3 / 8"
          : "Aguardando prontos · 2 / 8";
      }
    });
  }

  playGlitch(document.body);
})();


