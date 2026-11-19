# AirForceDashi — Estrutura de Telas e Experiência de Produto v1.0

Documento oficial de UX/produto para as telas do jogo. Complementa [`economia-v1.md`](economia-v1.md): a economia define *o que o jogador ganha e gasta*; este documento define *onde isso aparece e em que ordem se constrói*.

**Premissa de produto**

Air Force Dashi é um **arcade de voo** (*flying toy*) com casca de produto moderna — não um simulador militar nem um Ace Combat em miniatura. A experiência deve ser rápida de entrar, clara de evoluir e desejável de personalizar.

**Três jornadas** (espelho de `economia-v1.md` §15)

| Jornada | O que o jogador faz | Onde mora na UI |
| --- | --- | --- |
| **Jogar** | Modos, partidas, objetivos | Main Menu → Pré-partida → Gameplay → Resultado |
| **Evoluir** | Credits, XP, aeronaves, patentes, missões | Hangar + Carreira / Operações + Perfil |
| **Colecionar** | Skins, emblemas, prestígio, exclusivos | Hangar + Loja + (depois) Battle Pass |

---

## 1. Princípios de tela

1. **Hubs, não proliferação de telas full-screen.** Várias “telas” da lista clássica (passe, ranking, dailies, mastery) são **abas ou painéis** dentro de hubs.
2. **Arcade first.** Checkpoint, Anti-Drone e Vôo Livre devem chegar ao ar em poucos toques. Briefing narrativo longo só onde a missão pedir.
3. **Economia visível cedo, monetização paga depois.** Credits, XP e desbloqueios aparecem no MVP de produto. Dashi Coins e passe premium vêm quando o catálogo cosmético e o wallet já existem (`economia-v1.md` Fases 1–8 → 9).
4. **Sem pay-to-win na UI.** Nenhum botão, badge ou oferta pode sugerir vantagem competitiva comprável (princípios 1–2 da economia).
5. **Uma ação primária por tela.** Main Menu = Jogar (ou continuar). Hangar = equipar/desbloquear. Loja = comprar. Resultado = reivindicar e sair/replay.
6. **Empty states importam.** Primeira sessão (escolha F-22/F-15), sem segunda aeronave, sem skins, sem ranking — cada hub precisa de estado vazio honesto.
7. **Pause conta no fluxo.** Já existe no projeto; faz parte da experiência completa, não é detalhe técnico.

---

## 2. Arquitetura: 7 hubs (+ fluxos satélite)

Em vez de 12 telas principais isoladas, o produto se organiza assim:

```
MAIN MENU
├── Jogar → PRÉ-PARTIDA → GAMEPLAY → RESULTADO → (volta)
├── Hangar
├── Carreira / Operações
├── Loja
├── Perfil
├── Configurações
└── (futuro) Multiplayer / Lobby
```

| # | Hub / fluxo | Papel | Full-screen? |
| --- | --- | --- | --- |
| 1 | **Main Menu** | Identidade + navegação + CTA Jogar / Vôo Livre | Sim |
| 2 | **Pré-partida** | Modo → aeronave → (briefing leve) → Play | Sim (fluxo curto) |
| 3 | **Gameplay** (+ Pause) | Voo, HUD, objetivos, controles | Sim |
| 4 | **Resultado** | Score, Credits, XP, medals, CTA replay/sair | Sim |
| 5 | **Hangar** | Aeronaves, mastery, skins, emblemas, loadout visual | Sim |
| 6 | **Carreira / Operações** | Dailies, weeklies, XP/patente, passe, ranking solo | Sim (abas) |
| 7 | **Loja** | Credits + (depois) Dashi Coins / packs | Sim |
| — | **Perfil** | Identidade do piloto, medals, stats resumidas | Sim ou overlay |
| — | **Configurações** | Áudio, controles, gráficos, sensibilidade | Overlay / tela |
| — | **Lobby** (expansão) | Matchmaking Team vs Team | Sim — fase tardia |

### O que *não* é tela principal isolada

| Item antigo (lista de 12) | Destino nesta arquitetura |
| --- | --- |
| Seleção de aeronaves | Aba / passo dentro de **Hangar** e atalho na **Pré-partida** |
| Seleção de modos | Passo 1 da **Pré-partida** (+ atalho Vôo Livre no Main Menu) |
| Briefing da missão | Passo opcional/leve da **Pré-partida** (só modos que precisarem) |
| Progressão / Battle Pass | Aba em **Carreira / Operações** |
| Ranking / Estatísticas | Aba em **Carreira** + resumo no **Perfil** |
| Perfil + Configurações juntos | **Separados** (identidade ≠ técnico) |

---

## 3. Detalhamento por hub

### 3.1 Main Menu

**Objetivo:** identidade do jogo + caminho mais curto até voar.

**Conteúdo**

- Arte / fundo cinematográfico (já alinhado ao título atual)
- CTA primário: **Jogar** (abre Pré-partida)
- Atalho: **Vôo Livre** (pula seleção de missão; ainda pode pedir aeronave se houver mais de uma)
- Entradas secundárias: Hangar, Carreira, Loja, Perfil, Configurações
- Chip discreto de moedas: Credits (+ Dashi Coins quando existir)
- Indicador leve de “missões diárias disponíveis” (não um mural de stats)

**Não colocar no primeiro viewport:** leaderboards densos, passe completo, loja em destaque agressivo, wall of modes.

---

### 3.2 Pré-partida

**Objetivo:** escolher *o que* jogar e *com qual* avião, sem atrito.

**Fluxo padrão**

1. **Modo** — Checkpoint | Anti-Drone | Defesa aérea | Ataque | Team vs Team (conforme disponível) | Vôo Livre
2. **Aeronave** — lista desbloqueada + hint da próxima meta (ex.: “F-15 — 8.000 Credits”)
3. **Briefing** — ver §3.2.1
4. **Play**

**Recompensas visíveis:** recompensa-base do modo (tabela `economia-v1.md` §2) em texto curto, não planilha.

#### 3.2.1 Briefing — regra de peso

| Tipo de modo | Briefing |
| --- | --- |
| Checkpoint, Anti-Drone, Vôo Livre | **Leve:** 1 linha de objetivo + nível/dificuldade + aeronave + Play |
| Defesa aérea, Missão de ataque | **Médio:** objetivos primário/secundário, cenário, recompensas |
| Team vs Team | **Lobby** (fase expansão); pré-partida só resume regras e recompensas |

---

### 3.3 Gameplay + Pause

**Objetivo:** sensação de voo e clareza de objetivo.

- HUD por modo (já existem padrões Checkpoint / Anti-Drone)
- Pause: retomar, reiniciar (quando aplicável), opções rápidas (som/sensibilidade), voltar ao título — alinhado ao que o build já oferece
- Sem loja, passe ou pop-ups de compra durante o voo

Abandono de partida: recompensa incompleta conforme `economia-v1.md` §2 (anti-farm) — a UI de saída pode avisar sem dramatizar.

---

### 3.4 Resultado da missão

**Objetivo:** fechar o loop econômico da partida e empurrar a próxima ação.

**Blocos**

1. Resultado (clear / fail / score / tempo)
2. Breakdown de Credits (base + bônus, com teto comunicado se aplicável)
3. XP de carreira + XP de Aircraft Mastery (quando existir)
4. Medalhas / feitos desbloqueados (se houver)
5. CTAs: **Jogar de novo** | **Trocar modo** | **Hangar** | **Menu**

Derrota: ainda mostra XP/participação quando houver participação efetiva — sem perda de patrimônio (economia § princípios).

---

### 3.5 Hangar

**Objetivo:** hub único de **aeronaves + personalização + mastery**.

**Abas sugeridas**

| Aba | Conteúdo |
| --- | --- |
| Frota | Lista de aeronaves, desbloqueadas / bloqueadas com preço em Credits |
| Equipar | Skin, emblema, efeitos visuais equipados na aeronave selecionada |
| Mastery | Níveis 1–10, recompensas cosméticas/Credits (`economia-v1.md` §6) — **sem** buffs de combate |
| (opcional) Hangar visual | Decoração de hangar como sink (`economia-v1.md` §8 / §12) |

**Onboarding (primeira vez):** escolha obrigatória F-22 **ou** F-15 gratuita; a outra fica a 8.000 Credits (`economia-v1.md` §4). Pode ser modal full-screen na primeira abertura do Hangar ou logo após o primeiro Main Menu autenticado.

Seleção rápida de aeronave na Pré-partida **reutiliza** os mesmos dados — não duplicar lógica de inventário.

---

### 3.6 Carreira / Operações

**Objetivo:** retenção diária/semanal e meta de médio prazo — sem ser a home do jogo.

**Abas sugeridas**

| Aba | Conteúdo | Fase economia |
| --- | --- | --- |
| Operações | Daily (3 + bônus) e Weekly | Fase 6 |
| Patente | XP, nível, patente militar | Fase 2 |
| Temporada | Battle Pass free/premium (8 semanas) | Fase 9 |
| Ranking | Leaderboards **por modo** (solo primeiro) | Após modos estáveis + validação |
| Eventos | Special Operations | Fase 10 |

Dailies/weeklies têm prioridade de UI sobre o passe: retêm no dia 1; o passe retém na temporada.

---

### 3.7 Loja

**Objetivo:** sinks de Credits cedo; Dashi Coins e packs depois.

**Seções**

1. **Credits** — pinturas, emblemas, molduras, pacotes de personalização (`economia-v1.md` §8); 10–15 itens no escopo mínimo de lançamento
2. **Aeronaves** — pode viver no Hangar *ou* espelhar preços aqui; preferência: compra no Hangar, vitrine opcional na Loja
3. **Premium** — Dashi Coins, Starter Pack, Seasonal Pack, Special Collection (Fase 8); **proibido** listar aeronaves/armas/vantagens
4. **Passe** — atalho para comprar Premium Pass / Bundle (preços §11), sem substituir a aba Temporada

UI deve deixar óbvio: **Credits = jogar; Dashi Coins = identidade**. Sem conversão DC → Credits na v1.0.

---

### 3.8 Perfil

**Objetivo:** identidade do piloto e prestígio.

- Nome / avatar / moldura
- Patente + nível
- Saldos (Credits, DC, Medals)
- Stats resumidas (partidas, preferência de modo/aeronave)
- Vitrine de medals / conquistas
- Mastery highlights (ex.: “Raptor Specialist”)

Não misturar sliders de áudio aqui.

---

### 3.9 Configurações

**Objetivo:** preferências técnicas.

- Áudio, sensibilidade do mouse, gráficos, keybinds / touch
- Conta / logout (quando houver auth — `economia-v1.md` Fase 0)
- Créditos / versão

Acessível pelo Main Menu e por atalho no Pause (subset).

---

### 3.10 Multiplayer / Lobby (expansão)

**Objetivo:** Team vs Team com matchmaking.

Só entra quando:

- Modos solo estão estáveis
- Recompensas são validadas no servidor (economia §14)
- Matchmaking por habilidade do piloto (economia §5), não por “avião pago”

Até lá, **Ranking solo por modo** cobre vaidade com custo baixo.

---

## 4. Fluxos essenciais

### 4.1 Sessão típica (MVP de produto)

```
Main Menu → Jogar → Pré-partida (modo + avião) → Gameplay
    → Resultado (Credits + XP) → Jogar de novo | Hangar | Menu
```

### 4.2 Primeira sessão (onboarding)

```
Main Menu → (modal) Escolha F-22 ou F-15
    → Tutorial leve opcional / primeira partida Checkpoint ou Anti-Drone
    → Resultado → hint “ganhe Credits para a segunda aeronave”
```

### 4.3 Retenção diária

```
Main Menu (badge Operações) → Carreira / Daily → Pré-partida → …
    → Hangar (gastar Credits) ou Loja Credits
```

### 4.4 Monetização (após Fase 8)

```
Resultado / Hangar / Temporada → desejo cosmético
    → Loja Premium (DC / pack / passe) — nunca vantagem de combate
```

---

## 5. Mapa de prioridade (etapas de produto)

Alinhado às fases de `economia-v1.md` §16, traduzido em **superfície de UI**.

| Etapa | Meta | Hubs / fluxos | Fases economia |
| --- | --- | --- | --- |
| **A — MVP jogável** | Divertir | Main Menu, Pré-partida (modos existentes), Gameplay + Pause, Resultado básico, Configurações | — (cliente local ok) |
| **B — MVP de produto** | Motivo para voltar + economia free | Resultado com Credits/XP, Hangar (frota + onboarding 2 aviões), Perfil básico, Loja Credits, chip de moedas no Menu | 0–4 |
| **C — Retenção** | Loop diário/semanal | Carreira: Operações + Patente; Mastery no Hangar; Ranking solo; empty states polidos | 5–7 |
| **D — Monetização** | Identidade paga | Loja Premium (DC, packs), polish de vitrine | 8 |
| **E — Temporada** | Meta de 8 semanas | Aba Temporada (Free/Premium Pass) | 9 |
| **F — Social** | Escala | Lobby / Team vs Team, ranking competitivo | 10 + netcode |

### Diferenças conscientes vs. lista anterior de 12 telas

| Antes | Agora |
| --- | --- |
| MVP = telas 1–6 + 12 | MVP jogável **sem** loja/hangar full; MVP de produto **com** Hangar + Loja Credits + Perfil |
| Retenção = Hangar, Passe, Ranking | Retenção = Operações + Mastery + Ranking solo; **passe depois** |
| Monetização = Multiplayer + Loja | Monetização = **Loja Premium**; Multiplayer = expansão social separada |
| Briefing sempre | Briefing só quando o modo precisa |
| Passe como tela #8 | Passe como aba em Carreira, Fase E |

---

## 6. Conteúdo mínimo por etapa (checklist de UX)

### Etapa A — MVP jogável

- [ ] Main Menu com identidade + Jogar + Vôo Livre + Config
- [ ] Pré-partida: modos disponíveis no build + aeronave atual
- [ ] Briefing leve para Checkpoint / Anti-Drone
- [ ] Gameplay + Pause (retomar / reiniciar / título)
- [ ] Resultado: score/tempo/clear (mesmo sem wallet remoto)

### Etapa B — MVP de produto

- [ ] Auth + wallet (Credits) ligado ao Resultado
- [ ] Onboarding F-22 / F-15
- [ ] Hangar: frota, compra segunda aeronave (8.000), equipar cosmético básico
- [ ] Loja Credits com 10–15 itens
- [ ] Perfil: nível/patente stub + saldos
- [ ] Chip Credits no Main Menu
- [ ] Copy de empty states (sem itens / sem 2ª aeronave)

### Etapa C — Retenção

- [ ] Aba Operações (Daily + Weekly + countdown)
- [ ] Mastery por aeronave no Hangar (sem buff)
- [ ] Medals no Perfil
- [ ] Ranking solo por modo (Checkpoint time, Anti-Drone score, …)
- [ ] Badge “missões prontas” no Main Menu

### Etapa D — Monetização

- [ ] Seção Premium na Loja (pacotes DC + Starter Pack)
- [ ] Itens Epic/Legendary só cosmético; review de copy anti-P2W
- [ ] Telemetria de conversão visível para o time (não necessariamente no cliente)

### Etapa E — Temporada

- [ ] Aba Temporada com tracks Free / Premium
- [ ] Compra Premium Pass / Bundle (R$ 24,90 / R$ 39,90)
- [ ] Progressão por XP de temporada / challenges

### Etapa F — Social

- [ ] Lobby Team vs Team
- [ ] Matchmaking por skill
- [ ] Recompensas TvT validadas no servidor
- [ ] Ranking competitivo (separado do leaderboard solo, se necessário)

---

## 7. To-do de implementação (ordem recomendada)

Espelho prático para o time. Marcar conforme avançar. Preferir **reutilizar cenas/UI atuais** (`title_card`, selectores de modo, pause, HUDs) em vez de reescrever tudo.

### Fundação de navegação

- [ ] Definir árvore de cenas/UI: `MainMenu`, `PreMission`, `Hangar`, `Career`, `Store`, `Profile`, `Settings`
- [ ] Router simples (stack ou state machine) Menu ↔ hubs ↔ gameplay ↔ resultado
- [ ] Tokens visuais já usados (preto · vermelho · branco · cinza; Bebas Neue + Barlow)
- [ ] Persistência local vs. remota: o que ainda pode ser `user://` e o que exige backend (`economia-v1.md` §14)

### Etapa A

- [ ] Refinar Main Menu: CTA único dominante + atalho Vôo Livre
- [ ] Unificar entrada Checkpoint / Anti-Drone / (futuros) num fluxo Pré-partida
- [ ] Resultado local estruturado (campos prontos para Credits/XP mesmo que zerados)
- [ ] Pause: garantir caminhos “título / reiniciar / opções” estáveis

### Etapa B (paralelo às Fases 0–4 da economia)

- [ ] Integrar concessão de recompensa pós-partida na tela de Resultado
- [ ] UI de saldo Credits (Menu, Perfil, Hangar, Loja)
- [ ] Fluxo onboarding escolha de aeronave
- [ ] Hangar frota + desbloqueio 8.000
- [ ] Inventário equipável (skin/emblema/moldura)
- [ ] Loja Credits (catálogo mínimo)
- [ ] Perfil: patente/nível + medals stub

### Etapa C (Fases 5–7)

- [ ] UI Daily / Weekly Operations
- [ ] UI Aircraft Mastery
- [ ] Catálogo e vitrine de Medals
- [ ] Leaderboards solo por modo (leitura; escrita só com validação)

### Etapa D–E (Fases 8–9)

- [ ] Vitrine Dashi Coins + packs
- [ ] Gate de compra (plataforma) + recibos na UI
- [ ] Battle Pass UI (duas tracks) + deep link Loja ↔ Temporada

### Etapa F

- [ ] Lobby, salas, convites, matchmaking
- [ ] HUD/resultados específicos de Team vs Team
- [ ] Proteções UX: abandon, penalties de reward (não de patrimônio)

### Qualidade transversal (antes de cada release de UI)

- [ ] Nenhum CTA premium promete poder de combate
- [ ] Toda recompensa exibida no Resultado passou pelo serviço central (quando backend existir)
- [ ] Empty states e first-time flows testados
- [ ] Caminho free completo até a segunda aeronave sem pagar
- [ ] Performance: hubs não carregam o mundo 3D inteiro sem necessidade
- [ ] Acessibilidade básica: contraste da paleta, foco em controles, textos de recompensa legíveis

---

## 8. Fora de escopo (v1.0 desta visão)

- Assinatura VIP (`economia-v1.md` §15)
- Conversão Dashi Coins → Credits
- Sinks de reparo / combustível / munição
- Árvore de armas pay-to-win
- Briefing cinematográfico obrigatório em todo modo
- Social completo (clãs, chat global, spectator) antes do Lobby básico
- Loja inchada sem os 10–15 cosméticos desejáveis de baseline

---

## 9. Relação com outros docs

| Documento | Responsabilidade |
| --- | --- |
| [`economia-v1.md`](economia-v1.md) | Moedas, preços, fases de backend, anti-P2W, métricas |
| **Este arquivo** | Hubs, fluxos, prioridade de telas, to-do de UI/UX |
| README | Estado *atual* do build (modos e controles), não o roadmap de produto |

Em conflito de números (preços, XP, duração de temporada), **prevalece `economia-v1.md`**. Em conflito de “quantas telas construir agora”, **prevalece este documento**.

---

## 10. Visão em uma frase

> Arcade de voo que se abre em segundos, mostra evolução de piloto em hubs claros (Hangar + Carreira + Loja), e só depois escala para temporada premium e multiplayer — sem nunca vender poder.

---

*Documento vivo. Baseline v1.0 — ajustar fluxos com playtests; preservar hubs, jornadas e alinhamento com a economia.*
