# Air Force Dashi

<p align="center">
  <img src="docs/images/icon.svg" width="72" alt="Air Force Dashi icon" />
</p>

<p align="center">
  <strong>Brinquedo de voo com F-22</strong> — país de lagos no fim da tarde,<br/>
  mundo procedural, missões CheckPoint e Vôo Livre.
</p>

<p align="center">
  <img src="docs/images/hero-f22.png" width="520" alt="F-22 pixel art — title art" />
</p>

<p align="center">
  <a href="#modos-de-jogo"><img src="https://img.shields.io/badge/Godot-4.7-478cbf?logo=godotengine&logoColor=white" alt="Godot 4.7" /></a>
  <a href="#como-jogar"><img src="https://img.shields.io/badge/platform-Windows-0078d4?logo=windows&logoColor=white" alt="Windows" /></a>
  <a href="#licença"><img src="https://img.shields.io/badge/license-MIT-grey" alt="MIT" /></a>
</p>

---

## Capturas

### Vôo Livre

Explore o mapa procedural em câmera chase, com cidade, névoa e horizonte aberto.

![Vôo Livre — chase cam sobre a cidade](docs/images/screenshot-voo-livre.png)

### CheckPoint

Trinta níveis progressivos de anéis no ar — gates, tempo e rota cada vez mais exigentes.

![CheckPoint — curso aéreo](docs/images/screenshot-checkpoint.png)

### Title art

Arte pixel do F-22 (com detalhe da bandeira de São Paulo na fuselagem) usada na tela inicial.

![F-22 title art](docs/images/hero-f22.png)

---

## Sobre

**Air Force Dashi** é um *flying toy* arcade feito em **Godot 4.7** (Forward Plus) para desktop Windows. O foco é sensação de voo, leitura pixel e um mundo vivo — não um simulador militar pesado.

### Destaques

- **Dois modos** na tela inicial: **CheckPoint** e **Vôo Livre**
- Mundo **10×** com heightmap procedural, biomas, ruas, skyline com LOD e fade
- Voo arcade **WASD** + mouse como trim leve
- HUD estilo F-22 (CCIP, tapes, avisos) e cockpits
- Mísseis com traçante, explosões em estágios e colisão em prédios
- Ciclo dia/noite (~12+12 min), névoa matinal, nuvens densas à tarde, chuva leve ocasional
- Tráfego aéreo distante (silhuetas) e áudio sintético / amostrado
- Paleta de menus: **preto · vermelho · branco · cinza** (Bebas Neue + Barlow)

---

## Modos de jogo

| Modo | O que é |
|------|---------|
| **CheckPoint** | 30 níveis progressivos de anéis no ar. Progresso salvo localmente. |
| **Vôo Livre** | Explore o cenário sem missão — lagos, cidades, aeroportos. |

**CheckPoint — atalhos**

| Tecla | Ação |
|-------|------|
| **R** | Reiniciar o nível |
| **N** | Próximo nível (após clear) |

---

## Controles

| Input | Ação |
|-------|------|
| **W / S** | Subir / descer |
| **A / D** | Bank + curva |
| **LMB** | Disparar míssil |
| **RMB** | Afterburner (segurar) |
| **F** | Barrel roll |
| Mouse | Trim leve (com WASD solto) |
| **Space** | Ciclar câmera (top → chase → cockpit → free) |
| **Esc** | Pause (som + sensibilidade do mouse) |
| **M** | Ligar/desligar som |

---

## Como jogar

### Requisitos

- [Godot 4.7+](https://godotengine.org/download) (Forward Plus)
- Windows 10/11 (desenvolvido e testado neste alvo)

### Abrir no editor

1. Clone o repositório
2. Abra a pasta no Godot 4.7+
3. Rode a cena principal `scenes/main.tscn` (**F5**)

```bash
git clone https://github.com/DashiGabriell/AirForceDashi.git
cd AirForceDashi
godot --path .
```

No Windows também há `run.bat`, se preferir.

---

## Estrutura do projeto

```
AirForceDashi/
├── scenes/           # main, world, jet, camera
├── scripts/
│   ├── aircraft/     # jet + mesh procedural
│   ├── missions/     # CheckPoint (30 níveis + course)
│   ├── world/        # terreno, prédios, clima, tráfego…
│   ├── ui/           # title, HUD, pause, checkpoint UI
│   ├── fx/           # impactos, chuva, aim marker
│   └── autoloads/    # Game, áudio
├── shaders/          # terrain, sky, clouds, buildings, dither
├── assets/ui/        # arte do título (F-22)
├── fonts/            # Bebas Neue, Barlow, mono
└── docs/images/      # imagens do README
```

---

## Desenvolvimento

Validação headless útil:

```bash
godot --headless --path . -s res://scripts/validate.gd
godot --headless --path . -s res://scripts/validate_checkpoint.gd
```

Captura de screenshots para docs (abre janela breve):

```bash
godot --path . -s res://scripts/capture_readme.gd
```

Progresso de CheckPoint e opções ficam em `user://airforce_dashi.cfg`.

---

## Créditos

- Projeto: **DashiGabriell**
- Engine: [Godot](https://godotengine.org/)
- Fontes: [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue), [Barlow](https://fonts.google.com/specimen/Barlow) (OFL)

---

## Licença

Distribuído sob os termos da licença **MIT**. Veja [LICENSE](LICENSE).
