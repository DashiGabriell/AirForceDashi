# Air Force Dashi

<p align="center">
  <img src="docs/images/icon.svg" width="72" alt="Air Force Dashi icon" />
</p>

<p align="center">
  <strong>Arcade de voo no navegador</strong> — F-22 no fim da tarde,<br/>
  mundo vivo, hubs de produto e missões curtas.
</p>

<p align="center">
  <img src="docs/images/hero-f22.png" width="520" alt="F-22 pixel art — title art" />
</p>

<p align="center">
  <a href="#stack"><img src="https://img.shields.io/badge/Three.js-0.182-black?logo=threedotjs&logoColor=white" alt="Three.js" /></a>
  <a href="#stack"><img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black" alt="React 19" /></a>
  <a href="#como-rodar"><img src="https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=nodedotjs&logoColor=white" alt="Node ≥ 20" /></a>
  <a href="#licença"><img src="https://img.shields.io/badge/license-MIT-grey" alt="MIT" /></a>
</p>

---

## Sobre

**Air Force Dashi** é um *flying toy* arcade com casca de produto web: sessões curtas no browser, sensação de voo caprichada e meta-game (Credits, Hangar, Operações, Loja).

O cliente de produção é **Vite + React + Three.js**. A API **Hono** valida economia; **Supabase** persiste progresso quando configurado.

### Destaques

- **Hubs de produto** espelhando o ensaio `reestilo/telas` (menu, pré-partida, hangar, carreira, loja, perfil, config, lobby)
- **Modos:** CheckPoint, Anti-Drone, Attack e Vôo Livre
- **Frota** com loadout AA/AG, skins, emblemas e efeitos cosméticos
- Mundo com heightmap, cidade/instancing, água, céu HDRI, nuvens atravessáveis e horizonte distante
- HUD estilo F-22 (tapes, radar, strips de missão) + pause com abandono
- Mísseis com VFX (Quarks), explosões e colisão em superfície/prédios
- Áudio de cockpit + SFX/theme de UI (`reestilo/audio`) com glitch de entrada nas telas
- Economia **sem pay-to-win** — Credits por jogar; cosméticos premium separados

---

## Capturas

### Vôo Livre

Explore o mapa em câmera chase, com cidade, névoa e horizonte aberto.

![Vôo Livre — chase cam sobre a cidade](docs/images/screenshot-voo-livre.png)

### CheckPoint

Anéis no ar com gates, tempo e rota progressiva.

![CheckPoint — curso aéreo](docs/images/screenshot-checkpoint.png)

### Title art

Arte pixel do F-22 (detalhe da bandeira de São Paulo na fuselagem) usada na identidade do título.

![F-22 title art](docs/images/hero-f22.png)

---

## Modos de jogo

| Modo | O que é |
|------|---------|
| **CheckPoint** | Curso de anéis no ar; níveis desbloqueáveis; progresso local (+ sync API). |
| **Anti-Drone** | Caça a alvos aéreos com locks e burst. |
| **Attack** | Alvos no solo / destruição com colapso local. |
| **Vôo Livre** | Explore sem missão — cidade, lagos, aeroportos. |

Fluxo típico: **Main Menu → Pré-partida → Gameplay → Resultado**.

---

## Controles (cliente web)

| Input | Ação |
|-------|------|
| **W / S** · ↑ / ↓ | Subir / descer (pitch) |
| **A / D** · ← / → | Bank + curva |
| **LMB** ou **V** | Disparar |
| **RMB** ou **Shift** | Afterburner (segurar) |
| **F** | Barrel roll |
| **Space** | Ciclar câmera (top → chase → rear → cockpit → free) |
| **C** | Olhar para trás (segurar) |
| **Q** | Inspeção (fora do FREE) / descer no FREE |
| **E** · **PageUp** | Subir na câmera FREE |
| **PageDown** | Descer na câmera FREE |
| Mouse | Look / trim |
| **Esc** | Pause |
| **M** | Ligar/desligar som |

No hub, o primeiro clique em qualquer controle **arma** o theme + SFX de UI (botão ♪ no topo).

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Cliente | Vite 6 · React 19 · Three.js · TypeScript |
| Simulação | `@afd/game-core` (sem WebGL) |
| Render | `@afd/game-render` (cena de voo, preview do hangar, FX) |
| Economia | `@afd/economy` + DTOs em `@afd/shared-types` |
| API | Hono em `apps/api` (`http://localhost:8787`) |
| Persistência | Supabase (opcional; service role só no server) |
| Ensaio visual | `reestilo/` (HTML/CSS/JS + áudio de referência) |

Roteiro da migração e budgets: [`docs/migracao-threejs-v1.md`](docs/migracao-threejs-v1.md).

---

## Como rodar

Requisitos: **Node ≥ 20**, Windows/macOS/Linux, browser moderno (Chrome recomendado).

```bash
git clone https://github.com/DashiGabriell/AirForceDashi.git
cd AirForceDashi
npm install
```

### Variáveis de ambiente

Copie o exemplo e preencha as chaves (nunca exponha `SERVICE_ROLE` no Vite):

```bash
cp .env.example .env
```

| Variável | Onde | Uso |
|----------|------|-----|
| `VITE_SUPABASE_URL` | cliente | URL do projeto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | cliente | anon / publishable |
| `SUPABASE_URL` | API | URL do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | API | persistência server-side |
| `SUPABASE_TOKEN` | tools | bootstrap Management API (opcional) |

Sem Supabase, o jogo roda com **progresso local**; a API continua servindo economia in-memory.

### Scripts

```bash
npm run api      # Hono · http://localhost:8787
npm run dev      # Vite · http://localhost:5173 (proxy → api)
npm run build
npm run preview
npm run typecheck
npm run test
npm run budget   # gate de tamanho do JS em apps/web/dist
```

Suba **api** e **dev** em paralelo para wallet, grants e sync.

### Tools úteis

```bash
node tools/bootstrap-supabase-env.mjs
node tools/apply-afd-migration.mjs
node tools/smoke-supabase-persist.mjs
node tools/measure-bundle.mjs
```

---

## Estrutura do repositório

```
AirForceDashi/
├── apps/
│   ├── web/                 # Cliente Vite + React + Three
│   └── api/                 # Hono — wallet / grants / loja / persist
├── packages/
│   ├── game-core/           # Simulação, missões, progresso, frota
│   ├── game-render/         # Cena de voo, hangar preview, FX
│   ├── economy/             # Schemas + service
│   └── shared-types/        # Enums / DTOs / budgets
├── reestilo/                # Ensaio visual + áudio de UI
├── assets/                  # Mapas, modelos 3D, refs de arte
├── tools/                   # Bundle, Supabase, clouds, harness
├── docs/                    # Economia, telas, migração, VFX…
└── docs/images/             # Arte e capturas do README
```

---

## Hubs e produto

| Hub | Papel |
|-----|--------|
| **Main Menu** | Identidade + CTA Jogar / Vôo Livre |
| **Pré-partida** | Modo → aeronave → Play |
| **Gameplay** + **Pause** | Voo, HUD, objetivos |
| **Resultado** | Score, Credits, XP, replay |
| **Hangar** | Frota, skins, emblemas, efeitos, mastery |
| **Carreira / Operações** | Dailies, weeklies, XP / patente |
| **Loja** | Catálogo Credits (+ premium depois) |
| **Perfil** | Callsign, medals, stats |
| **Configurações** | Áudio, gráficos, sensibilidade |
| **Lobby** | Stub TvT / matchmaking |

Detalhes de UX: [`docs/telas-produto-v1.md`](docs/telas-produto-v1.md).  
Moedas e anti-P2W: [`docs/economia-v1.md`](docs/economia-v1.md).

---

## Documentação

| Doc | Domínio |
|-----|---------|
| [`docs/migracao-threejs-v1.md`](docs/migracao-threejs-v1.md) | Engine web, performance, fases |
| [`docs/telas-produto-v1.md`](docs/telas-produto-v1.md) | Hubs e fluxos |
| [`docs/economia-v1.md`](docs/economia-v1.md) | Credits, XP, loja, fases de backend |
| [`docs/decisao-vfx-misseis-v1.md`](docs/decisao-vfx-misseis-v1.md) | Motor VFX de mísseis / explosões |
| [`docs/destruicao-predios-v1.md`](docs/destruicao-predios-v1.md) | Colapso local (Attack) |
| [`docs/cidade-cityjson-atlas-v1.md`](docs/cidade-cityjson-atlas-v1.md) | CityJSON → atlas de prédios |
| [`docs/frota-glb-bake-todo-v1.md`](docs/frota-glb-bake-todo-v1.md) | Bake GLB por aeronave |

---

## Créditos

- Projeto: **DashiGabriell**
- Cliente web: Three.js · React · Vite · Hono · Supabase
- Fontes de produto: ensaio `reestilo` (tipografia e tokens do hub)

---

## Licença

Distribuído sob os termos da licença **MIT**. Veja [LICENSE](LICENSE).
