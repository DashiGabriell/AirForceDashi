"""Pin airbase to main island, fix cameras, re-render close-ups with validation."""
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


def sample_png(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    px = img.pixels
    mx = 0.0
    nonempty = 0
    # variance proxy
    acc = [0.0, 0.0, 0.0]
    n = 0
    for y in range(0, h, 8):
        for x in range(0, w, 8):
            i = (y * w + x) * 4
            r, g, b = px[i], px[i + 1], px[i + 2]
            s = r + g + b
            mx = max(mx, s)
            if s > 0.08:
                nonempty += 1
            acc[0] += r
            acc[1] += g
            acc[2] += b
            n += 1
    mean = [c / max(n, 1) for c in acc]
    bpy.data.images.remove(img)
    return {"wh": (w, h), "max": mx, "nonempty": nonempty, "mean": mean}


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc = bpy.context.scene
    ter = bpy.data.objects["Terrain_Pacific_16km"]
    mesh = ter.data
    mw = ter.matrix_world
    imw = mw.inverted()

    deps = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(ter.evaluated_get(deps), deps)

    def hz(x, y):
        hit = bvh.ray_cast(Vector((x, y, 5000)), Vector((0, 0, -1)))
        return None if hit[0] is None else hit[0].z

    peak = Vector((358.7, -639.4, 1800.0))

    # Search ONLY around main peak SW coastal apron
    best = None
    for cy in range(-2800, -200, 80):
        for cx in range(-2800, 800, 80):
            zs = []
            ok = True
            for dx in range(-500, 501, 100):
                z = hz(cx + dx, cy)
                if z is None or z < 28 or z > 95:
                    ok = False
                    break
                zs.append(z)
            if not ok or len(zs) < 6:
                continue
            mean = sum(zs) / len(zs)
            std = (sum((z - mean) ** 2 for z in zs) / len(zs)) ** 0.5
            if std > 22:
                continue
            dist = math.hypot(cx - peak.x, cy - peak.y)
            # prefer south-west of peak, moderate distance
            score = std * 3.5 + abs(mean - 55) * 0.5 + abs(dist - 1800) * 0.01
            if best is None or score < best[0]:
                best = (score, cx, cy, mean, std, dist)

    print("BEST main-island coastal", best)
    if best is None:
        # force a site: walk south from peak until z~50-80
        cx, cy = peak.x - 800, peak.y - 1200
        for step in range(40):
            z = hz(cx, cy - step * 40)
            if z and 35 < z < 90:
                cy = cy - step * 40
                mean = z
                break
        else:
            cx, cy, mean = -1200.0, -1800.0, 60.0
        std = 15.0
        print("forced", cx, cy, mean)
    else:
        _, cx, cy, mean, std, dist = best

    pad_z = float(mean)

    # Flatten pad
    flat_rx, flat_ry = 850.0, 260.0
    changed = 0
    for v in mesh.vertices:
        w = mw @ v.co
        dx = (w.x - cx) / flat_rx
        dy = (w.y - cy) / flat_ry
        d2 = dx * dx + dy * dy
        if d2 >= 1.0:
            continue
        t = 1.0 - d2
        t = t * t * (3 - 2 * t)
        w.z = w.z * (1 - t) + pad_z * t
        v.co = imw @ w
        changed += 1
    mesh.update()
    print("flattened", changed, "pad", round(cx, 1), round(cy, 1), round(pad_z, 1))

    deps = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(ter.evaluated_get(deps), deps)

    def hz2(x, y):
        hit = bvh.ray_cast(Vector((x, y, 5000)), Vector((0, 0, -1)))
        return pad_z if hit[0] is None else hit[0].z

    deck = hz2(cx, cy) + 0.5
    run = bpy.data.objects["Airbase_Runway"]
    run.location = Vector((cx, cy, deck))
    run.scale = (0.95, 1.5, 1.0)
    run.rotation_euler = (0, 0, 0)

    for name, ox, oy, off in [
        ("Airbase_Tower", cx + 180, cy + 85, 22.5),
        ("Airbase_Hangar_1", cx - 170, cy - 100, 6),
        ("Airbase_Hangar_2", cx - 170, cy + 100, 6),
        ("Airbase_Hangar_3", cx + 60, cy - 100, 6),
    ]:
        o = bpy.data.objects[name]
        o.location = Vector((ox, oy, hz2(ox, oy) + off))
        print(name, tuple(round(v, 1) for v in o.location))

    # Soften height tint (was too green/dark)
    mat = bpy.data.materials.get("M_Terrain_HQ")
    if mat and mat.node_tree:
        nt = mat.node_tree
        tint = next((n for n in nt.nodes if n.label == "height_tint"), None)
        if tint:
            tint.color_ramp.elements[0].color = (0.78, 0.68, 0.48, 1)  # sand
            # find mid elements
            for e in tint.color_ramp.elements:
                if 0.08 < e.position < 0.2:
                    e.color = (0.38, 0.48, 0.22, 1)
                elif 0.35 < e.position < 0.55:
                    e.color = (0.42, 0.34, 0.28, 1)
                elif e.position > 0.9:
                    e.color = (0.55, 0.52, 0.48, 1)
        mix_tint = next((n for n in nt.nodes if n.label == "apply_height_tint"), None)
        if mix_tint:
            mix_tint.inputs["Factor"].default_value = 0.38
        for n in nt.nodes:
            if n.type == "MAPPING":
                lab = (n.label or "").lower()
                # ~8-12m period — readable in close airbase shot without harsh tiling
                if "sand" in lab:
                    n.inputs["Scale"].default_value = (0.1, 0.1, 0.1)
                elif "grass" in lab:
                    n.inputs["Scale"].default_value = (0.08, 0.08, 0.08)
                elif "rock" in lab:
                    n.inputs["Scale"].default_value = (0.07, 0.07, 0.07)

    # Cameras — compose intentionally
    # Hero: from SE over water toward peak, include airbase if in frame
    aim(
        bpy.data.objects["Cam_IslandHero"],
        (peak.x + 3500, peak.y - 4500, 950),
        (peak.x - 200, peak.y + 100, 500),
        28,
    )
    # Airbase: west approach, slightly elevated, look along runway to east with ocean on right/south
    aim(
        bpy.data.objects["Cam_Airbase"],
        (cx - 950, cy - 550, deck + 55),
        (cx + 400, cy + 40, deck + 2),
        34,
    )
    # Flight: low coastal pass south of runway looking toward peak
    aim(
        bpy.data.objects["Cam_FlightMain"],
        (cx + 200, cy - 1100, 160),
        (cx - 100, cy + 200, deck + 40),
        28,
    )

    sun = bpy.data.objects.get("Sun_LateAfternoon")
    if sun:
        sun.data.energy = 3.4
        sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    if sc.world and sc.world.node_tree:
        bg = next(n for n in sc.world.node_tree.nodes if n.type == "BACKGROUND")
        bg.inputs["Strength"].default_value = 1.25

    sc.render.engine = "CYCLES"
    sc.cycles.samples = 48
    if hasattr(sc.cycles, "use_denoising"):
        sc.cycles.use_denoising = True
    sc.render.resolution_x = 1600
    sc.render.resolution_y = 900
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.exposure = 0.3

    for cam_name, fname in [
        ("Cam_IslandHero", "preview_hero.png"),
        ("Cam_Airbase", "preview_airbase.png"),
        ("Cam_FlightMain", "preview_flight.png"),
    ]:
        sc.camera = bpy.data.objects[cam_name]
        path = os.path.join(OUT, fname)
        sc.render.filepath = path
        print("RENDER", cam_name, "from", tuple(round(v, 1) for v in sc.camera.location))
        bpy.ops.render.render(write_still=True)
        stats = sample_png(path)
        print("DONE", fname, os.path.getsize(path), stats)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print("SAVED", BLEND)


if __name__ == "__main__":
    main()
