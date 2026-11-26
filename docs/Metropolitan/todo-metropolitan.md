# To-do do Metropolitan (Mapa 02)

**Atualizado em:** 2026-11-26, depois do commit `a021b45`
**Plano de referência:** [`mapa-02-metropolitan-v1.md`](mapa-02-metropolitan-v1.md) (decisões Q1 a Q27, ordem de trabalho no §6)
**Mapa em escala real:** [`mapa-metropolitan.svg`](mapa-metropolitan.svg)

Este arquivo lista o que já foi feito e o que falta, tarefa por tarefa. Cada tarefa diz o que fazer, onde mexer, como testar e quando está pronta. Marque `[x]` ao concluir e registre no §9 (Histórico) do plano.

---

## Como rodar e testar (vale para todas as tarefas)

| Para quê | Comando |
| --- | --- |
| Jogo no navegador | `npm run dev` (Vite em `http://127.0.0.1:5173`) |
| API de economia (evita os erros 500 em `/me` e `/auth/guest`) | `npm run api` (porta 8787), em outro terminal |
| Typecheck de todo o monorepo | `npm run typecheck` |
| Testes do núcleo (vitest) | `npm run test -w @afd/game-core` |
| Build de produção da web | `npm run build -w @afd/web` |
| Regenerar terreno e zoneamento | `node tools/metropolitan/build-terrain.mjs`, depois copiar `heightmap_2049.u16.gz`, `zoning_2049.u8.gz` e `zoning_preview.png` de `assets/maps/metropolitan/` para `apps/web/public/maps/metropolitan/` |
| Regenerar o mapa SVG | `npx tsx tools/metropolitan/export-map-svg.mts` |

**Teste em voo:** no menu, escolha **Metropolitan (em construção)** e o modo **Voo livre**. A partida é em cruzeiro a 2.200 m, 4 km antes da pista oeste do aeroporto, com o nariz para o sul (Downtown). Quando o terreno mudar, recarregue com **Ctrl+Shift+R**, para o navegador não usar o terreno antigo do cache.

**Eixos:** +x é leste, +z é sul. As coordenadas abaixo estão em metros.

### Coordenadas de referência

| Ponto | x | z |
| --- | --- | --- |
| Partida (2.200 m) | -1.659 | -18.766 |
| Centro do aeroporto | -859 | -13.266 |
| Cruzamento central da Downtown | -400 | -5.000 |
| Ponte oeste (pênsil) | -5.040 | -5.000 |
| Ponte leste (arco) | 4.390 | -5.000 |
| Ponte do porto (estaiada) | 14.001 | 1.048 |
| Cais do porto | 19.990 | -7.200 a 200 |
| Estádio | 2.000 | 13.900 |

---

## Parte A: o que já foi feito

### [x] A1. Contrato de mapa (`MapDefinition`), passo 1

- **O que foi feito:** os dados do Pacific saíram das constantes e foram para `packages/game-core/src/world/pacificMap.ts`, com o tipo em `world/mapDefinition.ts`. Nenhum valor do Pacific mudou.
- **Como testar:** `npm run test -w @afd/game-core` (inclui `pacificMap.test.ts`). Em voo, o Pacific continua igual ao de antes.
- **Ficou pendente:** os campos de aeroporto, máscara, slots e pontes no contrato (tarefa B8).

### [x] A2. Terreno 2049² e zoneamento, passo 2

- **O que foi feito:**
  - `tools/metropolitan/build-terrain.mjs` gera o heightmap (uint16, 0 a 200 m) e o zoneamento (códigos 0 a 8) a partir de `assets/maps/metropolitan/zoning_polygons.json`.
  - O mundo é um círculo de 29 km de raio, com o layout no quadrado de 40 × 40 km.
  - Cada região tem um platô plano, e as margens descem até o terreno natural numa faixa de 200 m.
  - O carregamento no navegador está em `MetropolitanTerrainLoader.ts`, já corrigido para o gzip que o Vite entrega (commit `f56e328`).
- **Como testar:**
  - `metroGrid.test.ts` e `metropolitanTerrain.test.ts`.
  - Abrir `assets/maps/metropolitan/zoning_preview.png`.
  - Em voo, o terreno carrega sem "Failed to fetch" no console.

### [x] A3. Protótipo de voo entre torres, passo 3

- **O que foi feito:** teste 0 (chão plano) e teste 1 (terreno real) em `MetropolitanTestWorld`. Você aprovou o voo entre torres de 200 e 450 m (critério Q18).
- **Como testar:** voar baixo entre os ícones da Downtown, sem aviso de altitude indevido e sem colisão inesperada.

### [x] A4. Downtown em blockout, passo 4 (segunda passada)

- **O que foi feito:** `world/metroDowntown.ts` gera 400 volumes num raio de 2,8 km a partir de (-400, -5000):
  - 5 ícones de 260 a 450 m;
  - 50 torres de 80 a 199 m;
  - 200 prédios médios e 145 baixos;
  - ruas de 70 m e avenidas principais de 150 m.
- **Como testar:** `metroDowntown.test.ts` (10 testes). Em voo, passar pela avenida z = -5000.
- **Ficou pendente:** validar a silhueta a 3,6 km (tarefa B1).

### [x] A5. Aeroporto em blockout, passo 5

- **O que foi feito:** `world/metroAirport.ts`, com:
  - 2 pistas de 3.000 × 60 m, separadas 1,6 km, com taxiways e ligações;
  - pátio de 1.040 × 1.800 m e terminal de 1.000 m;
  - torre de controle de 82 m;
  - 3 hangares e 2 galpões de manutenção;
  - marcações de eixo e de cabeceira.

  A partida fica alinhada com a pista oeste (Q15).
- **Como testar:** `metroAirport.test.ts` (8 testes). Em voo, a pista oeste aparece logo à frente na partida.

### [x] A6. Porto (Harbor) em blockout, passo 6, validado em voo

- **O que foi feito:** `world/metroHarbor.ts`, com:
  - cais de 200 m e pátio de 1 km;
  - 4 píeres de 650 m, com 16 guindastes e 4 navios;
  - 108 pilhas de contêineres e 7 armazéns.

  A foto de referência está em `referencias/harbor.jpg`.
- **Como testar:** `metroHarbor.test.ts` (8 testes). Em voo, seguir para leste até a costa reta em x ≈ 20 km.

### [x] A7. Coastal com estádio, passo 7

- **O que foi feito:** `world/metroCoastal.ts`.
  - **Estádio** em (2000, 13900): oval de 28 segmentos girados com 42 m de altura, cobertura, campo de 105 × 68 m, praça e 4 torres de luz de 70 m.
  - **Orla** de 14 km seguindo a costa real: areia de 80 m, avenida de 30 m e 87 resorts de 30 a 90 m.
  - O render e a colisão passaram a aceitar volumes girados (`yaw`).
- **Como testar:** `metroCoastal.test.ts` (6 testes). Em voo, seguir para o sul passando pela Downtown até o mar.

### [x] A8. Canais, 3 pontes e percurso de 12 portais, passo 8 (primeira passada)

- **O que foi feito:**
  - **Canais:** o gerador de terreno corta canais de 400 m nas divisas Residential ↔ Downtown, Downtown ↔ Financial e Harbor ↔ Coastal. O canal do porto sai no mar a leste.
  - **Pontes:** `world/metroBridges.ts` monta a pênsil (oeste), a em arco (leste) e a estaiada (porto), com tabuleiro de 36 m, rampas de ~7%, pilares e colisão suave (Q10). São 204 peças.
  - **Percurso:** `buildMetroCheckpoint` gera 12 portais de raio 45 m, entre 160 e 400 m, da pista oeste até o pátio do porto. São 44,6 km, com no máximo 80° de curva entre portais.
  - **No teste 0:** os portais aparecem em voo livre e acendem em sequência (`isThroughGate`, extraído do `CheckpointCourse`).
- **Como testar:**
  - `metroBridges.test.ts` (10 testes): pontes sobre a água certa, rampas no chão, canal ligado ao mar, nada encostando nos outros blockouts, portais livres de qualquer volume e curvas de no máximo 100°.
  - Em voo: seguir a rota pelo SVG e passar pelos 12 portais.

### [x] A9. Mapa de referência em SVG

- **O que foi feito:** `tools/metropolitan/export-map-svg.mts` gera `mapa-metropolitan.svg` em escala real (1 unidade = 1 m), direto dos dados do jogo. Mostra:
  - as regiões e os canais;
  - as curvas de nível a cada 20 m;
  - todas as superfícies e todos os volumes;
  - as pontes, a rota e os portais com altitude;
  - a legenda e a escala.
- **Como testar:** abrir o SVG no navegador e passar o mouse num volume ou num portal para ver a altura. Regenerar a cada fase.

### [x] A10. Mapa no menu

- **O que foi feito:** a entrada `MapId.METROPOLITAN` em `world/maps.ts`, chamada "Metropolitan (em construção)", só com voo livre.
- **Como testar:** `maps.test.ts` e o menu de seleção de mapa.

---

## Parte B: o que falta

A ordem abaixo é a recomendada. As tarefas marcadas como **decisão** precisam de uma resposta sua antes de começar.

### [ ] B1. Validações em voo pendentes

- **Contexto:** os passos 4, 7 e 8 têm testes automáticos verdes, mas só o porto foi validado em voo.
- **O que fazer:** voar e conferir:
  1. A Downtown legível a 3,6 km, sem corte assimétrico (§8 do plano).
  2. O estádio e a orla: nada flutuando nem enterrado e resorts alinhados com a costa.
  3. As pontes:
     - rampas sem degrau estranho;
     - possibilidade de passar por baixo do tabuleiro do porto (45 m livres);
     - a colisão suave não pegando o jato acima das pontes.
  4. O percurso: os 12 portais na ordem, cada um acendendo ao passar e todos resetando 6 s depois do último.
- **Como testar:** em voo livre, usando o SVG como guia. Anote o que não ficou bom.
- **Pronto quando:** você aprovar cada item. Registrar "validado em voo" no §6 do plano.

### [ ] B2. Teto de instâncias (Q14), **decisão**

- **Contexto:** a Q14 fixou 430 instâncias na janela de streaming. O mapa já tem 930 volumes, todos num único `InstancedMesh`, ou seja, uma chamada de desenho. Ainda faltam 4 regiões, e duas delas são enormes (Residential e Industrial, com cerca de 170 km² cada).
- **O que fazer:**
  1. Medir no HUD de desempenho: FPS, tempo de quadro e draw calls na partida, sobre a Downtown e no meio do percurso.
  2. Escolher entre:
     - manter tudo carregado e subir o teto;
     - fazer streaming por setor de 4 × 4 km (Q9);
     - fazer corte por distância com HLOD (tarefa B9).
  3. Atualizar a Q14 e o §4.7 do plano.
- **Como testar:** as medições acima, nos perfis de qualidade Low, Med e Ultra.
- **Pronto quando:** houver um teto novo escrito no plano, com a medição que o justifica.

### [ ] B3. Modo CheckPoint completo no Metropolitan

- **Contexto:** os 12 portais já existem e acendem, mas sem tempo, HUD, vitória, derrota nem recompensa. Hoje o `CheckpointCourse` só gera percursos procedurais por nível (Pacific).
- **O que fazer:**
  1. Em `missions/CheckpointCourse.ts`, adicionar um início com portais fixos, por exemplo `startFixed(gates, timeLimit)`, reaproveitando o `tick` e o `isThroughGate`.
  2. Em `world/maps.ts`, liberar `PlayMode.CHECKPOINT` no Metropolitan.
  3. Em `FlightScene.ts`, no ramo `metroTest`:
     - usar `buildMetroCheckpoint` no lugar dos níveis do Pacific;
     - ligar o HUD de portal e de tempo já existente;
     - tirar os portais de enfeite do `MetropolitanTestWorld` enquanto o modo estiver ativo.
  4. Definir o tempo limite medindo um voo real. Partida mais percurso dão cerca de 50 km; somar uma margem de cerca de 30%.
  5. Recompensa: conferir como a economia (`packages/economy`) valida o CheckPoint do Pacific e criar a entrada do Metropolitan no servidor. O cliente nunca é fonte da verdade.
- **Como testar:**
  - Teste unitário do `startFixed`: passar pelos 12 portais termina em WIN, e o tempo esgotado termina em FAIL com o motivo `TIME`.
  - Em voo: escolher Metropolitan e CheckPoint, completar o percurso, ver o resultado e a recompensa creditada pela API.
- **Pronto quando:** o percurso puder ser completado e perdido, com o resultado validado pelo servidor.

### [ ] B4. Borda circular, aviso e nuvens (Q20, Q23, Q25 e Q26)

- **Contexto:** hoje o jato pode passar dos 29 km sem aviso nenhum. Só a Arena tem contenção (`jet.containBox`).
- **O que fazer:**
  1. Em game-core, criar uma função pura de intensidade do aviso: 0 até `R - 2 km` e 1 na borda, com curva suave.
  2. Em `JetSimulation`, criar uma contenção circular no estilo do `containBox`, que vira o jato de volta perto de R.
  3. No HUD, mostrar o aviso de retorno, cada vez mais forte com a intensidade.
  4. No render, criar uma faixa de nuvens no anel entre `R - 2 km` e R, sem colisão e sem bloquear a visão (Q23). Usar como base a regra de borda da Arena e o `CloudField`.
- **Como testar:**
  - Teste unitário da curva de intensidade (0, meio e 1) e da contenção: o jato nunca sai do círculo.
  - Em voo: ir para o leste além do porto até a borda; o aviso aparece a 2 km e as nuvens entram aos poucos.
- **Pronto quando:** não der para sair do mundo, e o aviso e as nuvens funcionarem.

### [ ] B5. Alerta de proximidade das torres (Q2) e auto pull só pelo terreno (§4.2)

- **Contexto:** a Q2 diz que os avisos de altitude medem só o terreno e que as torres geram apenas um alerta de proximidade. Não achei esse alerta no código, e o voo aprovado no passo 3 não o testou.
- **O que fazer:**
  1. Confirmar que o aviso de altitude e o auto pull usam só `world.sampleFloor` (terreno), nunca o topo de prédio.
  2. Criar o alerta de proximidade: usando `buildings.getCollisionAabbs(origin, raio)`, avisar quando o jato estiver a menos de cerca de 150 m de um volume à frente, sem travar o jogador.
  3. Criar o som e o indicador do alerta no HUD.
- **Como testar:**
  - Teste unitário da detecção: volume à frente a 100 m alerta; volume atrás não alerta.
  - Em voo: passar rente a um ícone da Downtown e ver o alerta, sem auto pull.
- **Pronto quando:** o alerta for claro e o voo entre torres continuar aprovado (Q18).

### [ ] B6. Regiões 5 a 8, passo 9

Cada região segue o mesmo molde das anteriores:

1. Criar um módulo `world/metro<Região>.ts` determinístico.
2. Escrever o teste `metro<Região>.test.ts` contra o terreno real, cobrindo:
   - todo canto de volume dentro da região;
   - ruas livres;
   - sem sobreposição com pontes, rampas e canais;
   - orçamento da região;
   - determinismo.
3. Exportar no `index.ts`.
4. Adicionar a cor do tipo novo em `MetropolitanBlockoutMesh.ts`.
5. Ligar no `warm()` do `MetropolitanTestWorld`.
6. Regenerar o SVG.
7. Escrever o passo no plano.
8. Fazer commit e push.

Depende da decisão B2, porque as regiões grandes não cabem no teto atual.

- [ ] **B6.1 Financial District** (laranja, 39 km², platô de 10 m, entre o canal leste e o Harbor)
  - **O que fazer:** escritórios densos de 60 a 200 m (só a Downtown passa de 200 m, Q1), quadras regulares e uma praça corporativa. Deixar livre a cabeceira da ponte leste e o corredor do percurso (portal 8 a 230 m).
  - **Como testar:** os testes do molde. Em voo, entre a ponte leste e o portal 8.
- [ ] **B6.2 Residential District** (amarelo, 177 km², platô de 14 m, a oeste da Downtown)
  - **O que fazer:** bairros de casas e prédios de 3 a 12 andares, com densidade caindo para longe do canal. Deixar livre a cabeceira da ponte oeste e os portais 2 a 4 (260 a 330 m).
  - **Como testar:** os testes do molde. Em voo, a partida passando pelos portais 2 a 4.
- [ ] **B6.3 Industrial Zone** (marrom, 167 km², platô de 7 m, a nordeste)
  - **O que fazer:** galpões, fábricas, silos, chaminés e pátios de ferrovia ligados ao porto.
  - **Como testar:** os testes do molde. Em voo, a nordeste do aeroporto.
- [ ] **B6.4 Green Zone** (verde, 223 km², colinas até 140 m, a sudoeste)
  - **O que fazer:** parque e floresta (árvores instanciadas, não prédios), lagos e trilhas. Nada em encosta íngreme: medir a inclinação pelo heightmap.
  - **Como testar:** os testes do molde, mais o teste de inclinação máxima sob cada objeto. Em voo, sobre as colinas a sudoeste.

### [ ] B7. Passada de detalhe do porto e da ponte estaiada

- **Contexto:** a ponte do porto tem só pilones, sem estais. O porto segue o layout, ainda não a foto `referencias/harbor.jpg`.
- **O que fazer:**
  1. Estais: adicionar `pitch` ao `MetroBuilding`, ou desenhar os cabos com uma geometria de linhas em leque partindo de cada pilone.
  2. Porto, conforme a foto:
     - quebra-mares;
     - guindastes STS vermelhos e azuis;
     - mais berços;
     - ferrovia no pátio;
     - armazéns em fileira.
- **Como testar:** atualizar `metroHarbor.test.ts` (quebra-mar no mar, guindaste no cais). Em voo, comparar com a foto lado a lado.
- **Pronto quando:** você validar comparando com a foto.

### [ ] B8. Metropolitan como mapa de verdade (`MapDefinition` completo, §5)

- **Contexto:** hoje o Metropolitan roda dentro de um "mundo de teste" e de um ramo especial do `FlightScene`, e as funções de terreno ainda leem o mapa ativo fixo.
- **O que fazer:**
  1. Completar o contrato com aeroporto, máscara, slots e pontes.
  2. Passar o mapa como parâmetro nas funções de terreno.
  3. Trocar o ramo `metroTest` por um mundo Metropolitan que siga a mesma interface do Pacific.
  4. Tirar o "(em construção)" do nome quando as regiões estiverem aprovadas.
- **Como testar:** todos os testes do núcleo, mais o Pacific e a Arena sem regressão em voo.
- **Pronto quando:** não houver mais `metroTest` no `FlightScene`.

### [ ] B9. Streaming, HLOD e corte por distância (§4.4)

- **Contexto:** `CityHlod` e `gatherBuildings` cortam por ordem de laço, e a silhueta some de um lado só. O Metropolitan carrega todos os volumes de uma vez.
- **O que fazer:**
  1. Trocar o corte por ordem fixa por um corte por distância ou por amostragem espaçada.
  2. Para o Metropolitan, aplicar a escolha da B2 (setores de 4 × 4 km ou HLOD) e manter a silhueta das regiões distantes.
- **Como testar:**
  - Teste unitário: com mais candidatos que `MAX`, os escolhidos são os mais próximos, distribuídos dos dois lados.
  - Em voo: girar 360° a 3,6 km da Downtown, sem lado faltando.
- **Pronto quando:** a silhueta estiver simétrica e a medição couber no teto da B2.

### [ ] B10. Slots de publicidade, preparo técnico (passo 10, Q4 e §4.6)

- **O que fazer:**
  1. Montar a tabela de slots: tipo, superfície, tamanho e campo `premium` (painéis da Downtown, naming rights do estádio).
  2. Criar um atlas de anúncios com offset de UV por instância, sem um material por marca.
  3. Usar só marcas fictícias (parecer §4.6).
- **Como testar:**
  - Teste unitário: cada slot cabe na fachada do volume a que pertence.
  - Em voo: os painéis aparecem na Downtown e no estádio, e as draw calls não sobem por marca.
- **Pronto quando:** os slots estiverem prontos sem venda ativa, e o orçamento estiver medido.

### [ ] B11. Tráfego aéreo em silhuetas (passo 11, Q21)

- **O que fazer:** ligar o `AirTraffic` (`game-render/src/world/AirTraffic.ts`) no `MetropolitanTestWorld`, com rotas de pouso e decolagem nas duas pistas. Só silhuetas distantes, sem interação e sem radar.
- **Como testar:** em voo, ver aviões chegando e saindo do aeroporto ao longe. Conferir que eles não entram na colisão nem no radar.
- **Pronto quando:** os aviões estiverem visíveis e sem efeito no jogo.

### [ ] B12. Orçamento por região medido e fechado (passo 12, §4.7)

- **O que fazer:** medir FPS, draw calls e instâncias por região no cruzeiro e em voo baixo, e preencher uma tabela no plano. O teto é de 120 draw calls no cruzeiro (ideal 80), conforme `migracao-threejs-v1.md`.
- **Como testar:** o HUD de desempenho nos perfis Low, Med e Ultra, nos mesmos pontos de medição da B2.
- **Pronto quando:** todas as regiões couberem no teto e a tabela estiver no plano.

### [ ] B13. Fachadas (doc `fachadas-atlas-v1.md`, fases F0 a F4)

- **Contexto:** os blockouts são caixas de cor sólida. As fachadas entram depois que as regiões forem aprovadas.
- **O que fazer:** seguir as fases do doc de fachadas: F0 (janelas em metros), F1 (atlas e UV por instância), F2 (destruição com o mesmo atlas), F3 (horizonte) e F4 (landmarks e ads). Para a cidade vinda de CityJSON, ver `cidade-cityjson-atlas-v1.md` (fases C0 a C3).
- **Como testar:** os critérios de aceite de cada doc.

### [ ] B14. Refinos de terreno e zoneamento (§5)

- **O que fazer:**
  - Ajustar os contornos dos polígonos à imagem de layout, incluindo o contorno de ilha.
  - Suavizar o zigue-zague do canal Downtown ↔ Financial, perto de z = -6.000.
  - Revisar a forma quadrada da ocupação.
- **Como testar:**
  - Regenerar o terreno e rodar todos os testes: as regiões já construídas não podem perder pedaço.
  - Comparar o `zoning_preview.png` e o SVG com a imagem de layout.
- **Pronto quando:** você aprovar comparando com a imagem de referência.

### [ ] B15. Aprovação final por região (§8 do plano)

Para cada região, conferir:

- O voo atravessa a região sem aviso de altitude indevido.
- A silhueta é legível a 3,6 km.
- O platô é plano, sem prédio em encosta.
- O orçamento está dentro do teto.
- A máscara bate com a imagem de referência.
- Não há costura na borda circular.

| Região | Voo | Silhueta | Platô | Orçamento | Máscara |
| --- | --- | --- | --- | --- | --- |
| Downtown | [x] | [ ] | [x] | [ ] | [x] |
| Airport | [ ] | [ ] | [x] | [ ] | [x] |
| Harbor | [x] | [ ] | [x] | [ ] | [x] |
| Coastal | [ ] | [ ] | [x] | [ ] | [x] |
| Financial | [ ] | [ ] | [ ] | [ ] | [ ] |
| Residential | [ ] | [ ] | [ ] | [ ] | [ ] |
| Industrial | [ ] | [ ] | [ ] | [ ] | [ ] |
| Green Zone | [ ] | [ ] | [ ] | [ ] | [ ] |

---

## Parte C: fora da V1 (só para referência)

Missões Attack, interceptação e corridas; dirigíveis e faixas aéreas; marina, centro de convenções, usina e torre de comunicação; ciclo de dia e noite, chuva e neblina; venda de anúncios; fachadas em 4K. Ver o §7 do plano.

---

## Notas técnicas

- **Arquivo travado no Windows:** com o `npm run dev` rodando, o Vite às vezes mantém um `.ts` mapeado, e a edição falha com `ftruncate`. Se acontecer, pare o servidor, edite e suba de novo. Outra saída é regravar o arquivo sem truncar.
- **Terreno novo:** depois de rodar o `build-terrain.mjs`, copie os binários para `apps/web/public/maps/metropolitan/` e recarregue com Ctrl+Shift+R.
- **Commits:** nunca incluir `audio/*.wav`, `audio/jet/`, os `.blend` e `.blend1` do Pacific nem o `pacific_islands_complete.glb` (105 MB, acima do limite do GitHub).
