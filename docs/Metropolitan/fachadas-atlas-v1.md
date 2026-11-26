# Fachadas — atlas, variação por instância e janelas em metros (v1)

**Status:** contrato aceito, não implementado
**Data:** 2026-11-26
**Escopo:** trocar a cor chapada dos prédios de fundo por fachadas texturizadas, mantendo a forma geométrica simples e o instancing
**Documentos irmãos:**

| Doc | Domínio |
| --- | --- |
| [`cidade-cityjson-atlas-v1.md`](cidade-cityjson-atlas-v1.md) | Tipos de prédio offline, `BuildingField`, orçamento de tipos e triângulos |
| [`destruicao-predios-v1.md`](destruicao-predios-v1.md) | Colapso local do alvo Attack (esta fatia altera a §4 e a §5.1 dele, ver §9) |
| [`migracao-threejs-v1.md`](migracao-threejs-v1.md) | Budgets de frame, draw calls, memória de textura |
| [`mapa-02-metropolitan-v1.md`](mapa-02-metropolitan-v1.md) | Layout, slots de publicidade e orçamento por região do Metropolitan |

Em conflito de textura, atlas e UV de fachada → **este arquivo**.
Em conflito de orçamento de frame → `migracao-threejs-v1.md`.
Em conflito de forma do prédio e tipos → `cidade-cityjson-atlas-v1.md`.

---

## 0. Decisões

| Tema | Decisão |
| --- | --- |
| Forma | Continua `BoxGeometry(1,1,1)` escalada por instância. Nada de malha por prédio. |
| Material base | `MeshLambertMaterial` com `map`. Sem PBR (`MeshStandardMaterial`) nos prédios de fundo. |
| Variação | Um atlas compartilhado, com UV por instância (atributo instanciado). Tint por `instanceColor`, que já existe. |
| Janelas | Grade de janelas **em metros**, não na caixa unitária. Corrige o bug da §2.2. |
| Draw calls | Cidade de fundo em **1 `InstancedMesh`** com 1 material, somando todas as fachadas. Landmarks ficam fora. |
| Destruição | Os 4 estágios continuam com o mesmo `map`, diferenciados por tint. Sem textura nova por estágio. |
| Horizonte | `CityHlod` usa cor média do tile, sem textura. |

---

## 1. Estado atual no repo

| Peça | Onde | Estado |
| --- | --- | --- |
| Caixa de prédio | `packages/game-render/src/world/BuildingField.ts` | 1 `BoxGeometry(1,1,1)` compartilhada, `InstancedMesh` com `MAX = 430`. |
| Cor | `BuildingField.ts` | `MeshLambertMaterial({ color: 0x8a9098 })` + `KIND_COLOR` por `kind` via `setColorAt`. `instanceColor` já ativo. |
| Janelas procedurais | `packages/game-render/src/world/radialHorizon.ts` (`applyBuildingFacade`) | Janelas e telhado calculados no fragment shader, a partir de `vBuildLocal`. Noite via `uDayFactor`. |
| Horizonte | `radialHorizon.ts` | `applyRadialHorizon` e `applyBuildingFacade` fazem fog e discard pela distância. |
| Horizonte distante | `packages/game-render/src/world/CityHlod.ts` | Slabs de cor fixa `0x6a727c`, `MAX = 96`, anel de 1050 a 3600 m. |
| Destruição | `packages/game-render/src/missions/DestructibleField.ts` | 4 `MeshLambertMaterial` com cor fixa por estágio (`0xb0b6be`, `0x9a7a4a`, `0x6a4030`, `0x3a2a22`). Sem textura. |
| Entulho | `DestructibleField.ts` | Pool de `Mesh` com a mesma geometria, sem instancing. |

**O que já funciona:** o shader de fachada já faz janelas e luz noturna sem textura. Isso é ótimo para o custo, e o atlas não precisa substituir essa parte inteira.

---

## 2. Problemas encontrados

### 2.1 Textura compartilhada sem variação

Um atlas só, com o mesmo UV para todas as instâncias, deixa todos os prédios iguais. A variação precisa vir de um atributo por instância.

### 2.2 Janelas na escala errada (bug existente)

`applyBuildingFacade` usa `vBuildLocal = transformed`, que é a coordenada da caixa unitária, antes do `instanceMatrix`. Por isso:

- `uCoord` fica sempre em `[-0.5, 0.5]`, então `bay = fract((uCoord + 0.5) * 5.5)` dá **5,5 janelas por face**, qualquer que seja a largura do prédio.
- `floorY = fract((vCoord + 0.5) * 9.0)` dá **9 andares por altura**, qualquer que seja a altura.

Consequência: um prédio de 40 m tem janelas do mesmo tamanho relativo que um de 300 m. Em torres de 450 m, cada "andar" vira cerca de 50 m. O shader precisa usar coordenadas em metros.

**Correção (F0):** calcular a escala da instância no vertex shader e passar a coordenada em metros:

```glsl
vec3 instScale = vec3(
  length(instanceMatrix[0].xyz),
  length(instanceMatrix[1].xyz),
  length(instanceMatrix[2].xyz)
);
vBuildLocal = transformed * instScale; // metros, centrado na origem
```

Com isso, `bay` e `floorY` passam a usar passos em metros (por exemplo 3,5 m de largura de janela e 3,6 m de andar), e o número de janelas cresce com o tamanho real.

### 2.3 Sem atlas

Não há textura de fachada no projeto. O custo de memória de textura é zero hoje, então qualquer atlas entra no orçamento de `migracao-threejs-v1.md` §1.1 (texturas GPU residentes ≤ 128 MB).

---

## 3. Atlas de fachada

### 3.1 Formato

| Campo | Valor |
| --- | --- |
| Tamanho | **2048 × 2048** |
| Grade | **4 × 4** tiles de **512 × 512** (16 variantes por atlas) |
| Quantidade | **2 atlas** na v1 (32 variantes), ou 1 atlas na F1 |
| Formato de entrega | KTX2 (UASTC ou BC7), com mipmaps. PNG só como fonte de bake. |
| Mipmaps | Obrigatórios. Sem eles, janelas fazem aliasing no horizonte. |
| Anisotropia | 4 a 8 |
| Cor média por tile | Pré-calculada no bake, para o `CityHlod` (§6) |

### 3.2 Tipos de tile

Cada tile é uma fachada completa, sem janela nas faixas que o shader procedural cobrir (ver §4.3). Categorias sugeridas:

| Categoria | Uso | Exemplo |
| --- | --- | --- |
| Vidro (curtain wall) | Torres comerciais, Downtown, Financial | Painel de vidro com montantes |
| Concreto com faixas | Torres residenciais, blocos | Janelas repetidas com faixa horizontal |
| Tijolo ou pedra | Residencial antigo, bairro | Textura de alvenaria |
| Industrial | Galpões, chaminés | Chapa metálica, portas |
| Térreo (shopfront) | Faixa inferior de qualquer prédio | Vitrines, letreiros |
| Painel de anúncio | Slots de ads (ver `mapa-02` §4.6) | Área neutra, sem marca |

A lista final sai do blockout. O alvo é 12 a 16 variantes em uso, dentro do limite de 48 tipos do `cidade-cityjson-atlas-v1.md` §8.

### 3.3 Fonte

- Autoria própria, preferida.
- Fontes de terceiros, só com licença clara. Os pacotes GLB analisados (`low_poly_night_city_building_skyline.glb` e `asian_themed_low_poly_night_city_buildings.glb`, CC-BY-4.0, autor 99.Miles) têm texturas de fachada que podem ser extraídas. Nesse caso, o crédito vai para `assets/city/SOURCES.txt` e para os créditos do jogo.

---

## 4. UV por instância

### 4.1 Atributo

```ts
const rect = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
// rect[i*4 + 0..1] = offset (u, v) do tile no atlas
// rect[i*4 + 2..3] = escala (du, dv) do tile
geometry.setAttribute("aUvRect", rect);
```

O atributo é escrito junto com a matriz em `BuildingField.apply`. O tile é escolhido por `hash(b.id)` e pela categoria do `kind` (e, no futuro, pela região do zoneamento).

### 4.2 Shader

Com `onBeforeCompile`, substituir o `uv` padrão por UV do tile:

```glsl
#ifdef USE_MAP
vMapUv = uv * aUvRect.zw + aUvRect.xy;
#endif
```

Validar na F1 que o `map_fragment` do Lambert usa `vMapUv` e que `mapTransform` continua identidade.

### 4.3 Repetição por tamanho real

O UV do tile precisa repetir de acordo com a área da face em metros. Caso contrário, janelas do atlas esticam em prédios altos.

- Tiles por face = `round(tamanho_da_face_m / tamanho_de_referência_m)`, com referência de 24 m por tile na F1.
- O número de repetições entra no `aUvRect.zw`, e o shader faz `fract` dentro do tile.
- A grade procedural de janelas (§5) é desligada nas faixas que o tile já pinta, por flag no atributo (`aFacadeMask`, 0 ou 1).

### 4.4 Tint e variação

- `instanceColor` já existe. Usar para variação de ±8% em luminância, por hash do `id`.
- `KIND_COLOR` continua como tint base por tipo de bairro.
- Nada de cor nova por instância além disso, para não quebrar o batch.

---

## 5. Janelas procedurais em metros

Depois da correção da §2.2, a grade procedural de `applyBuildingFacade` passa a:

- Usar o passo de janela em metros (3,5 m) e o de andar em metros (3,6 m).
- Calcular o número de janelas por face a partir da largura real da face, com arredondamento para o inteiro mais próximo, para não cortar janela na borda.
- Manter a luz noturna (`uDayFactor`) e a cor fria/quente como estão.
- Manter o telhado como está (`n.y > 0.5`), já que a escala do telhado também é em metros depois da correção.

Essa grade procedural **não precisa** de textura. Ela só custa ALU no fragment shader, e continua sendo a melhor opção para vidro.

---

## 6. Horizonte (`CityHlod`)

- O `CityHlod` não usa atlas. Usa **cor média do tile** por categoria, exportada no bake, para o horizonte bater com as fachadas próximas.
- Mantém `MeshLambertMaterial` com cor fixa e `applyRadialHorizon`.
- Corrige também o truncamento por ordem de iteração (§4.4 de `mapa-02-metropolitan-v1.md`), ao mesmo tempo, porque o contrato de células é o mesmo.

---

## 7. Destruição (`DestructibleField`)

### 7.1 Estágios

Os 4 estágios continuam com **o mesmo atlas**. A diferença vem do tint:

| Estágio | Cor (multiplica o map) |
| --- | --- |
| 0 | `0xb0b6be` |
| 1 | `0x9a7a4a` |
| 2 | `0x6a4030` |
| 3 | `0x3a2a22` |

Isso mantém a regra da `destruicao-predios-v1.md` de não criar textura nova por estágio, e a mudança é só de `map` no mesmo material.

### 7.2 Entulho

Os blocos do pool não são instanciados. Cada peça precisa do próprio `uRect` (tile do prédio de origem). Solução:

- Um `ShaderMaterial` ou `MeshLambertMaterial` clonado por peça, com `customProgramCacheKey` igual, para que o programa seja compartilhado.
- Ou, se o número de clones pesar, migrar o pool para `InstancedMesh` com `aUvRect`.

Escolher na F2 com medição de draw calls.

---

## 8. Orçamento

| Item | Limite | Motivo |
| --- | --- | --- |
| Materiais da cidade de fundo | 1 (`BuildingField`) + 1 (`CityHlod`) | Batch único com UV por instância |
| Draw calls de prédios | **≤ 3** no cruzeiro | Teto de `migracao-threejs-v1.md` §1.1 |
| Memória de textura (atlas) | **≤ 12 MB** em KTX2 com mipmaps, ~43 MB em RGBA descomprimido | Dentro dos 128 MB residentes |
| Instâncias ativas | ≤ 430 (`MAX`) | Mantido |
| Tris por prédio | ≤ 12 (caixa) | Caixa unitária, sem detalhe de malha |
| Custo de fragment | Janela procedural só em faces de vidro | Medir no perf HUD |

Números de textura são estimativas. A F1 precisa medir o tamanho real do KTX2 e o uso de memória no Chrome.

---

## 9. Impacto em outros docs

| Doc | Seção | Mudança necessária |
| --- | --- | --- |
| `destruicao-predios-v1.md` | §4 Orçamento, linha "Materiais" | De "os 4 materiais, sem textura nova" para "os 4 materiais com o mesmo `map` e tint diferente" |
| `destruicao-predios-v1.md` | §5.1 Corpo em pé | Cor por estágio passa a ser tint sobre o atlas |
| `cidade-cityjson-atlas-v1.md` | §7.2 Muda | Cor única vira atlas com UV por instância |
| `migracao-threejs-v1.md` | §1.1 Budgets | Incluir o teto de memória de atlas |
| `mapa-02-metropolitan-v1.md` | §4.6 Ads | Slot de anúncio usa tile da categoria "Painel de anúncio" |

Não atualizar esses docs agora. Atualizar quando a F1 for implementada, para não divergir do código.

---

## 10. Fases

### F0 — Janelas em metros (sem textura)

- Corrigir `vBuildLocal` para coordenadas em metros (§2.2).
- Ajustar passos de janela e de andar (§5).
- **DoD:** prédio de 40 m e prédio de 300 m mostram janelas de tamanho real parecido. Sem regressão de FPS no cruzeiro.

### F1 — Atlas e UV por instância

- Atlas 2048² com 16 tiles, primeira versão com 6 a 8 tiles úteis.
- Atributo `aUvRect` e `onBeforeCompile` de UV (§4).
- Tint por `instanceColor` (§4.4).
- **DoD:** cidade de fundo com fachadas variadas, em 1 draw de prédios. Memória de textura medida dentro de §8.

### F2 — Destruição com o mesmo atlas

- Estágios por tint (§7.1).
- Entulho com `uRect` por peça (§7.2).
- **DoD:** alvo Attack com a mesma fachada da cidade, sem novo draw por estágio.

### F3 — Horizonte

- Cor média por tile no `CityHlod`.
- **DoD:** silhueta distante bate com a cor média das fachadas próximas, sem salto visível na transição de 1050 m.

### F4 — Landmarks e ads

- GLB de landmarks (ver `mapa-02` §6, item 7) com bake pelo pipeline de `cidade-cityjson-atlas-v1.md` §6.
- Slots de ads usando atlas de painel.
- **DoD:** landmarks fora do `BuildingField`, com orçamento próprio por região.

---

## 11. Critérios de aceite

1. Prédios de alturas diferentes mostram janelas de tamanho real parecido, sem número fixo de andares.
2. Dentro de `BuildingField`, todas as fachadas saem em 1 draw.
3. Nenhum `new Mesh` nem `new Material` durante o voo na cidade de fundo.
4. Atlas em KTX2 com mipmaps, dentro do teto de memória de §8.
5. Alvo destruído mantém a fachada do prédio de origem, com tint por estágio.
6. Horizonte sem salto de cor na transição do `CityHlod`.
7. Créditos de qualquer textura de terceiros registrados em `assets/city/SOURCES.txt`.

---

## 12. Perguntas em aberto

- Os 16 tiles de cada atlas saem de autoria própria ou de textura extraída dos pacotes GLB (CC-BY)?
- Janela procedural continua como camada sobre o atlas em todos os tiles de vidro, ou só em tiles marcados?
- Pool de entulho com materiais clonados ou migração para `InstancedMesh`?

---

## 13. Histórico

| Data | Evento |
| --- | --- |
| 2026-11-26 | Contrato inicial. Bug de escala de janela registrado (§2.2). Decisão de manter Lambert e shader procedural de vidro. |
