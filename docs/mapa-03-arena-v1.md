# Mapa 03 — Arena (céu, nuvens e mar) v1

**Status:** implementado (céu, mar animado, deck de nuvens, escolha de mapa na pré-partida)
**Data:** 2026-11-26
**Escopo:** mapa de combate de alto nível. Fundo de céu, nuvens e mar, com animação de água perceptível e custo estável quando há vários jatos, mísseis, flares e fumaça na tela. O Pacífico continua o mundo de passeio e missão. O Metropolitan continua o mundo de exploração.
**Documentos irmãos:**

| Doc | Domínio |
| --- | --- |
| [`mapa-02-metropolitan-v1.md`](mapa-02-metropolitan-v1.md) | Mapa denso de cidade. Orçamento oposto a este. |
| [`migracao-threejs-v1.md`](migracao-threejs-v1.md) | Teto de frame e draw calls. Em conflito de performance, vale aquele arquivo. |
| [`decisao-vfx-misseis-v1.md`](decisao-vfx-misseis-v1.md) | VFX de combate que este mapa precisa deixar respirar. |

Em conflito de layout do Pacífico ou do Metropolitan → o doc daquele mapa.
Em conflito de forma, custo e regras deste arena → **este arquivo**.

---

## 0. Decisões já tomadas

| Tema | Decisão | Consequência |
| --- | --- | --- |
| Identidade | Céu + nuvens + mar. Fundo calmo para o jato ler. | Sem terreno, prédio, vegetação, cidade, base, torre, tráfego aéreo ou silhueta de horizonte. |
| Autoração | Perfil de mundo no runtime. Sem `.blend`, sem heightmap, sem chunk. | O mapa é código em `game-render` + regras em `game-core`. |
| Mar | O plano atual (2 triângulos, 1 draw call), com movimento no fragment shader. | Sem grade subdividida, sem deslocamento de vértice, sem FFT, sem projected grid. |
| Nuvens | Cenário. Um deck alto e fino, acima da faixa de engajamento. | Nuvem não é cobertura e não altera o resultado do tiro. |
| Céu | `SkySystem` reutilizado, com iluminação travada num preset único da partida. | O ciclo dia/noite deixa de ser variável de contraste neste mapa. |
| Chão de gameplay | Plano em `WATER_LEVEL` (`y = 0`) em todo lugar. | Colisão, sombra do jato e impacto na água ficam determinísticos. |
| Rede | O mundo não tem estado para sincronizar. | O servidor, quando existir, sincroniza aviões e armas. Céu, mar e nuvem são cosméticos. |
| Pacífico | Permanece montado por `WorldSystem` como está. | Este mapa é um segundo perfil, não um modo que desliga peças do Pacífico por flag solta. |

---

## 1. Entendimento do briefing

O arena serve combate de alto nível e, no horizonte, multiplayer. A prioridade visual é o jato: silhueta, afterburner, míssil, flare e fumaça. O fundo existe para dar escala, horizonte e sensação de voo, e para ficar fora do caminho.

O mar precisa se mover. O movimento tem de ser óbvio o bastante para a água não parecer um adesivo, e barato o bastante para não disputar GPU com o combate. Em velocidade de jato (`BASE_SPEED = 310` m/s, pós-combustão perto de `310 × 2.35`) o que se lê de algumas centenas de metros até o horizonte é ondulação larga e o brilho do sol. Onda geométrica pequena some.

Nuvens entram como teto e profundidade. Elas ficam fora da faixa em que dois jatos se olham, para um cliente nunca esconder um alvo que o outro está vendo.

---

## 2. Parecer

O mapa é mais barato que o Pacífico e que o Metropolitan. O custo do mundo atual está no streaming de terreno de 16 km, nos prédios, na vegetação, na cidade, na base e no tráfego. Céu, nuvens e mar já existem como sistemas separados, e o mar já é o caso mínimo: um plano que segue a câmera.

O trabalho real é três coisas:

1. Um perfil de mundo que monta só céu, mar e um deck reduzido de nuvens, com chão plano.
2. Animação do mar no shader que já existe, usando o `dt` e a direção do sol que o `update` já recebe e hoje ignora.
3. Regras de arena (spawn no ar, limite de jogo, radar só de combate, luz travada) para o fundo não virar variável de balanceamento.

Nada disso pede asset novo do Blender nem streaming.

---

## 3. Onde o plano encontra o código

### 3.1 O que já existe e entra neste mapa

| Peça | Onde | O que aproveitar |
| --- | --- | --- |
| Céu | `packages/game-render/src/world/SkySystem.ts` | Cúpula HDR (dia `kloofendal_43d_clear_puresky`, noite `qwantani_night_puresky`, em `apps/web/public/sky/`), sol, hemisfério, haze. Esfera de raio 9000, 128×64, 1 draw call, segue a câmera. |
| Mar | `packages/game-render/src/world/WaterSurface.ts` | Plano de meio-lado 12 km (`PLANE_HALF`), textura 512 gerada uma vez, UVs no espaço do mundo, fade circular (`HORIZON_NEAR` / `HORIZON_FAR`, e o disco cresce com a altitude). Shader `AFD_Ocean_cyan_disk_v6`. O fragmento diz explicitamente que não há animação no tempo. |
| Nuvens | `packages/game-render/src/world/CloudField.ts` | 72 massas, cartões cruzados, deriva, reciclagem em anéis de 700 m a 7200 m. Camadas baixa (380–720 m), média (820–1600 m) e alta (2100–3400 m). Densidade muda com `DayPhase`. |
| Relógio | `packages/game-core/src/world/dayClock.ts` | `dayFactor`, `duskFactor`, `dawnFactor`, `sunDir`. No arena o relógio fica parado num preset. |
| Renderer de voo | `packages/game-render/src/FlightScene.ts` | `antialias: false`, `pixelRatio` 1, `powerPreference: "high-performance"`. Já é o perfil de combate. |
| Constantes | `packages/game-core/src/constants.ts` | `WATER_LEVEL = 0`, `CRUISE_ALT = 2200`, `MAX_ALT = 12000`, `WORLD_SIZE = 16000`. |
| Sombra do jato | `FlightScene` + `JetShadow.ts` | Plano no chão. Com `y = 0` em todo lugar, a sombra continua válida sem amostrar heightmap. |
| Impacto na água | `FlightScene` (`boom_water` quando `y` está perto de `WATER_LEVEL`) | Continua válido. O mar infinito é a única superfície. |

### 3.2 O que o Pacífico monta e este mapa deixa de montar

`WorldSystem` (`packages/game-render/src/world/WorldSystem.ts`) hoje adiciona, além de céu, nuvens e água:

| Peça | Por que sai |
| --- | --- |
| `TerrainStreamer` | Heightmap, chunks, worker, cache IndexedDB. É o grosso do custo e do estado. |
| `BuildingField`, `CityHlod`, `VegetationField` | Densidade visual e draw calls de cenário. |
| `HorizonSilhouette` | Existe para tampar buraco de streaming. Sem terreno, não há buraco. |
| `AirbaseComplex`, `ControlTower` | Geolocalizados no Pacífico. Não há pista neste mapa. |
| `AirTraffic` | Alvos falsos no radar e na vista. Distração direta. |
| `buildPlaces` / `nearestPlace` | POIs de turismo. O arena não anuncia lugar. |

`FlightScene` instancia `new WorldSystem(scene)` sem escolha de mapa, amostra `sampleHeight` para o spawn e usa `world.sampleFloor` no voo. O arena precisa de um ponto de entrada próprio aí, não de `if` espalhado dentro do streamer.

### 3.3 O que o código ainda não tem

- Tipo de mapa ou perfil de mundo. `PlayMode` (`packages/shared-types/src/index.ts`) cobre modo de jogo (`FREE_FLIGHT`, `CHECKPOINT`, `ANTI_DRONE`, `ATTACK`, `TARGET_PRACTICE`), não qual terreno montar.
- Uniform de tempo no mar.
- Deck de nuvens com altitude e contagem próprias.
- Limite de arena como regra de jogo.
- Netcode. O lobby TvT ainda é stub (`migracao-threejs-v1.md`). Este mapa é desenhado para esse netcode chegar sem arrastar mundo junto.

---

## 4. Arquitetura

Um segundo mundo, irmão de `WorldSystem`, com a mesma ideia de `warm` / `update` / `dispose` / `sampleFloor`, montando só o que a seção 3.1 lista.

Nome de trabalho: `ArenaWorld`, em `packages/game-render/src/world/ArenaWorld.ts`.

Responsabilidade:

- Construir `SkySystem`, `WaterSurface` e um `CloudField` (ou um deck derivado) e colocá-los na cena.
- `sampleFloor` devolve `WATER_LEVEL` para qualquer `(x, z)`.
- `update` avança o preset de luz (fixo), o mar e as nuvens. Não há streaming, POI nem contato de tráfego.
- `warm` só espera o HDR do céu e semeia as nuvens. Sem worker de chunk e sem IndexedDB.

`FlightScene` escolhe o mundo na criação, a partir de um id de mapa na sessão. O primeiro uso pode ser um free flight neste arena, para validar sensação e frame, antes de qualquer modo ranqueado.

O Pacífico não ganha ramos `if (arena)` dentro de `TerrainStreamer`, `heightfield` ou `chunk`. Os dois mundos compartilham as classes de céu, mar e nuvem. Não compartilham a lista do que existe na cena.

---

## 5. Céu

Reusar `SkySystem` sem material novo.

**Preset travado, proposta:** dia claro e alto. `dayFactor` no topo da rampa em que o shader já entrega o HDR de dia (acima de ~0.58), `duskFactor = 0`, `dawnFactor = 0`. Haze de dia (`0x9eb4cc`). Sol alto o bastante para o brilho na água cair numa faixa legível, não num disco branco no horizonte.

Motivo: silhueta do jato estável para todos os clientes, e o especular do mar tem uma direção de sol constante. Entardecer dourado fica como alternativa de arte se o dia claro parecer clínico demais. Os dois são o mesmo código: um relógio que não dá `tick`. A escolha é um número, não um sistema.

A cúpula continua seguindo a câmera (`dome.position` em `SkySystem.update`). O jogador nunca alcança a borda do céu.

Fora deste mapa: crossfade dia/noite, alvorada e anoitecer como evento de partida. O relógio do Pacífico permanece para o Pacífico.

---

## 6. Mar

### 6.1 Geometria

Permanece o que `WaterSurface` já faz:

- `PlaneGeometry` de 24 km com 1×1 segmento. Dois triângulos, um draw call.
- O plano é recentrado em `(wx, WATER_LEVEL + 0.6, wz)` todo frame. Visualmente infinito.
- Fade circular no fragmento, com `uFadeNear` / `uFadeFar` crescendo com a altitude, para o quadrado do plano nunca aparecer. Esse fade fica.

A textura ciano de 512 (vale, meio, crista) continua sendo a cor de base. A animação não troca a paleta.

### 6.2 Movimento

Tudo no fragment shader, dirigido por um `uTime` acumulado com o `dt` que `update` já recebe.

Duas camadas, em espaço de mundo (as UVs já são `vWorldXZ`, então o scroll não anda com a câmera):

| Camada | Comprimento | Papel |
| --- | --- | --- |
| Swell | 40–80 m | Ondulação larga. É o movimento que se percebe em câmera externa e no horizonte. Período visual lento, na casa de 8–14 s. |
| Chop | 8–16 m | Tremor curto. Vira cintilação quando o jato está rápido. Some com a distância junto com o fade, para não aliasar no horizonte. |

A normal sai de duas senoides analíticas (derivada no próprio shader). Sem normal map extra. A direção do sol, hoje argumento ignorado de `WaterSurface.update`, entra no especular: faixa estreita na direção do sol, crista mais clara, vale um pouco mais fundo na cor que já existe. Fresnel leve no rasante, para o horizonte do mar encontrar o haze do céu em vez de cortar numa linha dura.

O avião a 300–700 m/s não precisa de onda que suba e desça o mesh. Abaixo de cerca de 80 m de altura uma onda geométrica seria visível, e esse mapa não otimiza o rasante: otimiza o combate. Se no teste o mar parado-demais incomodar só no cockpit colado na água, o ajuste é amplitude do especular e velocidade do swell, não tessellation.

### 6.3 Custo esperado

O shader passa de uma amostra de textura para uma amostra mais um punhado de senos e um especular. O draw call continua 1. Não há readback, não há CPU de física de água, não há malha que cresce com a área.

Parâmetros (`uTime` escala, amplitude do especular, comprimentos) ficam em uniformes nomeados no topo de `WaterSurface`, para afinar em voo sem reescrever o material.

### 6.4 O que este mar não faz

- Grade projetada na câmera, Tessendorf/FFT, simulação de Gerstner em vértice.
- Espuma de quebra, esteira do jato na água, reflexão do céu em planar reflection. Reflexão de céu é um segundo render da cena. Neste mapa o céu já está no fundo; o custo não se paga.
- Transparência com fundo do mar. O plano continua opaco perto do jato, como hoje, e só dissolve no horizonte.

---

## 7. Nuvens

### 7.1 Papel

Profundidade e teto. Olhando para cima, há tempo. Olhando para um jato na mesma altitude, há céu ou mar.

A faixa de engajamento deste mapa é cerca de **400 m a 4000 m**. Cruzeiro do jogo é 2200 m. As camadas atuais (baixa, média e alta até ~3400 m) atravessam exatamente essa faixa. Por isso o arena não reusa a distribuição do Pacífico.

**Deck único, proposta:**

| Parâmetro | Valor de partida |
| --- | --- |
| Base | 5500 m |
| Topo | cerca de 7000 m |
| Massas | 24 (hoje são 72) |
| Cartões | os cruzados que já existem, com menos puffs por massa nas camadas que o Pacífico chama de alta |
| Vento | uma direção fixa, mesma para todas as massas |
| Densidade | constante. `cloudDensityForPhase` não dirige este deck |
| Semente | fixa por partida, para o céu não parecer outro jogo a cada entrada |

24 massas ainda derivam e reciclam no anel, no mesmo esquema de `CloudField` (sair do raio e renascer à frente). O bob de poucos metros pode ficar. Ele não muda o gameplay.

### 7.2 Por que não são cobertura

Cada cliente move as próprias massas. Não há autoridade de nuvem. Se a nuvem pudesse ocultar um jato, dois clientes discordariam do que está visível, e o mapa estaria errado para combate sério.

Regras de implementação:

- O deck fica inteiro acima de 5500 m. Um jato em cruzeiro olha o inimigo contra céu ou mar.
- Alpha e densidade nascem baixos o bastante para, mesmo olhando para cima através do deck, um jato no meio das nuvens continuar legível. O teste da seção 11 cobre isso.
- Nuvem não escreve depth (`depthWrite: false` já é o caso) e não entra em query de visão, radar ou lock.

Sincronizar nuvem pela rede, ou torná-la obstáculo autoritativo, fica fora desta versão. O custo de design é maior que o ganho de cenário.

### 7.3 Custo

Hoje cada massa é um grupo de meshes (cerca de 4 a 6 puffs, 2 cartões cada). 72 massas dão na ordem de várias centenas de quads transparentes, e transparência empilhada é fill-rate. 24 massas num deck só, com menos puffs, deixam a maior parte do orçamento de draw call para jatos e VFX.

`migracao-threejs-v1.md` fixa 120 draw calls no cruzeiro, ideal 80. Este mapa, vazio de aviões, deve ficar folgadamente abaixo do ideal, porque o cenário é: 1 céu + 1 mar + as massas de nuvem. O que enche o frame numa luta é míssil, fumaça, flare e debris, não o mundo.

Se 24 massas ainda pesarem com vários aviões, o corte é contagem e tamanho, não um sistema novo de volume.

---

## 8. Gameplay e multiplayer

### 8.1 Espaço

O oceano visual não tem borda. O espaço de jogo tem.

**Proposta de limite:** caixa suave de **32 × 32 km**, centrada na origem, maior que o `WORLD_SIZE` de 16 km do Pacífico. A 310 m/s, 16 km de ponta a ponta duram cerca de 50 s. Para combate de alto nível isso aperta demais. 32 km dá margem sem pedir streaming.

O limite é regra, não mesh:

- Dentro da caixa, voo livre.
- Na borda, aviso e força que devolve o jato para dentro (o mesmo espírito do teto em `MAX_ALT`, que já segura em 12000 m).
- Abaixo de `WATER_LEVEL`, o contato com a água continua sendo o que o voo já faz hoje ao cruzar o mar. Não há ilha para pousar.

Spawn no ar, na altitude de cruzeiro (2200 m), dentro da caixa. Para o teste solo, um ponto. Para a partida futura, dois lados opostos, mesma altitude, narizes apontados para o centro. Sem pista e sem porta-aviões nesta versão.

### 8.2 Colisão e queries

`sampleFloor(x, z) = 0`. Quem hoje chama `sampleHeight`, `solidFloor` ou o heightfield do Pacífico no caminho do arena passa a usar o chão do mundo ativo. Isso inclui spawn, sombra, escolha `boom` / `boom_water`, e qualquer AGL.

AGL neste mapa é a própria altitude, porque o chão é zero. `SAFE_AGL`, `CRITICAL_AGL` e `AUTO_PULL` continuam fazendo sentido: avisam o mar, que é a única coisa em que se pode bater.

### 8.3 Radar e leitura

Contatos de radar neste mapa são só o que a luta produz: outros jatos, mísseis, o que o modo de jogo já marcar. Sem POI, sem tráfego civil, sem instalação desenhada no relevo. O Pacífico pode manter o radar de turismo.

### 8.4 O que a rede carrega

Quando o multiplayer existir, o estado replicado deste mapa é o dos aviões e das armas. Não há chunk, altura variável, prédio destrutível nem objeto de cenário com vida.

Consequência prática para o cliente:

- Céu e mar podem ser puramente locais. Com o preset de luz fixo e o shader em função de `uTime` local, a diferença entre clientes é invisível no resultado do tiro.
- Nuvens locais estão autorizadas porque a seção 7 as tira da faixa de engajamento e as impede de cobrir alvo.
- O limite de 32 km e o spawn são dados de partida, iguais para todos, conhecidos antes do primeiro tick.

Este mapa é o primeiro candidato de combate em rede exatamente por essa lista ser curta.

---

## 9. Fora desta versão

- Porta-aviões, plataforma, boia, ilha baixa "para referência". Qualquer volume no mar vira distração, colisão e estado.
- Clima dinâmico, frente de nuvem, tempestade, neblina competitiva.
- Reflexão planar, espuma, esteira na água, cáustica.
- Ciclo de hora como parte da partida.
- Reusar o heightmap do Pacífico com tudo achatado em zero. Isso ainda pagaria streaming para desenhar um plano.
- Modo ranqueado, lobby e netcode em si. Este doc deixa o mapa pronto para eles. Não os implementa.

---

## 10. Fases

Cada fase é jogável. A seguinte não começa para compensar a anterior.

### Fase A — Mundo vazio no ar

`ArenaWorld` montado pela `FlightScene` num free flight de teste. Céu, mar parado (o shader atual) e o deck de nuvens já na altitude da seção 7, ainda com o visual de cartão que existe. Spawn a 2200 m. Chão em 0. Sem terreno e sem radar de POI.

Pronto quando: dá para decolar mentalmente já no ar, voar vários minutos, e o frame no cruzeiro fica abaixo do teto da migração com um jato só.

### Fase B — Mar em movimento

`uTime`, duas camadas, normal analítica, especular do sol, fade circular intacto. Afinar comprimento e velocidade em câmera chase, traseira e cockpit, em altitude baixa (~200 m), cruzeiro (2200 m) e alta (~6000 m, já dentro do deck).

Pronto quando: o mar se mexe de forma óbvia no chase a 2200 m, o horizonte não aliasa, e o custo do mar continua 1 draw call.

### Fase C — Leitura de combate

Preset de luz travado. Nuvens na contagem e no alpha finais. Dois jatos locais (ou o jato e um alvo de missão já existente) se cruzam entre 800 m e 3000 m com mísseis e flares. Nenhum dos dois some atrás de nuvem. A sombra no mar e o `boom_water` continuam corretos.

Pronto quando: um observador de fora aponta o jato inimigo mais rápido do que aponta qualquer elemento do fundo.

### Fase D — Regra de arena

Caixa de 32 km com aviso de borda. Spawn nomeado (solo agora, dois lados preparados na constante). Radar filtrado. Id de mapa na sessão, para o Pacífico e o arena coexistirem sem troca manual de código.

Pronto quando: sair da caixa traz o jato de volta, e trocar o id de mapa monta o outro mundo sem resquício (sem chunk do Pacífico aparecendo no mar, sem mar do arena no meio da ilha).

---

## 11. Critérios de aceite

- Cena do arena, sem aviões extras: céu 1 draw, mar 1 draw, nuvens na contagem da seção 7. Frame de cruzeiro dentro do teto de `migracao-threejs-v1.md`, com folga para VFX.
- Mar animado perceptível em chase a 2200 m e no cockpit. Sem quad visível nas bordas em nenhuma altitude até `MAX_ALT`.
- Dois jatos entre 400 m e 4000 m permanecem legíveis um para o outro com o deck no topo. Lock, flare e explosão não dependem de amostrar terreno.
- `sampleFloor` do arena é 0 em pontos dentro e fora da caixa de 32 km.
- Pacífico: subir o mapa antigo ainda mostra terreno, base, cidade e tráfego. Nenhuma regressão exigida como parte de "desligar o mundo".
- Nenhum asset novo de malha. Nenhum heightmap. Nenhuma dependência de biblioteca de oceano.

---

## 12. Decisões em aberto

Estas não bloqueiam a Fase A. Precisam de resposta antes da Fase C ou D, conforme a linha.

| Decisão | Proposta deste doc | Quando trava |
| --- | --- | --- |
| Preset de luz | Dia claro, sol alto, sem entardecer | Fase C. Trocar para fim de tarde é só outro trio `(day, dusk, dawn)`. |
| Tamanho da caixa | 32 × 32 km, suave | Fase D. 16 km é opção se o modo for só dogfight curto. |
| Altitude do deck | 5500–7000 m, 24 massas | Fase A já usa o número. Ajuste fino na Fase C se o teto parecer perto ou longe demais. |
| Id do mapa na sessão | Campo novo ao lado de `PlayMode`, não um `PlayMode` extra | Fase D. `PlayMode` continua sendo o tipo da partida (livre, ataque, treino). O arena pode hospedar mais de um modo. |
| Nome de produto | "Arena" neste doc | Quando houver tela de seleção. O nome técnico do mundo pode ficar `ArenaWorld` independente do nome na UI. |
