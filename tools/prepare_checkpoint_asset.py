"""Prepare Sketchfab/pack checkpoint for Air Force Dashi.

Source: assets/3d/checkpoint/base_basic_pbr.glb + texture_emissive.png
- Wire emissive map (arrow chevrons) as neon cyan
- Keep metallic PBR on the arch
- Normalize: aperture radius ≈ 1, gate plane = XY (fly +Z)
- Bake a 2s looping UV scroll action on the emissive Mapping (clockwise)
  (Three.js also scrolls emissiveMap at runtime as primary)

Outputs:
  assets/3d/checkpoint_gate.glb
  apps/web/public/models/checkpoint_gate.glb
"""

from __future__ import annotations

import math
import os
import shutil

import bpy
import mathutils

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "assets", "3d", "checkpoint", "base_basic_pbr.glb")
EMISSIVE = os.path.join(ROOT, "assets", "3d", "checkpoint", "texture_emissive.png")
OUT_ASSET = os.path.join(ROOT, "assets", "3d", "checkpoint_gate.glb")
OUT_PUBLIC = os.path.join(ROOT, "apps", "web", "public", "models", "checkpoint_gate.glb")

TARGET_CLEAR_R = 1.0
FPS = 24
ANIM_FRAMES = 48  # 2 seconds loop


def log(msg: str) -> None:
    print(f"[checkpoint-asset] {msg}", flush=True)


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mesh_objects() -> list[bpy.types.Object]:
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def world_bounds(objs: list[bpy.types.Object]) -> tuple[mathutils.Vector, mathutils.Vector]:
    mn = mathutils.Vector((1e9, 1e9, 1e9))
    mx = mathutils.Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for corner in o.bound_box:
            co = o.matrix_world @ mathutils.Vector(corner)
            mn.x = min(mn.x, co.x)
            mn.y = min(mn.y, co.y)
            mn.z = min(mn.z, co.z)
            mx.x = max(mx.x, co.x)
            mx.y = max(mx.y, co.y)
            mx.z = max(mx.z, co.z)
    return mn, mx


def normalize_unit_gate(objs: list[bpy.types.Object]) -> None:
    """Center, make largest planar radius = TARGET_CLEAR_R * ~1.25 outer, clear≈1."""
    # Parent under empty for transforms
    root = bpy.data.objects.new("CheckpointGate", None)
    bpy.context.collection.objects.link(root)
    for o in objs:
        o.parent = root

    mn, mx = world_bounds(objs)
    center = (mn + mx) * 0.5
    size = mx - mn
    log(f"raw size={[round(v, 3) for v in size]} center={[round(v, 3) for v in center]}")

    # Move to origin
    root.location = -center
    bpy.context.view_layer.update()

    # Apply location into meshes
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.data.objects.remove(root, do_unlink=True)

    mn, mx = world_bounds(objs)
    size = mx - mn
    # Outer radius in XY (gate plane). Model may be oriented with hole along Y or Z.
    dims = sorted([(size.x, 0), (size.y, 1), (size.z, 2)], reverse=True)
    # Two largest axes = ring plane; smallest = thickness / fly axis
    axis_thin = dims[2][1]
    plane_axes = [dims[0][1], dims[1][1]]
    outer_r = 0.5 * max(size[plane_axes[0]], size[plane_axes[1]])
    # Approximate clear radius ~ 78% of outer for this asset style
    clear_r = outer_r * 0.78
    scale = TARGET_CLEAR_R / max(clear_r, 1e-6)
    log(f"thin_axis={axis_thin} outer_r={outer_r:.3f} clear~{clear_r:.3f} scale={scale:.4f}")

    for o in objs:
        o.scale = (scale, scale, scale)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Orient so fly-through = +Z (thin axis → Z)
    if axis_thin == 0:
        rot = mathutils.Matrix.Rotation(math.radians(90), 4, "Y")
    elif axis_thin == 1:
        rot = mathutils.Matrix.Rotation(math.radians(-90), 4, "X")
    else:
        rot = mathutils.Matrix.Identity(4)
    for o in objs:
        o.data.transform(rot)
        o.data.update()

    # Re-center XY
    mn, mx = world_bounds(objs)
    center = (mn + mx) * 0.5
    for o in objs:
        o.data.transform(mathutils.Matrix.Translation(-mathutils.Vector((center.x, center.y, center.z))))
        o.data.update()

    mn, mx = world_bounds(objs)
    log(f"final size={[round(v, 3) for v in (mx - mn)]}")


# Emissive atlas: two luminous rings with chevrons (bottom half). Metal islands sit above.
# UV centers / radii measured from texture_emissive.png layout.
NEON_UV_RINGS = (
    # (center_u, center_v, inner_r, outer_r)
    (0.25, 0.28, 0.12, 0.235),
    (0.75, 0.28, 0.12, 0.235),
)


def uv_in_neon_ring(u: float, v: float) -> bool:
    for cu, cv, r0, r1 in NEON_UV_RINGS:
        d = math.hypot(u - cu, v - cv)
        if r0 <= d <= r1:
            return True
    return False


def make_metal_material(src: bpy.types.Material) -> bpy.types.Material:
    """Arch metal only — zero emission so it never tints cyan/red."""
    mat = src.copy()
    mat.name = "CheckpointMetal"
    mat["afd_role"] = "metal"
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        return mat
    emit_color = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
    emit_str = bsdf.inputs.get("Emission Strength")
    if emit_color is not None:
        # Disconnect any emission links
        for link in list(emit_color.links):
            nt.links.remove(link)
        emit_color.default_value = (0, 0, 0, 1)
    if emit_str is not None:
        for link in list(emit_str.links):
            nt.links.remove(link)
        emit_str.default_value = 0.0
    if not bsdf.inputs["Metallic"].is_linked and bsdf.inputs["Metallic"].default_value < 0.2:
        bsdf.inputs["Metallic"].default_value = 0.9
    if not bsdf.inputs["Roughness"].is_linked:
        bsdf.inputs["Roughness"].default_value = 0.28
    return mat


def make_neon_material(emissive_img: bpy.types.Image) -> bpy.types.Material:
    """Only the luminous ring band — emissive arrows; runtime tints cyan→red."""
    mat = bpy.data.materials.new("CheckpointNeon")
    mat.use_nodes = True
    mat["afd_role"] = "neon"
    mat["afd_neon_idle"] = [0.05, 1.0, 0.78]
    mat["afd_neon_pass"] = [1.0, 0.12, 0.08]
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    out.location = (300, 0)
    bsdf.location = (0, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    # Dark base so only emission reads
    bsdf.inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.35

    texcoord = nt.nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-900, 0)
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.name = "EmissiveMapping"
    mapping.location = (-650, 0)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = emissive_img
    tex.name = "EmissiveTex"
    tex.location = (-400, 0)
    nt.links.new(texcoord.outputs["UV"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])

    emit_color = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
    emit_str = bsdf.inputs.get("Emission Strength")
    if emit_color is not None:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.location = (-180, -80)
        nt.links.new(tex.outputs["Color"], mix.inputs["A"])
        mix.inputs["B"].default_value = (0.05, 1.0, 0.78, 1.0)
        nt.links.new(mix.outputs["Result"], emit_color)
    if emit_str is not None:
        emit_str.default_value = 22.0

    # Blender preview loop (runtime uses Three UV scroll on CheckpointNeon only)
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 1
    scene.frame_end = ANIM_FRAMES
    rot_in = mapping.inputs["Rotation"]
    rot_in.default_value = (0.0, 0.0, 0.0)
    rot_in.keyframe_insert(data_path="default_value", frame=1)
    rot_in.default_value = (0.0, 0.0, -math.tau)
    rot_in.keyframe_insert(data_path="default_value", frame=ANIM_FRAMES)
    return mat


def assign_neon_faces(obj: bpy.types.Object, metal: bpy.types.Material, neon: bpy.types.Material) -> None:
    """Split materials: ring UV islands → neon; everything else → metal."""
    mesh = obj.data
    # Slot 0 = metal, slot 1 = neon
    mesh.materials.clear()
    mesh.materials.append(metal)
    mesh.materials.append(neon)

    if not mesh.uv_layers:
        log("no UV layers — cannot split neon faces")
        return
    uv_layer = mesh.uv_layers.active
    if uv_layer is None:
        log("no active UV — cannot split neon faces")
        return

    neon_faces = 0
    for poly in mesh.polygons:
        # Average UV of face loops
        u = v = 0.0
        for li in poly.loop_indices:
            uv = uv_layer.data[li].uv
            u += uv.x
            v += uv.y
        n = max(1, len(poly.loop_indices))
        u /= n
        v /= n
        if uv_in_neon_ring(u, v):
            poly.material_index = 1
            neon_faces += 1
        else:
            poly.material_index = 0
    log(f"neon faces={neon_faces}/{len(mesh.polygons)} on {obj.name}")


def wire_neon_materials() -> None:
    if not os.path.isfile(EMISSIVE):
        raise SystemExit(f"missing {EMISSIVE}")
    img = bpy.data.images.load(EMISSIVE)
    img.name = "texture_emissive"
    img.colorspace_settings.name = "sRGB"

    # Source materials from import (usually one "model")
    sources = [m for m in bpy.data.materials if m.users > 0]
    if not sources:
        raise SystemExit("no materials on import")
    src = sources[0]
    metal = make_metal_material(src)
    neon = make_neon_material(img)

    for obj in mesh_objects():
        assign_neon_faces(obj, metal, neon)

    # Drop unused original if orphaned
    if src.name != metal.name and src.users == 0:
        bpy.data.materials.remove(src)
    log("materials: CheckpointMetal (static) + CheckpointNeon (tint + arrow scroll)")


def export_glb(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_animations=False,
        export_image_format="AUTO",
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
    )
    log(f"exported {path} ({os.path.getsize(path)} bytes)")


def main() -> None:
    if not os.path.isfile(SRC):
        raise SystemExit(f"missing {SRC}")
    clear_scene()
    log(f"import {SRC}")
    bpy.ops.import_scene.gltf(filepath=SRC)
    objs = mesh_objects()
    if not objs:
        raise SystemExit("no mesh")
    for o in objs:
        o.name = "CheckpointGateMesh"
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.shade_smooth()

    normalize_unit_gate(objs)
    wire_neon_materials()

    # Root empty with metadata
    root = bpy.data.objects.new("CheckpointGate", None)
    bpy.context.collection.objects.link(root)
    root["afd_clear_radius"] = TARGET_CLEAR_R
    root["afd_neon_idle"] = [0.05, 1.0, 0.78]
    root["afd_neon_pass"] = [1.0, 0.12, 0.08]
    root["afd_arrow_anim"] = "uv_scroll_cw"
    for o in mesh_objects():
        o.parent = root

    export_glb(OUT_ASSET)
    os.makedirs(os.path.dirname(OUT_PUBLIC), exist_ok=True)
    shutil.copyfile(OUT_ASSET, OUT_PUBLIC)
    log(f"public → {OUT_PUBLIC}")
    log("done")


if __name__ == "__main__":
    main()
