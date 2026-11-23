"""Build Dashi AFB hard-surface blockout into pacific_islands_16km.blend."""
from __future__ import annotations

import math
import os

import bpy
from mathutils import Vector

BLEND = r"C:\Users\Gabriell\Documents\AirForceDashi\assets\maps\pacific_islands\pacific_islands_16km.blend"
OX, OZ, OY = -2200.0, -1800.0, 58.0


def ensure_coll(name: str):
    if name in bpy.data.collections:
        return bpy.data.collections[name]
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def mat(name: str, rgb, rough=0.7, metal=0.05):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = rough
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metal
    return m


def box(coll, name, size, loc, mats=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(OX + loc[0], OZ + loc[1], OY + loc[2]))
    ob = bpy.context.active_object
    ob.name = name
    # Cube default size=1 → side length 1; scale to full metres.
    ob.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mats:
        ob.data.materials.clear()
        ob.data.materials.append(mats)
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll.objects.link(ob)
    return ob


def cyl(coll, name, r, h, loc, mats=None, seg=16):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=seg, location=(OX + loc[0], OZ + loc[1], OY + loc[2]))
    ob = bpy.context.active_object
    ob.name = name
    if mats:
        ob.data.materials.clear()
        ob.data.materials.append(mats)
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll.objects.link(ob)
    return ob


def clear_afb():
    for o in list(bpy.data.objects):
        if o.name.startswith("AFB_"):
            bpy.data.objects.remove(o, do_unlink=True)


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    clear_afb()
    coll = ensure_coll("03_Airbase")

    asphalt = mat("M_AFB_Asphalt", (0.05, 0.05, 0.06), 0.9)
    concrete = mat("M_AFB_Concrete", (0.35, 0.34, 0.3), 0.85)
    steel = mat("M_AFB_Steel", (0.2, 0.22, 0.26), 0.4, 0.55)
    dark = mat("M_AFB_Dark", (0.05, 0.06, 0.07), 0.7, 0.15)
    earth = mat("M_AFB_Earth", (0.2, 0.15, 0.1), 0.95)
    mark = mat("M_AFB_Mark", (0.85, 0.84, 0.78), 0.65)

    # Runway + blast
    box(coll, "AFB_Runway", (3500, 60, 0.12), (0, 0, 0.08), asphalt)
    box(coll, "AFB_BlastW", (220, 68, 0.1), (-1860, 0, 0.07), concrete)
    box(coll, "AFB_BlastE", (220, 68, 0.1), (1860, 0, 0.07), concrete)
    box(coll, "AFB_Taxi", (3300, 28, 0.11), (0, 95, 0.075), asphalt)
    box(coll, "AFB_ApronMain", (900, 220, 0.1), (-200, 255, 0.06), concrete)
    box(coll, "AFB_ApronAlert", (520, 180, 0.1), (520, 235, 0.06), concrete)

    # Hangars as boxes (vault detail lives in game mesh)
    for i, lx in enumerate((-780, -620, -460)):
        box(coll, f"AFB_Hangar_{i}", (54, 72, 16.5), (lx, 460, 8.25), steel)
    for i, lz in enumerate((380, 480, 580, 680)):
        box(coll, f"AFB_HAS_{i}", (24.5, 36, 8.2), (-980, lz, 4.1), concrete)
        box(coll, f"AFB_HAS_berm_{i}", (32, 22, 4.5), (-980, lz + 4, 2.3), earth)
    box(coll, "AFB_HAS_4", (24.5, 36, 8.2), (-880, 380, 4.1), concrete)
    box(coll, "AFB_HAS_5", (24.5, 36, 8.2), (-880, 480, 4.1), concrete)

    # Fuel
    box(coll, "AFB_FuelBund", (72, 70, 1.6), (-520, 180, 0.85), concrete)
    for i, (dx, dz) in enumerate(((-18, -18), (18, -18), (-18, 18), (18, 18), (0, 0), (0, -28))):
        cyl(coll, f"AFB_Tank_{i}", 8.5, 11, (-520 + dx, 180 + dz, 5.6), steel, 20)

    # Ammo
    for i, lz in enumerate((200, 280, 360, 440)):
        box(coll, f"AFB_Bunker_{i}", (18, 28, 7), (-1100, lz, 3.5), earth)
        box(coll, f"AFB_BunkerFace_{i}", (16, 1.2, 5.2), (-1100, lz - 15, 2.7), concrete)

    # Admin
    box(coll, "AFB_HQ", (48, 28, 11.4), (420, 520, 5.7), concrete)
    for i, lx in enumerate((280, 360, 440, 520)):
        box(coll, f"AFB_Barracks_{i}", (16, 44, 10.5), (lx, 620, 5.25), concrete)
    box(coll, "AFB_Fire", (42, 28, 9), (180, 200, 4.5), concrete)

    # Helipads
    for i, (lx, lz) in enumerate(((680, 420), (760, 420), (680, 500), (760, 500))):
        cyl(coll, f"AFB_Helipad_{i}", 12.5, 0.18, (lx, lz, 0.12), concrete, 24)
        box(coll, f"AFB_HMark_{i}", (5.6, 1.2, 0.05), (lx, lz, 0.22), mark)

    # Remove old proxy runway/hangars if present
    for name in ("Airbase_Runway", "Airbase_Tower", "Airbase_Hangar_1", "Airbase_Hangar_2", "Airbase_Hangar_3"):
        if name in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print("AFB blockout saved", BLEND)
    print("objects", sum(1 for o in bpy.data.objects if o.name.startswith("AFB_")))


if __name__ == "__main__":
    main()
