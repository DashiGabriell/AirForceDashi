"""Relocate airbase to a true coastal flat pad and re-render close-ups."""
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
    mesh = ter.data
    mw = ter.matrix_world
    imw = mw.inverted()

    # Undo previous high pad by restoring from heightmap if available, else skip
    # Search coastal flat: land 25-95m, low variance along 1.2km X strip
    deps = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(ter.evaluated_get(deps), deps)

    def hz(x, y):
        hit = bvh.ray_cast(Vector((x, y, 5000)), Vector((0, 0, -1)))
        return None if hit[0] is None else hit[0].z

    best = None
    for cy in range(-4500, 4500, 100):
        for cx in range(-4500, 4500, 100):
            zs = []
            ok = True
            for dx in range(-600, 601, 100):
                z = hz(cx + dx, cy)
                if z is None or z < 22 or z > 110:
                    ok = False
                    break
                zs.append(z)
            if not ok or len(zs) < 8:
                continue
            # also check width band
            for dy in (-60, 60):
                z = hz(cx, cy + dy)
                if z is None or z < 18 or z > 120:
                    ok = False
                    break
                zs.append(z)
            if not ok:
                continue
            mean = sum(zs) / len(zs)
            std = (sum((z - mean) ** 2 for z in zs) / len(zs)) ** 0.5
            # prefer lower std, lower elevation (coastal), near main peak (358,-639)
            dist = math.hypot(cx - 200, cy + 700)
            score = std * 4.0 + abs(mean - 45) * 0.4 + dist * 0.002
            if best is None or score < best[0]:
                best = (score, cx, cy, mean, std)

    print("BEST coastal", best)
    if best is None:
        # fallback: find any land 30-80 near south coast of peak by scanning vertices
        cands = []
        for v in mesh.vertices:
            w = mw @ v.co
            if 25 <= w.z <= 85 and -2500 < w.x < 1500 and -3500 < w.y < 0:
                cands.append((w.x, w.y, w.z))
        if not cands:
            raise RuntimeError("no coastal land found")
        # cluster mean of lowest 200
        cands.sort(key=lambda t: t[2])
        pick = cands[:200]
        cx = sum(p[0] for p in pick) / len(pick)
        cy = sum(p[1] for p in pick) / len(pick)
        mean = sum(p[2] for p in pick) / len(pick)
        std = 20.0
        print("fallback", cx, cy, mean)
    else:
        _, cx, cy, mean, std = best

    pad_z = mean

    # Flatten a generous coastal apron
    flat_rx, flat_ry = 1000.0, 280.0
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
        # pull toward pad; also lift anything below pad slightly for clean deck
        target = pad_z
        w.z = w.z * (1 - t) + target * t
        v.co = imw @ w
        changed += 1
    mesh.update()
    print("flattened", changed, "at", round(cx, 1), round(cy, 1), "z", round(pad_z, 1))

    deps = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(ter.evaluated_get(deps), deps)

    def hz2(x, y):
        hit = bvh.ray_cast(Vector((x, y, 5000)), Vector((0, 0, -1)))
        return pad_z if hit[0] is None else hit[0].z

    deck = hz2(cx, cy) + 0.6
    run = bpy.data.objects["Airbase_Runway"]
    run.location = Vector((cx, cy, deck))
    run.scale = (0.9, 1.35, 1.0)
    run.rotation_euler = (0, 0, 0)

    for name, ox, oy, off in [
        ("Airbase_Tower", cx + 200, cy + 90, 22.5),
        ("Airbase_Hangar_1", cx - 200, cy - 110, 6),
        ("Airbase_Hangar_2", cx - 200, cy + 110, 6),
        ("Airbase_Hangar_3", cx + 80, cy - 110, 6),
    ]:
        o = bpy.data.objects[name]
        o.location = Vector((ox, oy, hz2(ox, oy) + off))

    # Stronger texture period for mid shots (~20-30m) + keep height tint
    mat = bpy.data.materials.get("M_Terrain_HQ")
    if mat and mat.node_tree:
        for n in mat.node_tree.nodes:
            if n.type == "MAPPING":
                lab = (n.label or "").lower()
                if "sand" in lab:
                    n.inputs["Scale"].default_value = (0.045, 0.045, 0.045)
                elif "grass" in lab:
                    n.inputs["Scale"].default_value = (0.035, 0.035, 0.035)
                elif "rock" in lab:
                    n.inputs["Scale"].default_value = (0.03, 0.03, 0.03)

    # Cameras: airbase approach over water; hero from sea; flight along coast
    aim(bpy.data.objects["Cam_Airbase"], (cx - 1100, cy - 700, deck + 70), (cx + 200, cy + 20, deck + 3), 32)
    aim(bpy.data.objects["Cam_IslandHero"], (cx + 2800, cy - 3600, 750), (200, -800, 400), 30)
    aim(bpy.data.objects["Cam_FlightMain"], (cx + 900, cy - 1400, 180), (cx - 200, cy + 80, deck + 20), 26)

    sun = bpy.data.objects.get("Sun_LateAfternoon")
    if sun:
        sun.data.energy = 3.0
        sun.rotation_euler = (math.radians(52), 0, math.radians(25))

    sc.render.engine = "CYCLES"
    sc.cycles.samples = 64
    if hasattr(sc.cycles, "use_denoising"):
        sc.cycles.use_denoising = True
    sc.render.resolution_x = 1600
    sc.render.resolution_y = 900
    sc.render.resolution_percentage = 100
    sc.view_settings.exposure = 0.2

    for cam_name, fname in [
        ("Cam_IslandHero", "preview_hero.png"),
        ("Cam_Airbase", "preview_airbase.png"),
        ("Cam_FlightMain", "preview_flight.png"),
    ]:
        sc.camera = bpy.data.objects[cam_name]
        path = os.path.join(OUT, fname)
        sc.render.filepath = path
        print("RENDER", cam_name)
        bpy.ops.render.render(write_still=True)
        print("DONE", fname, os.path.getsize(path))

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print("SAVED")


if __name__ == "__main__":
    main()
