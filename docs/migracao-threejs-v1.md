# AirForceDashi — Migração Godot → Three.js (Browser-first) v1.0

Documento operacional para **reescrever o cliente 3D/UI em Three.js**, com desempenho máximo no navegador como prioridade #1.

**Uso:** este arquivo é o roteiro. A migração ocorre **neste repositório** (`apps/web`, `packages/*`). O projeto Godot permanece como referência viva de feel / câmeras / missões.

**Documentos irmãos (prevalecem nos seus domínios):**

| Doc | Domínio |
| --- | --- |
| [`economia-v1.md`](economia-v1.md) | Moedas, preços, anti-P2W, fases de backend |
| [`telas-produto-v1.md`](telas-produto-v1.md) | Hubs, fluxos, prioridade de UI |
| [`decisao-vfx-misseis-v1.md`](decisao-vfx-misseis-v1.md) | Escolha do motor VFX (mísseis / explosões) |
| [`destruicao-predios-v1.md`](destruicao-predios-v1.md) | Colapso local de alvos Attack |
| [`cidade-cityjson-atlas-v1.md`](cidade-cityjson-atlas-v1.md) | CityJSON offline → atlas de prédios instanciados |
| **Este arquivo** | Engine web, performance, port do gameplay, pipeline de assets |

Em conflito de números econômicos → `economia-v1.md`.  
Em conflito de hubs/telas → `telas-produto-v1.md`.  
Em conflito de stack 3D/web → **este documento**.

---

## 0. Decisão e premissas

### 0.1 Por que migrar

Air Force Dashi é um **arcade de voo + produto web** (economia, hubs, ranking, retenção). O centro de gravidade é:

1. Sessões curtas no **navegador**
2. Meta-game (Credits, XP, Hangar, Operações, Loja)
3. Feel de voo arcade caprichado

Three.js (stack web nativa) alinha deploy, UI de produto, auth e telemetria no mesmo ecossistema, com download e runtime mais leves que Godot WASM.

### 0.2 Premissas inegociáveis

1. **Browser-first** — desktop/mobile browser; desktop nativo é bonus, não requisito.
2. **Performance > fidelidade 1:1 com Godot** — portar a *sensação*, não cada draw call.
3. **Servidor valida economia** — cliente nunca é fonte da verdade de Credits/XP (`economia-v1.md`).
4. **Sem pay-to-win** — UI e netcode respeitam princípios da economia.
5. **Godot atual = referência viva** — usar o build Godot como *design oracle* (feel, câmeras, HUD, modos), não como runtime de produção web.
6. **Migração por fatias jogáveis** — cada fase entrega algo jogável no browser; nada de “big bang” de 6 meses sem build.

### 0.3 O que NÃO fazer

- [ ] Não tentar embutir Godot export + Three “ao lado” como produto final.
- [ ] Não portar validadores `.gd` headless 1:1 — recriar smoke tests em Vitest/Playwright.
- [ ] Não voxelizar a cidade inteira no dia 1 (ver §8 híbrido).
- [ ] Não bloquear a Etapa A de produto (`telas-produto-v1.md`) esperando netcode TvT.

---

## 1. Objetivo de desempenho (navegador)

### 1.1 Budgets-alvo (MVP web jogável)

Medir em **Chrome latest**, notebook médio (integrada) e mobile mid-range.

| Métrica | Alvo MVP | Alvo “muito bom” |
| --- | --- | --- |
| First Contentful Paint (shell) | &lt; 1,5 s | &lt; 1,0 s |
| Time to Interactive (menu) | &lt; 3 s (4G) | &lt; 2 s |
| Download inicial gzip/brotli (JS+WASM+assets críticos) | ≤ 8 MB | ≤ 5 MB |
| Memória JS heap em cruzeiro | ≤ 250 MB | ≤ 180 MB |
| Frame time gameplay (desktop) | ≤ 16,7 ms (60 fps) p95 | ≤ 11 ms |
| Frame time gameplay (mobile) | ≤ 22 ms (~45 fps) p95 | ≤ 16,7 ms |
| Draw calls (cruzeiro cidade) | ≤ 120 | ≤ 80 |
| Triângulos visíveis (cruzeiro) | ≤ 400k | ≤ 250k |
| Texturas GPU residentes | ≤ 128 MB | ≤ 80 MB |
| Áudio decode inicial | ≤ 2 MB compressed | streaming + lazy |

### 1.2 Estratégias obrigatórias de performance

- [ ] **Internal resolution** baixa + upscale (equivalente ao `INTERNAL_BASE_H ≈ 340` do Godot) — pixel look + FPS.
- [ ] **Renderer:** WebGL2 estável no MVP; WebGPU como feature-detect opcional depois.
- [ ] **Instancing** para prédios, vegetação, tráfego, debris.
- [ ] **Chunk streaming** do mundo (não um heightmap monolítico na GPU).
- [ ] **LOD** agressivo (terrain, skyline, buildings, FX).
- [ ] **Frustum + distance culling** em todo campo procedural.
- [ ] **Object pooling** (mísseis, explosões, drones, particles).
- [ ] **Áudio** compressed (Opus/AAC/Ogg) + buses leves; sem N loops pesados simultâneos.
- [ ] **Code splitting** — menu shell ≠ mundo 3D ≠ hangar 3D.
- [ ] **Asset pipeline** glTF/Draco/KTX2 (Basis); nada de PNG gigante runtime.
- [ ] **Offload** geração pesada: worker threads para heightmap/chunk bake quando possível.
- [ ] **Preferir GPU** (shaders/instancing) a milhares de `Object3D` soltos.

### 1.3 Perfis de qualidade (settings)

| Perfil | Resolução interna | Alcance prédios | Partículas | Sombras |
| --- | --- | --- | --- | --- |
| Low | ~240–280p altura | curto | mínimas | off |
| Medium (default) | ~340p | médio | médias | blob/simples |
| High | ~480p | longo | altas | contact/PCF leve |

- [ ] Implementar seletor Low/Medium/High persistido
- [ ] Auto-detect: descer perfil se p95 frame time &gt; alvo por N segundos

---

## 2. Arquitetura-alvo (repo web)

### 2.1 Monorepo neste repo (Godot + web)

```
AirForceDashi/
├── scenes/ scripts/ …       # Godot 4.7 — referência de feel (não runtime web)
├── apps/
│   ├── web/                 # cliente Three.js + UI produto (Vite + React)
│   └── api/                 # economia Hono (M5 in-memory; DB depois)
├── packages/
│   ├── game-core/           # simulação pura (TS): flight, missions, scoring — sem DOM/WebGL
│   ├── game-render/         # Three.js: world, jet, FX, cameras
│   ├── economy/             # schemas, catalog, grants, flags (M5)
│   ├── game-assets/         # (futuro) glTF, KTX2, áudio, atlases
│   └── shared-types/        # DTOs economia, replay events, protocol
├── docs/                    # economia / telas / este roteiro
└── tools/                   # measure-bundle, bake chunks, perf harness
```

### 2.2 Separação crítica: `game-core` ≠ `game-render`

| Camada | Responsabilidade | Pode rodar em Worker? |
| --- | --- | --- |
| `game-core` | Física arcade, input → state, missões, scoring local | Sim (ideal) |
| `game-render` | Three.js scene, meshes, post, áudio spatialize | Não (main + rAF) |
| `web` UI | Hubs HTML/CSS (Hangar, Loja…) | — |
| `api` | Wallet, XP, anti-fraud, leaderboards | Servidor |

**Regra:** o tick de simulação não importa `three`. Isso permite testar looping, checkpoint e scoring sem GPU.

### 2.3 Stack recomendada (sóbria + rápida)

| Peça | Escolha padrão | Alternativa |
| --- | --- | --- |
| Bundler | Vite | — |
| UI hubs | React 19 ou SolidJS | Vue |
| 3D | Three.js r16x+ | Babylon (só se time preferir) |
| Physics leve | Custom arcade (port do `jet.gd`) | cannon-es só se necessário |
| Estado UI | Zustand / tiny store | — |
| Auth/DB | Supabase ou Postgres + JWT | Clerk + API própria |
| Hosting | Vercel / Cloudflare Pages + Workers | — |
| Telemetria | PostHog / custom events | — |
| Testes | Vitest (core) + Playwright (smoke browser) | — |

- [ ] Congelar versões no `package.json` / lockfile no dia 0 do repo web
- [ ] CI: typecheck + vitest + build size budget gate

---

## 3. Inventário do Godot atual → destino Three.js

Mapa do que existe hoje e para onde vai. Usar como checklist de portabilidade.

### 3.1 Autoloads / estado global

| Godot | Destino |
| --- | --- |
| `scripts/autoloads/game.gd` | `game-core` (`GameState`) + `shared-types` + sync parcial com API |
| `scripts/autoloads/audio_bus.gd` | `game-render/audio` (Web Audio / Howler / Three Audio) |

Campos/sistemas a portar de `Game`:

- [ ] Enums: `Cam`, `PlayMode`, `Aircraft`
- [ ] Constantes de mundo (`WORLD_SIZE`, `CRUISE_ALT`, `SAFE_AGL`, DLZ…)
- [ ] Telemetria de voo (`airspeed`, `pitch_deg`, `g_force`…)
- [ ] Progresso local → migrar para remoto quando Fase 0 economia existir
- [ ] `player_name`, `aircraft`, `avatar_id`
- [ ] `view_camera()` / `look_back_hold`
- [ ] Sinais → EventEmitter / mitt / Zustand subscriptions

### 3.2 Aeronave

| Godot | Destino |
| --- | --- |
| `scripts/aircraft/jet.gd` | `game-core/flight/JetSimulation.ts` |
| `scripts/aircraft/jet_mesh.gd` | `game-render/aircraft/JetVisual.ts` (glTF ou procedural mesh) |
| Rails / mísseis bay | `game-core` + visual pooled |

- [ ] Portar modelo de voo: pitch contínuo (looping), bank, AB, barrel roll
- [ ] Portar CCIP / aim / DLZ
- [ ] Portar clamp de chão / building hit soft
- [ ] F-22 e F-15 como defs de stats + mesh/skin
- [ ] Esconder airframe em cockpit (`set_external_visible`)

### 3.3 Câmeras

| Modo Godot | Destino |
| --- | --- |
| TOP | Ortho/perspective top-down chase |
| CHASE | Third-person behind |
| REAR | Look-aft / check-six |
| COCKPIT | Interior + 2D canopy overlay |
| FREE | Free fly + photo mode |

- [ ] Portar blend entre modos
- [ ] Portar FOV punch / shake G-force / AB
- [ ] Hold **V** look-back sem trocar modo salvo
- [ ] Budgets: menos shake em mobile Low

### 3.4 Mundo

| Godot | Destino |
| --- | --- |
| `terrain_generator.gd` | Worker bake heightmap chunks → mesh/clipmap |
| `world_root.gd` | `WorldDirector` (hora do dia, weather hooks) |
| `building_field.gd` | Instanced buildings + streaming radius |
| `vegetation_field.gd` | Instanced impostors / cards |
| `street_field.gd` | Decals / ribbon meshes |
| `landmark_field.gd` / `detail_field.gd` | POIs + props rare |
| `air_traffic.gd` | Cheap silhouettes far field |
| `weather_fx.gd` | Fog uniforms + rain particles leves |

- [ ] Redesenhar streaming: anéis de chunk em torno do jet
- [ ] Não carregar `WORLD_SIZE` inteiro na GPU
- [ ] Dia/noite via uniforms (sol, fog, city lights) — custo constante
- [ ] Biome audio crossfade no audio graph

### 3.5 Missões / combate

| Godot | Destino |
| --- | --- |
| `checkpoint_course.gd` + levels | `missions/checkpoint` |
| `antidrone_course.gd` + drones | `missions/antidrone` |
| `missile.gd` + `impact.gd` | pooled projectiles + FX |
| Futuro: defesa aérea / ataque a prédios | hybrid destroyable targets (§8) |

- [ ] Checkpoint 30 levels — dados em JSON/TS, não hardcode espalhado
- [ ] Anti-Drone spawn/score
- [ ] Resultado de partida → DTO pronto para API de recompensa

### 3.6 UI / produto

| Godot (hoje) | Destino web |
| --- | --- |
| `title_card.gd` | Main Menu React + canvas 3D opcional atrás |
| `hud.gd`, `cockpit.gd`, HUDs de missão | Overlay HTML/Canvas2D/SVG **ou** CSS + canvas |
| `pause_menu.gd`, selects | Hub components |
| Touch controls | Pointer / gamepad / virtual sticks |

Seguir hubs de `telas-produto-v1.md`: Main Menu, Pré-partida, Hangar, Carreira, Loja, Perfil, Settings.

- [ ] UI de produto **fora** do WebGL quando possível (DOM = acessível + barato)
- [ ] Gameplay HUD pode ser Canvas2D over canvas 3D (pixel crisp)
- [ ] Não montar mundo 3D inteiro ao abrir Hangar/Loja

### 3.7 Áudio / FX

- [ ] Engine loop, AB, missile, boom, roll, alt warn, menu theme
- [ ] Converter para formatos web; lazy load SFX de missão
- [ ] Contrails / vapor / skim — GPU particles com caps por perfil

### 3.8 Assets

| Origem Godot | Destino |
| --- | --- |
| `assets/ui/*` (title, icons, avatars) | WebP/AVIF + atlas |
| `assets/aircraft/f15|f22` sheets | Referência de arte; bake → glTF/lowpoly ou keep 2D decals |
| `fonts/` Bebas / Barlow | `@font-face` subset WOFF2 |
| Áudio wav | Opus/Ogg/AAC compressed |

- [ ] Inventário completo de assets com tamanho e prioridade de load
- [ ] Pipeline automatizado `tools/bake-assets`

---

## 4. Plano de migração por fases (TO-DO mestre)

Cada fase tem **Definition of Done** e gate de performance.

---

### Fase M0 — Bootstrap do repo web (semana 0)

**Meta:** app abre no browser com shell de produto e canvas vazio medido.

- [x] Criar monorepo (`apps/web`, `packages/game-core`, `game-render`, `shared-types`)
- [x] Vite + TS strict (ESLint/Prettier na sequência)
- [x] Rota mínima: `/` Main Menu stub (paleta preto/vermelho/branco/cinza)
- [x] Canvas Three.js fullscreen atrás do menu (cena clear color + fog)
- [x] Custom HUD de perf (fps, mb, draw calls)
- [x] Script `npm run budget` — falha se JS inicial &gt; `M0_BUNDLE_BUDGET`
- [x] Docs oficiais já em `docs/` (economia / telas / este roteiro)
- [x] README: seção cliente web + link deste arquivo
- [ ] Decidir auth provider (mesmo que stub) — adiado para M4/produto

**DoD:** abrir URL local &lt; 3 s até menu interativo em notebook médio.

---

### Fase M1 — Núcleo de voo (sem mundo rico)

**Meta:** jato voa com feel próximo do Godot (WASD, AB, loop, câmeras básicas).

#### Core

- [x] Portar input map (WASD, fire, throttle, roll, look back, cam cycle)
- [x] `JetSimulation`: speed, pitch local contínuo, yaw/bank, telemetry
- [x] Testes Vitest: looping (nose.y passa invertido), bank direction, clamp solo
- [x] Estado `PlayMode.FREE_FLIGHT` mínimo

#### Render

- [x] Mesh F-22 placeholder (caixa refinada)
- [x] Trails AB + contrail com pool
- [x] Câmeras: CHASE, REAR, COCKPIT, TOP, FREE
- [x] Internal render target + nearest upscale (pixel look)
- [x] Sombra blob simples

#### UX

- [x] HUD mínimo: speed/alt/heading + waterline
- [x] Pause: retomar / menu

**DoD:** Vôo Livre jogável 5 min a ≥45 fps mobile mid / 60 fps desktop Medium; bundle crítica ≤ budget M1.

---

### Fase M2 — Mundo procedural streaming

**Meta:** lago/cidade/céu vivos sem carregar o mapa 10× inteiro.

- [x] Heightmap por chunk (worker + fallback main-thread)
- [x] Terrain tiled mesh (anel 7×7, bake orçado/frame)
- [x] Water plane + level
- [x] Building field instanced + radius streaming
- [x] Vegetation impostors (cones instanced)
- [x] Sky + day/night uniform clock
- [x] Fog / cloud billboards leves
- [x] Far air traffic silhouettes
- [x] POI names para HUD (airport/place readout)
- [x] Stress test: cache de chunks bounded (Vitest path longo)

**DoD:** budgets §1.1 Medium em cruzeiro sobre cidade; sem hitch &gt; 100 ms p99 ao streamar chunk.

---

### Fase M3 — Combate e missões existentes

**Meta:** paridade jogável com Godot nos modos atuais.

- [x] Mísseis pooled + trail + boom
- [x] CCIP / aim projection na câmera ativa
- [x] Checkpoint course + 30 levels data-driven
- [x] UI select Checkpoint + HUD gates/timer
- [x] Anti-Drone course + drones mesh baratos
- [x] Resultado local (score/time) com DTO de recompensa **ainda offline**
- [x] F-15 visual + seleção de aeronave
- [x] Avatares / callsign persistidos (localStorage)

**DoD:** Checkpoint nível 1–5 e Anti-Drone tutorial clearáveis; fps dentro do budget com FX ativos.

---

### Fase M4 — Hubs de produto (Etapas A–B de telas)

**Meta:** casca de produto web alinhada a `telas-produto-v1.md`.

- [x] Router SPA: Main Menu → Pré-partida → Gameplay → Resultado → hubs
- [x] Main Menu: CTA Jogar + Vôo Livre + chip Credits stub
- [x] Pré-partida: modos disponíveis + aeronave
- [x] Hangar stub (frota F-22/F-15 + unlock 8.000 Credits offline)
- [x] Settings (áudio, sens, qualidade Low/Med/High)
- [x] **Não** carregar World nos hubs — só `BootCanvas` leve

**DoD:** caminho “abrir site → voar → resultado → menu” sem reload completo da página.

---

### Fase M5 — Backend economia (Fases 0–4 de `economia-v1.md`)

**Meta:** Credits/XP server-side; cliente só exibe.

- [x] Schemas wallet / transactions / aircraft / inventory (`packages/economy`)
- [x] Auth + sessão (guest token + `/me`)
- [x] Endpoint grant recompensa pós-partida (idempotente)
- [x] Tabelas de reward por modo
- [x] Hangar compra 2ª aeronave (8.000 Credits)
- [x] Loja Credits 10–15 itens
- [x] Feature flags remotas de preços
- [x] Telemetria earned/spent

**DoD:** checklist qualidade econômica (`economia-v1.md` §16) para Fases 0–4 — MVP in-memory (`apps/api` + `@afd/economy`).

---

### Fase M6 — Retenção e polish web

- [x] Daily / Weekly Operations UI + validação server
- [x] Aircraft Mastery (sem buff)
- [x] Medals + Perfil
- [x] Ranking solo por modo
- [x] PWA opcional (cache shell; **não** cachear autoridade de wallet)
- [x] Mobile controls polish + safe areas
- [x] Acessibilidade: foco, contraste, reduce motion

**DoD:** Etapa C de `telas-produto-v1.md` completa no web.

---

### Fase M7 — Destruição híbrida (prédios-alvo)

Ver §8. Só depois do combate estável.

- [x] Interface `DestructibleTarget`
- [x] Promote building MultiMesh → voxel/chunk local no hit de missão
- [x] Debris instanced + despawn
- [x] Missão de ataque MVP (1–3 alvos)

**DoD:** destruir alvo a 60/45 fps sem rebuild da cidade inteira.

---

### Fase M8 — Monetização / temporada / social

Seguir `economia-v1.md` Fases 8–10 e `telas-produto-v1.md` D–F.

- [x] Dashi Coins + payments (stub checkout — sem Stripe)
- [x] Battle Pass UI (Free/Premium · 8 semanas · claim server)
- [x] Lobby TvT stub (sem netcode; grant `tvt` validado)

---

## 5. Ordem de port do feel (referência Godot)

Checklist fino do que o jogador *sente*. Validar lado a lado com build Godot.

### 5.1 Voo

- [ ] W/S pitch contínuo fecha looping
- [ ] A/D bank correto (não invertido)
- [ ] Hold AB acelera + FOV punch + plume
- [ ] Barrel roll (F)
- [ ] Auto pull-up perto do solo sem matar manobra em altitude
- [ ] Soft ceiling
- [ ] Water skim FX

### 5.2 Câmeras

- [ ] Cycle Space: TOP → CHASE → REAR → COCKPIT → FREE
- [ ] Hold V look-aft
- [ ] Cockpit: frame 2D + mesh externa oculta + HUD só no vidro
- [ ] FREE: WASD/QE, wheel speed, photo hide HUD

### 5.3 Combate / HUD

- [ ] CCIP pipper
- [ ] Tapes speed/alt
- [ ] Low alt warn + vignette
- [ ] Missile rearm 4 trilhos
- [ ] Checkpoint gate feedback
- [ ] Anti-Drone lock/score (se existir no Godot atual)

---

## 6. Pipeline de assets (detalhado)

### 6.1 Modelos

- [ ] Definir escala mundo (1 unit = 1 m) igual à convenção Godot atual
- [ ] F-22 / F-15: glTF 2.0, &lt; 15k tris cada no LOD0; LOD1/LOD2
- [ ] Opcional: manter procedural mesh (port SurfaceTool → BufferGeometry) para look pixel
- [ ] Draco mesh compression no glTF
- [ ] Sem animações esqueléticas desnecessárias no jato

### 6.2 Texturas

- [ ] KTX2 / Basis Universal para GPU
- [ ] Atlases UI pixel (nearest)
- [ ] Sheets F-15/F-22: só referência ou decals 2D; não spritesheet full in-game 3D

### 6.3 Áudio

- [ ] Converter WAV → Opus/Ogg
- [ ] Manifest JSON: `id → url, volume, category, preload?`
- [ ] Categorias: ui, engine, sfx, music — mute respeita `sound_on`

### 6.4 Ferramentas

- [ ] Script `bake-terrain-chunk`
- [ ] Script `measure-bundle` (CI)
- [ ] Script `export-checkpoint-levels` (se dados ainda em GDScript)

---

## 7. Rede, save e anti-fraude (web)

Mesmo single-player “online”:

- [ ] Progresso de Credits/XP **só** via API
- [ ] Cliente pode guardar settings/sensibilidade local (`localStorage`)
- [ ] Replay opcional: log de inputs + seed mundo para validação futura
- [ ] Rate limit grants; idempotency keys por `matchId`
- [ ] Nunca confiar em `creditsEarned` mandado pelo cliente sem validar modo/score

Alinhar schemas à Fase 0 de `economia-v1.md`.

---

## 8. Prédios: abordagem híbrida (destruição)

Decisão de design (já alinhada em conversa):

| Camada | Tecnologia | Uso |
| --- | --- | --- |
| Cidade de fundo | Instancing (ex-MultiMesh) + shader barato | Sempre |
| Alvo de missão | Chunks voxel **ou** prefab fraturado local | Só ao promover alvo |
| Impact FX | Particles instanced + decals | Sempre pooled |

### TO-DO híbrido

- [x] API `BuildingHitQuery(segment) → hit | null` (paridade Godot)
- [x] `promoteToDestructible(buildingId)`
- [x] Damaged states 0..N antes do colapso
- [x] Colisão atualiza só AABB/chunk local
- [x] Budget: máx. K alvos voxel ativos simultâneos (K=3)

---

## 9. Testes e qualidade

### 9.1 Automatizados

- [ ] Vitest: flight math, rewards math, camera view_camera logic
- [ ] Playwright: boot menu, start free flight, pause, return
- [ ] Perf harness headless-ish (canvas) registrando fps médios em CI nightlies

### 9.2 Manual / side-by-side

- [ ] Checklist §5 contra Godot reference build
- [ ] Sessão 20 min memory
- [ ] Mobile Safari + Chrome Android
- [ ] Throttle CPU 4× / Network Fast 3G no DevTools

### 9.3 Definition of Done global (cliente web “substitui” Godot no browser)

- [ ] Modos Checkpoint + Anti-Drone + Vôo Livre
- [ ] 5 câmeras + look-back
- [ ] F-22 + F-15
- [ ] Budgets §1.1 Medium cumpridos
- [ ] Hubs Etapa A–B no ar
- [ ] Economia Fase 0–1 no mínimo integrada
- [ ] Godot deixado como archive/reference, não como release web

---

## 10. Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Mundo procedural caro demais na CPU main thread | Hitch/stutter | Workers + bake + menor radius mobile |
| Port “fiel demais” do Godot | Atraso / FPS ruim | Priorizar feel; cortar systems secundários |
| UI toda em WebGL | Acessibilidade ruim + custo | Hubs em DOM |
| Áudio autoplay policies | Sem motor no boot | Unlock on first gesture |
| Safari WebGL quirks | Visual/perf | Testar cedo; fallback Low |
| Escopo meta + 3D juntos | Burnout | Fatias M0–M8; meta API em paralelo a partir M4 |
| Rewrites infinitas de feel | Drift | Congelar “feel accept” com vídeo referência |

---

## 11. Cronograma sugerido (orientativo)

| Fase | Duração típica (1–2 devs) | Entrega |
| --- | --- | --- |
| M0 | 3–5 dias | Shell web + budgets CI |
| M1 | 1,5–3 semanas | Voo + câmeras |
| M2 | 2–4 semanas | Mundo streaming |
| M3 | 2–3 semanas | Missões atuais |
| M4 | 1–2 semanas | Hubs A–B |
| M5 | 2–3 semanas | Economia online |
| M6 | 2 semanas | Retenção |
| M7 | 1–2 semanas | Destruição híbrida MVP |
| M8 | contínuo | Pass / DC / social |

Ajustar à capacidade do time; **não** iniciar M7 antes de M3 estável.

---

## 12. Checklist do dia 1 no repo cópia

Quando criar a cópia / novo repo, executar nesta ordem:

1. [ ] Criar repo `airforce-dashi-web` (ou nome final)
2. [ ] Copiar `docs/economia-v1.md`, `docs/telas-produto-v1.md`, **este arquivo**
3. [ ] Scaffold monorepo (§2.1)
4. [ ] Implementar M0 completo
5. [ ] Abrir board (GitHub Projects / Linear) com issues = checkboxes M1→M8
6. [ ] Gravar baseline de perf (fps vazio, tamanho bundle)
7. [ ] Manter Godot repo como `reference/` ou remoto read-only para consulta de feel
8. [ ] Primeira build deploy preview (Vercel/CF) mesmo com menu só

---

## 13. Apêndice A — Equivalências rápidas Godot → Three

| Godot | Three.js / Web |
| --- | --- |
| `Node3D` | `Object3D` |
| `MeshInstance3D` + ArrayMesh | `Mesh` + `BufferGeometry` |
| MultiMesh | `InstancedMesh` |
| `GPUParticles3D` | `Points` / custom GPGPU / `three/examples` particles (com cap) |
| `StandardMaterial3D` | `MeshStandardMaterial` / `MeshBasicMaterial` unlit pixel |
| Autoload singleton | module singleton / store |
| `user://cfg` | `localStorage` / IndexedDB |
| `_physics_process` | fixed timestep em `game-core` + render interpolation |
| Export Web | Vite static + CDN |
| `.tscn` | TS scene factories / JSX for UI only |

---

## 14. Apêndice B — Conteúdo mínimo do `game-core` (módulos)

- [ ] `math/` (wrap, smoothstep, basis helpers)
- [ ] `flight/JetSimulation.ts`
- [ ] `flight/CameraRigLogic.ts` (modos, look-back)
- [ ] `combat/MissileSystem.ts`
- [ ] `combat/AimComputer.ts`
- [ ] `missions/checkpoint/*`
- [ ] `missions/antidrone/*`
- [ ] `world/HeightSample.ts` (interface; impl pode mockar em testes)
- [ ] `meta/RewardDraft.ts` (calcula proposta local; servidor confirma)
- [ ] `input/InputMap.ts`

---

## 15. Apêndice C — Conteúdo mínimo do `game-render` (módulos)

- [ ] `RendererApp.ts` (resize, internal RT, quality profile)
- [ ] `scene/WorldScene.ts`
- [ ] `aircraft/JetVisual.ts`
- [ ] `world/TerrainChunks.ts`
- [ ] `world/BuildingField.ts`
- [ ] `fx/ParticlesPool.ts`
- [ ] `fx/ExplosionFx.ts`
- [ ] `audio/AudioGraph.ts`
- [ ] `debug/PerfHud.ts`

---

## 16. Registro de decisões (preencher durante a migração)

| Data | Decisão | Motivo |
| --- | --- | --- |
| YYYY-MM-DD | Ex.: React vs Solid | … |
|  | Ex.: Procedural jet vs glTF | … |
|  | Ex.: WebGPU on/off MVP | … |

---

## 17. Visão em uma frase

> Reescrever o cliente em Three.js com simulação desacoplada, streaming agressivo e hubs DOM, para entregar no navegador o arcade de voo + economia de produto com o maior FPS e o menor tempo-até-voar possíveis — usando o Godot atual só como referência de feel.

---

*Documento vivo v1.0 — criar issues a partir dos checkboxes; atualizar budgets com números reais do primeiro preview web.*
