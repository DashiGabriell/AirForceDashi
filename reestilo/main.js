(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* =========================================================
     Sons EXCLUSIVOS de ./audio/ (reestilo/audio)
     HTMLAudioElement — funciona em file:// e http://
     ========================================================= */
  const AUDIO_DIR = new URL("./audio/", window.location.href);

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

  const audioUrl = (file) => new URL(file, AUDIO_DIR).href;

  const audio = {
    enabled: false,
    unlocked: false,
    templates: new Map(),
    menu: null,
    lastToggleTick: 0,
    ready: false,

    boot() {
      if (this.ready) return;
      this.ready = true;

      for (const [id, file] of Object.entries(SFX_FILES)) {
        const key = file.replace(/\.wav$/, ""); // ui_select, ui_confirm, ...
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

      console.info(
        "[AFD reestilo] SFX em",
        AUDIO_DIR.href,
        Object.fromEntries(
          [...this.templates.entries()].map(([k, v]) => [k, v.currentSrc || v.src]),
        ),
        "menu:",
        this.menu.currentSrc || this.menu.src,
      );
    },

    async unlock() {
      this.boot();
      // Gesto do usuário: “toca” mudo para liberar autoplay no file://
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
          /* primeiro play real no clique */
        }
      }
      this.unlocked = true;
    },

    setEnabled(on) {
      this.enabled = on;
      const btn = $("[data-audio-toggle]");
      if (btn) {
        btn.textContent = on ? "SFX ON" : "SFX OFF";
        btn.setAttribute("aria-pressed", String(on));
        btn.classList.toggle("tag--ok", on);
      }
      const hint = $(".ds-audio-hint");
      if (hint) {
        hint.textContent = on
          ? `Áudio armado · arquivos em ${AUDIO_DIR.pathname}`
          : "Clique em qualquer controle para armar o áudio do cockpit.";
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
      if (!tpl) {
        console.warn("[AFD reestilo] SFX ausente:", id);
        return;
      }
      const src = tpl.currentSrc || tpl.src || audioUrl(SFX_FILES[id]);
      const shot = new Audio(src);
      shot.volume = VOL[id] ?? 0.7;
      const p = shot.play();
      if (p && typeof p.catch === "function") {
        p.catch((err) => console.warn("[AFD reestilo] play fail", id, src, err));
      }
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

  /* Demos de UI */
  $$("[data-meter]").forEach((el) => {
    const pct = Number(el.dataset.meter || 0);
    const fill = $(".meter__fill", el);
    if (fill) {
      requestAnimationFrame(() => {
        fill.style.width = `${pct}%`;
      });
    }
  });

  const pctLabel = $("[data-pct]");
  const segMeter = $('[data-meter="64"]');
  if (pctLabel && segMeter) {
    let dir = 1;
    let value = 64;
    setInterval(() => {
      value += dir * 1.2;
      if (value >= 92) dir = -1;
      if (value <= 28) dir = 1;
      const rounded = Math.round(value);
      pctLabel.textContent = `${rounded}%`;
      const fill = $(".meter__fill", segMeter);
      if (fill) fill.style.width = `${rounded}%`;
    }, 80);
  }

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
    input.addEventListener("input", () => {
      sync();
      const now = performance.now();
      if (now - audio.lastToggleTick > 50) {
        audio.lastToggleTick = now;
        void armAndPlay("toggle");
      }
    });
    sync();
  });

  $$("[data-toggle]").forEach((btn) => {
    if (btn.hasAttribute("data-audio-toggle")) return;
    btn.addEventListener("click", () => {
      const on = btn.classList.toggle("is-on");
      btn.setAttribute("aria-pressed", String(on));
      btn.lastChild.textContent = on ? " Som ON" : " Som OFF";
    });
  });

  const panel = $("[data-tab-panel]");
  const copy = {
    fleet: "Painel Frota — conteúdo ativo via JS.",
    mastery: "Painel Mastery — níveis 1–10, só cosmético.",
    pass: "Painel Passe — tiers free / premium.",
  };
  $$("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$("[data-tab]").forEach((t) => t.classList.remove("hub__tab--on"));
      tab.classList.add("hub__tab--on");
      if (panel) panel.textContent = copy[tab.dataset.tab] || "";
    });
  });

  $$(".hubnav__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".hubnav__btn").forEach((b) => b.classList.remove("hubnav__btn--on"));
      btn.classList.add("hubnav__btn--on");
    });
  });

  $$(".chip[data-sfx]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const row = chip.parentElement;
      if (!row) return;
      $$(".chip", row).forEach((c) => c.classList.remove("chip--on"));
      chip.classList.add("chip--on");
    });
  });

  $$(".hangar__card:not(:disabled)").forEach((card) => {
    card.addEventListener("click", () => {
      const scope =
        card.closest(".shop__grid, .equip-grid, .modal__panel, .screen-panel, .ds-section") ||
        document;
      $$(".hangar__card", scope).forEach((c) => c.classList.remove("hangar__card--on"));
      card.classList.add("hangar__card--on");
    });
  });

  $$("[data-demo-load]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.add("is-loading");
      setTimeout(() => btn.classList.remove("is-loading"), 1400);
    });
  });

  /* Clique → som + punch */
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

  /* =========================================================
     Glitch de entrada — replay a cada troca de tela / seção
     ========================================================= */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const glitchTargets = (root) => {
    if (!root) return [];
    const marked = $$(".glitch-el", root);
    if (marked.length) return marked;
    return $$(
      "h1, h2, h3, .btn, .hubnav__btn, .hub__tab, .hangar__card, .chip, .menu__brand, .menu__title, .menu__sub, .menu__accent, .pre__accent, .result__accent, .hub__empty, .result__meta, .result__stats, .settings__block, .swatch, .meter, .panel, .fhud__strip, .fhud__time, .fhud__pilot, .fhud__radar, .toast--static",
      root,
    );
  };

  const playGlitch = (root, { sound = true } = {}) => {
    if (!root || reduceMotion) return;
    const nodes = glitchTargets(root);
    nodes.forEach((el, i) => {
      el.classList.remove("is-glitching");
      el.style.removeProperty("--g");
      // texto para overlays RGB (só se for texto curto)
      const text = (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3)
        ? el.textContent.trim()
        : "";
      if (text && text.length < 48) el.setAttribute("data-glitch-text", text);
      else el.removeAttribute("data-glitch-text");

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

    root.classList.remove("glitch-burst", "is-glitching");
    void root.offsetWidth;
    root.classList.add("glitch-burst", "is-glitching");
    window.setTimeout(() => {
      root.classList.remove("glitch-burst", "is-glitching");
    }, 520);

    if (sound && audio.enabled) audio.playRole("arm");
  };

  const showScreen = (id) => {
    const panels = $$("[data-screen-panel]");
    const tabs = $$("[data-screen]");
    panels.forEach((panel) => {
      const on = panel.getAttribute("data-screen-panel") === id;
      panel.hidden = !on;
      panel.classList.toggle("is-active", on);
      if (on) playGlitch(panel);
    });
    tabs.forEach((tab) => {
      tab.classList.toggle("hub__tab--on", tab.getAttribute("data-screen") === id);
    });
  };

  $$("[data-screen]").forEach((tab) => {
    tab.addEventListener("click", () => {
      showScreen(tab.getAttribute("data-screen"));
    });
  });

  $("[data-glitch-replay]")?.addEventListener("click", () => {
    const active = $(".screen-panel.is-active");
    if (active) playGlitch(active);
  });

  // Primeira tela do demo
  showScreen("menu");

  /* Nav ativa + glitch ao mudar de seção */
  const links = $$(".ds-nav a");
  const sections = links.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  const setActive = () => {
    let current = null;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= 140) current = section;
    }
    if (!current) current = sections[0];
    if (!current) return;
    links.forEach((a) => {
      a.classList.toggle(
        "is-active",
        a.getAttribute("href") === `#${current.id}`,
      );
    });
  };
  window.addEventListener("scroll", setActive, { passive: true });
  setActive();

  links.forEach((a) => {
    a.addEventListener("click", () => {
      const id = (a.getAttribute("href") || "").replace(/^#/, "");
      const section = id ? document.getElementById(id) : null;
      if (!section) return;
      // espera o scroll âncora aterrissar
      window.setTimeout(() => playGlitch(section), 80);
    });
  });

  document.body.classList.add("is-live");

  /* =========================================================
     Product hubs — tabs, briefing, countdown, onboard, abandon
     ========================================================= */
  const wireTabs = (tabAttr, panelAttr) => {
    const tabs = $$(`[${tabAttr}]`);
    if (!tabs.length) return;
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute(tabAttr);
        const groupRoot = tab.closest(".ds-section") || document;
        $$(`[${tabAttr}]`, groupRoot).forEach((t) => {
          t.classList.toggle("hub__tab--on", t === tab);
        });
        $$(`[${panelAttr}]`, groupRoot).forEach((panel) => {
          const on = panel.getAttribute(panelAttr) === id;
          panel.hidden = !on;
          panel.classList.toggle("is-on", on);
        });
      });
    });
  };

  wireTabs("data-career-tab", "data-career-panel");
  wireTabs("data-shop-tab", "data-shop-panel");
  wireTabs("data-hud-tab", "data-hud-panel");

  const BRIEF = {
    cp: {
      weight: "light",
      kind: "LEVE · Checkpoint",
      line: "Passe pelos anéis antes do tempo zerar.",
      meta: "Lv 3 · F-22 RAPTOR · +120–420 CR base",
      midGoals: null,
    },
    ad: {
      weight: "light",
      kind: "LEVE · Anti-Drone",
      line: "Elimine drones e mantenha a streak — score sobe o reward.",
      meta: "Wave 4 · F-22 RAPTOR · +150–500 CR base",
      midGoals: null,
    },
    free: {
      weight: "light",
      kind: "LEVE · Vôo Livre",
      line: "Sandbox sem ranking — treine, explore, teste loadout.",
      meta: "Sem reward ranqueável · F-22 RAPTOR",
      midGoals: null,
    },
    aa: {
      weight: "mid",
      kind: "MÉDIO · Defesa aérea",
      line: null,
      meta: "Cenário: Lake Country · dusk · +200–600 CR",
      midGoals: [
        ["Primário", "Neutralizar 8 alvos aéreos"],
        ["Secundário", "Sem colisão com solo"],
      ],
    },
    atk: {
      weight: "mid",
      kind: "MÉDIO · Ataque",
      line: null,
      meta: "Cenário: ridge run · dawn · +220–650 CR",
      midGoals: [
        ["Primário", "Destruir 3 estruturas marcadas"],
        ["Secundário", "Tempo sob 2:00"],
      ],
    },
    tvt: {
      weight: "mid",
      kind: "LOBBY · Team vs Team",
      line: null,
      meta: "Pré-partida resume regras · matchmaking na expansão",
      midGoals: [
        ["Regra", "Skill match por piloto — avião pago não dá poder"],
        ["Reward", "Servidor / temporada — sem pay-to-win"],
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

    if (!showMid) {
      const kind = $(".brief__kind", light);
      const line = $(".brief__line", light);
      const meta = $(".brief__meta", light);
      if (kind) kind.textContent = data.kind;
      if (line) line.textContent = data.line || "";
      if (meta) meta.textContent = data.meta;
    } else {
      const kind = $(".brief__kind", mid);
      const meta = $(".brief__meta", mid);
      const goals = $(".brief__goals", mid);
      if (kind) kind.textContent = data.kind;
      if (meta) meta.textContent = data.meta;
      if (goals && data.midGoals) {
        goals.innerHTML = data.midGoals
          .map(([k, v]) => `<li><strong>${k}</strong> — ${v}</li>`)
          .join("");
      }
    }
  };

  $$("[data-mode]").forEach((card) => {
    card.addEventListener("click", () => {
      $$("[data-mode]").forEach((c) => c.classList.remove("mode-card--on"));
      card.classList.add("mode-card--on");
      applyBrief(card.getAttribute("data-mode") || "cp");
    });
  });
  applyBrief(($(".mode-card--on")?.getAttribute("data-mode")) || "cp");

  const pad2 = (n) => String(n).padStart(2, "0");
  const dailyEl = $('[data-countdown="daily"]');
  const weeklyEl = $('[data-countdown="weekly"]');
  let dailyLeft = 5 * 3600 + 12 * 60 + 44;
  let weeklyLeft = 2 * 86400 + 11 * 3600;

  const fmtDaily = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
  };
  const fmtWeekly = (s) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    return `${d}d ${h}h`;
  };

  if (dailyEl || weeklyEl) {
    window.setInterval(() => {
      if (dailyEl) {
        dailyLeft = Math.max(0, dailyLeft - 1);
        dailyEl.textContent = fmtDaily(dailyLeft);
      }
      if (weeklyEl && dailyLeft % 60 === 0) {
        weeklyLeft = Math.max(0, weeklyLeft - 60);
        weeklyEl.textContent = fmtWeekly(weeklyLeft);
      }
    }, 1000);
  }

  const onboard = $("#onboard-modal");
  const openOnboard = () => {
    if (!onboard) return;
    onboard.hidden = false;
    playGlitch($(".modal__panel", onboard) || onboard, { sound: false });
  };
  const closeOnboard = () => {
    if (onboard) onboard.hidden = true;
  };
  $$("[data-open-onboard]").forEach((btn) => btn.addEventListener("click", openOnboard));
  $$("[data-close-onboard]").forEach((btn) => btn.addEventListener("click", closeOnboard));
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && onboard && !onboard.hidden) closeOnboard();
  });

  const abandonPanel = $("#abandon-panel");
  const abandonToast = $("[data-abandon-toast]");
  $$("[data-abandon]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!abandonPanel) return;
      abandonPanel.hidden = false;
      abandonPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      playGlitch(abandonPanel, { sound: false });
    });
  });
  $$("[data-close-abandon]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (abandonPanel) abandonPanel.hidden = true;
    });
  });
  $$("[data-confirm-abandon]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (abandonPanel) abandonPanel.hidden = true;
      if (abandonToast) {
        abandonToast.classList.remove("is-punch");
        void abandonToast.offsetWidth;
        abandonToast.classList.add("is-punch");
        abandonToast.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  });

  $$('#shop [data-shop-panel="pass"] .btn').forEach((btn) => {
    if (!/Temporada/i.test(btn.textContent || "")) return;
    btn.addEventListener("click", () => {
      const careerTab = $('[data-career-tab="season"]');
      const career = $("#career");
      careerTab?.click();
      career?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (career) window.setTimeout(() => playGlitch(career), 80);
    });
  });
})();
