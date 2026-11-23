# Pacific Islands — Mapa 01 (authoring)

## Freeze v1
- Mundo: **16 × 16 km** (256 km²)
- Pico: **~1800 m**
- 7 ilhas (1 principal + 4 úteis + 2 silhuetas)
- Oceano dominante; terra ~25% alvo de layout
- 16 setores lógicos **4 × 4 km**
- Clima: tropical, final de tarde

## Arquivos
| Arquivo | Uso |
|---|---|
| `pacific_islands_16km.blend` | Cena Blender de autoração |
| `heightmap_1025.png` | Heightmap 1025² (se exportado) |
| `../../tools/blender/build_pacific_islands_16km.py` | Script gerador |

## Collections
- `00_LayoutGuides` — envelopes das ilhas
- `01_Terrain` — malha 16 km
- `02_Ocean` — plano oceânico
- `03_Airbase` — pista ~2200 m + proxies
- `04_POI` — empties + carrier
- `05_Sectors_4km` — 16 setores
- `06_Environment` — sol + câmera overview

## Notas
Proxies (hangares, carrier) são âncoras visuais, não arte final.
O jogo lê este heightmap (16 km, mar a 0 m). Dashi AFB fica em **(-2200, -1800)** com pista 3500×60 m.

```
python tools/blender/flatten_airbase_pad.py
python tools/blender/export_pacific_heights.py
python tools/blender/build_dashi_afb.py   # blockout no .blend
```

Dashi AFB (pista 3500 m) fica em **(-2200, -1800)**. Para regenerar proxies no `.blend`:

```
python tools/blender/flatten_airbase_pad.py
python tools/blender/export_pacific_heights.py
# no Blender MCP / background:
# build_airbase_complex.py
```
