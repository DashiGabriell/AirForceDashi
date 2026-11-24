"""Build detailed checkpoint gate GLB matching the approved concept.

- Dark gunmetal metallic arch with 8 clamp modules + antennas
- Inner cyan neon energy band (emissive) — game tints to red on pass
- Clockwise chevron markers (emissive)
- Unit scale: clear aperture radius = 1.0 (scale by GatePoint.radius in-game)
- Gate plane = XY, fly-through axis = local +Z / −Z

Outputs:
  assets/3d/checkpoint_gate.glb
  apps/web/public/models/checkpoint_gate.glb

Run:
  "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" ^
    --background --python tools/build_checkpoint_gate.py
"""

from __future__ import annotations

import math
import os
import shutil

import bpy
import bmesh
import mathutils

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_ASSET = os.path.join(ROOT, "assets", "3d", "checkpoint_gate.glb")
OUT_PUBLIC = os.path.join(ROOT, "apps", "web", "public", "models", "checkpoint_gate.glb")

# Clear aperture (inner edge of neon). Outer metal grows from here.
R_CLEAR = 1.0
NEON_WIDTH = 0.085
METAL_INNER = R_CLEAR + NEON_WIDTH * 0.15
METAL_OUTER = 1.28
METAL_DEPTH = 0.22
CLAMP_COUNT = 8
CHEVRON_COUNT = 8


def log(msg: str) -> None:
    print(f"[checkpoint] {msg}", flush=True)


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def new_mat(name: str) -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return mat


def mat_metal() -> bpy.types.Material:
    mat = new_mat("CheckpointMetal")
    nt = mat.node_tree
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    out.location = (300, 0)
    bsdf.location = (0, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    # Gunmetal with slight cool tint
    bsdf.inputs["Base Color"].default_value = (0.22, 0.24, 0.27, 1.0)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.22
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.7
    # Micro variation on roughness (keeps metal readable in EEVEE + Three)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 22.0
    noise.inputs["Detail"].default_value = 10.0
    noise.location = (-500, -120)
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-280, -120)
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.32, 0.32, 0.32, 1)
    ramp.color_ramp.elements[1].position = 0.8
    ramp.color_ramp.elements[1].color = (0.12, 0.12, 0.12, 1)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Roughness"])
    return mat


def mat_neon(name: str, rgb: tuple[float, float, float], strength: float) -> bpy.types.Material:
    """Principled + Emission so glTF keeps emissive for runtime color swap."""
    mat = new_mat(name)
    nt = mat.node_tree
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    out.location = (300, 0)
    bsdf.location = (0, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.25
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    elif "Emission" in bsdf.inputs:
        bsdf.inputs["Emission"].default_value = (*rgb, 1.0)
    mat["afd_role"] = "neon"
    mat["afd_neon_idle"] = list(rgb)
    mat["afd_neon_pass"] = [1.0, 0.12, 0.08]
    return mat


def assign(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def torus(
    name: str,
    major: float,
    minor: float,
    major_seg: int = 64,
    minor_seg: int = 16,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=major_seg,
        minor_segments=minor_seg,
        location=(0, 0, 0),
    )
    obj = bpy.context.active_object
    obj.name = name
    return obj


def box(name: str, sx: float, sy: float, sz: float) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx * 0.5, sy * 0.5, sz * 0.5)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def cylinder(name: str, radius: float, depth: float, verts: int = 12) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=depth,
        vertices=verts,
        location=(0, 0, 0),
    )
    obj = bpy.context.active_object
    obj.name = name
    return obj


def bevel_object(obj: bpy.types.Object, width: float = 0.008, segments: int = 2) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=mod.name)


def add_panel_rings(metal_mat: bpy.types.Material, parent: bpy.types.Object) -> None:
    """Thin recessed panel rings on the metal arch face."""
    for i, (maj, minor) in enumerate(
        [
            (METAL_INNER + 0.04, 0.012),
            ((METAL_INNER + METAL_OUTER) * 0.5, 0.01),
            (METAL_OUTER - 0.05, 0.014),
        ]
    ):
        r = torus(f"PanelRing_{i}", maj, minor, 72, 8)
        assign(r, metal_mat)
        r.parent = parent


def add_rivet_band(metal_mat: bpy.types.Material, parent: bpy.types.Object) -> None:
    count = 48
    r = (METAL_INNER + METAL_OUTER) * 0.5
    for i in range(count):
        ang = (i / count) * math.tau
        riv = cylinder(f"Rivet_{i}", 0.012, 0.04, 8)
        riv.location = (
            math.cos(ang) * r,
            math.sin(ang) * r,
            METAL_DEPTH * 0.55,
        )
        assign(riv, metal_mat)
        riv.parent = parent


def add_clamps(
    metal_mat: bpy.types.Material,
    neon_mat: bpy.types.Material,
    parent: bpy.types.Object,
) -> None:
    r = METAL_OUTER + 0.02
    for i in range(CLAMP_COUNT):
        ang = (i / CLAMP_COUNT) * math.tau + math.pi / CLAMP_COUNT
        ca, sa = math.cos(ang), math.sin(ang)
        clamp = box(f"Clamp_{i}", 0.22, 0.16, 0.28)
        clamp.location = (ca * r, sa * r, 0.0)
        clamp.rotation_euler = (0, 0, ang)
        bevel_object(clamp, 0.01, 2)
        assign(clamp, metal_mat)
        clamp.parent = parent

        # Side fins
        for side in (-1, 1):
            fin = box(f"ClampFin_{i}_{side}", 0.06, 0.04, 0.18)
            fin.location = (
                ca * (r + 0.02) + (-sa) * side * 0.1,
                sa * (r + 0.02) + ca * side * 0.1,
                0.0,
            )
            fin.rotation_euler = (0, 0, ang)
            assign(fin, metal_mat)
            fin.parent = parent

        # Antennas (3 per clamp in ref feel — use 3 thin rods)
        for a in range(3):
            spread = (a - 1) * 0.035
            ant = cylinder(f"Antenna_{i}_{a}", 0.008, 0.16, 6)
            ant.rotation_euler = (math.pi / 2, 0, ang)
            ant.location = (
                ca * (r + 0.12),
                sa * (r + 0.12),
                spread,
            )
            # Point outward in XY
            direction = mathutils.Vector((ca, sa, 0))
            ant.rotation_mode = "QUATERNION"
            ant.rotation_quaternion = direction.to_track_quat("Z", "Y")
            ant.location = (
                ca * (r + 0.18),
                sa * (r + 0.18),
                spread * 2.2,
            )
            assign(ant, metal_mat)
            ant.parent = parent

        # Neon status LEDs on clamp face
        led = box(f"ClampLed_{i}", 0.04, 0.018, 0.012)
        led.location = (ca * (r - 0.02), sa * (r - 0.02), 0.12)
        led.rotation_euler = (0, 0, ang)
        assign(led, neon_mat)
        led.parent = parent


def add_chevrons(neon_mat: bpy.types.Material, parent: bpy.types.Object) -> None:
    """Clockwise V chevrons floating just inside the neon band."""
    r = R_CLEAR + NEON_WIDTH * 0.55
    for i in range(CHEVRON_COUNT):
        ang = (i / CHEVRON_COUNT) * math.tau
        # Build a simple V from two boxes
        root = bpy.data.objects.new(f"Chevron_{i}", None)
        bpy.context.collection.objects.link(root)
        root.empty_display_size = 0.05
        root.location = (math.cos(ang) * r, math.sin(ang) * r, 0.02)
        # Point clockwise tangent
        root.rotation_euler = (0, 0, ang + math.pi / 2)
        root.parent = parent

        for side, sign in (("L", -1), ("R", 1)):
            arm = box(f"ChevronArm_{i}_{side}", 0.16, 0.04, 0.028)
            arm.location = (0.055, sign * 0.048, 0.03)
            arm.rotation_euler = (0, 0, sign * math.radians(34))
            assign(arm, neon_mat)
            arm.parent = root


def add_neon_band(neon_mat: bpy.types.Material, field_mat: bpy.types.Material, parent: bpy.types.Object) -> None:
    major = R_CLEAR + NEON_WIDTH * 0.5
    band = torus("NeonBand", major, NEON_WIDTH * 0.48, 96, 20)
    assign(band, neon_mat)
    band.parent = parent

    # Soft inner field disc (very thin, slight toward camera for read)
    field = torus("NeonField", major * 0.92, NEON_WIDTH * 0.9, 64, 12)
    assign(field, field_mat)
    field.scale = (1.0, 1.0, 0.35)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    field.parent = parent


def add_metal_arch(metal_mat: bpy.types.Material, parent: bpy.types.Object) -> bpy.types.Object:
    """Main structural torus — thick gunmetal ring."""
    major = (METAL_INNER + METAL_OUTER) * 0.5
    minor = (METAL_OUTER - METAL_INNER) * 0.5
    # Flatten depth with scale Z after creation for rectangular-ish profile feel
    arch = torus("MetalArch", major, minor, 96, 24)
    # Squash Z so it reads more like the ref's thick band than a round tube
    arch.scale.z = METAL_DEPTH / (minor * 2)
    bpy.context.view_layer.objects.active = arch
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(arch, metal_mat)
    arch.parent = parent

    # Outer shell reinforcement
    shell = torus("MetalShell", METAL_OUTER - 0.02, 0.035, 72, 10)
    assign(shell, metal_mat)
    shell.parent = parent

    # Inner lip
    lip = torus("MetalLip", METAL_INNER + 0.02, 0.028, 72, 10)
    assign(lip, metal_mat)
    lip.parent = parent
    return arch


def join_hierarchy(root: bpy.types.Object, name: str) -> bpy.types.Object:
    """Join all mesh descendants into one object per material role is better for game —
    instead keep hierarchy and export; glTF keeps nodes.
    """
    return root


def export_glb(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.context.scene.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_image_format="AUTO",
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_animations=False,
    )
    log(f"exported {path} ({os.path.getsize(path)} bytes)")


def main() -> None:
    clear_scene()
    metal = mat_metal()
    # Saturated cyan-green neon (concept art) — runtime swaps to red on pass
    neon = mat_neon("CheckpointNeon", (0.05, 1.0, 0.78), 28.0)
    field = mat_neon("CheckpointNeonField", (0.08, 0.95, 0.85), 10.0)
    field["afd_role"] = "neon_field"

    root = bpy.data.objects.new("CheckpointGate", None)
    bpy.context.collection.objects.link(root)
    root.empty_display_size = 0.2
    root["afd_clear_radius"] = R_CLEAR
    root["afd_neon_idle"] = [0.12, 1.0, 0.95]
    root["afd_neon_pass"] = [1.0, 0.12, 0.08]

    add_metal_arch(metal, root)
    add_panel_rings(metal, root)
    add_rivet_band(metal, root)
    add_clamps(metal, neon, root)
    add_neon_band(neon, field, root)
    add_chevrons(neon, root)

    # Origin at center; fly-through along Z
    # Shade smooth on meshes
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            bpy.context.view_layer.objects.active = o
            o.select_set(True)
            bpy.ops.object.shade_smooth()
            o.select_set(False)

    export_glb(OUT_ASSET)
    os.makedirs(os.path.dirname(OUT_PUBLIC), exist_ok=True)
    shutil.copyfile(OUT_ASSET, OUT_PUBLIC)
    log(f"public copy → {OUT_PUBLIC}")
    log("done")


if __name__ == "__main__":
    main()
