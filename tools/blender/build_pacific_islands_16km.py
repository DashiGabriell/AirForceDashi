"""
Air Force Dashi — Pacific Islands map authoring (16×16 km)
Run inside Blender via MCP / Scripting.
Units: 1 BU = 1 meter.
"""
import bpy
import bmesh
import math
import os
from mathutils import Vector, noise

# ── Spec (frozen) ──────────────────────────────────────────────
WORLD_M = 16000.0
HALF = WORLD_M * 0.5
MAX_H = 1800.0  # main peak ~1.5–1.8 km
HM_RES = 1025   # heightmap + displace source (power of 2 + 1)
MESH_RES = 513  # interactive mesh density
SECTOR = 4000.0
OUT_DIR = r"C:\Users\Gabriell\Documents\AirForceDashi\assets\maps\pacific_islands"
BLEND_OUT = os.path.join(OUT_DIR, "pacific_islands_16km.blend")
HM_OUT = os.path.join(OUT_DIR, "heightmap_1025.png")

# Island envelopes: (cx, cy, rx, ry, peak, type)
# Organic layout — not a ring. Coords in meters from world center.
ISLANDS = [
    # Main ~7×5 km — slightly off-center south-west of geometric center
    {"name": "Main", "cx": -600, "cy": -400, "rx": 3500, "ry": 2500, "peak": 1800, "kind": "main"},
    # A vegetation NW
    {"name": "SecA_Vegetation", "cx": -4200, "cy": 3800, "rx": 1500, "ry": 1250, "peak": 420, "kind": "secondary"},
    # B coastal village NE
    {"name": "SecB_Village", "cx": 3800, "cy": 3200, "rx": 1250, "ry": 1000, "peak": 280, "kind": "secondary"},
    # C radar East
    {"name": "SecC_Radar", "cx": 5200, "cy": -800, "rx": 1000, "ry": 750, "peak": 360, "kind": "secondary"},
    # D mountains / waterfalls North
    {"name": "SecD_Mountains", "cx": 800, "cy": 5200, "rx": 1000, "ry": 750, "peak": 980, "kind": "secondary"},
    # E uninhabited silhouette SW
    {"name": "SecE_Wild", "cx": -5200, "cy": -4800, "rx": 750, "ry": 500, "peak": 160, "kind": "sil"},
    # F outpost SE
    {"name": "SecF_Outpost", "cx": 4800, "cy": -5200, "rx": 500, "ry": 500, "peak": 120, "kind": "sil"},
]

POIS = [
    {"name": "POI_Airbase", "x": -1800, "y": -900, "z": 8, "note": "runway ~2200m"},
    {"name": "POI_MainPeak", "x": 200, "y": 200, "z": 1800, "note": "central mountain"},
    {"name": "POI_Carrier", "x": -6200, "y": 1200, "z": 0, "note": "carrier patrol"},
    {"name": "POI_Radar_E", "x": 5200, "y": -800, "z": 80, "note": "radar east"},
    {"name": "POI_Radar_N", "x": 600, "y": 5000, "z": 120, "note": "radar north"},
    {"name": "POI_Lighthouse", "x": 4200, "y": 2800, "z": 40, "note": "coastal lighthouse"},
    {"name": "POI_Platform_A", "x": -2000, "y": 5500, "z": 0, "note": "offshore platform"},
    {"name": "POI_Platform_B", "x": 6000, "y": -2500, "z": 0, "note": "offshore platform"},
    {"name": "POI_TrainingArea", "x": -5500, "y": 2500, "z": 0, "note": "air training box"},
    {"name": "POI_CheckPointRing", "x": 1500, "y": -2800, "z": 200, "note": "checkpoint circuit"},
    {"name": "POI_MissionZone_1", "x": -3500, "y": 3500, "z": 50, "note": "mission interest"},
    {"name": "POI_MissionZone_2", "x": 3500, "y": 4500, "z": 50, "note": "mission interest"},
    {"name": "POI_MissionZone_3", "x": 4500, "y": -4000, "z": 50, "note": "mission interest"},
]


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def fbm(p, octaves=5, lac=2.0, gain=0.5):
    amp = 1.0
    freq = 1.0
    total = 0.0
    norm = 0.0
    for _ in range(octaves):
        total += noise.noise(p * freq) * amp
        norm += amp
        amp *= gain
        freq *= lac
    return total / max(norm, 1e-6)


def island_mask(x, y, isl):
    """Soft elliptical mask with coastal noise."""
    dx = (x - isl["cx"]) / isl["rx"]
    dy = (y - isl["cy"]) / isl["ry"]
    # warp ellipse for organic shoreline
    warp = 0.18 * fbm(Vector((x * 0.00035, y * 0.00035, 2.1)), 3)
    r = math.sqrt(dx * dx + dy * dy) + warp
    # falloff: 1 inside, smooth to 0 past ~1.05
    if r >= 1.12:
        return 0.0
    if r <= 0.72:
        t = 1.0
    else:
        u = (r - 0.72) / (1.12 - 0.72)
        t = 1.0 - u * u * (3 - 2 * u)
    return max(0.0, t)


def height_at(x, y):
    h = 0.0
    land = 0.0
    for isl in ISLANDS:
        m = island_mask(x, y, isl)
        if m <= 0.0:
            continue
        land = max(land, m)
        # ridged / mountainous detail
        n = fbm(Vector((x * 0.00022, y * 0.00022, 0.7)), 5)
        ridge = 1.0 - abs(fbm(Vector((x * 0.0004, y * 0.0004, 3.3)), 4))
        detail = 0.55 * n + 0.45 * ridge
        # main island: taller central mass slightly north-east of airbase
        if isl["kind"] == "main":
            px, py = 200.0, 200.0
            dpeak = math.hypot(x - px, y - py) / 2800.0
            peak_fall = math.exp(-dpeak * dpeak * 2.2)
            base = isl["peak"] * (0.25 + 0.75 * peak_fall)
            # flatten airbase plateau
            ax, ay = -1800.0, -900.0
            dpad = math.hypot(x - ax, y - ay)
            if dpad < 1400.0:
                flat = max(0.0, 1.0 - dpad / 1400.0)
                base = base * (1.0 - 0.92 * flat) + 12.0 * flat
            h = max(h, base * m * (0.65 + 0.35 * detail))
        else:
            base = isl["peak"] * (0.35 + 0.65 * (0.5 + 0.5 * detail))
            h = max(h, base * m)
    # shallow shelf near coasts
    if 0.0 < land < 0.35:
        h = max(h, -2.0 + land * 18.0)
    if land <= 0.0:
        # gentle seabed variation (always underwater)
        seabed = -40.0 + 18.0 * fbm(Vector((x * 0.00008, y * 0.00008, 9.0)), 3)
        return seabed
    return h


def build_heightmap_image(name="AFD_HM_Pacific"):
    ensure_dir(OUT_DIR)
    if name in bpy.data.images:
        bpy.data.images.remove(bpy.data.images[name])
    img = bpy.data.images.new(name, width=HM_RES, height=HM_RES, alpha=False, float_buffer=True)
    pixels = [0.0] * (HM_RES * HM_RES * 4)
    # also keep raw heights for stats
    hmin, hmax = 1e9, -1e9
    land_count = 0
    for j in range(HM_RES):
        y = -HALF + (j / (HM_RES - 1)) * WORLD_M
        for i in range(HM_RES):
            x = -HALF + (i / (HM_RES - 1)) * WORLD_M
            h = height_at(x, y)
            hmin = min(hmin, h)
            hmax = max(hmax, h)
            if h > 0.5:
                land_count += 1
            # store normalized later
            idx = (j * HM_RES + i) * 4
            pixels[idx] = h  # temp store absolute in R
            pixels[idx + 1] = h
            pixels[idx + 2] = h
            pixels[idx + 3] = 1.0
        if j % 128 == 0:
            print(f"heightmap row {j}/{HM_RES}")
    # normalize 0..1 for displace (seabed→peak)
    span = max(hmax - hmin, 1e-3)
    for n in range(HM_RES * HM_RES):
        idx = n * 4
        v = (pixels[idx] - hmin) / span
        pixels[idx] = pixels[idx + 1] = pixels[idx + 2] = v
    img.pixels.foreach_set(pixels)
    img.pack()
    try:
        img.filepath_raw = HM_OUT
        img.file_format = "PNG"
        img.save()
    except Exception as e:
        print("heightmap save warn:", e)
    land_pct = 100.0 * land_count / (HM_RES * HM_RES)
    meta = {"hmin": hmin, "hmax": hmax, "span": span, "land_pct": land_pct}
    print("HM meta", meta)
    return img, meta


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in list(bpy.data.collections):
        if coll.name not in ("Collection",):
            bpy.data.collections.remove(coll)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for b in list(block):
            block.remove(b)


def get_or_create_collection(name, parent=None):
    if name in bpy.data.collections:
        col = bpy.data.collections[name]
    else:
        col = bpy.data.collections.new(name)
    root = parent or bpy.context.scene.collection
    # link if not already
    def is_linked(c, target):
        if target in c.children[:]:
            return True
        for ch in c.children:
            if is_linked(ch, target):
                return True
        return False
    if col.name not in [c.name for c in root.children] and col != root:
        try:
            root.children.link(col)
        except RuntimeError:
            pass
    return col


def make_terrain(img, meta):
    col = get_or_create_collection("01_Terrain")
    bpy.ops.mesh.primitive_grid_add(
        x_subdivisions=MESH_RES,
        y_subdivisions=MESH_RES,
        size=WORLD_M,
        location=(0, 0, 0),
    )
    terrain = bpy.context.active_object
    terrain.name = "Terrain_Pacific_16km"
    # Move to collection
    for c in list(terrain.users_collection):
        c.objects.unlink(terrain)
    col.objects.link(terrain)

    # Material
    mat = bpy.data.materials.new("M_Terrain_Tropical")
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.12, 0.28, 0.10, 1)
    bsdf.inputs["Roughness"].default_value = 0.85
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    terrain.data.materials.append(mat)

    # Displace from heightmap
    tex = bpy.data.textures.new("T_Pacific_HM", type="IMAGE")
    tex.image = img
    tex.extension = "EXTEND"
    mod = terrain.modifiers.new("Displace_HM", type="DISPLACE")
    mod.texture = tex
    mod.texture_coords = "UV"
    # ensure UVs
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.uv.unwrap(method="ANGLE_BASED", margin=0.001)
    # Better: project from view / reset UV 0-1 for grid
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.reset()
    bpy.ops.object.mode_set(mode="OBJECT")
    # strength = full height span (image 0..1)
    mod.strength = meta["span"]
    mod.mid_level = -meta["hmin"] / meta["span"]  # so 0 in image → hmin
    # Apply for stable authoring export (optional — keep modifier for editability)
    # Keep modifier live for now
    return terrain


def make_ocean():
    col = get_or_create_collection("02_Ocean")
    bpy.ops.mesh.primitive_plane_add(size=WORLD_M * 1.08, location=(0, 0, 0.0))
    ocean = bpy.context.active_object
    ocean.name = "Ocean_Pacific"
    for c in list(ocean.users_collection):
        c.objects.unlink(ocean)
    col.objects.link(ocean)
    mat = bpy.data.materials.new("M_Ocean_Tropical")
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.02, 0.12, 0.22, 1)
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = 0.85
    elif "Transmission" in bsdf.inputs:
        bsdf.inputs["Transmission"].default_value = 0.85
    bsdf.inputs["Roughness"].default_value = 0.08
    if "IOR" in bsdf.inputs:
        bsdf.inputs["IOR"].default_value = 1.333
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    ocean.data.materials.append(mat)
    return ocean


def make_airbase_proxy():
    """Simple runway + hangar blocks as visual anchors (not final art)."""
    col = get_or_create_collection("03_Airbase")
    # Runway ~2200 × 60 m on plateau
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-1800, -900, 10))
    rw = bpy.context.active_object
    rw.name = "Airbase_Runway"
    rw.scale = (1100, 30, 0.4)  # half-extents via scale on 1m cube → 2200×60
    for c in list(rw.users_collection):
        c.objects.unlink(rw)
    col.objects.link(rw)
    mat = bpy.data.materials.new("M_Runway")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.18, 0.18, 0.2, 1)
        bsdf.inputs["Roughness"].default_value = 0.55
    rw.data.materials.append(mat)
    # Tower
    bpy.ops.mesh.primitive_cylinder_add(radius=8, depth=45, location=(-1550, -780, 30))
    tw = bpy.context.active_object
    tw.name = "Airbase_Tower"
    for c in list(tw.users_collection):
        c.objects.unlink(tw)
    col.objects.link(tw)
    # Hangars
    for i, (hx, hy) in enumerate(((-2000, -1050), (-2000, -750), (-1600, -1050))):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(hx, hy, 18))
        hg = bpy.context.active_object
        hg.name = f"Airbase_Hangar_{i+1}"
        hg.scale = (40, 28, 12)
        for c in list(hg.users_collection):
            c.objects.unlink(hg)
        col.objects.link(hg)


def make_carrier_proxy():
    col = get_or_create_collection("04_POI")
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-6200, 1200, 8))
    c = bpy.context.active_object
    c.name = "Carrier_Hull"
    c.scale = (160, 35, 12)
    for uc in list(c.users_collection):
        uc.objects.unlink(c)
    col.objects.link(c)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-6200, 1200, 16))
    deck = bpy.context.active_object
    deck.name = "Carrier_Deck"
    deck.scale = (170, 38, 1.2)
    for uc in list(deck.users_collection):
        uc.objects.unlink(deck)
    col.objects.link(deck)


def make_poi_empties():
    col = get_or_create_collection("04_POI")
    for p in POIS:
        bpy.ops.object.empty_add(type="PLAIN_AXES", location=(p["x"], p["y"], p["z"]))
        e = bpy.context.active_object
        e.name = p["name"]
        e.empty_display_size = 120
        e["afd_note"] = p["note"]
        for uc in list(e.users_collection):
            uc.objects.unlink(e)
        col.objects.link(e)


def make_sector_empties():
    col = get_or_create_collection("05_Sectors_4km")
    n = int(WORLD_M // SECTOR)  # 4
    for iy in range(n):
        for ix in range(n):
            cx = -HALF + SECTOR * (ix + 0.5)
            cy = -HALF + SECTOR * (iy + 0.5)
            bpy.ops.object.empty_add(type="CUBE", location=(cx, cy, 0))
            e = bpy.context.active_object
            e.name = f"Sector_{ix}_{iy}"
            e.empty_display_size = SECTOR * 0.5
            e["afd_sector"] = f"{ix}_{iy}"
            for uc in list(e.users_collection):
                uc.objects.unlink(e)
            col.objects.link(e)


def make_lighting():
    col = get_or_create_collection("06_Environment")
    # Late afternoon sun
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 5000))
    sun = bpy.context.active_object
    sun.name = "Sun_LateAfternoon"
    sun.data.energy = 4.5
    sun.data.angle = math.radians(1.2)
    sun.rotation_euler = (math.radians(48), math.radians(15), math.radians(-35))
    for uc in list(sun.users_collection):
        uc.objects.unlink(sun)
    col.objects.link(sun)

    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("AFD_Pacific_World")
        bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputWorld")
    bg = nodes.new("ShaderNodeBackground")
    # warm late sky
    bg.inputs["Color"].default_value = (0.45, 0.62, 0.95, 1)
    bg.inputs["Strength"].default_value = 0.55
    links.new(bg.outputs["Background"], out.inputs["Surface"])

    # Camera overview
    bpy.ops.object.camera_add(location=(0, -14500, 9500))
    cam = bpy.context.active_object
    cam.name = "Cam_Overview"
    cam.rotation_euler = (math.radians(52), 0, 0)
    bpy.context.scene.camera = cam
    for uc in list(cam.users_collection):
        uc.objects.unlink(cam)
    col.objects.link(cam)


def make_island_guides():
    col = get_or_create_collection("00_LayoutGuides")
    for isl in ISLANDS:
        bpy.ops.mesh.primitive_circle_add(
            vertices=64,
            radius=1,
            location=(isl["cx"], isl["cy"], 5),
        )
        g = bpy.context.active_object
        g.name = f"Guide_{isl['name']}"
        g.scale = (isl["rx"], isl["ry"], 1)
        g.display_type = "WIRE"
        for uc in list(g.users_collection):
            uc.objects.unlink(g)
        col.objects.link(g)


def frame_view():
    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            for space in area.spaces:
                if space.type == "VIEW_3D":
                    space.clip_end = 100000
                    space.shading.type = "MATERIAL"
            break


def main():
    ensure_dir(OUT_DIR)
    print("=== AFD Pacific Islands 16km build ===")
    clear_scene()
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0
    sc.render.engine = "BLENDER_EEVEE"
    if hasattr(sc, "eevee"):
        pass
    sc["afd_map_id"] = "pacific_islands"
    sc["afd_world_m"] = WORLD_M
    sc["afd_max_h"] = MAX_H
    sc["afd_sectors"] = int(WORLD_M // SECTOR) ** 2

    img, meta = build_heightmap_image()
    terrain = make_terrain(img, meta)
    ocean = make_ocean()
    make_island_guides()
    make_airbase_proxy()
    make_carrier_proxy()
    make_poi_empties()
    make_sector_empties()
    make_lighting()
    frame_view()

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    print("SAVED", BLEND_OUT)
    print("OBJECTS", len(bpy.data.objects))
    print("LAND%~", round(meta["land_pct"], 2))
    print("H range", round(meta["hmin"], 1), "→", round(meta["hmax"], 1))
    return {"blend": BLEND_OUT, "hm": HM_OUT, "meta": meta}


if __name__ == "__main__":
    main()
