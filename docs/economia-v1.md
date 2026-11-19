# AirForceDashi — Modelo Econômico Oficial v1.0

Documento-base da economia do jogo. Valores iniciais de balanceamento; após o lançamento, ajustar com dados reais de partidas e comportamento dos jogadores.

**Decisões de produto**

| Pilar | Decisão |
| --- | --- |
| Aeronaves | Todas conquistáveis com **Credits** (sem exclusivas pagas) |
| Competição | Cada aeronave tem vantagens e desvantagens; não existe opção universalmente superior |
| Ritmo | **Moderado** — evolução por sessão, metas de médio/longo prazo |

**Princípios inegociáveis**

1. Todas as aeronaves podem ser conquistadas jogando.
2. Moeda premium não compra vantagem competitiva.
3. Derrota não gera perda de patrimônio.
4. Cada aeronave possui identidade de gameplay própria.
5. O jogador sempre tem objetivos de curto e longo prazo.
6. Sem conversão Dashi Coins → Credits na v1.0.
7. Sem cobrança de reparo, combustível, munição ou manutenção.

---

## 1. Moedas oficiais

Três moedas + sistema de experiência.

| Moeda | Tipo | Origem | Uso |
| --- | --- | --- | --- |
| **Credits** | Progressão | Jogando (partidas, missões, eventos) | Aeronaves, pinturas básicas, personalizações free |
| **Dashi Coins** | Premium | Dinheiro real / ofertas | Skins especiais, efeitos, identidade, cosméticos |
| **Medals** | Conquista | Feitos específicos | Prestígio; não compráveis nem negociáveis |
| **XP** | Carreira | Participação e objetivos | Nível, patente; não comprável nem gastável |

**Regra:** Credits = esforço e progressão. Dashi Coins = monetização e personalização premium. Não confundir os dois fluxos.

---

## 2. Recompensas por partida

O jogador ganha Credits em qualquer modo. Valores de conclusão normal (sem bônus):

| Modo | Recompensa-base |
| --- | --- |
| Checkpoint | 120 Credits |
| Anti-Drone | 160 Credits |
| Defesa do espaço aéreo | 180 Credits |
| Missão de ataque | 190 Credits |
| Team vs Team | 160 Credits |

### Bônus de desempenho

| Critério | Recompensa |
| --- | --- |
| Objetivo secundário | +20 |
| Excelente desempenho | +30 |
| Conclusão sem sofrer danos | +20 |
| Vitória em Team vs Team | +30 |
| Participação efetiva | +10 |

**Regras de bônus**

- Nem todos os bônus precisam ser acumuláveis; definir **teto de bônus por partida** para controlar inflação.
- Em modos competitivos, priorizar contribuição individual (não recompensar demais só por entrar em time vencedor).
- Sem bônus de vitória em modos puramente individuais.
- Média-alvo de sessão: **~200 Credits por partida**.

**Exemplo — Missão de ataque**

| Item | Credits |
| --- | --- |
| Conclusão | 190 |
| Objetivo secundário | +20 |
| Excelente desempenho | +30 |
| **Total** | **240** |

### Proteção da economia

| Regra | Motivo |
| --- | --- |
| Partida abandonada ≠ recompensa completa | Anti-farm / abandono |
| Resultados validados pelo servidor | Anti-fraude |
| Repetições automatizadas não geram Credits indefinidos | Anti-bot |
| Sem penalidade econômica por perder | Evitar medo de jogar |
| Sem reparo de aeronave | Incentivar experimentação |

---

## 3. Missões diárias, semanais e eventos

Partidas geram Credits; missões criam motivo para voltar.

### Daily Operations

Três desafios por dia + bônus de conclusão.

| Desafio | Recompensa |
| --- | --- |
| Complete 2 partidas | 100 Credits |
| Destrua 10 drones ou alvos | 100 Credits |
| Utilize uma aeronave diferente | 100 Credits |
| Complete os 3 desafios | +150 Credits |
| **Máximo diário (missões)** | **450 Credits** |

Recompensas de partida são adicionais.

### Weekly Operations

| Desafio | Recompensa |
| --- | --- |
| Complete 15 partidas | 500 Credits |
| Complete 5 missões diferentes | 400 Credits |
| Alcance 10 objetivos especiais | 300 Credits |
| Complete todos os desafios | +300 Credits |
| **Total semanal (missões)** | **1.500 Credits** |

### Special Operations

Eventos temporários com missões específicas, recompensas cosméticas, XP e Medals.

Desafios rotativos devem incentivar experimentar aeronaves/modos **sem obrigar** o jogador a jogar o que não gosta.

---

## 4. Loja de aeronaves (meta principal de progressão)

### Início

- Jogador escolhe **F-22 Raptor** ou **F-15 Eagle** como aeronave gratuita.
- A outra fica disponível por **8.000 Credits**.
- Todos começam com experiência completa + objetivo imediato.

### Tabela de desbloqueio (lançamento)

| Categoria | Custo | Significado |
| --- | --- | --- |
| Aeronave inicial escolhida | Gratuita | Onboarding |
| Segunda aeronave inicial | 8.000 | Primeira meta |
| Entrada | 18.000 | Curto prazo |
| Intermediária | 32.000 | Médio prazo |
| Avançada | 50.000 | Médio/longo |
| Especializada | 75.000 | Longo prazo |
| Elite | 100.000 | Meta de temporada/carreira |

Categorias = complexidade / especialização / custo de progressão — **não** superioridade competitiva.

### Catálogo ilustrativo futuro

| Aeronave | Categoria | Custo sugerido |
| --- | --- | --- |
| F-22 Raptor | Inicial | Gratuito ou 8.000 |
| F-15 Eagle | Inicial | Gratuito ou 8.000 |
| F-16 Fighting Falcon | Entrada | 18.000 |
| F/A-18 Super Hornet | Intermediária | 32.000 |
| Su-27 Flanker | Intermediária | 32.000 |
| Eurofighter Typhoon | Avançada | 50.000 |
| Rafale | Avançada | 50.000 |
| Su-35 | Especializada | 75.000 |
| F-35 Lightning II | Especializada | 75.000 |
| Elite futura | Elite | 100.000 |

> Inclusão real depende de escopo, características implementadas e autorização de materiais protegidos.

**Não** liberar aeronaves apenas por nível/patente. Níveis recomendados podem orientar; Credits + escolha do jogador desbloqueiam.

---

## 5. Diferenciação e equilíbrio competitivo

Cada aeronave deve ser **diferente**, não necessariamente melhor.

### Identidades iniciais (gameplay)

**F-22 Raptor — especialista em interceptação**

- Alta manobrabilidade e aceleração
- Boa capacidade de interceptação
- Menor capacidade de carga (no balanceamento do jogo)
- Maior exigência de precisão

**F-15 Eagle — especialista versátil**

- Alta velocidade e boa capacidade de carga
- Boa resistência no modelo do jogo
- Menor agilidade em manobras fechadas
- Mais eficiente em certas missões de ataque

### Matriz de atributos (0–100, prototipação)

| Atributo | F-22 | F-15 |
| --- | --- | --- |
| Velocidade | 88 | 94 |
| Manobrabilidade | 96 | 80 |
| Aceleração | 94 | 88 |
| Resistência | 82 | 90 |
| Capacidade de carga | 75 | 95 |
| Controle | 94 | 84 |

### Especialização por modo

| Modo | Atributos valorizados |
| --- | --- |
| Checkpoint | Velocidade e manobrabilidade |
| Anti-Drone | Controle e precisão |
| Defesa aérea | Interceptação e aceleração |
| Missão de ataque | Capacidade de carga e resistência |
| Team vs Team | Equilíbrio entre atributos |

**Regras**

- Nenhuma aeronave indispensável em qualquer modo.
- Diferença perceptível, nunca “compra errada”.
- Matchmaking por **habilidade do piloto**, não só por aeronave/patente.

---

## 6. Aircraft Mastery

Progressão individual por aeronave. Não concede buff de combate (velocidade, resistência, armamento).

### Exemplo — F-22

| Mastery | Recompensa |
| --- | --- |
| 1 | Aeronave disponível |
| 2 | Emblema F-22 |
| 3 | Pintura alternativa |
| 4 | 500 Credits |
| 5 | Insígnia de domínio |
| 6 | Moldura de perfil |
| 7 | Efeito visual |
| 8 | 1.000 Credits |
| 9 | Título “Raptor Specialist” |
| 10 | Skin exclusiva Mastery |

### Mastery XP por partida (até ~200)

| Fonte | XP |
| --- | --- |
| Participar | 100 |
| Concluir objetivos | até +50 |
| Excelente desempenho | até +50 |

Resolve o problema de “já tenho 10 aeronaves e nada para fazer”: cada uma vira coleção + domínio.

---

## 7. Ritmo de progressão (simulação)

**Premissas do jogador moderado**

- ~200 Credits / partida
- 3 partidas / dia
- Até 450 Credits / dia em desafios
- 1.500 Credits / semana em Weekly Operations

| Fonte | Média semanal |
| --- | --- |
| Partidas (3×7×200) | 4.200 |
| Desafios diários | 3.150 |
| Operações semanais | 1.500 |
| **Total** | **~8.850 Credits** |

| Objetivo | Custo | Tempo aproximado |
| --- | --- | --- |
| Segunda aeronave | 8.000 | ~1 semana |
| Entrada | 18.000 | ~2 semanas |
| Intermediária | 32.000 | ~4 semanas |
| Avançada | 50.000 | ~6 semanas |
| Especializada | 75.000 | ~9 semanas |
| Elite | 100.000 | ~12 semanas |

Prazos assumem Credits acumulados **sem** gastar em cosméticos. A escolha “nova aeronave vs. personalização” é intencional.

**Meta de sink:** jogador moderado gasta ~60–75% dos Credits ganhos em itens, mantendo reserva para metas maiores (indicador de saúde, não obrigação).

---

## 8. Loja de personalização

Quatro raridades. Raridade = complexidade visual / exclusividade — **nunca** poder de combate.

| Raridade | Exemplos | Preço |
| --- | --- | --- |
| Common | Pinturas básicas, emblemas simples | 500–1.500 Credits |
| Rare | Camuflagens, decalques | 2.000–4.000 Credits |
| Epic | Pinturas elaboradas, efeitos | 6.000–10.000 Credits **ou** 150–250 DC |
| Legendary | Skins especiais, efeitos exclusivos | 300–600 DC |

Manter lendários conquistáveis por desafios difíceis, eventos e Mastery.

### Tabela de referência de preços

| Produto | Credits | Dashi Coins |
| --- | --- | --- |
| Emblema comum | 500 | — |
| Emblema especial | 2.000 | 50 |
| Pintura básica | 1.500 | — |
| Pintura especial | 4.000 | 100 |
| Efeito de fumaça | 3.000 | 100 |
| Efeito de entrada | — | 150 |
| Moldura de perfil | 2.000 | 75 |
| Decoração de hangar | 5.000 | 150 |
| Skin lendária | — | 400 |
| Pacote de personalização | 8.000 | 250 |

---

## 9. Dashi Coins — tabela comercial

Valores sugeridos (sujeitos a impostos, taxas de plataforma e validação comercial).

| Pacote | Preço | Preço / DC |
| --- | --- | --- |
| 100 DC | R$ 4,90 | R$ 0,049 |
| 250 DC | R$ 9,90 | R$ 0,0396 |
| 600 DC | R$ 19,90 | R$ 0,0332 |
| 1.500 DC | R$ 39,90 | R$ 0,0266 |
| 3.500 DC | R$ 79,90 | R$ 0,0228 |

### Categorias de oferta

| Oferta | Descrição |
| --- | --- |
| Starter Pack | Único, para novos jogadores |
| Seasonal Pack | Temático da temporada |
| Special Collection | Coleções premium de skins/efeitos |

**Proibido nestes pacotes:** aeronaves, armamentos ou vantagens competitivas.

---

## 10. XP, níveis e patentes

Carreira independente do saldo.

### Patentes

| Patente | Níveis |
| --- | --- |
| Cadete | 1–4 |
| Aspirante | 5–9 |
| Segundo-Tenente | 10–14 |
| Primeiro-Tenente | 15–19 |
| Capitão | 20–29 |
| Major | 30–39 |
| Tenente-Coronel | 40–49 |
| Coronel | 50–59 |
| General | 60–79 |
| General de Elite | 80–100 |

### XP por atividade

| Atividade | XP |
| --- | --- |
| Checkpoint | 100 |
| Anti-Drone | 140 |
| Defesa aérea | 160 |
| Missão de ataque | 170 |
| Team vs Team | 140 |
| Desafio diário | 100 |
| Desafio semanal | 300 |

XP mesmo em derrota, se houve participação efetiva. Patente militar **não** pode ser comprada.

### Curva de XP por nível

| Faixa | XP por nível |
| --- | --- |
| 1–10 | 500 |
| 11–20 | 800 |
| 21–30 | 1.200 |
| 31–40 | 1.600 |
| 41–50 | 2.000 |
| 51–60 | 2.500 |
| 61–70 | 3.000 |
| 71–80 | 3.500 |
| 81–90 | 4.000 |
| 91–100 | 5.000 |

Primeiros níveis rápidos; finais = dedicação. Recompensas de nível devem crescer junto com a curva.

---

## 11. Battle Pass e temporadas

- Duração: **8 semanas**
- Níveis de recompensa: **30–40**

| Plano | Preço |
| --- | --- |
| Free Pass | Gratuito |
| Premium Pass | R$ 24,90 |
| Premium Bundle | R$ 39,90 (passe + alguns níveis iniciais; não entrega tudo) |

### Distribuição exemplo (por temporada)

| Tipo | Qtd. |
| --- | --- |
| Cosméticos | 15 |
| Pacotes de Credits | 8 |
| Emblemas | 5 |
| Itens de perfil | 4 |
| Skins especiais | 3 |
| Recompensa final | 1 |

Free Pass deve ser interessante. Premium = mais variedade, **não** exclusividade competitiva.

---

## 12. Controle de inflação (sinks)

Jogador antigo com saldo alto precisa de destinos recorrentes.

| Sink | Objetivo |
| --- | --- |
| Aeronaves | Progressão principal |
| Personalizações | Gasto recorrente |
| Hangar | Personalização |
| Coleções | Metas de médio prazo |
| Eventos | Gastos temporários |
| Itens de perfil | Prestígio |

**Não** usar reparos/combustível/munição como sink.

Oferecer itens em várias faixas de preço para saldos pequenos e grandes.

---

## 13. Métricas de saúde da economia

| Indicador | O que revela |
| --- | --- |
| Credits earned/day | Entrada de moeda |
| Credits spent/day | Saída de moeda |
| Average wallet balance | Acúmulo |
| Time to Next Aircraft | Ritmo de progressão (crítico) |
| Purchase conversion | % que compra |
| ARPPU | Receita por pagante |
| D1 / D7 / D30 | Retenção |
| Aircraft usage | Popularidade / balanceamento |

Se Time to Next Aircraft estiver muito alto ou baixo, ajustar recompensas/preços — não reconstruir a arquitetura.

Se ~80% dos jogadores usarem a mesma aeronave, investigar balanceamento de gameplay (não só preço).

---

## 14. Arquitetura técnica

Godot (cliente) + serviço central de economia. **Nenhum modo controla saldo sozinho.**

```
ECONOMY
├── Wallet (Credits, Dashi Coins)
├── Rewards (Match, Daily, Weekly, Event)
├── Progression (XP, Levels, Ranks)
├── Aircraft (Unlocks, Collection, Mastery)
├── Inventory (Skins, Emblems, Cosmetics)
├── Store (Credits, Premium, Seasonal)
└── Achievements (Medals, Challenges)
```

### Tabelas iniciais (ex.: Supabase)

| Tabela | Finalidade |
| --- | --- |
| `player_wallets` | Saldos |
| `wallet_transactions` | Histórico imutável (cliente só lê) |
| `player_progression` | XP, níveis, patentes |
| `aircraft_catalog` | Catálogo |
| `player_aircraft` | Desbloqueios |
| `aircraft_mastery` | Domínio por aeronave |
| `item_catalog` | Itens disponíveis |
| `player_inventory` | Itens do jogador |
| `game_rewards` | Config de recompensas |
| `player_missions` | Missões ativas/concluídas |
| `player_achievements` | Medalhas / conquistas |
| `store_products` | Produtos |
| `store_purchases` | Compras |
| `seasons` | Temporadas |
| `season_progress` | Progresso do passe |

Backend valida partidas, calcula recompensas, debita compras e concede itens. Cada recompensa com **ID único** (idempotência / anti-duplicação).

---

## 15. Baseline oficial v1.0

| Parâmetro | Definição |
| --- | --- |
| Moeda free | Credits |
| Moeda premium | Dashi Coins |
| Conquista | Medals |
| Progressão | XP |
| Média por partida | ~200 Credits |
| Máx. diário missões | 450 Credits |
| Semanal missões | 1.500 Credits |
| Aeronave inicial | Gratuita (escolha F-22 / F-15) |
| Segunda inicial | 8.000 |
| Entrada → Elite | 18k / 32k / 50k / 75k / 100k |
| Temporada | 8 semanas |
| Premium Pass | R$ 24,90 |
| Assinatura VIP | Fora do escopo inicial |
| Pay-to-Win | Não permitido |

### Escopo mínimo de lançamento

- 2 aeronaves
- 10–15 cosméticos desejáveis
- Progressão clara (Credits + XP)
- Evitar loja inchada sem valor percebido

### Três jornadas do jogador

| Jornada | Conteúdo |
| --- | --- |
| **Jogar** | Missões, combates, desafios |
| **Evoluir** | Aeronaves, patentes, coleções |
| **Colecionar** | Personalização, prestígio, exclusivos |

Free-to-play completo; pagante investe em **identidade**, não em poder.

---

## 16. To-do de implementação

Ordem recomendada. Marcar conforme avançar.

### Fase 0 — Fundação

- [ ] Definir schemas das tabelas (`player_wallets`, `wallet_transactions`, etc.)
- [ ] Serviço central de economia (API) separado do gameplay Godot
- [ ] Autenticação de jogador + vínculo wallet ↔ conta
- [ ] Transações imutáveis + IDs de recompensa idempotentes
- [ ] Feature flags / config remota para preços e recompensas (ajustar sem build)

### Fase 1 — Wallet e recompensas de partida

- [ ] Wallet: Credits (+ stub Dashi Coins)
- [ ] Endpoint de concessão de recompensa pós-partida (validação server-side)
- [ ] Tabela de recompensas-base por modo (seção 2)
- [ ] Sistema de bônus com teto por partida
- [ ] Regras: abandono, anti-farm, sem penalidade por derrota
- [ ] Telemetria: Credits earned/spent/day, wallet médio

### Fase 2 — XP, níveis e patentes

- [ ] Concessão de XP por modo/missão
- [ ] Curva de XP (seção 10)
- [ ] Mapeamento nível → patente
- [ ] UI de perfil: nível, patente, progresso
- [ ] Recompensas de level-up (mesmo que cosméticas simples)

### Fase 3 — Aeronaves e desbloqueio

- [ ] Catálogo inicial: F-22 + F-15
- [ ] Onboarding: escolha da aeronave gratuita
- [ ] Compra/desbloqueio da segunda por 8.000 Credits
- [ ] Persistência `player_aircraft`
- [ ] Preparar categorias de preço para expansões futuras
- [ ] Matriz de atributos F-22 / F-15 + testes de feel por modo
- [ ] Métrica: Time to Next Aircraft + aircraft usage

### Fase 4 — Inventário e personalização (Credits)

- [ ] Catálogo de itens (raridades Common–Rare no mínimo)
- [ ] Inventário do jogador + equipar skin/emblema/moldura
- [ ] Loja Credits com 10–15 itens iniciais
- [ ] Preços alinhados à seção 8
- [ ] Sinks básicos ativos (não só acumular)

### Fase 5 — Aircraft Mastery

- [ ] Mastery XP por aeronave (cap ~200/partida)
- [ ] 10 níveis de Mastery com recompensas cosméticas/Credits
- [ ] UI de progresso por aeronave
- [ ] Garantir: Mastery **não** altera stats de combate

### Fase 6 — Missões diárias e semanais

- [ ] Daily Operations (3 + bônus 450)
- [ ] Weekly Operations (1.500)
- [ ] Rotação de desafios (modos/aeronaves diferentes)
- [ ] UI de missões + countdown de refresh
- [ ] Validação server-side de progresso

### Fase 7 — Medalhas e conquistas

- [ ] Catálogo de Medals (feitos específicos)
- [ ] Concessão não comprável / não negociável
- [ ] Exibição em perfil

### Fase 8 — Dashi Coins e loja premium

- [ ] Tabela de pacotes DC (seção 9)
- [ ] Integração de pagamento (plataforma alvo)
- [ ] Loja premium: Epic/Legendary só cosmético
- [ ] Starter Pack (one-time)
- [ ] Bloquear qualquer item com vantagem competitiva
- [ ] Métricas: conversion, ARPPU

### Fase 9 — Battle Pass / temporadas

- [ ] Modelo de temporada (8 semanas, 30–40 níveis)
- [ ] Tracks Free + Premium
- [ ] Premium Pass R$ 24,90 + Bundle R$ 39,90
- [ ] Distribuição de recompensas (seção 11)
- [ ] Progressão por XP de temporada / challenges
- [ ] Seasonal Pack / Special Collection

### Fase 10 — Eventos, polish e balanceamento contínuo

- [ ] Special Operations (eventos temporários)
- [ ] Dashboard interno dos indicadores (seção 13)
- [ ] Loop de ajuste: preços, recompensas, caps de bônus
- [ ] Expansão de catálogo de aeronaves (entrada → elite) conforme conteúdo
- [ ] Revisar sinks se average wallet crescer demais
- [ ] Documentar deltas de balanceamento (changelog econômico)

### Checklist de qualidade antes de cada release econômico

- [ ] Nenhuma compra DC afeta combate
- [ ] Toda recompensa passa pelo serviço central
- [ ] Transações auditáveis
- [ ] Idempotência testada (retry não duplica Credits)
- [ ] Free path completo até a segunda aeronave sem pagar
- [ ] Telemetria mínima ligada (earned, spent, TTA, usage)

---

## Referências de UX (inspiração, não cópia)

- Battle Pass / Operation Pass com tracks free/premium e metas de longo prazo
- Aircraft Tree com sinks secundários (peças/armas) — no AirForceDashi, Mastery + cosméticos cumprem papel similar sem pay-to-win
- Missões diárias com meta meta (pontos → crate) e lista clara de objetivos
- Perfil com moedas, stats e identidade visual do piloto

---

*Documento vivo. Baseline v1.0 — ajustar números com dados reais; preservar arquitetura e princípios.*
