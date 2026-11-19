# Destruição de prédios — colapso local (v1)

**Status:** aceita, não implementada  
**Data:** 2026-11-19  
**Escopo:** deixar o prédio atingido no modo Attack se partir e cair, sem trocar o render e sem simular a cidade inteira  
**Implementação:** futura. Este documento é o contrato.

---

## 1. Decisão

O prédio **atingido** se parte em poucos blocos que se separam e caem com gravidade simples. O resto da cidade continua no `InstancedMesh` de hoje.

**Não adotar** [`three-voxel-destruction`](https://github.com/sbobyn/three-voxel-destruction) como sistema de destruição do jogo.

| Caminho | Papel |
| --- | --- |
| Colapso local em `DestructibleField` | Escolhido. Visual no alvo do míssil, custo limitado a poucos blocos |
| `three-voxel-destruction` + `three-avbd` | Descartado para o voo. Serve só como referência de leitura (andar que perde apoio, entulho que assenta) |

A biblioteca faz o efeito de Teardown: cada voxel é um corpo rígido na GPU, em WebGPU. A demo de cidade dela já usa cerca de 94 mil voxels num quarteirão. O voo do Air Force Dashi é `WebGLRenderer`. A cidade de fundo é um campo instanciado (`BuildingField`, teto de 430 instâncias). Só até 3 alvos promovidos viram malha local (`DestructibleField`, `MAX_ACTIVE = 3`). Trocar o render e simular voxel em toda a cidade quebra o orçamento e corta quem não tem WebGPU.

---

## 2. O que o jogador deve ver

1. O míssil acerta um alvo do Attack. O prédio da cidade some do instanciado (`BuildingField.hideBuilding`) e aparece uma malha local no mesmo lugar, com a mesma largura, altura, profundidade e yaw.
2. Cada hit que muda `damageState` (0 → 1 → 2) solta **2 a 4** blocos pequenos das beiradas ou do topo. O corpo que fica em pé encolhe na altura, como já faz hoje.
3. O hit que zera o HP parte o que restou. Os blocos se separam, tombam e caem. Em cerca de 2,5 a 4 segundos assentam no chão ou somem. Não há pilha infinita.
4. O jato atravessa o entulho. Míssil novo não colide com bloco caído. O AABB de gameplay encolhe com o HP e, destruído, fica rente ao chão (`hy = 0.01`), como hoje.
5. De longe, o colapso lê como prédio, não como confete. Blocos grandes, poucos, proporcionais à caixa original.

Poeira e flash de explosão **não** entram nesta v1. Quando existirem, saem do míssil (`MissileFx` / a decisão em [`decisao-vfx-misseis-v1.md`](decisao-vfx-misseis-v1.md)), não de um solver de voxel.

---

## 3. O que não muda

- Regras de missão: `hitsToDestroy`, `targetCount`, tempo, vitória. Continuam em `attackLevels.ts` e `AttackCourse.ts`.
- `damageDestructible` continua a dona do HP, de `damageState` (0 | 1 | 2 | 3) e do AABB. O visual só observa esse estado.
- Cidade de fundo: `InstancedMesh` em `BuildingField`. Prédio não promovido não vira malha individual.
- Render: `WebGLRenderer` em `FlightScene.ts`. Sem `WebGPURenderer`, sem `three-avbd`, sem dependência nova.
- Teto de alvos visuais: **3** ao mesmo tempo (`MAX_ACTIVE`).

---

## 4. Orçamento (não negociar na v1)

Estes números existem para a cena de voo não ganhar um segundo mundo físico.

| Limite | Valor | Motivo |
| --- | --- | --- |
| Prédios locais vivos | 3 | Já é o contrato de `DestructibleField` |
| Blocos estruturais por prédio | 8 a 12 | Silhueta de prédio, não voxel grid |
| Blocos de entulho soltos por prédio | até 16, contando os que já caíram | Um colapso inteiro |
| Entulho vivo na cena | **≤ 48** | 3 × 16 |
| Geometria | **1** `BoxGeometry` compartilhada | Escala por bloco |
| Materiais | os 4 `MeshLambertMaterial` já existentes | Cor por estágio, sem textura nova |
| Sombras | desligadas | O campo de prédios também não depende de sombra por bloco |
| Solver | nenhum | Gravidade + amortecimento numérico no tick |
| Colisão entre blocos | nenhuma | Eles não se empurram |
| Colisão com jato, míssil ou tiro | nenhuma | `raycast` vazio; AABB de gameplay não usa o entulho |
| Tempo de queda | 2,5 a 4 s | Depois o bloco assenta (para) ou é devolvido ao pool |
| Draw calls novos | os meshes do pool, não um draw por voxel da cidade | Pool criado uma vez |

Se um bloco a mais deixasse o frame instável, corta-se entulho, não se liga física de voxel.

---

## 5. Modelo visual

### 5.1 Corpo em pé

Enquanto `destroyed === false`, o prédio local é uma pilha de **4 faixas** (o que `DestructibleField` já faz), ocupando `w × h × d` com yaw do alvo.

- `damageState` 0: cor `0xb0b6be`, altura cheia.
- `damageState` 1: cor `0x9a7a4a`, altura ~67% ou o `hScale` já derivado de `hp / maxHp`.
- `damageState` 2: cor `0x6a4030`, altura ~34%.
- A faixa que “some” no encolhimento vira 2–4 blocos de entulho naquele frame, nascendo na borda da faixa que deixou de existir. Não recria a pilha inteira a cada hit.

### 5.2 Colapso

Quando `damageDestructible` retorna `true`:

- A pilha em pé esconde.
- Os blocos que ainda representam o volume restante recebem velocidade para fora e para cima, mais uma velocidade angular leve.
- Gravidade constante em Y (o mesmo “baixo” do mundo: Y negativo em relação ao voo). Valor da ordem de **30 a 40 u/s²**, para a queda ler em escala de prédio (dezenas de metros), não em escala de migalha.
- Amortecimento linear (~0,2 a 0,4 por segundo) para não quicarem para sempre.
- Ao cruzar o chão local (`baseY` do alvo, ou `sampleFloor` se estiver barato no tick), a velocidade zera e o bloco fica parado. Sem bounce em cadeia.
- Depois de assentados, no máximo **6** blocos continuam visíveis no chão, como ruína baixa. O excedente volta ao pool. A ruína não bloqueia voo nem míssil.

### 5.3 Forma dos blocos

Não é um grid uniforme de cubinhos. Cada bloco é a caixa compartilhada com escala própria:

- Lajes: largura ~40–70% de `w` ou `d`, altura ~15–25% de `h`.
- Núcleo: um bloco mais alto no centro, que tomba por último.
- Migalhas: no máximo 4 por colapso, escala mínima ~1,5 m no menor eixo, para não virar ruído.

Origem de cada bloco: dentro do volume do prédio no momento do hit, em espaço local, depois yaw do alvo. Assim o burst sai do prédio, não do centro do mundo.

---

## 6. Simulação do entulho

Estado por bloco, só no render (não entra em `game-core` e não vai para save):

```ts
interface DebrisPiece {
  active: boolean;
  mesh: Mesh;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rx: number; ry: number; rz: number;
  avx: number; avy: number; avz: number;
  age: number;
  settled: boolean;
}
```

Por frame, para cada peça ativa e não assentada:

1. `vy -= gravity * dt`
2. posição += velocidade * dt
3. rotação += velocidade angular * dt
4. se `y` ≤ chão: encostar, zerar velocidades, `settled = true`
5. se `age` > 4 s e ainda não assentou: devolver ao pool (caiu para fora do mundo útil)

`dt` entra limitado (o tick de voo já corta picos). Peça inativa: `visible = false`, fora do grupo ou em Y longe, e não custa tick.

O pool nasce no construtor de `DestructibleField`: 48 meshes, uma geometria, materiais compartilhados. `spawn` de prédio novo não dá `new Mesh` no meio do combate.

---

## 7. Onde mexer quando for implementar

| Arquivo | Mudança |
| --- | --- |
| `packages/game-render/src/missions/DestructibleField.ts` | Pool de entulho, queda, colapso no lugar de só esconder a pilha |
| `packages/game-render/src/FlightScene.ts` | Passar `dt` para o field no tick. Hoje `destructibles.sync(targets)` não anima queda |
| `packages/game-render/src/world/BuildingField.ts` | Sem mudança de contrato. `hideBuilding` já tira o instanciado |
| `packages/game-core/src/missions/DestructibleTarget.ts` | Sem mudança de regra. O visual não recalcula HP |
| `packages/game-core/src/missions/attack.test.ts` | Continua verde. Teste novo só se a lógica de HP mudar — não deve mudar |

Não criar pacote npm. Não criar cena WebGPU paralela.

### 7.1 Ordem sugerida

1. Pool de 48 blocos, invisíveis, geometria única.
2. No destroy, esconder a pilha e soltar 8–12 blocos com velocidade. Sem hit intermediário ainda.
3. No `damageState` 1 e 2, soltar 2–4 blocos da faixa que encolheu.
4. Assentar no `baseY` e limitar a ruína a 6 blocos.
5. Voar o Attack 1 e o Attack 10 (1 alvo e 3 alvos) e olhar o contador de draw do perf HUD. O colapso não pode subir o custo de forma contínua depois que os blocos assentam.

---

## 8. Critério de pronto

- Acertar o alvo mostra bloco saindo do prédio, não só a caixa ficando mais baixa e marrom.
- O último hit derruba o volume. Os blocos caem e param.
- Com 3 alvos promovidos, o quarto prédio da cidade não vira malha local.
- Jato e míssil ignoram o entulho. O alvo destruído não recebe hit novo (`destroyed` e AABB baixo).
- Nenhum `new Mesh` / `new BoxGeometry` no meio do tick de queda.
- `npm run typecheck -w @afd/game-render` e `npm run test -w @afd/game-core` passam.
- A cidade ao redor, o terreno e o céu seguem no mesmo caminho de antes.

---

## 9. Fora desta v1

- Voxel grid, suporte estrutural (“o andar cai se o pilar sair”), corte a laser, entulho que empurra entulho.
- Destruição de prédio que não é alvo de missão.
- Dano no jato por bater em ruína.
- WebGPU, `three-voxel-destruction`, `three-avbd`.
- Poeira procedural. Isso, se vier, segue [`decisao-vfx-misseis-v1.md`](decisao-vfx-misseis-v1.md).

Uma v2 só se a v1 estiver no jogo e ainda parecer pobre **vista do caça**, em velocidade de ataque. Aí se aumenta a silhueta dos poucos blocos. Não se abre a cidade inteira para física.
