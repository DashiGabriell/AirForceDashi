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

    # Hangars — shell + soft detail (vault ribs live in game ExtrudeGeometry)
    cladding = mat("M_AFB_Cladding", (0.28, 0.30, 0.34), 0.55, 0.42)
    for i, lx in enumerate((-780, -620, -460)):
        lz = 460.0
        span, depth, height = 54.0, 72.0, 16.5
        r = span * 0.5
        z_front = lz - depth * 0.5
        z_back = lz + depth * 0.5
        p = f"AFB_Hangar_{i}"
        box(coll, p, (span, depth, height), (lx, lz, height * 0.5), cladding)
        box(coll, f"{p}_sillL", (1.8, depth + 2, 1.1), (lx - r - 0.2, lz, 0.55), concrete)
        box(coll, f"{p}_sillR", (1.8, depth + 2, 1.1), (lx + r + 0.2, lz, 0.55), concrete)
        box(coll, f"{p}_ridge", (1.2, depth - 2, 0.7), (lx, lz, height + 0.15), steel)
        for vi in range(5):
            vz = z_front + 10 + vi * 12
            box(coll, f"{p}_vent{vi}", (3.2, 2.4, 1.1), (lx, vz, height + 0.9), dark)
        box(coll, f"{p}_rear", (span - 2, 0.45, height * 0.92), (lx, z_back - 0.3, height * 0.46), cladding)
        box(coll, f"{p}_svc", (4.2, 0.35, 3.6), (lx, z_back + 0.05, 1.9), dark)
        box(coll, f"{p}_track", (span + 3.5, 1.6, 1.15), (lx, z_front - 0.9, height * 0.98), steel)
        leaf_w = span / 4
        leaf_h = height * 0.78
        for leaf in range(4):
            cx = lx - span * 0.5 + leaf_w * (leaf + 0.5)
            box(coll, f"{p}_door{leaf}", (leaf_w - 0.55, 0.42, leaf_h), (cx, z_front - 0.25, leaf_h * 0.5 + 0.15), dark)
            box(coll, f"{p}_stiff{leaf}", (leaf_w - 0.9, 0.5, 0.28), (cx, z_front + 0.05, leaf_h * 0.55), steel)
        box(coll, f"{p}_jambL", (0.7, 1.2, height * 0.9), (lx - r + 0.2, z_front - 0.4, height * 0.45), steel)
        box(coll, f"{p}_jambR", (0.7, 1.2, height * 0.9), (lx + r - 0.2, z_front - 0.4, height * 0.45), steel)
        box(coll, f"{p}_apron", (span + 14, 22, 0.1), (lx, z_front - 14, 0.07), concrete)
        box(coll, f"{p}_drain", (span + 12, 0.55, 0.12), (lx, z_front - 3.2, 0.14), dark)
    # HAS — shell + berm + blast doors + wing walls (vault ribs live in game)
    has_sites = [(-980, 380), (-980, 480), (-980, 580), (-980, 680), (-880, 380), (-880, 480)]
    for i, (lx, lz) in enumerate(has_sites):
        span, depth, height = 24.5, 36.0, 8.2
        r = span * 0.5
        z_front = lz - depth * 0.5
        z_back = lz + depth * 0.5
        p = f"AFB_HAS_{i}"
        box(coll, p, (span, depth, height), (lx, lz, height * 0.5), concrete)
        box(coll, f"{p}_berm", (span + 10, depth * 0.62, height * 0.62), (lx, lz + 4, height * 0.32), earth)
        box(coll, f"{p}_bermR", (span + 14, depth * 0.4, height * 0.38), (lx, lz + 8, height * 0.2), earth)
        box(coll, f"{p}_shoulderL", (5.5, depth * 0.85, height * 0.7), (lx - r - 4, lz + 1, height * 0.35), earth)
        box(coll, f"{p}_shoulderR", (5.5, depth * 0.85, height * 0.7), (lx + r + 4, lz + 1, height * 0.35), earth)
        box(coll, f"{p}_rear", (span - 1.5, 0.7, height * 0.95), (lx, z_back - 0.2, height * 0.48), concrete)
        box(coll, f"{p}_svc", (2.4, 0.35, 2.8), (lx, z_back + 0.25, 1.5), dark)
        box(coll, f"{p}_wingL", (3.2, 14, 5.2), (lx - r - 0.6, z_front - 5, 2.6), concrete)
        box(coll, f"{p}_wingR", (3.2, 14, 5.2), (lx + r + 0.6, z_front - 5, 2.6), concrete)
        box(coll, f"{p}_track", (span + 2.5, 1.4, 1.1), (lx, z_front - 0.7, height * 0.95), steel)
        leaf_w = span * 0.48
        leaf_h = height * 0.88
        for side, tag in ((-1, "L"), (1, "R")):
            cx = lx + side * span * 0.25
            box(coll, f"{p}_door{tag}", (leaf_w - 0.35, 0.55, leaf_h), (cx, z_front - 0.1, leaf_h * 0.5 + 0.12), dark)
            box(coll, f"{p}_hinge{tag}", (0.55, 0.7, leaf_h + 0.4), (lx + side * (r - 0.4), z_front + 0.15, leaf_h * 0.5 + 0.2), steel)
        box(coll, f"{p}_apron", (span + 10, 16, 0.1), (lx, z_front - 10, 0.07), concrete)
        box(coll, f"{p}_drain", (span + 8, 0.55, 0.15), (lx, z_front - 2.5, 0.12), dark)

    # Fuel farm — bund, tanks with ladder/roof, manifold, loading rack, pump house
    accent = mat("M_AFB_Accent", (0.45, 0.12, 0.1), 0.65, 0.1)
    cx, cz = -520.0, 180.0
    box(coll, "AFB_FuelPad", (68, 66, 0.18), (cx, cz, 0.12), concrete)
    box(coll, "AFB_FuelSump", (8, 8, 0.22), (cx, cz + 8, 0.08), dark)
    for name, size, loc in (
        ("AFB_FuelBundN", (72, 2, 1.7), (cx, cz - 34, 0.9)),
        ("AFB_FuelBundS", (72, 2, 1.7), (cx, cz + 34, 0.9)),
        ("AFB_FuelBundW", (2, 70, 1.7), (cx - 35, cz, 0.9)),
        ("AFB_FuelBundE", (2, 70, 1.7), (cx + 35, cz, 0.9)),
    ):
        box(coll, name, size, loc, concrete)
    box(coll, "AFB_FuelRamp", (6, 10, 0.35), (cx + 38, cz, 0.35), concrete)
    for i, (dx, dz) in enumerate(((-18, -18), (18, -18), (-18, 18), (18, 18), (0, 0), (0, -28))):
        tx, tz = cx + dx, cz + dz
        cyl(coll, f"AFB_Tank_{i}", 8.5, 11, (tx, tz, 5.65), steel, 20)
        cyl(coll, f"AFB_Tank_{i}_roof", 8.3, 1.35, (tx, tz, 12.35), steel, 16)
        box(coll, f"AFB_Tank_{i}_ladder", (0.35, 0.35, 11.5), (tx + 9.05, tz, 5.9), dark)
        cyl(coll, f"AFB_Tank_{i}_pad", 9.7, 0.35, (tx, tz, 0.25), concrete, 16)
    box(coll, "AFB_FuelManifoldX", (40, 0.45, 0.45), (cx, cz - 18, 1.35), steel)
    box(coll, "AFB_FuelManifoldZ", (0.45, 36, 0.45), (cx, cz, 1.35), steel)
    box(coll, "AFB_FuelRackPad", (22, 48, 0.15), (cx + 58, cz, 0.1), concrete)
    box(coll, "AFB_FuelRackBeam", (1.0, 38, 0.55), (cx + 50, cz, 5.7), steel)
    for i in range(5):
        z = cz - 20 + i * 10
        box(coll, f"AFB_FuelBay_{i}", (3.5, 0.35, 4.2), (cx + 55, z, 2.2), dark)
    box(coll, "AFB_FuelPump", (18, 24, 6.2), (cx + 70, cz, 3.15), concrete)
    box(coll, "AFB_FuelPumpRoof", (18.5, 24.5, 0.35), (cx + 70, cz, 6.4), steel)

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
