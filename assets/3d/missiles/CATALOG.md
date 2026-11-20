# Missile / bomb catalog

Source pack: `missile__bomb_collection_-_fighter_jets_-_free.glb`
Each file is one weapon, nose on local −Z, length ≈ 2.4 units (game scale).

| Slug | Display name | Tris | File |
| --- | --- | ---: | --- |
| `agm-114-hellfire` | AGM-114 Hellfire | 340 | `agm-114-hellfire.glb` |
| `agm-65-maverick` | AGM-65 Maverick | 514 | `agm-65-maverick.glb` |
| `aim-7-sparrow` | AIM-7 Sparrow | 300 | `aim-7-sparrow.glb` |
| `aim-9-sidewinder` | AIM-9 Sidewinder | 436 | `aim-9-sidewinder.glb` |
| `gbu-12-paveway-ii` | GBU-12 Paveway II | 828 | `gbu-12-paveway-ii.glb` |
| `hj-10` | HJ-10 | 568 | `hj-10.glb` |
| `jdam` | JDAM | 666 | `jdam.glb` |
| `jdam-b` | JDAM (2) | 666 | `jdam-b.glb` |
| `kab-500l` | KAB-500L | 696 | `kab-500l.glb` |
| `kh-29` | Kh-29 | 400 | `kh-29.glb` |
| `pl-11` | PL-11 | 568 | `pl-11.glb` |
| `pl-11-b` | PL-11 (2) | 452 | `pl-11-b.glb` |
| `r-27` | R-27 | 304 | `r-27.glb` |
| `r-27-b` | R-27 (2) | 574 | `r-27-b.glb` |
| `r-77` | R-77 | 1012 | `r-77.glb` |
| `ty-90` | TY-90 | 470 | `ty-90.glb` |

## Notes

- Duplicate variants keep the pack naming (`jdam-b`, `pl-11-b`, `r-27-b`).
- Materials come from the source GLB; no bake in this pass.
- Public copies live under `apps/web/public/models/missiles/`.
- **F-22 Raptor (jogável):** `aim-9-sidewinder` (AA) + `jdam` (AG) — ver `packages/game-core/src/progress/weapons.ts`.
