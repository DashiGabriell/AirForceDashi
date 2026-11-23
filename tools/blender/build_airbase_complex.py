"""Rebuild Dashi AFB proxies in the Pacific Islands Blender scene.

Matches packages/game-core/src/world/airbaseLayout.ts world anchors.
Run via Blender MCP execute_blender_code or:
  blender pacific_islands_16km.blend --background --python this_file.py
"""
from __future__ import annotations

import math
from typing import Iterable

import bpy
from mathutils import Vector

# World XZ (game) → Blender XY, Z up
CX, CY = -2200.0, -1800.0
PAD = 58.0


def ensure_collection(name: str) -> bpy.types.Collection:
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def clear_prefixed(prefixes: Iterable[str]) -> None:
    for obj in list(bpy.data.objects):
        if any(obj.name.startswith(p) for p in prefixes):
            bpy.data.objects.remove(obj, do_unlink=True)


def mat(name: str, color: tuple[float, float, float], rough=0.7) -> bpy.types.Material:
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    return m


def link(obj: bpy.types.Object, col: bpy.types.Collection) -> None:
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def box(name: str, size: Vector, loc: Vector, mat_ref: bpy.types.Material, col: bpy.types.Collection) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size * 0.5
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if obj.data.materials:
        obj.data.materials[0] = mat_ref
    else:
        obj.data.materials.append(mat_ref)
    link(obj, col)
    return obj


def cyl(name: str, r: float, depth: float, loc: Vector, mat_ref: bpy.types.Material, col: bpy.types.Collection, verts=16) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts)
    obj = bpy.context.active_object
    obj.name = name
    if obj.data.materials:
        obj.data.materials[0] = mat_ref
    else:
        obj.data.materials.append(mat_ref)
    link(obj, col)
    return obj


def main() -> None:
    col = ensure_collection("03_Airbase")
    clear_prefixed(
        (
            "Airbase_Runway",
            "Airbase_Blast",
            "Airbase_Taxi",
            "Airbase_Apron",
            "Airbase_Hangar",
            "Airbase_HAS",
            "Airbase_Fuel",
            "Airbase_Bunker",
            "Airbase_HQ",
            "Airbase_Barracks",
            "Airbase_Fire",
            "Airbase_Helipad",
            "Airbase_Tower",
            "POI_Airbase",
        )
    )

    asphalt = mat("M_AFB_Asphalt", (0.05, 0.05, 0.06), 0.9)
    concrete = mat("M_AFB_Concrete", (0.35, 0.34, 0.32), 0.8)
    steel = mat("M_AFB_Steel", (0.25, 0.28, 0.32), 0.45)
    earth = mat("M_AFB_Earth", (0.2, 0.16, 0.1), 0.95)

    def W(lx: float, ly: float, z: float = PAD) -> Vector:
        return Vector((CX + lx, CY + ly, z))

    # Runway + blast pads
    box("Airbase_Runway", Vector((3500, 60, 0.12)), W(0, 0, PAD + 0.08), asphalt, col)
    box("Airbase_Blast_W", Vector((220, 68, 0.1)), W(-1860, 0, PAD + 0.07), concrete, col)
    box("Airbase_Blast_E", Vector((220, 68, 0.1)), W(1860, 0, PAD + 0.07), concrete, col)
    box("Airbase_Taxi_Alpha", Vector((3220, 28, 0.1)), W(-80, 120, PAD + 0.07), asphalt, col)
    box("Airbase_Apron_Main", Vector((520, 220, 0.1)), W(-200, 280, PAD + 0.06), concrete, col)
    box("Airbase_Apron_Alert", Vector((280, 180, 0.1)), W(520, 260, PAD + 0.06), concrete, col)

    # Hangars (box proxies + arched note via scaled cylinder half isn't trivial; use boxes + ribs)
    for i, lx in enumerate((-780, -620)):
        box(f"Airbase_Hangar_{i+1}", Vector((54, 72, 16.5)), W(lx, 460, PAD + 8.25), steel, col)

    for i in range(4):
        box(f"Airbase_HAS_{i+1}", Vector((24.5, 36, 8.2)), W(-980, 380 + i * 100, PAD + 4.1), concrete, col)

    # Fuel tanks
    for i, (dx, dy) in enumerate(((-30, -28), (0, -28), (30, -28), (-30, 12), (0, 12), (30, 12))):
        cyl(f"Airbase_Fuel_{i+1}", 9.0, 10.0, W(-520 + dx, 180 + dy, PAD + 5.1), steel, col)

    for i in range(4):
        box(f"Airbase_Bunker_{i+1}", Vector((20, 28, 5.5)), W(-1100, 200 + i * 80, PAD + 2.75), earth, col)

    box("Airbase_HQ", Vector((36, 28, 11.4)), W(420, 520, PAD + 5.7), concrete, col)
    for i, name in enumerate("ABCD"):
        box(f"Airbase_Barracks_{name}", Vector((16, 40, 10.5)), W(280 + i * 80, 620, PAD + 5.25), concrete, col)
    box("Airbase_Fire", Vector((42, 24, 6)), W(180, 200, PAD + 3), concrete, col)

    for i, (lx, ly) in enumerate(((680, 420), (720, 480), (760, 540), (800, 600))):
        cyl(f"Airbase_Helipad_{i+1}", 12.5, 0.12, W(lx, ly, PAD + 0.1), asphalt, col, verts=24)

    empty = bpy.data.objects.new("POI_Airbase", None)
    empty.location = W(0, 0, PAD + 8)
    empty.empty_display_size = 40
    link(empty, col)
    empty.hide_render = True

    out = r"C:\Users\Gabriell\Documents\AirForceDashi\assets\maps\pacific_islands\pacific_islands_16km.blend"
    bpy.ops.wm.save_as_mainfile(filepath=out)
    print("Airbase rebuilt at", CX, CY, "saved", out)


if __name__ == "__main__":
    main()
