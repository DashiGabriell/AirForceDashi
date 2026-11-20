# Frota GLB — bake para o jogo (to-do v1)

**Status:** backlog operacional  
**Data:** 2026-11-19  
**Escopo:** quais aeronaves em `assets/3d/` ainda precisam do procedimento F-22/F-15 e em que ordem  
**Procedimento de referência:** `tools/build_f22_game.py` / `tools/build_f15_game.py`  
**Contrato de saída:** um mesh exterior, material `Paint`, nariz Three.js −Z, comprimento ~9, ~16k tris → `*_game.glb` + `*_paint_default.png` em `assets/3d/` e `apps/web/public/models/`

**Documentos irmãos:**

| Doc | Domínio |
| --- | --- |
| [`economia-v1.md`](economia-v1.md) | Catálogo / custo / categorias de aeronave |
| [`migracao-threejs-v1.md`](migracao-threejs-v1.md) | Budgets de mesh / LOD |
| **Este arquivo** | Pipeline de bake + checklist por fase |

---

## 1. Já feitos (não reabrir sem motivo)

| ID jogo | Fonte em `assets/3d/` | Saída | Script | Runtime |
| --- | --- | --- | --- | --- |
| `f22` | `f22_raptor.glb` | `f22_game.glb` + `f22_paint_default.png` | `tools/build_f22_game.py` | `JetModel.ts` → `/models/f22_game.glb` |
| `f15` | `F-15E Strike Eagle.glb` | `f15_game.glb` + `f15_paint_default.png` | `tools/build_f15_game.py` | `JetModel.ts` → `/models/f15_game.glb` |
| `f16` | `F-16 Fighting Falcon.glb` | `f16_game.glb` + `f16_paint_default.png` | `tools/build_fleet_phase_a.py` | Hangar + `JetModel` |
| `fa18` | `Boeing F-A-18F Super Hornet.glb` | `fa18_game.glb` + `fa18_paint_default.png` | `tools/build_fleet_phase_a.py` | Hangar + `JetModel` |
| `typhoon` | `Eurofighter Typhoon.glb` | `typhoon_game.glb` + `typhoon_paint_default.png` | `tools/build_fleet_phase_a.py` | Hangar + `JetModel` |
| `rafale` | `Dassault Rafale (M).glb` | `rafale_game.glb` + `rafale_paint_default.png` | `tools/build_fleet_phase_a.py` | Hangar + `JetModel` |
| `su35` | `Sukhoi Su-35.glb` | `su35_game.glb` + `su35_paint_default.png` | `tools/build_fleet_phase_a.py` | Hangar + `JetModel` |
| `f35` | `F-35 Lightning II.glb` | `f35_game.glb` + `f35_paint_default.png` | `tools/build_fleet_phase_a.py` | Hangar + `JetModel` |
| `f14` | `F-14 Tomcat.glb` | `f14_game.glb` + `f14_paint_default.png` | `tools/build_fleet_phase_b.py` | Hangar + `JetModel` |
| `gripen` | `Saab JAS 39 Gripen.glb` | `gripen_game.glb` + `gripen_paint_default.png` | `tools/build_fleet_phase_b.py` | Hangar + `JetModel` |
| `mirage2000` | `Dassault Mirage 2000.glb` | `mirage2000_game.glb` + `mirage2000_paint_default.png` | `tools/build_fleet_phase_b.py` | Hangar + `JetModel` |
| `f2` | `Mitsubishi F-2.glb` | `f2_game.glb` + `f2_paint_default.png` | `tools/build_fleet_phase_b.py` | Hangar + `JetModel` |
| `mig29` | `MiG-29 - Fighter Jet.glb` | `mig29_game.glb` + `mig29_paint_default.png` | `tools/build_fleet_phase_b.py` | Hangar + `JetModel` |
| `mig35` | `MiG-35.glb` | `mig35_game.glb` + `mig35_paint_default.png` | `tools/build_fleet_phase_b.py` | Hangar + `JetModel` |
| `su57` | `Sukhoi Su-57 Felon.glb` | `su57_game.glb` + `su57_paint_default.png` | `tools/build_fleet_phase_b.py` | Hangar + `JetModel` |
| `yf23` | `YF-23 Black Widow II.glb` | `yf23_game.glb` + `yf23_paint_default.png` | `tools/build_fleet_phase_b.py` | Hangar + `JetModel` |
| `f4` | `F-4 Phantom II.glb` | `f4_game.glb` + `f4_paint_default.png` | `tools/build_fleet_phase_b.py` | Hangar + `JetModel` |
| `su34` | `The Sukhoi Su-34.glb` | `su34_game.glb` + `su34_paint_default.png` | `tools/build_fleet_phase_c.py` | Hangar + `JetModel` |
| `a10` | `A-10 Thunderbolt II.glb` | `a10_game.glb` + `a10_paint_default.png` | `tools/build_fleet_phase_c.py` | Hangar + `JetModel` |
| `b2` | `Northrop Grumman B-2 Spirit.glb` | `b2_game.glb` + `b2_paint_default.png` | `tools/build_fleet_phase_c.py` | Hangar + `JetModel` |
| `u2` | `U-2 Dragonlady.glb` | `u2_game.glb` + `u2_paint_default.png` | `tools/build_fleet_phase_c.py` | Hangar + `JetModel` |

**Fora do escopo deste to-do (não são airframes de frota):**

- `missile__bomb_collection_-_fighter_jets_-_free.glb` — já fatiado em `assets/3d/missiles/`
- pasta `assets/3d/missiles/`
- arquivos `*_game.glb` / `*_paint_default.png` (produtos do bake)

---

## 2. Inventário — fontes ainda sem bake

Varredura de `assets/3d/*.glb` (2026-11-19). **20 airframes** candidatos + **1 duplicata Su-57** a decidir.

| # | Arquivo fonte | Nome curto | Sugestão `id` | Notas |
| --- | --- | --- | --- | --- |
| 1 | `F-16 Fighting Falcon.glb` | F-16 | `f16` | No catálogo ilustrativo (`economia-v1` · Entrada) |
| 2 | `Boeing F-A-18F Super Hornet.glb` | F/A-18F | `fa18` | No catálogo ilustrativo · Intermediária |
| 3 | `Eurofighter Typhoon.glb` | Typhoon | `typhoon` | No catálogo ilustrativo · Avançada |
| 4 | `Dassault Rafale (M).glb` | Rafale M | `rafale` | No catálogo ilustrativo · Avançada |
| 5 | `Sukhoi Su-35.glb` | Su-35 | `su35` | No catálogo ilustrativo · Especializada |
| 6 | `F-35 Lightning II.glb` | F-35 | `f35` | No catálogo ilustrativo · Especializada |
| 7 | `F-14 Tomcat.glb` | F-14 | `f14` | Extra (não no quadro ilustrativo atual) |
| 8 | `F-4 Phantom II.glb` | F-4 | `f4` | Extra / legado |
| 9 | `Dassault Mirage 2000.glb` | Mirage 2000 | `mirage2000` | Extra |
| 10 | `Saab JAS 39 Gripen.glb` | Gripen | `gripen` | Extra |
| 11 | `Mitsubishi F-2.glb` | F-2 | `f2` | Extra |
| 12 | `YF-23 Black Widow II.glb` | YF-23 | `yf23` | Extra / protótipo |
| 13 | `MiG-29 - Fighter Jet.glb` | MiG-29 | `mig29` | Extra |
| 14 | `MiG-35.glb` | MiG-35 | `mig35` | Extra |
| 15 | `Sukhoi Su-57 Felon.glb` | Su-57 | `su57` | Escolher **uma** variante (§3) |
| 16 | `Sukhoi Su-57 Felon (P).glb` | Su-57 (P) | — | Duplicata / variante — não bakear as duas |
| 17 | `The Sukhoi Su-34.glb` | Su-34 | `su34` | Extra / ataque |
| 18 | `A-10 Thunderbolt II.glb` | A-10 | `a10` | Extra / CAS (silhueta bem diferente) |
| 19 | `Northrop Grumman B-2 Spirit.glb` | B-2 | `b2` | Extra / bombardeiro (escala e feel ≠ caça) |
| 20 | `U-2 Dragonlady.glb` | U-2 | `u2` | Extra / recon (não caça) |

> **Su-27 Flanker** aparece no catálogo ilustrativo de `economia-v1.md`, mas **não há GLB** em `assets/3d/` hoje. Tratar como gap de asset, não como item de bake.

---

## 3. Decisões antes de bakear

- [x] **Su-57:** bakeado `Sukhoi Su-57 Felon.glb` (hierarquia idêntica à `(P)`). Manter `(P)` como fonte bruta / não bakear de novo.
- [x] **B-2 / U-2 / A-10 / Su-34:** entram como **jogáveis no Hangar** (coleção / free-flight). Flight model ainda compartilhado com caças — tuning por silhueta fica para depois.
- [ ] **Licenças:** cada fonte precisa de linha em `apps/web/public/models/CREDITS.txt` (padrão F-22) antes de ship.
- [ ] **IDs no código:** além do bake, cada fase exige `Aircraft` / catálogo / `JetModel` / Hangar — este doc só cobre o pipeline de mesh até o GLB estar em `public/models/`.

---

## 4. Checklist por aeronave (copiar a cada bake)

Para cada item da fase:

1. [ ] Criar `tools/build_<id>_game.py` (clonar F-15; ajustar `SRC`, drops por hierarquia, `KEEP_PARENT` / prefixos)
2. [ ] `blender --background --python tools/build_<id>_game.py`
3. [ ] Validar: tris ≈ 16k, comprimento ~9 no eixo longo, nariz −Z, material `Paint`, luma albedo utilizável (não preto morto)
4. [ ] Confirmar cópias em `assets/3d/` e `apps/web/public/models/`
5. [ ] Atualizar `CREDITS.txt`
6. [ ] Ligar loader em `JetModel.ts` (e enum/catálogo quando a fase de produto pedir)
7. [ ] Marcar a linha da fase como `[x]` neste arquivo

Comando modelo:

```bash
blender --background --python tools/build_<id>_game.py
```

---

## 5. Fases de implementação

Prioridade alinhada a [`economia-v1.md`](economia-v1.md) §4 (catálogo ilustrativo) + starters já feitos.

### Fase A — Catálogo ilustrativo (após F-22 / F-15)

Ordem sugerida de bake + liberação no Hangar:

| Ordem | Aeronave | Arquivo fonte | Status |
| --- | --- | --- | --- |
| A1 | F-16 Fighting Falcon | `F-16 Fighting Falcon.glb` | [x] |
| A2 | F/A-18F Super Hornet | `Boeing F-A-18F Super Hornet.glb` | [x] |
| A3 | Eurofighter Typhoon | `Eurofighter Typhoon.glb` | [x] |
| A4 | Rafale M | `Dassault Rafale (M).glb` | [x] |
| A5 | Su-35 | `Sukhoi Su-35.glb` | [x] |
| A6 | F-35 Lightning II | `F-35 Lightning II.glb` | [x] |

**DoD Fase A:** seis `*_game.glb` em `public/models/`; frota completa no Hangar / pré-partida / `JetModel` (custo via catálogo economia). **Concluído 2026-11-19.**

### Fase B — Caças extras (expansão de frota)

| Ordem | Aeronave | Arquivo fonte | Status |
| --- | --- | --- | --- |
| B1 | F-14 Tomcat | `F-14 Tomcat.glb` | [x] |
| B2 | Gripen | `Saab JAS 39 Gripen.glb` | [x] |
| B3 | Mirage 2000 | `Dassault Mirage 2000.glb` | [x] |
| B4 | F-2 | `Mitsubishi F-2.glb` | [x] |
| B5 | MiG-29 | `MiG-29 - Fighter Jet.glb` | [x] |
| B6 | MiG-35 | `MiG-35.glb` | [x] |
| B7 | Su-57 Felon | `Sukhoi Su-57 Felon.glb` | [x] |
| B8 | YF-23 | `YF-23 Black Widow II.glb` | [x] |
| B9 | F-4 Phantom II | `F-4 Phantom II.glb` | [x] |

**DoD Fase B:** todos os caças da tabela com bake; IDs no catálogo / Hangar / `JetModel`. **Concluído 2026-11-20.** `(P)` permanece fonte bruta.

### Fase C — Silhuetas especiais (opcional / mais tarde)

| Ordem | Aeronave | Arquivo fonte | Status |
| --- | --- | --- | --- |
| C1 | Su-34 | `The Sukhoi Su-34.glb` | [x] |
| C2 | A-10 Thunderbolt II | `A-10 Thunderbolt II.glb` | [x] |
| C3 | B-2 Spirit | `Northrop Grumman B-2 Spirit.glb` | [x] |
| C4 | U-2 Dragonlady | `U-2 Dragonlady.glb` | [x] |

**Decisão de produto:** as quatro silhuetas são **jogáveis** (Hangar / pré-partida / `JetModel`), não NPC. Feel de voo dedicado (CAS / stealth / recon) fica fora deste bake.

**DoD Fase C:** bake técnico ok; decisão jogador vs NPC documentada. **Concluído 2026-11-20.**

### Fase D — Gaps de asset

| Item | Status |
| --- | --- |
| Arquivar a variante Su-57 não escolhida | [x] movida para `assets/3d/_raw/Sukhoi Su-57 Felon (P).glb` (2026-11-20) |
| Localizar / adquirir GLB **Su-27 Flanker** (citado em `economia-v1` · 32.000 CR) | [ ] **bloqueado** — sem fonte em `assets/3d/` |
| Bake + runtime `su27` | [ ] script pronto: `tools/build_fleet_phase_d.py` |

**Como desbloquear o Su-27**

1. Colocar o GLB fonte em `assets/3d/` com um destes nomes:
   - `Sukhoi Su-27 Flanker.glb` (preferido)
   - `Sukhoi Su-27.glb` / `Su-27 Flanker.glb` / `Su-27.glb`
2. Rodar (ou pedir ao agente):
   ```bash
   blender --background --python tools/build_fleet_phase_d.py
   ```
3. Ligar `su27` em `Aircraft` / `FLEET` / catálogo / `JetModel` (custo ilustrativo: **32.000 CR**, intermediária).

Candidatos públicos (verificar licença antes de ship): Sketchfab “Sukhoi Su-27 Flanker” (vários autores). Preferir o mesmo pack/estilo `*-airframe` das outras fontes do projeto.

---

## 6. Resumo executivo

| Situação | Qtd |
| --- | --- |
| Já bakeados e no jogo | **21** (starters + Fase A/B/C) |
| Arquivo raw arquivado | Su-57 `(P)` em `assets/3d/_raw/` |
| Gap de asset | **Su-27** (sem GLB) |
| Prioridade imediata | Drop do GLB Su-27 → bake Fase D |

Próximo passo concreto: **você** coloca o GLB do Su-27 em `assets/3d/`; em seguida bake + wiring `su27`.
