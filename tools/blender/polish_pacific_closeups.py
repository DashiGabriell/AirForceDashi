"""Polish Pacific Islands close-ups: texture contrast, flat airbase pad, Cycles renders."""
import bpy
import math
import os
from mathutils import Vector
from mathutils.bvhtree import BVHTree

OUT = r"C:\Users\Gabriell\Documents\AirForceDashi\assets\maps\pacific_islands"
BLEND = os.path.join(OUT, "pacific_islands_16km.blend")


def aim(cam, loc, tgt, lens=30):
    cam.data.type = "PERSP"
    cam.location = Vector(loc)
    cam.rotation_euler = (Vector(tgt) - cam.location).normalized().to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = lens
    cam.data.clip_start = 1.0
    cam.data.clip_end = 200000.0


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc = bpy.context.scene
    ter = bpy.data.objects["Terrain_Pacific_16km"]

    # --- Boost terrain readability: tint albedo by height + coarser BOX scale ---
    mat = bpy.data.materials.get("M_Terrain_HQ")
    if mat and mat.node_tree:
        nt = mat.node_tree
        nodes, links = nt.nodes, nt.links
        bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")

        # Coarser tiling so detail survives mid shots (period ~12–20 m)
        for n in nodes:
            if n.type == "MAPPING":
                lab = (n.label or "").lower()
                if "sand" in lab:
                    n.inputs["Scale"].default_value = (0.08, 0.08, 0.08)
                elif "grass" in lab:
                    n.inputs["Scale"].default_value = (0.06, 0.06, 0.06)
                elif "rock" in lab:
                    n.inputs["Scale"].default_value = (0.05, 0.05, 0.05)

        # Height tint overlay (visible from distance even when PBR averages)
        if not any(n.label == "height_tint" for n in nodes):
            te = next(n for n in nodes if n.type == "TEX_COORD")
            sep = next(n for n in nodes if n.type == "SEPXYZ")
            mr = next(n for n in nodes if n.type == "MAP_RANGE")
            tint = nodes.new("ShaderNodeValToRGB")
            tint.label = "height_tint"
            tint.location = (-200, 1000)
            # shore turquoise-sand -> lush green mid -> rock brown -> pale peak
            e0 = tint.color_ramp.elements[0]
            e0.position = 0.0
            e0.color = (0.72, 0.62, 0.42, 1)
            e1 = tint.color_ramp.elements[1]
            e1.position = 1.0
            e1.color = (0.45, 0.42, 0.40, 1)
            mid = tint.color_ramp.elements.new(0.12)
            mid.color = (0.28, 0.42, 0.18, 1)
            mid2 = tint.color_ramp.elements.new(0.45)
            mid2.color = (0.35, 0.28, 0.22, 1)
            links.new(mr.outputs["Result"], tint.inputs["Fac"])

            mix_tint = nodes.new("ShaderNodeMix")
            mix_tint.data_type = "RGBA"
            mix_tint.clamp_factor = True
            mix_tint.label = "apply_height_tint"
            mix_tint.location = (700, 150)
            mix_tint.inputs["Factor"].default_value = 0.55
            # Base from existing rock mix feeding BSDF
            base_link = bsdf.inputs["Base Color"].links[0]
            base_src = base_link.from_socket
            links.remove(base_link)
            links.new(base_src, mix_tint.inputs["A"])
            links.new(tint.outputs["Color"], mix_tint.inputs["B"])
            links.new(mix_tint.outputs["Result"], bsdf.inputs["Base Color"])
            print("height tint added")

    # --- Carve a local flat pad for the airbase in the heightfield ---
    deps = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(ter.evaluated_get(deps), deps)

    def hz(x, y):
        hit = bvh.ray_cast(Vector((x, y, 5000)), Vector((0, 0, -1)))
        return None if hit[0] is None else hit[0].z

    # Pick coastal foothill site near main peak SW
    cx, cy = -900.0, -1600.0
    # Sample mean height for pad
    samples = []
    for dx in range(-600, 601, 100):
        for dy in range(-80, 81, 40):
            z = hz(cx + dx, cy + dy)
            if z is not None and z > 15:
                samples.append(z)
    if not samples:
        cx, cy = -700.0, -2250.0
        for dx in range(-600, 601, 100):
            z = hz(cx + dx, cy)
            if z is not None:
                samples.append(z)
    pad_z = sorted(samples)[len(samples) // 3] if samples else 80.0  # lower quartile-ish
    print("pad site", cx, cy, "pad_z", round(pad_z, 1), "n", len(samples))

    # Soft-flatten mesh vertices inside runway ellipse
    mesh = ter.data
    mw = ter.matrix_world
    imw = mw.inverted()
    flat_r_x, flat_r_y = 900.0, 220.0
    changed = 0
    for v in mesh.vertices:
        w = mw @ v.co
        dx = (w.x - cx) / flat_r_x
        dy = (w.y - cy) / flat_r_y
        d2 = dx * dx + dy * dy
        if d2 < 1.0:
            # blend toward pad_z
            t = 1.0 - d2
            t = t * t * (3 - 2 * t)
            new_z = w.z * (1 - t) + pad_z * t
            w.z = new_z
            v.co = imw @ w
            changed += 1
    mesh.update()
    print("flattened verts", changed)

    # Refresh BVH after edit
    deps = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(ter.evaluated_get(deps), deps)

    def hz2(x, y):
        hit = bvh.ray_cast(Vector((x, y, 5000)), Vector((0, 0, -1)))
        return pad_z if hit[0] is None else hit[0].z

    deck = hz2(cx, cy) + 0.8
    run = bpy.data.objects["Airbase_Runway"]
    run.location = Vector((cx, cy, deck))
    run.scale = (0.85, 1.2, 1.0)
    run.rotation_euler = (0, 0, 0)

    for name, ox, oy, off in [
        ("Airbase_Tower", cx + 220, cy + 100, 22.5),
        ("Airbase_Hangar_1", cx - 180, cy - 120, 6),
        ("Airbase_Hangar_2", cx - 180, cy + 120, 6),
        ("Airbase_Hangar_3", cx + 100, cy - 120, 6),
    ]:
        o = bpy.data.objects[name]
        z = hz2(ox, oy)
        o.location = Vector((ox, oy, z + off))

    # Cameras — closer so BOX textures + tint read
    peak = Vector((358.7, -639.4, 900))
    aim(bpy.data.objects["Cam_IslandHero"], (3200, -4200, 900), (100, -900, 350), 32)
    aim(bpy.data.objects["Cam_Airbase"], (cx - 900, cy - 320, deck + 95), (cx + 350, cy + 10, deck + 4), 35)
    aim(bpy.data.objects["Cam_FlightMain"], (cx + 600, cy - 1600, 280), (cx - 100, cy + 50, deck + 30), 28)

    # Lighting
    sun = bpy.data.objects.get("Sun_LateAfternoon")
    if sun:
        sun.data.energy = 3.2
        sun.rotation_euler = (math.radians(48), 0, math.radians(35))
    if sc.world and sc.world.node_tree:
        bg = next(n for n in sc.world.node_tree.nodes if n.type == "BACKGROUND")
        bg.inputs["Strength"].default_value = 1.15

    # Ocean: keep turquoise shallow bias
    omat = bpy.data.materials.get("M_Ocean_HQ")
    if omat and omat.use_nodes:
        bsdf = next(n for n in omat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        if "Transmission Weight" in bsdf.inputs:
            bsdf.inputs["Transmission Weight"].default_value = 0.7
        bsdf.inputs["Roughness"].default_value = 0.04

    # Cycles renders
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 64
    if hasattr(sc.cycles, "use_denoising"):
        sc.cycles.use_denoising = True
    sc.render.resolution_x = 1600
    sc.render.resolution_y = 900
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.exposure = 0.25

    jobs = [
        ("Cam_IslandHero", "preview_hero.png"),
        ("Cam_Airbase", "preview_airbase.png"),
        ("Cam_FlightMain", "preview_flight.png"),
    ]
    for cam_name, fname in jobs:
        sc.camera = bpy.data.objects[cam_name]
        path = os.path.join(OUT, fname)
        sc.render.filepath = path
        print("RENDER", cam_name, "->", path)
        bpy.ops.render.render(write_still=True)
        print("DONE", fname, os.path.getsize(path))

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print("SAVED", BLEND)


if __name__ == "__main__":
    main()
