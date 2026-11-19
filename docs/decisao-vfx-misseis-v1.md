# Decisão VFX — mísseis e explosões (v1)

**Status:** aceita  
**Data:** 2026-11-19  
**Escopo:** escolher biblioteca de partículas/VFX para melhorar FX de mísseis e explosões no cliente Three.js **e orientar a implementação sob prioridade de alta performance**  
**Princípio:** beleza sem regressão de frame time — alinhado a [`migracao-threejs-v1.md`](migracao-threejs-v1.md) (*Performance > fidelidade*)  
**Código nesta fatia:** ainda não; este doc é a especificação de decisão + regras de implementação

---

## 1. Decisão

**Adotar [`three.quarks`](https://github.com/Alchemist0823/three.quarks) (`npm: three.quarks`) como motor VFX de combate.**

**Não adotar** [`wawa-vfx`](https://github.com/wass08/wawa-vfx) / `wawa-vfx-vanilla` como stack principal de explosões de míssil.

A escolha também é uma escolha de **performance**: Quarks foi preferido pelo `BatchedRenderer`, modelo de pooling/clone de prefabs e teto de qualidade sob caps — não só pela estética dos demos.

| Candidata | Papel |
| --- | --- |
| **three.quarks** | Escolhida — VFX de gameplay (impacto, flash, fumaça, debris, trail de míssil) com batch + caps |
| **wawa-vfx / wawa-vfx-vanilla** | Descartada para este caso — útil como referência leve / protótipos R3F, não como base de combate |

---

## 2. Contexto no Air Force Dashi

### 2.1 Onde os FX vivem hoje

O combate 3D roda em **`@afd/game-render`** com **Three.js vanilla** (não React Three Fiber no loop de voo):

| Peça | Arquivo / papel |
| --- | --- |
| Cena de voo | `packages/game-render/src/FlightScene.ts` — `WebGLRenderer`, tick, combate |
| Visual de míssil | `packages/game-render/src/combat/MissileFx.ts` |
| Simulação de míssil | `MissileSystem` (lógica) + `missileFx.boom(...)` no impacto |

### 2.2 Estado atual do “boom”

`MissileFx.boom` cria uma **esfera `MeshBasicMaterial` laranja** que escala e some em ~0,45s. Trails de voo usam `TrailPool` caseiro.

Isso é suficiente como placeholder, mas **não entrega** explosão de combate AAA: flash, núcleo, fumaça volumétrica suave, estilhaços, shockwave, camadas com tempos diferentes, soft particles contra o terreno, etc.

### 2.3 Objetivo de produto

> Explosões de míssil **muito mais bonitas**, com vários impactos simultâneos (Anti-Drone, Defesa aérea, solo), sem destruir o orçamento de performance browser-first já definido em [`migracao-threejs-v1.md`](migracao-threejs-v1.md).

---

## 3. Candidatas avaliadas

### 3.1 [wawa-vfx](https://github.com/wass08/wawa-vfx) (`wawa-vfx` + `wawa-vfx-vanilla`)

| Aspecto | Avaliação |
| --- | --- |
| **Foco** | VFX “fácil” para Three.js / R3F; nasceu no contexto do curso Wawa Sensei |
| **API** | `VFXParticles` + `VFXEmitter` (store global); burst/`emitAtPos` |
| **Vanilla** | Sim — pacote `wawa-vfx-vanilla` (encaixa no `game-render`) |
| **Render** | Instancing; modes `billboard` / `mesh` / `stretchBillboard` |
| **Editor visual** | Não (ajuste por código / Leva no pacote R3F) |
| **Trails nativos** | Stretch billboard ajuda streaks; **não** há sistema de ribbon trail de produção como no Quarks |
| **Sub-emitters** | Não é o modelo central (camadas = vários emitters manuais) |
| **Soft particles** | Não é feature de primeira classe documentada |
| **WebGPU** | Não é pilar do produto |
| **Adoção (npm, ~nov/2026)** | `wawa-vfx-vanilla` ~3,7k downloads/semana; pacote criado set/2025 |
| **Maturidade** | Biblioteca recente, excelente DX para demos; menos “engine de jogo” |

**Pontos fortes:** curva de aprendizado baixa; fireworks/fogo em poucos minutos; TypeScript; peer `three` flexível (`>=0.159`).

**Pontos fracos para AFD:** teto artístico mais baixo para explosões compostas; menos ferramentas de batch/editor/JSON; menos histórico em títulos de jogo; menos alinhado a pooling + muitas instâncias de impacto.

### 3.2 [three.quarks](https://github.com/Alchemist0823/three.quarks)

| Aspecto | Avaliação |
| --- | --- |
| **Foco** | Motor VFX / particle system **para jogos e apps Three.js** |
| **API** | `BatchedRenderer` + `ParticleSystem` + behaviors + emitters; JSON via `QuarksLoader` |
| **Vanilla** | Sim — caminho principal documentado (R3F é opcional via `quarks.r3f`) |
| **Render** | Batch de sprites/trails; billboard, stretched, mesh, **trail** |
| **Editor visual** | Sim — [quarks.art/create](https://quarks.art/create) + export JSON |
| **Sub-emitters** | Sim (`EmitSubParticleSystem` — death/birth/frame) |
| **Soft particles** | Sim (WebGL com depth texture; WebGPU com path dedicado) |
| **WebGPU** | Sim — `three.quarks/webgpu` (futuro alinhado à migração) |
| **Adoção (npm, ~nov/2026)** | ~34k downloads/semana; projeto desde 2019; v0.18.x ativa |
| **Maturidade** | Produção, demos, docs, Discord, Unity Shuriken import |

**Pontos fortes:** teto alto para “explosão bonita” em camadas; batch para muitos booms; trail nativo (pode substituir/ complementar `TrailPool`); iteração visual sem reescrever código; roadmap WebGPU.

**Pontos fracos / riscos:** API mais densa; peer dependency recente de `three` (ver §6); soft particles WebGL pedem depth setup no renderer.

---

## 4. Critérios de escolha (pesados para AFD)

| Critério | Peso | Quarks | Wawa |
| --- | --- | --- | --- |
| Beleza / teto de explosão composta (flash + fumaça + debris + shock) | Alto | Excelente (sub-emitters + behaviors + editor) | Bom, mas mais “uma nuvem de partículas” |
| Performance com N impactos simultâneos | Alto | `BatchedRenderer` desenhado para isso | Instancing ok; menos modelo de batch multi-sistema |
| Encaixe em `game-render` vanilla (sem forçar R3F no combate) | Alto | Nativo | Nativo (`-vanilla`) |
| Trails de míssil + VFX no mesmo motor | Médio | Trail mode nativo | Stretch / sistema à parte |
| Iteração artística (designer/dev sem rebuild constante) | Médio | Editor + JSON | Só código |
| Longevidade / comunidade / demos de jogo | Médio | Forte | Crescente, menor |
| Tempo até “primeiro boom melhor” | Baixo | Médio | **Mais rápido** |
| Alinhamento futuro WebGPU | Baixo–médio | Sim | Não claro |

**Resultado:** Quarks vence nos critérios que definem “explosões muito mais bonitas” **e** sustentáveis no combate arcade do AFD. Wawa vence só em “prototype em uma tarde”.

---

## 5. Por que three.quarks (resumo executivo)

1. **Explosão = composição**, não um sprite único. Quarks trata isso com sistemas + sub-emitters (ex.: flash curto no death → fumaça longa + sparks). O boom atual do AFD é uma esfera; Quarks é o caminho natural para substituí-lo por um prefab VFX.
2. **`BatchedRenderer`** casa com a meta de object pooling / muitos FX de [`migracao-threejs-v1.md`](migracao-threejs-v1.md) (mísseis, explosões, particles com cap por perfil).
3. **Trail nativo** permite unificar visual de rastro de míssil e impacto no mesmo pipeline, em vez de `TrailPool` + esfera soltos.
4. **Editor + JSON** permitem iterar a “beleza” (cores, curvas de size/color, duração) sem transformar cada ajuste em PR de shader.
5. **Produção comprovada** (adoção npm ~10× maior que `wawa-vfx-vanilla`, anos de manutenção, soft particles, WebGPU) reduz risco de trocar de lib no meio da polish de combate.
6. Wawa continua válida como **inspiração / sandbox**, mas não como fundação do FX de arma do jogo.

---

## 6. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Peer `three` do Quarks recente (`>=0.182` na linha atual) vs AFD em `three ^0.172` | Planejar **bump controlado de Three** em `@afd/game-render` / `apps/web` na fatia de integração; validar cena de voo + JetPreview antes de polish VFX |
| Soft particles exigem depth texture no WebGL | Fase 1 sem soft; Fase 2 ligar depth só no path de combate se o orçamento de GPU permitir |
| Bundle / CPU com muitos sistemas | Seguir §8 (pool, caps Low/Med/High, um `BatchedRenderer`, code-split fora do menu) |
| Curva de aprendizado | Começar com JSON exportado do editor + `QuarksUtil.play` / clone no `boom()`; behaviors avançados depois |
| Substituição do `TrailPool` | Não big-bang: primeiro só impacto; trail Quarks em fatia seguinte |

---

## 7. Encaixe arquitetural (performance-first)

```
FlightScene
  └─ BatchedRenderer (three.quarks)     ← UM por sessão de voo (nunca N)
  └─ MissileFx (refatorado)
        ├─ pool de prefabs boom (pré-aquecidos)
        ├─ sync()   → mesh/trail do projétil (Quarks Trail ou híbrido)
        ├─ boom()   → acquire do pool → play → release no fim
        └─ tick()   → batchRenderer.update(dt)  // único update VFX/frame
```

**Contrato mínimo com o gameplay atual:**

- Continuar chamando `missileFx.boom(x, y, z)` a partir de `FlightScene` nos impactos.
- **Proibir** `new ParticleSystem(...)` / `loader.load` / alocação de textura no hot path do `boom()`.
- Prefabs pooled + recycle; auto-destroy só se o recycle estiver garantido no mesmo frame/ciclo.
- Caps por perfil gráfico LOW / MEDIUM / HIGH (ver §8).
- VFX compartilha o mesmo clock `dt` da cena; sem `requestAnimationFrame` paralelo.

---

## 8. Orientação de implementação — alta performance

Esta seção **obrigatória** para qualquer PR que introduza Quarks no combate. Beleza que estoura o orçamento de frame **não passa**.

### 8.1 Princípios inegociáveis

1. **Um `BatchedRenderer` por `FlightScene`** — todos os sistemas de míssil/explosão entram nele; objetivo = minimizar draw calls.
2. **Pool, não spawn** — booms vêm de um pool pré-criado no boot da missão (ou no primeiro load do pacote VFX), não de `clone` + GC a cada impacto sob fogo intenso.
3. **Hot path sem I/O** — JSON, texturas KTX2/atlas e materiais carregam no `preload` / boot; `boom()` só reposiciona, reseta emitters e dá play.
4. **GPU > milhares de Object3D** — preferir billboard/stretched billboard no batch; mesh particles só com cap baixo e geometria mínima.
5. **Caps por perfil > fidelidade máxima** — o prefab “High” pode ter mais camadas; Low deve continuar legível e barato.
6. **Distance / prioridade** — impactos longe da câmera usam variante *lite* (menos partículas / sem soft / sem sub-emitter pesado) ou são dropados se o budget global estourou.
7. **Soft particles são opt-in caro** — OFF em Low; em Medium/High só após medir custo do depth pre-pass no pipeline atual (internal RT + upscale).
8. **Mesclar materiais** — mesmo atlas + mesmo blending + mesmo `renderMode` entre camadas sempre que possível, para o batch colapsar draws.
9. **Sem R3F no loop de combate** — Quarks vanilla em `@afd/game-render`; zero bridge React no tick de voo.
10. **Medir antes de polish** — HUD de perf já existente (fps / frame time / draw calls) é gate; ver §8.5.

### 8.2 Orçamento alvo (combat VFX)

Valores iniciais para calibrar; ajustar com telemetria real, **sem** remover o conceito de teto.

| Métrica | Low | Medium (default) | High |
| --- | --- | --- | --- |
| Partículas vivas (míssil + boom + trail VFX) | ≤ 400 | ≤ 1 200 | ≤ 2 500 |
| Booms simultâneos no pool | 4 | 8 | 12 |
| Camadas por boom (sistemas) | 1–2 | 2–3 | 3–4 |
| Trail points / míssil ativo | curto | médio | alto (ainda capped) |
| Soft particles | off | off (default) / trial | on se orçamento ok |
| Custo extra p95 frame time vs baseline sem Quarks | ≤ +1,5 ms | ≤ +2,5 ms | ≤ +4 ms |

Se o p95 estourar por N segundos → **degradar automaticamente** (mesmo espírito do auto-detect de perfil em `migracao-threejs-v1.md` §1.3): cortar camadas, reduzir `maxParticle`, recusar novos booms *full* e usar *lite*.

### 8.3 Padrão de pooling (boom)

```
boot missão
  └─ carregar atlas + prefab JSON uma vez
  └─ criar N instâncias no pool (N = tabela §8.2)
  └─ registrar todas no BatchedRenderer
  └─ deixar idle / paused

boom(x,y,z)
  └─ se pool vazio → variante lite OU drop silencioso (nunca alloc)
  └─ acquire → set position → restart emitters → mark busy

tick(dt)
  └─ batchRenderer.update(dt)
  └─ release dos que terminaram → idle no pool (sem dispose de GPU)
```

**Proibido no `boom()`:** `TextureLoader`, `QuarksLoader.load`, `new MeshBasicMaterial`, `new SphereGeometry`, `dispose`/`recreate` de geometry por impacto (o placeholder atual faz isso — a migração Quarks deve **eliminar** essa alocação).

### 8.4 Do / Don’t

| Do | Don’t |
| --- | --- |
| Atlas único (KTX2/Basis quando possível) | PNG soltos por camada no runtime |
| Additive só onde o flash precisa; alpha blended com ordem estável | Trocar blending por partícula sem necessidade |
| `MeshBasicMaterial` / unlit para a maioria dos FX de combate | PBR/`MeshStandardMaterial` em cada spark |
| Prefab *full* + prefab *lite* | Um único prefab “máximo” para todos os perfis |
| Atualizar Quarks **uma vez** por frame no `FlightScene.tick` | Updates duplicados (MissileFx + outro sistema) |
| Culling por distância da câmera de combate | Simular fumaça cara atrás do jogador fora de vista |
| Code-split: carregar Quarks com o chunk de gameplay, não no shell do menu | Puxar `three.quarks` no bundle do Main Menu |

### 8.5 Definition of Done (performance)

Uma implementação só é “pronta” se:

- [ ] Um único `BatchedRenderer` vivo na sessão de voo.
- [ ] Zero alloc de textura/material/geometry no path `boom()` sob stress (rajada Anti-Drone).
- [ ] Caps Low/Med/High aplicados e testados.
- [ ] Stress: ≥ 8 impactos em 1s sem crash e sem crescimento monotônico de heap (pool estável).
- [ ] Draw calls de VFX não disparam linearmente com N booms (batch efetivo).
- [ ] p95 frame time dentro da tabela §8.2 no hardware alvo Medium.
- [ ] Soft particles, se ligados, mensurados à parte e desligáveis pelo perfil.
- [ ] Dispose completo ao sair da missão (`batchRenderer` + pool + atlas) — sem leak entre partidas.

### 8.6 Ordem de fatias (sempre medindo)

1. **Infra** — bump Three se necessário; `BatchedRenderer` + preload; pool vazio com boom *lite* (poucas partículas).
2. **Gate perf** — stress + HUD; só então aumentar beleza.
3. **Prefab full** — camadas flash/smoke/debris no Medium/High.
4. **Trail Quarks** (opcional) — substituir `TrailPool` se o batch reduzir custo; senão manter trail atual.
5. **Soft particles** — último, e só se o depth path não brigar com o internal RT/upscale.

Nunca inverter: **não** começar pelo prefab mais denso do editor e “otimizar depois”.

---

## 9. Fora de escopo desta decisão

- Implementar ou instalar `three.quarks` neste momento
- Redesign final de texturas / atlas (apenas requisitos de formato/perf acima)
- Trocar áudio de impacto
- Migrar UI hubs para R3F ou `quarks.r3f`
- Decidir WebGPU como renderer padrão do jogo (Quarks WebGPU fica como caminho futuro, não MVP)

---

## 10. Alternativa rejeitada (registro)

**wawa-vfx** seria a escolha se o objetivo fosse apenas “um burst bonito rápido no R3F” ou um ensaio isolado. Para o AFD — combate Three vanilla, vários mísseis, polish longo de explosão **sob caps de performance** — o teto e o ecossistema do **three.quarks** (`BatchedRenderer` + pool de prefabs) são superiores.

---

## 11. Referências

| Recurso | URL |
| --- | --- |
| three.quarks (repo) | https://github.com/Alchemist0823/three.quarks |
| three.quarks (npm) | https://www.npmjs.com/package/three.quarks |
| Docs / site | https://quarks.art/ |
| Editor | https://quarks.art/create |
| Demos | https://demo.quarks.art/ |
| Renderers / batch (docs) | https://docs.quarks.art/docs/core-components/renderers |
| wawa-vfx (repo) | https://github.com/wass08/wawa-vfx |
| wawa-vfx-vanilla (npm) | https://www.npmjs.com/package/wawa-vfx-vanilla |
| FX atual AFD | `packages/game-render/src/combat/MissileFx.ts` |
| Roteiro engine + perf | [`migracao-threejs-v1.md`](migracao-threejs-v1.md) §1.2–1.3 |

---

## 12. Decisão final (uma linha)

**Usar three.quarks** para mísseis/explosões do Air Force Dashi — pelo teto visual **e** pelo caminho de alta performance (`BatchedRenderer`, pool de prefabs, caps por perfil, sem alloc no hot path) — rejeitando wawa-vfx como fundação de arma e rejeitando qualquer implementação “bonita primeiro, otimiza depois”.
