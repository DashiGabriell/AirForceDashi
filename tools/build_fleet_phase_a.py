"""Bake Phase A fleet airframes to game-ready GLBs.

Same contract as F-22/F-15: one exterior mesh, material Paint, nose on
Blender +Y → Three.js -Z, length ~9, ~16k tris.

Run:
  blender --background --python tools/build_fleet_phase_a.py
"""

from __future__ import annotations

import math
import os
import shutil

import bpy
import mathutils

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC_DIR = os.path.join(ROOT, "apps", "web", "public", "models")

TARGET_TRIS = 16000
TEX_SIZE = 1024
LENGTH = 9.0

# Keep only the fuselage parent (case-insensitive prefix).
FLEET = [
    {
        "id": "f16",
        "src": "F-16 Fighting Falcon.glb",
        "keep": ("f-16-airframe",),
    },
    {
        "id": "fa18",
        "src": "Boeing F-A-18F Super Hornet.glb",
        "keep": ("f18-airframe",),
    },
    {
        "id": "typhoon",
        "src": "Eurofighter Typhoon.glb",
        "keep": ("airframe",),
    },
    {
        "id": "rafale",
        "src": "Dassault Rafale (M).glb",
        "keep": ("rafale-airframe",),
    },
    {
        "id": "su35",
        "src": "Sukhoi Su-35.glb",
        "keep": ("su-35-airframe",),
    },
    {
        "id": "f35",
        "src": "F-35 Lightning II.glb",
        "keep": ("f-35-airframe",),
    },
]

GLASS_PREFIXES = ("glass", "inst-glass")
LIGHT_PREFIXES = ("landinglight", "lights", "landinglights")


def log(jet_id: str, msg: str) -> None:
    print(f"[{jet_id}] {msg}", flush=True)


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def parent_name(obj: bpy.types.Object) -> str:
    p = obj.parent
    while p is not None:
        name = p.name or ""
        if not name.startswith("Object_"):
            return name
        p = p.parent
    return ""


def material_names(obj: bpy.types.Object) -> list[str]:
    return [s.material.name for s in obj.material_slots if s.material]


def should_drop(obj: bpy.types.Object, keep_prefixes: tuple[str, ...]) -> bool:
    if obj.type != "MESH":
        return False
    parent = parent_name(obj).lower()
    base = parent.split(".")[0]
    keep = any(parent.startswith(p) or base.startswith(p) for p in keep_prefixes)
    return not keep


def has_prefix(obj: bpy.types.Object, prefixes: tuple[str, ...]) -> bool:
    mats = [n.lower() for n in material_names(obj)]
    return any(any(n.startswith(p) for p in prefixes) for n in mats)


def mesh_objects() -> list[bpy.types.Object]:
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def select_only(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def join_objects(objects: list[bpy.types.Object], name: str) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    return obj


def tri_count(obj: bpy.types.Object) -> int:
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def bake_world_matrix(obj: bpy.types.Object) -> None:
    select_only(obj)
    if obj.parent is not None:
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def vertex_bounds(obj: bpy.types.Object) -> tuple[list[float], list[float]]:
    mw = obj.matrix_world
    mn = [1e9, 1e9, 1e9]
    mx = [-1e9, -1e9, -1e9]
    for v in obj.data.vertices:
        co = mw @ v.co
        for i in range(3):
            mn[i] = min(mn[i], co[i])
            mx[i] = max(mx[i], co[i])
    return mn, mx


def game_placement(obj: bpy.types.Object, jet_id: str) -> mathutils.Matrix:
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]

    def extents(samples: list[mathutils.Vector]) -> tuple[list[float], list[float]]:
        mn = [min(p[i] for p in samples) for i in range(3)]
        mx = [max(p[i] for p in samples) for i in range(3)]
        return mn, mx

    mn, mx = extents(pts)
    size = [mx[i] - mn[i] for i in range(3)]
    axis = max(range(3), key=lambda i: size[i])
    mid = (mn[axis] + mx[axis]) * 0.5
    low = sum(1 for p in pts if p[axis] < mid)
    nose_at_min = low < (len(pts) - low)

    if axis == 1:
        rot = (
            mathutils.Matrix.Rotation(math.pi, 4, "Z")
            if nose_at_min
            else mathutils.Matrix.Identity(4)
        )
    elif axis == 0:
        ang = math.radians(-90 if nose_at_min else 90)
        rot = mathutils.Matrix.Rotation(ang, 4, "Z")
    else:
        ang = math.radians(90 if nose_at_min else -90)
        rot = mathutils.Matrix.Rotation(ang, 4, "X")

    spun = [rot @ p for p in pts]
    mn, mx = extents(spun)
    if (mx[2] - mn[2]) > (mx[0] - mn[0]):
        roll = mathutils.Matrix.Rotation(math.pi / 2, 4, "Y")
        rot = roll @ rot
        spun = [roll @ p for p in spun]
        mn, mx = extents(spun)

    length = max(mx[1] - mn[1], 0.001)
    scale = LENGTH / length
    scl = mathutils.Matrix.Scale(scale, 4)
    spun = [p * scale for p in spun]
    mn, mx = extents(spun)
    center = mathutils.Vector(((mn[i] + mx[i]) * 0.5 for i in range(3)))
    placed = mathutils.Matrix.Translation(-center) @ scl @ rot
    log(
        jet_id,
        f"placement axis={axis} nose_at_min={nose_at_min} "
        f"scale={scale:.3f} blender_size={[round(mx[i] - mn[i], 2) for i in range(3)]}",
    )
    return placed


def apply_mesh_matrix(obj: bpy.types.Object, mat: mathutils.Matrix) -> None:
    obj.data.transform(mat)
    obj.data.update()


def outward_normals(obj: bpy.types.Object) -> None:
    select_only(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def decimate(obj: bpy.types.Object, target: int, jet_id: str) -> None:
    current = tri_count(obj)
    if current <= target:
        log(jet_id, f"{obj.name} already {current} tris")
        return
    ratio = max(0.02, min(1.0, target / current))
    mod = obj.modifiers.new("Decimate", "DECIMATE")
    mod.ratio = ratio
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    log(jet_id, f"decimated {obj.name} {current} -> {tri_count(obj)} (ratio {ratio:.3f})")


def smart_uv(obj: bpy.types.Object) -> None:
    select_only(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def principled(mat: bpy.types.Material):
    if not mat or not mat.node_tree:
        return None
    for node in mat.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            return node
    return None


def force_emit_albedo(obj: bpy.types.Object) -> None:
    for slot in obj.material_slots:
        mat = slot.material
        if mat is None:
            continue
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = principled(mat)
        out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
        if out is None:
            continue
        emit = nt.nodes.new("ShaderNodeEmission")
        emit.name = "BakeEmit"
        emit.inputs["Strength"].default_value = 1.0
        base = bsdf.inputs.get("Base Color") if bsdf is not None else None
        if base is not None and base.is_linked:
            nt.links.new(base.links[0].from_socket, emit.inputs["Color"])
        elif base is not None:
            emit.inputs["Color"].default_value = base.default_value
        else:
            emit.inputs["Color"].default_value = (0.62, 0.66, 0.7, 1)
        nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])


def make_paint_material(image: bpy.types.Image) -> bpy.types.Material:
    mat = bpy.data.materials.new("Paint")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = principled(mat)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.name = "PaintTex"
    tex.image = image
    tex.location = (-320, 280)
    nt.nodes.active = tex
    if bsdf is not None:
        bsdf.inputs["Roughness"].default_value = 0.45
        bsdf.inputs["Metallic"].default_value = 0.35
    return mat


def connect_paint(mat: bpy.types.Material) -> None:
    bsdf = principled(mat)
    tex = mat.node_tree.nodes.get("PaintTex")
    if bsdf is None or tex is None:
        return
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])


def image_luma(image: bpy.types.Image) -> float:
    import array

    w, h = image.size
    buf = array.array("f", [0.0]) * (w * h * 4)
    image.pixels.foreach_get(buf)
    total = 0.0
    count = 0
    for i in range(0, len(buf), 256):
        total += buf[i] * 0.2126 + buf[i + 1] * 0.7152 + buf[i + 2] * 0.0722
        count += 1
    return total / max(count, 1)


def save_image(image: bpy.types.Image, path: str, jet_id: str) -> None:
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    log(jet_id, f"saved {path} luma={image_luma(image):.3f}")


def add_bake_targets(obj: bpy.types.Object, image: bpy.types.Image, jet_id: str) -> None:
    seen: set[int] = set()
    for slot in obj.material_slots:
        mat = slot.material
        if mat is None or id(mat) in seen:
            continue
        seen.add(id(mat))
        mat.use_nodes = True
        nt = mat.node_tree
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.name = "PaintTarget"
        tex.image = image
        for node in nt.nodes:
            node.select = False
        tex.select = True
        nt.nodes.active = tex
    log(jet_id, f"bake targets on {len(seen)} materials")


def bake_self(obj: bpy.types.Object, image: bpy.types.Image, out_png: str, jet_id: str) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    scene.cycles.use_denoising = False
    bake = scene.render.bake
    bake.use_selected_to_active = False
    bake.use_clear = True
    bake.margin = 16
    select_only(obj)
    log(jet_id, "baking Paint albedo (emit)…")
    bpy.ops.object.bake(type="EMIT")
    save_image(image, out_png, jet_id)


def fallback_gray(low: bpy.types.Object, image: bpy.types.Image, out_png: str, jet_id: str) -> None:
    log(jet_id, "source bake empty — neutral albedo")
    mat = low.data.materials[0]
    nt = mat.node_tree
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 4.5
    noise.inputs["Detail"].default_value = 4.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.42, 0.46, 0.50, 1)
    ramp.color_ramp.elements[1].position = 0.72
    ramp.color_ramp.elements[1].color = (0.74, 0.77, 0.80, 1)
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    scene = bpy.context.scene
    scene.render.bake.use_selected_to_active = False
    scene.render.bake.use_clear = True
    select_only(low)
    bpy.ops.object.bake(type="EMIT")
    save_image(image, out_png, jet_id)


def export_glb(obj: bpy.types.Object, path: str, jet_id: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    select_only(obj)
    bpy.ops.object.shade_smooth()
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_image_format="AUTO",
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
    )
    log(jet_id, f"exported {path} ({os.path.getsize(path)} bytes)")


def bake_one(entry: dict) -> None:
    jet_id = entry["id"]
    src = os.path.join(ROOT, "assets", "3d", entry["src"])
    out_glb = os.path.join(ROOT, "assets", "3d", f"{jet_id}_game.glb")
    out_png = os.path.join(ROOT, "assets", "3d", f"{jet_id}_paint_default.png")
    public_glb = os.path.join(PUBLIC_DIR, f"{jet_id}_game.glb")
    public_png = os.path.join(PUBLIC_DIR, f"{jet_id}_paint_default.png")
    keep = entry["keep"]

    if not os.path.isfile(src):
        raise SystemExit(f"missing {src}")

    clear_scene()
    log(jet_id, f"import {src}")
    bpy.ops.import_scene.gltf(filepath=src)

    meshes = mesh_objects()
    drop = [o for o in meshes if should_drop(o, keep)]
    log(jet_id, f"imported {len(meshes)} drop {len(drop)}")
    for o in drop:
        bpy.data.objects.remove(o, do_unlink=True)

    kept = mesh_objects()
    glass = [o for o in kept if has_prefix(o, GLASS_PREFIXES)]
    lights = [o for o in kept if has_prefix(o, LIGHT_PREFIXES) and o not in glass]
    paint_src = [o for o in kept if o not in glass and o not in lights]
    if not paint_src:
        raise SystemExit(f"[{jet_id}] no exterior meshes left")
    log(jet_id, f"paint parts {len(paint_src)} glass {len(glass)} lights {len(lights)}")
    for o in glass + lights:
        bpy.data.objects.remove(o, do_unlink=True)

    high = join_objects(paint_src, "AirframeHigh")
    log(jet_id, f"joined exterior {tri_count(high)} tris")
    bake_world_matrix(high)

    low = high.copy()
    low.data = high.data.copy()
    low.name = "Airframe"
    bpy.context.scene.collection.objects.link(low)

    placed = game_placement(high, jet_id)
    apply_mesh_matrix(high, placed)
    apply_mesh_matrix(low, placed)
    outward_normals(high)
    outward_normals(low)
    mn, mx = vertex_bounds(low)
    log(jet_id, f"oriented size {[round(mx[i] - mn[i], 2) for i in range(3)]}")

    force_emit_albedo(high)
    image = bpy.data.images.new(f"PaintAlbedo_{jet_id}", TEX_SIZE, TEX_SIZE, alpha=False)
    image.colorspace_settings.name = "sRGB"
    add_bake_targets(high, image, jet_id)
    bake_self(high, image, out_png, jet_id)

    mat = make_paint_material(image)
    if image_luma(image) < 0.12:
        low.data.materials.clear()
        low.data.materials.append(mat)
        for poly in low.data.polygons:
            poly.material_index = 0
        smart_uv(low)
        fallback_gray(low, image, out_png, jet_id)
    connect_paint(mat)
    low.data.materials.clear()
    low.data.materials.append(mat)
    for poly in low.data.polygons:
        poly.material_index = 0

    decimate(low, TARGET_TRIS, jet_id)
    outward_normals(low)
    image.pack()

    bpy.data.objects.remove(high, do_unlink=True)
    export_glb(low, out_glb, jet_id)

    os.makedirs(PUBLIC_DIR, exist_ok=True)
    shutil.copyfile(out_glb, public_glb)
    shutil.copyfile(out_png, public_png)
    log(jet_id, f"public glb {os.path.getsize(public_glb)} bytes tris {tri_count(low)}")


def main() -> None:
    for entry in FLEET:
        bake_one(entry)
    print("[phase-a] done", flush=True)


if __name__ == "__main__":
    main()
