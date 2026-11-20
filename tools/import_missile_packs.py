"""Import additional missile packs into the game catalog.

Sources:
  assets/3d/missiles/300_followers_-_free_aircraft_missile_set.glb
  assets/3d/missiles/aim-120c_amraam.glb
  assets/3d/missiles/1.glb  (unnamed parts → spatial clusters)

Outputs (merge / overwrite by slug):
  assets/3d/missiles/<slug>.glb
  apps/web/public/models/missiles/<slug>.glb
  assets/3d/missiles/CATALOG.md  (rewritten from disk inventory)

Run:
  "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" ^
    --background --python tools/import_missile_packs.py
"""

from __future__ import annotations

import math
import os
import re
import shutil

import bpy
import mathutils

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(ROOT, "assets", "3d", "missiles")
PUBLIC_DIR = os.path.join(ROOT, "apps", "web", "public", "models", "missiles")
TARGET_LENGTH = 2.4

PACK_300 = os.path.join(OUT_DIR, "300_followers_-_free_aircraft_missile_set.glb")
PACK_AMRAAM = os.path.join(OUT_DIR, "aim-120c_amraam.glb")
PACK_1 = os.path.join(OUT_DIR, "1.glb")

# Skip pack-300 items that duplicate better/existing assets or are decoration.
SKIP_SLUGS_300 = {
    "text001",  # huge text mesh
    "aim-9-sidewinder",  # already in catalog
    "agm65-maverick",  # prefer existing agm-65-maverick
    "agm-65-maverick",
}

# Friendly slug overrides for pack-300 display names.
SLUG_OVERRIDES = {
    "agm65-maverick": "agm-65-maverick-b",
    "agm-154-jsow": "agm-154-jsow",
    "mbda-brimstone": "mbda-brimstone",
    "gbu-24-paveway": "gbu-24-paveway",
    "mk83-bomb": "mk83-bomb",
    "aim-54-phoenix": "aim-54-phoenix",
    "aim-120-amraam": "aim-120-amraam",
    "ks-172-novator": "ks-172-novator",
    "aim-132-asraam": "aim-132-asraam",
}


def log(msg: str) -> None:
    print(f"[missiles+] {msg}", flush=True)


def slugify(name: str) -> str:
    s = name.strip().lower()
    s = s.replace("(2)", "b").replace("( 2)", "b")
    s = re.sub(r"[^\w\s-]+", "", s)
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s or "missile"


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mesh_under(root: bpy.types.Object) -> list[bpy.types.Object]:
    out: list[bpy.types.Object] = []
    stack = [root]
    while stack:
        o = stack.pop()
        if o.type == "MESH":
            out.append(o)
        stack.extend(list(o.children))
    return out


def select_hierarchy(root: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    stack = [root]
    while stack:
        o = stack.pop()
        o.select_set(True)
        stack.extend(list(o.children))
    bpy.context.view_layer.objects.active = root


def bake_world(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if obj.parent is not None:
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def join_meshes(meshes: list[bpy.types.Object], name: str) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    return obj


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


def orient_nose_neg_z(obj: bpy.types.Object) -> None:
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    mn = [min(p[i] for p in pts) for i in range(3)]
    mx = [max(p[i] for p in pts) for i in range(3)]
    size = [mx[i] - mn[i] for i in range(3)]
    axis = max(range(3), key=lambda i: size[i])
    mid = (mn[axis] + mx[axis]) * 0.5
    low = sum(1 for p in pts if p[axis] < mid)
    tip_at_min = low < (len(pts) - low)

    if axis == 2:
        rot = (
            mathutils.Matrix.Identity(4)
            if tip_at_min
            else mathutils.Matrix.Rotation(math.pi, 4, "Y")
        )
    elif axis == 0:
        ang = math.radians(90 if tip_at_min else -90)
        rot = mathutils.Matrix.Rotation(ang, 4, "Y")
    else:
        ang = math.radians(-90 if tip_at_min else 90)
        rot = mathutils.Matrix.Rotation(ang, 4, "X")

    obj.data.transform(rot)
    obj.data.update()

    mn, mx = vertex_bounds(obj)
    length = max(mx[2] - mn[2], 0.001)
    scale = TARGET_LENGTH / length
    obj.data.transform(mathutils.Matrix.Scale(scale, 4))
    obj.data.update()

    mn, mx = vertex_bounds(obj)
    center = mathutils.Vector(((mn[i] + mx[i]) * 0.5 for i in range(3)))
    obj.data.transform(mathutils.Matrix.Translation(-center))
    obj.data.update()


def outward_normals(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth()


def export_glb(obj: bpy.types.Object, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
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
    log(f"  exported {os.path.basename(path)} ({os.path.getsize(path)} bytes)")


def find_weapon_roots() -> list[bpy.types.Object]:
    roots: list[bpy.types.Object] = []
    for o in bpy.context.scene.objects:
        if o.type != "EMPTY":
            continue
        if not o.parent or o.parent.name != "GLTF_SceneRootNode":
            continue
        if not mesh_under(o):
            continue
        if o.name.startswith("Text"):
            continue
        roots.append(o)
    return roots


def display_name(root_name: str) -> str:
    return re.sub(r"_\d+$", "", root_name).strip()


def finalize_and_save(obj: bpy.types.Object, slug: str, name: str) -> dict:
    orient_nose_neg_z(obj)
    outward_normals(obj)
    obj.data.calc_loop_triangles()
    tris = len(obj.data.loop_triangles)
    out_path = os.path.join(OUT_DIR, f"{slug}.glb")
    public_path = os.path.join(PUBLIC_DIR, f"{slug}.glb")
    export_glb(obj, out_path)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    shutil.copyfile(out_path, public_path)
    bpy.data.objects.remove(obj, do_unlink=True)
    return {"slug": slug, "name": name, "tris": tris, "file": f"{slug}.glb"}


def process_named_root(root: bpy.types.Object, slug: str, name: str) -> dict | None:
    meshes = mesh_under(root)
    if not meshes:
        return None
    select_hierarchy(root)
    bpy.ops.object.duplicate()
    dup_root = bpy.context.view_layer.objects.active
    dup_meshes = mesh_under(dup_root)
    for m in dup_meshes:
        bake_world(m)
    joined = join_meshes(dup_meshes, name)
    if dup_root.name in bpy.data.objects and dup_root != joined:
        try:
            bpy.data.objects.remove(dup_root, do_unlink=True)
        except ReferenceError:
            pass
    return finalize_and_save(joined, slug, name)


def import_pack_300() -> list[dict]:
    if not os.path.isfile(PACK_300):
        log(f"skip missing {PACK_300}")
        return []
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=PACK_300)
    named = []
    for r in find_weapon_roots():
        name = display_name(r.name)
        raw = slugify(name)
        if raw in SKIP_SLUGS_300 or raw.startswith("text"):
            log(f"skip 300: {name}")
            continue
        slug = SLUG_OVERRIDES.get(raw, raw)
        named.append((name, slug))

    rows: list[dict] = []
    for name, slug in named:
        clear_scene()
        bpy.ops.import_scene.gltf(filepath=PACK_300)
        match = None
        for o in find_weapon_roots():
            if slugify(display_name(o.name)) == slugify(name):
                match = o
                break
            # AGM65 vs AGM-65
            if slugify(display_name(o.name).replace("AGM65", "AGM-65")) == slugify(
                name.replace("AGM65", "AGM-65")
            ):
                match = o
                break
        if match is None:
            # Match by normalized slug of display name
            for o in find_weapon_roots():
                if SLUG_OVERRIDES.get(slugify(display_name(o.name)), slugify(display_name(o.name))) == slug:
                    match = o
                    break
        if match is None:
            log(f"missing 300: {name}")
            continue
        log(f"process 300 {name} → {slug}")
        row = process_named_root(match, slug, name)
        if row:
            rows.append(row)
    return rows


def import_amraam_c() -> list[dict]:
    if not os.path.isfile(PACK_AMRAAM):
        log(f"skip missing {PACK_AMRAAM}")
        return []
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=PACK_AMRAAM)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        log("aim-120c: no mesh")
        return []
    for m in meshes:
        bake_world(m)
    joined = join_meshes(meshes, "AIM-120C AMRAAM")
    log("process AIM-120C AMRAAM → aim-120c-amraam")
    row = finalize_and_save(joined, "aim-120c-amraam", "AIM-120C AMRAAM")
    return [row] if row else []


def empty_aabb_center(root: bpy.types.Object) -> mathutils.Vector | None:
    meshes = mesh_under(root)
    if not meshes:
        return None
    mn = mathutils.Vector((1e9, 1e9, 1e9))
    mx = mathutils.Vector((-1e9, -1e9, -1e9))
    for m in meshes:
        for v in m.data.vertices:
            co = m.matrix_world @ v.co
            mn.x = min(mn.x, co.x)
            mn.y = min(mn.y, co.y)
            mn.z = min(mn.z, co.z)
            mx.x = max(mx.x, co.x)
            mx.y = max(mx.y, co.y)
            mx.z = max(mx.z, co.z)
    return (mn + mx) * 0.5


def import_pack_1_clusters() -> list[dict]:
    """1.glb has unnamed parts laid out along X — cluster by X into weapons."""
    if not os.path.isfile(PACK_1):
        log(f"skip missing {PACK_1}")
        return []
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=PACK_1)
    roots = find_weapon_roots()
    items: list[tuple[bpy.types.Object, float]] = []
    for r in roots:
        c = empty_aabb_center(r)
        if c is None:
            continue
        items.append((r, c.x))
    if not items:
        return []

    items.sort(key=lambda t: t[1])
    # Gap-based clustering on X
    clusters: list[list[bpy.types.Object]] = []
    cur: list[bpy.types.Object] = [items[0][0]]
    last_x = items[0][1]
    for obj, x in items[1:]:
        if abs(x - last_x) > 4.0:
            clusters.append(cur)
            cur = [obj]
        else:
            cur.append(obj)
        last_x = x
    clusters.append(cur)

    log(f"1.glb clustered into {len(clusters)} weapons")
    # Snapshot names per cluster (object names stay stable across reimport by matching)
    cluster_names = [[o.name for o in cl] for cl in clusters]

    rows: list[dict] = []
    for i, names in enumerate(cluster_names, start=1):
        slug = f"pack1-missile-{i:02d}"
        label = f"Missile Pack 1 #{i}"
        clear_scene()
        bpy.ops.import_scene.gltf(filepath=PACK_1)
        by_name = {o.name: o for o in bpy.context.scene.objects}
        meshes: list[bpy.types.Object] = []
        for n in names:
            root = by_name.get(n)
            if root is None:
                continue
            meshes.extend(mesh_under(root))
        if not meshes:
            log(f"skip empty cluster {slug}")
            continue
        # Duplicate meshes only (bake individually)
        bpy.ops.object.select_all(action="DESELECT")
        for m in meshes:
            m.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.duplicate()
        dups = [o for o in bpy.context.selected_objects if o.type == "MESH"]
        for m in dups:
            bake_world(m)
        joined = join_meshes(dups, label)
        log(f"process {label} → {slug} ({len(names)} parts)")
        row = finalize_and_save(joined, slug, label)
        if row:
            rows.append(row)
    return rows


# Source packs themselves must not appear as catalog weapons.
SOURCE_PACK_FILES = {
    "300_followers_-_free_aircraft_missile_set.glb",
    "aim-120c_amraam.glb",
    "1.glb",
    "roketsan_missiles.glb",
    "missile__bomb_collection_-_fighter_jets_-_free.glb",
}


def rewrite_catalog() -> None:
    """Rebuild CATALOG.md from exported weapon files currently on disk."""
    rows = []
    for fn in sorted(os.listdir(OUT_DIR)):
        if not fn.endswith(".glb"):
            continue
        if fn in SOURCE_PACK_FILES:
            continue
        if fn.startswith("300_") or fn == "1.glb":
            continue
        slug = fn[:-4]
        # Prefer known display labels
        label = slug.replace("-", " ").title()
        known = {
            "aim-9-sidewinder": "AIM-9 Sidewinder",
            "aim-120-amraam": "AIM-120 AMRAAM",
            "aim-120c-amraam": "AIM-120C AMRAAM",
            "aim-7-sparrow": "AIM-7 Sparrow",
            "aim-54-phoenix": "AIM-54 Phoenix",
            "aim-132-asraam": "AIM-132 ASRAAM",
            "agm-65-maverick": "AGM-65 Maverick",
            "agm-114-hellfire": "AGM-114 Hellfire",
            "agm-154-jsow": "AGM-154 JSOW",
            "mbda-brimstone": "MBDA Brimstone",
            "gbu-12-paveway-ii": "GBU-12 Paveway II",
            "gbu-24-paveway": "GBU-24 Paveway",
            "jdam": "JDAM",
            "jdam-b": "JDAM (2)",
            "mk83-bomb": "Mk83 Bomb",
            "kab-500l": "KAB-500L",
            "kh-29": "Kh-29",
            "hj-10": "HJ-10",
            "pl-11": "PL-11",
            "pl-11-b": "PL-11 (2)",
            "r-27": "R-27",
            "r-27-b": "R-27 (2)",
            "r-77": "R-77",
            "ty-90": "TY-90",
            "ks-172-novator": "KS-172 Novator",
        }
        for i in range(1, 20):
            known[f"pack1-missile-{i:02d}"] = f"Missile Pack 1 #{i}"
        label = known.get(slug, label)
        path = os.path.join(OUT_DIR, fn)
        # Tris unknown without reimport — leave as —
        rows.append({"slug": slug, "name": label, "tris": "—", "file": fn, "bytes": os.path.getsize(path)})

    path = os.path.join(OUT_DIR, "CATALOG.md")
    lines = [
        "# Missile / bomb catalog",
        "",
        "Sources:",
        "- `missile__bomb_collection_-_fighter_jets_-_free.glb` (original split)",
        "- `300_followers_-_free_aircraft_missile_set.glb`",
        "- `aim-120c_amraam.glb`",
        "- `1.glb` (unnamed spatial clusters → `pack1-missile-##`)",
        "",
        "Each file is one weapon, nose on local −Z, length ≈ 2.4 units (game scale).",
        "",
        "| Slug | Display name | Size | File |",
        "| --- | --- | ---: | --- |",
    ]
    for r in rows:
        kb = round(r["bytes"] / 1024)
        lines.append(f"| `{r['slug']}` | {r['name']} | {kb} KB | `{r['file']}` |")
    lines += [
        "",
        "## Notes",
        "",
        "- Duplicate variants keep pack naming (`jdam-b`, `pl-11-b`, `r-27-b`).",
        "- `aim-120c-amraam` is the high-detail AMRAAM used by the F-22 loadout.",
        "- `pack1-missile-##` names are provisional until the source pack is identified.",
        "- Public copies live under `apps/web/public/models/missiles/`.",
        "- F-22 playable: see `packages/game-core/src/progress/weapons.ts`.",
        "",
    ]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    log(f"catalog {path} ({len(rows)} weapons)")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    rows: list[dict] = []
    rows.extend(import_pack_300())
    rows.extend(import_amraam_c())
    rows.extend(import_pack_1_clusters())
    rewrite_catalog()
    log(f"done imported {len(rows)} new/updated weapons this run")


if __name__ == "__main__":
    main()
