# Mapa 02 — Metropolitan (decisões e contrato v1)

**Status:** decisões fechadas na rodada de grilling de 2026-11-26; implementação ainda não iniciada
**Data:** 2026-11-26 (última atualização: decisões Q1 a Q27)
**Escopo:** mapa principal de exploração e monetização. Cidade costeira densa e vertical, dentro de um mundo circular de raio 23 km.
**Documentos irmãos:**

| Doc | Domínio |
| --- | --- |
| [`fachadas-atlas-v1.md`](fachadas-atlas-v1.md) | Fachadas, UV por instância, janelas em metros |
| [`cidade-cityjson-atlas-v1.md`](cidade-cityjson-atlas-v1.md) | Atlas de prédios offline, `BuildingField` |
| [`migracao-threejs-v1.md`](migracao-threejs-v1.md) | Budgets de frame, draw calls, streaming |
| [`destruicao-predios-v1.md`](destruicao-predios-v1.md) | Colapso local de alvos Attack (fora da V1) |
| `assets/maps/pacific_islands/README.md` | Molde do Mapa 01 (freeze v1, setores, collections) |

Em conflito de orçamento de frame → `migracao-threejs-v1.md`.
Em conflito de forma do prédio de fundo → `cidade-cityjson-atlas-v1.md`.
Em conflito de layout, regiões, pontes e escopo do Metropolitan → **este arquivo**.

---

## 0. Decisões fechadas

### 0.1 Mundo e escala

| Tema | Decisão | Origem |
| --- | --- | --- |
| Tamanho do mundo | **Círculo de raio 29 km** (diâmetro 58 km), com área de ~2.640 km², cerca de **10× o Pacific** (256 km²). Raio ampliado para o quadrado de layout caber dentro do círculo (Q22, decisão de ampliar) | Q22, ampliação |
| Layout das regiões | Ocupa o quadrado de **40 × 40 km** no centro. O círculo de 29 km envolve o quadrado inteiro (meia diagonal de 28,3 km) | Q22, ampliação |
| Forma da borda | Círculo visível, com nuvens em faixa na borda e aviso de retorno | Q20 |
| Wrap do mundo | **Desligado.** O círculo é o limite do mundo, e a margem de oceano vira só visual | Q25 |
| Aviso de borda | Começa a **2 km** da borda, com nuvens entrando gradualmente e aviso mais forte à medida que o jogador se aproxima | Q26 |
| Nuvens da borda | Faixa visual, sem colisão e sem bloquear a visão. Igual à regra do Arena | Q23 |
| Ocupação | Sobre o quadrado de 40 × 40 km (1.600 km²): 40% urbano (640 km²), 15% verde (240), 15% industrial e portuário (240), 10% aeroporto (160), 20% água e litoral (320). A terra fica dentro do quadrado; a água, nos cantos e na faixa costeira | Q27, ajustado para o quadrado |
| Heightmap | **2049²** cobrindo 58 km (cerca de 28,3 m por célula), como asset binário separado. Nunca embutido no TS | Q24 |
| Platôs urbanos | Cada região tem um platô plano no heightmap, com transição para o terreno natural em faixa de cerca de 200 m | Q12 |

### 0.2 Regiões e pontos de interesse

| Tema | Decisão | Origem |
| --- | --- | --- |
| Unidade de trabalho | **As 8 regiões da imagem**, implementadas área por área. Setores de 4 × 4 km são técnicos, só para streaming | Q5, Q9 |
| Ordem de implementação | 1) Downtown, 2) Airport, 3) Harbor, 4) Coastal, 5) Financial, 6) Residential, 7) Industrial, 8) Green Zone | Q11 |
| Estádio | Dentro da região **Coastal** | Q13 |
| Porto | Dentro da região **Harbor** | Q13 |
| Orçamento de prédios | Cada região tem teto próprio. A soma das regiões visíveis na janela de streaming fica dentro de **430 instâncias** | Q14 |
| Fonte de verdade do layout | **Imagem de referência**. Quando texto e imagem divergem, vale a imagem | Q-inicial |

### 0.3 Escopo da V1

| Tema | Decisão | Origem |
| --- | --- | --- |
| Modos da V1 | **Exploração livre** e uma missão **CheckPoint** | Q3 |
| CheckPoint | **12 portais**, começando na Airport e terminando em Harbor, cruzando as três pontes. Altitudes entre **150 m e 400 m** | Q16 |
| Missões fora da V1 | Attack, interceptação e corridas entram em fases seguintes | Q3 |
| Ponto de partida | Airport, em cruzeiro a **2.200 m**, com o nariz na pista | Q15 |
| Pontos de interesse na V1 | **Estádio** e **porto**. Marina, centro de convenções, usina e torre de comunicação ficam para a V2 | Q5 |
| Pistas | **2 pistas de 3.000 m** | Q7 |
| Tráfego aéreo | Existente no repo (`AirTraffic`), só como **silhuetas distantes**, sem interação | Q21 |
| Luz | **Final de tarde travado**, sem ciclo de dia e noite. O ciclo entra como variação futura | Q19 |
| Mapa separado | Metropolitan é um mapa **separado** do Pacific, escolhido na pré-partida | Q6 |

### 0.4 Pontes

| Tema | Decisão | Origem |
| --- | --- | --- |
| Quantidade | **3 pontes** | Briefing |
| Ligações | Residential ↔ Downtown, Downtown ↔ Financial, Harbor ↔ Coastal | Q17 |
| Colisão | **Suave**, igual aos prédios. O tabuleiro não trava o jato | Q10 |
| Uso no CheckPoint | Portais sobre as pontes, sem colisão dura | Q10 |

### 0.5 Prédios e voo

| Tema | Decisão | Origem |
| --- | --- | --- |
| Alturas | **Só os 5 ícones de Downtown passam de 200 m** (até 450 m). Torres comerciais ficam entre 80 e 200 m | Q1 |
| Colisão das torres | **Suave**, como os prédios atuais | Briefing / Q2 |
| Avisos de altitude | Calculados **só pelo terreno**. Torres geram apenas alerta de proximidade | Q2 |
| Protótipo de voo | Voo entre torres de 200 m e 450 m. **Mantém a abordagem** se o jogador voar em velocidade de ataque sem aviso de altitude indevido e sem colisão inesperada. Se não, revisa o modelo de voo antes de seguir | Q18 |
| Fachadas | Contrato em [`fachadas-atlas-v1.md`](fachadas-atlas-v1.md). Começa pela F0, correção das janelas em metros | Doc de fachadas |

### 0.6 Publicidade

| Tema | Decisão | Origem |
| --- | --- | --- |
| Ativação na V1 | **Só preparo técnico**: atlas e slots prontos, sem venda e sem marca real | Q4 |
| Marcas | Fictícias nos protótipos | Parecer §4.6 |
| Dirigíveis e faixas aéreas | Fora da V1 | Q21 |

---

## 1. Entendimento do briefing (atualizado)

- **Mundo:** círculo de raio 29 km, com o layout ocupando um quadrado de 40 × 40 km no centro.
- **Identidade:** cidade gigantesca, moderna e costeira, com final de tarde travado na V1. Ficção, sem reproduzir cidade real.
- **Ocupação:** sobre o quadrado de 40 km (1.600 km²): 40% urbano (640 km²), 15% verde (240), 15% industrial e portuário (240), 10% aeroporto (160), 20% água e litoral (320).
- **Regiões (8):** Downtown, Financial District, Residential, Industrial, Airport, Harbor, Coastal, Green Zone.
- **Downtown:** 55 arranha-céus (5 ícones de 250–450 m e 50 torres comerciais de 80–200 m; eram 25–35, ampliado após o primeiro voo), ruas largas, praças, helipontos, painéis e fachadas publicitárias.
- **Aeroporto:** 2 pistas de 3.000 m, terminal, torre de controle, hangares, pátios, taxiways e manutenção.
- **Pontos de interesse da V1:** 3 pontes, estádio e porto.
- **Pontos de interesse da V2:** marina, centro de convenções, usina e torre de comunicação.
- **Monetização:** preparo técnico de slots na V1. Ativação depois.
- **Processo:** implementação área por área, com blockout antes do detalhe.

---

## 2. Parecer geral

**Concordo com a direção.** O Metropolitan segue o molde do Pacific, e a decisão de ir área por área permite testar a cada região, como você pediu.

Os riscos técnicos que sobraram estão nas seções 4 e 5.

---

## 3. Onde a proposta encontra o código atual

### 3.1 O que já existe

| Peça | Onde | Observação |
| --- | --- | --- |
| Mundo | `packages/game-core/src/world/pacificMap.ts` (`PACIFIC_MAP`) | `worldSize = 16000`, spawn e heightmap do Pacific. `constants.ts` reexporta `WORLD_SIZE` e `MAP_SPAWN`. `CRUISE_ALT = 2200` e `MAX_ALT = 12000` continuam globais |
| Streaming de chunks | `packages/game-core/src/world/streaming.ts`, `chunk.ts` | Chunks de 512 m, raio de cerca de 3 chunks. Não é o setor de 4 km |
| Prédios procedurais | `packages/game-core/src/world/chunk.ts` (`gatherBuildings`) | Células de 280 m, raio de 1600 m, `MAX_CITY = 220`, `MAX_SUBURB = 160`, `MAX_FARM = 50` |
| Render de prédios | `packages/game-render/src/world/BuildingField.ts` | 1 `BoxGeometry` compartilhada, `InstancedMesh`, `MAX = 430` |
| Silhueta de média distância | `packages/game-render/src/world/CityHlod.ts` | Células de 420 m, anel de 1050 a 3600 m, `MAX = 96` |
| Heightmap | `packages/game-core/src/world/pacificHeights.ts` | 513², uint16 em base64 dentro do TS. Inviável para o Metropolitan |
| Regiões | `packages/game-core/src/world/heightfield.ts` | Enum `Region` e `sampleRegion`, acoplados ao Pacific |
| Aeroporto | `packages/game-core/src/world/airbaseLayout.ts` | Dashi AFB, pista de 3.500 m. O Metropolitan usa 3.000 m |
| Lugares | `packages/game-core/src/world/pacificMap.ts` (`PACIFIC_MAP.places`) | Catálogo fixo. `places.ts` lê o mapa ativo e reexporta `NE_VILLAGE` |
| Hora do dia | `packages/game-core/src/world/dayClock.ts` | Base para o final de tarde travado |
| Tráfego aéreo | `packages/game-render/src/world/AirTraffic.ts` | Base para as silhuetas distantes da V1 |

### 3.2 O que a proposta cria e o código não tem

- Oito regiões com layout próprio, hoje acopladas ao Pacific.
- Alturas de 15 a 450 m. Hoje a cidade vai de 22 a 100 m, com raros cerca de 145 m.
- Mundo circular com borda visível. Hoje o mundo é um quadrado sem wrap: fora dele é oceano (`isInsideMap` em `heightfield.ts`). O círculo ainda não existe.
- Pontes, estádio, porto, e os demais POIs. Nenhum tem contrato técnico ainda.
- Slots de publicidade com material substituível.

**Divergências entre texto e imagem:** resolvidas pela regra de que a imagem vale. Indústria a nordeste, porto a leste, marina a sudeste, parque verde a sudoeste, estádio ao sul-centro.

---

## 4. Riscos e pontos técnicos

### 4.1 Regiões fixas no Pacific

`heightfield.ts` tem `VILLAGE` e `AIRBASE` como constantes. `places.ts` tem `PACIFIC_PLACES` escrito na mão. `chunk.ts` e `CityHlod.ts` chamam `isInsideAirbase` diretamente. O Metropolitan precisa de uma definição de mapa, não de mais constantes.

**Recomendação:** máscara de zoneamento PNG baked a partir do Blender, com canais por região, substituindo os círculos e as constantes. Ela também define densidade, faixa de altura, platôs e slots de ads.

### 4.2 Voo e prédios altos

Constantes atuais em `constants.ts`: `SAFE_AGL = 110`, `CAUTION_AGL = 160`, `CRITICAL_AGL = 36`, `AUTO_PULL = 2,4`, `MIN_AGL = 18`.

Com a decisão Q2, os avisos medem só o terreno. O protótipo de voo (Q18) precisa confirmar:
- O auto pull ignora as torres e respeita só o terreno.
- O alerta de proximidade de torre é claro sem travar o jogador.

**Ação:** protótipo de voo entre torres de 200 m e 450 m antes de povoar a cidade.

### 4.3 Heightmap, platôs e tamanho do mundo

- **Decidido:** 2049² para o mundo de 58 km de diâmetro, com cerca de 28,3 m por célula.
- Asset binário separado, carregado como recurso. Nunca embutido no TS.
- Platôs planos por região, com transição de cerca de 200 m, pintados no heightmap.
- Análogo ao `flatten_airbase_pad.py` já usado no Pacific.

### 4.4 HLOD e truncamento por ordem de iteração

Em `CityHlod.update`, o laço percorre `j` crescente e `i` crescente, com `n < MAX` (96). Em uma cidade densa, o limite é atingido na metade das linhas e a silhueta some de forma assimétrica. O mesmo padrão existe em `gatherBuildings`, com `MAX_CITY = 220`.

**Ação:** antes de povoar a cidade, trocar o corte por ordem fixa por um corte por distância ou amostragem espaçada, e revisar `MAX` contra o orçamento de draw calls.

### 4.5 Borda circular e nuvens

- O Pacific já não tem wrap: `sampleMeters` devolve oceano fora do quadrado. Nada no mundo usa `wrapXZ`, e o `wrap` que sobra em `vec3.ts` é para ângulos.
- A borda circular precisa de geometria de nuvem em faixa, sem colisão.
- O aviso começa a 2 km da borda (Q26).
- O círculo de raio 29 km cobre o quadrado de 40 km inteiro, então nenhuma região é cortada.

### 4.6 Publicidade e instancing

- Um material por marca gera um draw call por marca e quebra o instancing.
- **Recomendação:** atlas de anúncios com offset de UV por instância, ou um número fixo de slots por tipo de superfície.
- Naming rights do estádio e painéis de Downtown entram na mesma tabela de slots, com campo `premium`.

### 4.7 Orçamento de draw calls

`migracao-threejs-v1.md` fixa 120 draw calls no cruzeiro (ideal 80). Downtown com 25–35 torres, 5 ícones GLB, estádio, aeroporto e ads passa desse teto sem plano.

**Decidido:** orçamento por região dentro do teto global, com a soma nunca passando de 430 instâncias na janela de streaming (Q14). O teto de draw calls continua sendo o de `migracao-threejs-v1.md`.

### 4.8 Setores 4 × 4 km

Os setores são unidade técnica de streaming e de relatório, não de entrega. A entrega é por região (Q9).

---

## 5. Pendências (ainda não decididas)

| Item | Próximo passo |
| --- | --- |
| Contrato de mapa (`MapDefinition`): heightmap, lugares, spawn, vila | Passo 1 feito: tipo em `world/mapDefinition.ts`, dados em `world/pacificMap.ts`. Faltam: `airbase`, máscara, slots e pontes, que entram com cada região. Funções de terreno ainda leem o mapa ativo fixo, não um parâmetro |
| Máscara de zoneamento | Primeira passada gerada por `tools/metropolitan/build-terrain.mjs`. Falta refinar contornos e canais a partir da imagem de layout (§0.2) |
| Ocupação (§0.1) | Decidido: percentuais sobre o quadrado de 40 km. As regiões crescem até 80% de terra (primeira passada: urbano 38,2%, verde 13,9%, industrial e portuário 16,8%, aeroporto 11,1%). A conta com o quadrado inscrito no círculo (máximo 2/π) foi descartada. Revisar a forma quadrada no blockout |
| Contrato das 3 pontes: comprimento, altura, largura | Definir no blockout, região por região |
| Footprint do estádio (V1) e do porto (V1) | Definir no blockout de Coastal e Harbor |
| Layout das 2 pistas de 3.000 m | Parametrizar `airbaseLayout` ou criar layout próprio |
| Tabela de slots de publicidade | Tipo, superfície e campo `premium` |
| Orçamento por região medido | Medir no blockout de cada região |
| Aviso de borda e nuvens em faixa | Definir geometria e curva de intensidade |

---

## 6. Ordem de trabalho

1. **Contrato de mapa (`MapDefinition`).** Separar as constantes do Pacific. Pacific sem regressão. **Feito:** 88 testes passam (84 antigos e 4 novos em `pacificMap.test.ts`), typecheck de `game-core` e `game-render` limpo.
2. **Heightmap 2049² e máscara de zoneamento.** Pintar as 8 regiões no quadrado de 40 × 40 km, com platôs e borda circular de 29 km. **Primeira passada feita (quadrado de 40 km, círculo de 29 km, 80% de terra por crescimento das regiões):** `tools/metropolitan/build-terrain.mjs` gera `heightmap_2049.u16.gz`, `zoning_2049.u8.gz`, `metropolitan_terrain.json` e `zoning_preview.png` a partir de `zoning_polygons.json` (polígonos em pixel da imagem de layout). Platôs planos por região e transição de 200 m. Testes em `metropolitanTerrain.test.ts` (7 passam). Harbor está só na imagem de layout; as fotos de referência não trazem o porto. Os polígonos são aproximados, sem canais nem contorno fino de ilha, para refinar depois.
3. **Protótipo de voo** entre torres de 200 e 450 m. Critério Q18. **Feito e aprovado em voo:** teste 0 (chão plano pintado por área) e teste 1 (terreno real 2049² carregado no navegador, malha 513² com cor por área) em `MetropolitanTestWorld`, mapa "Metropolitan (em construção)", só voo livre.
4. **Região 1: Downtown.** Blockout, validação de skyline e voo. Silhueta legível a 3,6 km. **Blockout feito (segunda passada, mais densa e espalhada após o primeiro voo):** `world/metroDowntown.ts` gera 400 volumes determinísticos num raio de 2,8 km a partir de (-400, -5000): 5 ícones de 260–450 m em volta do cruzamento das avenidas principais (150 m de largura), 50 torres de 80–199 m espalhadas entre 0,4 e 1,5 km do centro, 200 prédios médios de 30–78 m e 145 baixos de 18–40 m. Ruas de 70 m, praças vazias, um prédio por quadra. Desenhados em um único `InstancedMesh` com colisão suave. Testes em `metroDowntown.test.ts`. Falta validar a silhueta a 3,6 km em voo. **Atenção:** 400 instâncias só na Downtown quase esgotam o teto de 430 na janela de streaming (Q14). Com instancing, o custo é de uma chamada de desenho; rever o teto antes de povoar as regiões vizinhas.
5. **Região 2: Airport.** Pistas de 3.000 m, terminal e torre. Base de partida da V1. **Blockout iniciado (primeira passada):** `world/metroAirport.ts` monta, sem aleatoriedade, 2 pistas paralelas de 3.000 × 60 m no eixo z, separadas 1,6 km, centradas em (-859, -13266) no platô de 9 m. Uma taxiway paralela por pista, ligações, pátio de 1.040 × 1.800 m, terminal de 1.000 m, torre de controle de 82 m, 3 hangares ao norte e 2 galpões de manutenção ao sul. Marcações de eixo e cabeceira. Partida em cruzeiro a 2.200 m no prolongamento da pista oeste, 4 km antes da cabeceira, nariz na pista e na Downtown (Q15). Testes em `metroAirport.test.ts`.
6. **Região 3: Harbor.** Porto (POI da V1) e saída do CheckPoint.
7. **Região 4: Coastal.** Estádio (POI da V1) e chegada do CheckPoint.
8. **Pontes e CheckPoint.** Portais das 3 pontes, 12 portais no total.
9. **Regiões 5 a 8:** Financial, Residential, Industrial, Green Zone.
10. **Slots de ads** (preparo técnico, Q4).
11. **Tráfego aéreo** em silhuetas distantes (Q21).
12. **Orçamento por região** medido e fechado.

Cada região tem entrega própria e teste antes da próxima.

---

## 7. Fora da V1

- Missões Attack, interceptação e corridas.
- Dirigíveis e faixas aéreas.
- Marina, centro de convenções, usina e torre de comunicação.
- Ciclo de dia e noite, chuva e neblina.
- Ativação de venda de anúncios.
- Detalhamento de fachadas em 4K.

---

## 8. Critérios para considerar cada região aprovada

- Escala de voo validada: o jato atravessa a região sem aviso de altitude indevido.
- Silhueta legível a 3,6 km, sem corte assimétrico do HLOD.
- Platô da região plano, sem prédio em encosta.
- Orçamento de draw calls e instâncias da região dentro do teto (§4.7).
- Máscara de zoneamento consistente com a imagem de referência.
- Nenhuma costura nem corte visível na borda circular.

---

## 9. Histórico

| Data | Evento |
| --- | --- |
| 2026-11-26 | Parecer inicial sobre a proposta do Mapa 02. Colisão suave, margem de oceano, imagem como fonte de layout e heightmap 1025² registrados. |
| 2026-11-26 | Passo 5 iniciado: blockout do aeroporto (2 pistas de 3.000 m, terminal, torre, hangares) e partida alinhada com a pista oeste. |
| 2026-11-26 | Passo 4, segunda passada: Downtown mais densa e espalhada (400 volumes, raio 2,8 km) e 55 arranha-céus, a pedido após o primeiro voo. |
| 2026-11-26 | Passo 4, primeira passada: blockout da Downtown (235 volumes, 5 ícones) no mundo de teste, sobre o terreno real. |
| 2026-11-26 | Passo 3 aprovado em voo: torres de 200 e 450 m sem aviso indevido nem colisão inesperada. Terreno real carregado no teste 1. |
| 2026-11-26 | Passo 2, primeira passada: heightmap 2049² e máscara de zoneamento gerados por `tools/metropolitan/build-terrain.mjs`. Ocupação decidida sobre o quadrado de 40 km, círculo ampliado para 29 km (Q27 ajustado). |
| 2026-11-26 | Passo 1 do trabalho: contrato `MapDefinition` criado. Dados do Pacific movidos para `world/pacificMap.ts`, sem mudança de valor. Doc corrigido: o Pacific já não tem wrap. |
| 2026-11-26 | Rodada de grilling (Q1 a Q27). Mundo mudou para 4× em área, depois para círculo de raio 23 km. Heightmap 2049². Wrap desligado. Ordem de regiões, CheckPoint de 12 portais, luz travada e escopo da V1 fechados. |
