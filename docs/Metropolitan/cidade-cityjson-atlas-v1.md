# Cidade visual — CityJSON → atlas de instâncias (v1)

**Status:** aceita, não implementada  
**Data:** 2026-11-19  
**Escopo:** melhorar a silhueta e a variedade dos prédios da cidade de fundo **sem** carregar CityJSON no loop de voo  
**Princípio:** CityJSON é **fonte offline** de forma urbana; o runtime continua `InstancedMesh` + AABB  
**Implementação:** futura. Este documento é o contrato para a fatia seguinte.

**Documentos irmãos:**

| Doc | Domínio |
| --- | --- |
| [`migracao-threejs-v1.md`](migracao-threejs-v1.md) | Budgets browser, instancing, streaming |
| [`destruicao-predios-v1.md`](destruicao-predios-v1.md) | Colapso local do alvo Attack (não muda) |
| **Este arquivo** | Pipeline CityJSON → atlas de tipos → `BuildingField` |

Em conflito de orçamento de frame / draw calls → `migracao-threejs-v1.md`.  
Em conflito de destruição de alvo → `destruicao-predios-v1.md`.  
Em conflito de “como nasce a forma do prédio de fundo” → **este documento**.

---

## 1. Decisão

**Usar CityJSON (e, se útil, o loader [`cityjson/cityjson-threejs-loader`](https://github.com/cityjson/cityjson-threejs-loader)) apenas no pipeline de conteúdo — offline / tooling.**

**Não adotar** o loader CityJSON como dependência de runtime do voo (`apps/web` / `packages/game-render` no tick).

| Caminho | Papel |
| --- | --- |
| CityJSON → bake → atlas de tipos → `InstancedMesh` | **Escolhido.** Visual de cidade real, custo de arcade |
| `cityjson-threejs-loader` no `FlightScene` a cada sessão | **Descartado.** Parse + malhas densas no cliente quebram streaming e budgets |
| Procedural caixa pura (estado atual) | Mantido como **fallback** até o atlas existir; continua válido para farm/suburb simples |

A pergunta de produto foi: *“usar o repo cityjson-threejs-loader para criar as imagens da cidade (prédios)?”*  
A resposta operacional é: **sim para criar / extrair formas; não para desenhar a cidade no browser em tempo real.**

---

## 2. Por que não carregar CityJSON no voo

O Air Force Dashi é arcade de voo browser-first. A cidade de fundo já tem contrato rígido:

| Peça hoje | Contrato |
| --- | --- |
| Lógica | `gatherBuildings` em `packages/game-core/src/world/chunk.ts` |
| Render | `BuildingField` em `packages/game-render/src/world/BuildingField.ts` |
| Geometria | **1** `BoxGeometry(1,1,1)` compartilhada |
| Capacidade | `MAX = 430` instâncias (`MAX_CITY` 220 + `MAX_SUBURB` 160 + `MAX_FARM` 50) |
| Streaming | raio `BUILDING_RADIUS = 1600`, célula `BUILDING_CELL = 280` |
| Colisão | AABB via `buildingToAabb` / `BuildingHitQuery` |
| Alvos Attack | promote → `DestructibleField` (máx. 3), ver `destruicao-predios-v1.md` |
| Render path | `WebGLRenderer` em `FlightScene.ts` |

O loader CityJSON resolve outro problema: visualizar modelos CityJSON 3D (CityGML-like) em Three.js. Isso implica:

1. **Parse** de JSON (muitas vezes MB) no cliente ou no boot.
2. **Malhas por building / face** — triângulos e draw calls fora do modelo “1 mesh + instance matrices”.
3. **Sem streaming nativo** alinhado aos chunks 512 m / stream radius 3.
4. **Colisão** difícil: AABB/hit precisariam ser derivados de malhas irregulares a cada frame ou pré-calculados à parte de qualquer forma.
5. **Destruição** do Attack (`hideBuilding` + malha local) deixa de encaixar: promover um CityJSON inteiro por hit explode o teto de 3 alvos locais.

Conclusão: o loader é ótimo para **inspecionar, prototipar e bakear**. Não é o renderer da cidade no cruzeiro.

---

## 3. Objetivo de produto

> De longe, a cidade deve parecer **quarteirões reais** (torres, lajes, blocos longos, pátios), não um campo uniforme de caixas cinzas — **sem** aumentar o orçamento de draw calls / heap do cruzeiro além dos alvos de [`migracao-threejs-v1.md`](migracao-threejs-v1.md).

O jogador **não** precisa ler janelas individuais a 2 km. Precisa ler:

- silhueta (torre vs bloco vs casa);
- ritmo de quarteirão (rua / lote);
- variação de altura no skyline;
- coerência com bioma `Region.CITY` / `SUBURB` / `FARM`.

---

## 4. Arquitetura-alvo

```
[Fontes CityJSON]
   (open data / export próprio / trechos curados)
           │
           ▼
[Tooling offline]  ← cityjson-threejs-loader OK aqui
   parse → simplificar → classificar → amostrar
           │
           ▼
[Atlas de tipos]   building-atlas.json (+ meshes GLB opcionais)
   typeId, footprint, heightBands, meshRef, kind, tags
           │
           ▼
[Runtime AFD]
   gatherBuildings → escolhe typeId por seed/região
   BuildingField → InstancedMesh por tipo (ou multi-atlas)
   buildingToAabb → caixa derivada do footprint bakeado
```

### 4.1 O que é um “tipo” no atlas

Cada entrada do atlas é um **protótipo reutilizável**, não um prédio único do mapa-fonte.

Campos mínimos sugeridos:

| Campo | Tipo | Nota |
| --- | --- | --- |
| `typeId` | string | estável (`city.tower.a`, `suburb.house.b`) |
| `kind` | `"city" \| "suburb" \| "farm"` | compatível com `BuildingInstance.kind` |
| `footprintW` / `footprintD` | number (m) | caixa lógica XZ (já usada em colisão) |
| `heightMin` / `heightMax` | number (m) | faixa; runtime sorteia `h` no intervalo |
| `yawSteps` | `1 \| 2 \| 4` | alinhamento a vias (hoje: 4 × 90°) |
| `mesh` | `"box" \| glbRef` | v1 pode ser só box + proporções; v1.1 GLB leve |
| `triBudget` | number | teto por mesh de tipo (ex.: ≤ 200 tris) |
| `source` | string | CityJSON / cidade / LOD de origem (crédito) |
| `tags` | string[] | `tower`, `slab`, `courtyard`, `warehouse` |

### 4.2 O que NÃO vai no atlas

- Geometria LOD0 fotorealista (milhares de tris / prédio).
- Texturas de fachada 4K por tipo no MVP.
- Grafo completo de vias / CityObject members no cliente.
- IDs CityJSON originais como `BuildingInstance.id` (quebram o hide/promote por célula).

O `id` de runtime continua no estilo atual (`b_${i}_${j}` ou equivalente estável por célula), para `hideBuilding` / Attack não mudarem.

---

## 5. Papel do `cityjson-threejs-loader`

| Fase | Usar o loader? | Como |
| --- | --- | --- |
| Exploração | Sim | Script Node ou página tooling: carregar `.city.json`, inspecionar bounding boxes / CityObjects |
| Bake | Sim (ou parse próprio) | Extrair footprint + height; opcionalmente mesh simplificada |
| Runtime voo | **Não** | Zero `import` do loader em `game-render` / `apps/web` de produção |
| Preview Hangar/cidade estática | Talvez | Só se for tela offline / editor; não no `FlightScene` |

Dependência tipicamente em `tools/` (ou `devDependency` do monorepo), **nunca** no bundle crítico do gameplay.

Referência: [cityjson/cityjson-threejs-loader](https://github.com/cityjson/cityjson-threejs-loader).

---

## 6. Pipeline de bake (contrato de tooling)

### 6.1 Entrada

- Um ou mais arquivos CityJSON (LOD1 preferível: solid / MultiSurface simples).
- Preferir cidades ou recortes com licença clara (CC0 / ODbL com atribuição no `SOURCES`).
- Escala em metros; origem local projetada (não WGS84 cru no runtime).

### 6.2 Passos

1. **Parse** CityJSON (loader ou parser leve).
2. **Filtrar** `Building` / `BuildingPart`; ignorar vegetação, bridges, etc. nesta v1.
3. **AABB / footprint** por objeto: `min/max` XZ + altura.
4. **Simplificar:** fundir BuildingParts; rejeitar objetos com footprint &lt; 6 m ou altura &lt; 3 m (ruído).
5. **Classificar** em buckets de tipo:
   - torre: `h/w ≥ 2.2` e `h ≥ 40`;
   - bloco: `0.6 ≤ h/w &lt; 2.2`;
   - laje / slab: `h/w &lt; 0.6` e área grande;
   - casa suburb: `h ≤ 14` e área pequena;
   - galpão farm: `h ≤ 16` e `w` ou `d` longo.
6. **Clusterizar** (k-means / quantização) nas dimensões `(w, d, h)` → N tipos (alvo: **12–24** tipos city, **6–12** suburb, **3–6** farm).
7. **Exportar** `building-atlas.json` (+ opcional `building-types.glb` com meshes nomeados por `typeId`).
8. **Validar** budgets: tris/tipo, contagem de tipos, tamanho do JSON gzip.

### 6.3 Saída versionada

Sugestão de paths (implementação futura):

```
assets/city/
  building-atlas.json
  building-types.glb          # opcional v1.1
  SOURCES.txt                 # licença + cidades de origem
tools/bake-cityjson-atlas.mjs # ou .py — CLI de bake
```

O atlas é **asset de jogo**, não um dump CityJSON cru.

---

## 7. Runtime — o que muda e o que não muda

### 7.1 Não muda (inegociável nesta fatia)

- `WebGLRenderer` / ausência de CityJSON no tick.
- Capacidade ~430 instâncias e raio de streaming.
- `buildingToAabb` como caixa para míssil / soft hit.
- Promote Attack + `destruicao-predios-v1.md` (colapso local em caixas).
- Biomas via `sampleRegion` (`CITY` / `SUBURB` / `FARM`).
- Horizon radial / fog: prédios continuam no mesmo material path (`applyRadialHorizon` se ainda aplicável).

### 7.2 Muda

| Hoje | Depois |
| --- | --- |
| `gatherBuildings` sorteia `w,h,d` com hashes | Sorteia `typeId` do atlas filtrado por `kind` + seed; `w,h,d` vêm do tipo (com jitter leve opcional) |
| `BuildingField`: 1 `BoxGeometry` | 1 mesh por tipo (box ou GLB lowpoly) **ou** poucos `InstancedMesh` agrupados por tipo |
| Cor única `0x8a9098` | Cor / material por `kind` ou por tag (ainda Lambert, sem PBR pesado) |
| Skyline “caixa aleatória” | Skyline com distribuição realista herdada do bake |

### 7.3 Extensão sugerida de `BuildingInstance`

Manter campos atuais e acrescentar:

```ts
typeId?: string; // chave no atlas; opcional enquanto fallback box existir
```

Colisão e destroy continuam usando `w,h,d,yaw,x,y,z,id`.

---

## 8. Orçamento (não negociar na v1 do atlas)

Alinhado a [`migracao-threejs-v1.md`](migracao-threejs-v1.md) §1.1.

| Limite | Valor | Motivo |
| --- | --- | --- |
| Tipos no atlas (total) | ≤ 48 | Poucos materiais / meshes residentes |
| Tris por tipo (mesh) | ≤ 200 (alvo ≤ 80) | Instancing barato |
| `InstancedMesh` draws de prédios | ≤ 8 (ideal 1–3) | Agrupar tipos que compartilham material |
| Instâncias ativas | ≤ 430 | Contrato atual `BuildingField` |
| Download atlas JSON gzip | ≤ 80 KB | Sem CityJSON cru |
| Download GLB tipos (se houver) | ≤ 400 KB | Lowpoly só |
| Parse CityJSON no cliente de voo | **0** | Bake offline |
| Dependência runtime `cityjson-threejs-loader` | **proibida** | Bundle + API fora do tick |

Se o atlas não couber no budget, corta-se tipos e tris — **não** se liga o loader no `FlightScene`.

---

## 9. Fases de implementação

### Fase C0 — Contrato e tooling stub

- [ ] Este doc aceito (feito).
- [ ] CLI `tools/bake-cityjson-atlas` que lê 1 CityJSON de amostra e emite `building-atlas.json` mínimo (só boxes classificadas).
- [ ] `SOURCES.txt` com licença.

**DoD:** atlas gerado em CI ou script local; nenhum import no runtime.

### Fase C1 — Runtime consome atlas (ainda box)

- [ ] Carregar atlas em `game-core` ou `game-render` no boot do mundo.
- [ ] `gatherBuildings` escolhe `typeId`; preenche `w,h,d` a partir do tipo.
- [ ] `BuildingField` inalterado em geometria (ainda 1 box) — só distribuição muda.
- [ ] Testes Vitest: contagens por `kind`, estabilidade de `id`, AABB.

**DoD:** skyline visualmente mais “de cidade” só com proporções bakeadas; FPS ≥ baseline atual em cruzeiro.

### Fase C2 — Meshes lowpoly por tipo

- [ ] Export GLB com N meshes nomeadas.
- [ ] `BuildingField` com 1 `InstancedMesh` por material/tipo agrupado.
- [ ] Fallback box se GLB falhar.
- [ ] Validar draw calls ≤ teto §8.

**DoD:** silhueta distinta (torre vs laje) a distância média; budgets OK.

### Fase C3 — Quarteirão / seed de lote (opcional)

- [ ] Usar footprints CityJSON só para **estatísticas** (densidade, orientação preferencial), não para colocar o mapa 1:1.
- [ ] Manter mundo procedural infinito / wrap `WORLD_SIZE`.
- [ ] Não importar coordenadas geográficas reais para o playground.

**DoD:** ritmo de ruas mais legível sem mapa único “Paris no meio do lago”.

---

## 10. O que explicitamente NÃO fazer

- [ ] Não adicionar `cityjson-threejs-loader` ao bundle de `apps/web` / `FlightScene`.
- [ ] Não streamar `.city.json` por chunk no voo.
- [ ] Não substituir `InstancedMesh` por milhares de `Mesh` CityObject.
- [ ] Não voxelizar a cidade inteira (já rejeitado em `migracao-threejs-v1.md` / `destruicao-predios-v1.md`).
- [ ] Não amarrar colisão à malha de alta resolução — AABB da caixa lógica.
- [ ] Não promover CityJSON inteiro no Attack; destroy continua local e barato.
- [ ] Não bloquear telas de produto / economia esperando o atlas.

---

## 11. Critérios de aceite (quando implementarmos)

1. Em cruzeiro sobre `Region.CITY`, o skyline mostra **pelo menos 3 silhuetas** distintas (torre, bloco, laje) sem shader novo obrigatório.
2. Draw calls e tris de prédios dentro dos tetos §8 (medido Chrome, perfil Medium).
3. Attack: hide + colapso local ainda funcionam com `id` estável.
4. Bundle de gameplay **não** contém o loader CityJSON.
5. Atribuição das fontes CityJSON está em `assets/city/SOURCES.txt` (ou equivalente).

---

## 12. Resumo executivo

| Pergunta | Resposta |
| --- | --- |
| Usamos CityJSON? | **Sim**, como fonte de formas / estatísticas |
| Usamos `cityjson-threejs-loader`? | **Sim no tooling**, **não no voo** |
| Como a cidade aparece no jogo? | Atlas de tipos + `InstancedMesh` (como hoje, porém menos “caixa aleatória”) |
| Quando? | Fatias C0→C2 após o mundo/horizon estáveis; não bloqueia produto |

Este arquivo é a especificação. Código de bake e consumo do atlas entram em PRs futuros que devem citar este contrato.
