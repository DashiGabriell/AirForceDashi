"""Split the Sketchfab missile/bomb collection into one GLB per weapon.

Source:
  assets/3d/missile__bomb_collection_-_fighter_jets_-_free.glb

Outputs:
  assets/3d/missiles/<slug>.glb
  apps/web/public/models/missiles/<slug>.glb
  assets/3d/missiles/CATALOG.md

Run:
  blender --background --python tools/split_missile_collection.py
"""

from __future__ import annotations

import math
import os
import re
import shutil

import bpy
import mathutils

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(
    ROOT,
    "assets",
    "3d",
    "missile__bomb_collection_-_fighter_jets_-_free.glb",
)
OUT_DIR = os.path.join(ROOT, "assets", "3d", "missiles")
PUBLIC_DIR = os.path.join(ROOT, "apps", "web", "public", "models", "missiles")

# Game convention: nose toward local -Z, length along Z ~ this value.
TARGET_LENGTH = 2.4


def log(msg: str) -> None:
    print(f"[missiles] {msg}", flush=True)


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


def select_hierarchy(root: bpy.types.Object) -> list[bpy.types.Object]:
    bpy.ops.object.select_all(action="DESELECT")
    selected: list[bpy.types.Object] = []
    stack = [root]
    while stack:
        o = stack.pop()
        o.select_set(True)
        selected.append(o)
        stack.extend(list(o.children))
    bpy.context.view_layer.objects.active = root
    return selected


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
    """Longest axis → Z, denser/sharper tip toward -Z, length TARGET_LENGTH, centered."""
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    mn = [min(p[i] for p in pts) for i in range(3)]
    mx = [max(p[i] for p in pts) for i in range(3)]
    size = [mx[i] - mn[i] for i in range(3)]
    axis = max(range(3), key=lambda i: size[i])
    mid = (mn[axis] + mx[axis]) * 0.5
    low = sum(1 for p in pts if p[axis] < mid)
    # Fewer verts on the tip → that tip goes to -Z.
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
    else:  # Y
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

    mn, mx = vertex_bounds(obj)
    log(
        f"  oriented size={[round(mx[i] - mn[i], 3) for i in range(3)]} "
        f"tip_at_min={tip_at_min} axis={axis}"
    )


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
    log(f"  exported {path} ({os.path.getsize(path)} bytes)")


def find_weapon_roots() -> list[bpy.types.Object]:
    roots: list[bpy.types.Object] = []
    for o in bpy.context.scene.objects:
        if o.type != "EMPTY":
            continue
        if o.parent is None:
            continue
        # Direct children of the glTF scene root that own mesh descendants.
        if not mesh_under(o):
            continue
        # Skip utility empties.
        if o.name in {"Sketchfab_model", "root", "GLTF_SceneRootNode"}:
            continue
        if o.parent and o.parent.name == "GLTF_SceneRootNode":
            roots.append(o)
    return roots


def display_name(root_name: str) -> str:
    # "AGM-65 Maverick_4" → "AGM-65 Maverick"
    base = re.sub(r"_\d+$", "", root_name).strip()
    return base


def write_catalog(rows: list[dict]) -> None:
    path = os.path.join(OUT_DIR, "CATALOG.md")
    lines = [
        "# Missile / bomb catalog",
        "",
        "Source pack: `missile__bomb_collection_-_fighter_jets_-_free.glb`",
        "Each file is one weapon, nose on local −Z, length ≈ 2.4 units (game scale).",
        "",
        "| Slug | Display name | Tris | File |",
        "| --- | --- | ---: | --- |",
    ]
    for r in sorted(rows, key=lambda x: x["slug"]):
        lines.append(
            f"| `{r['slug']}` | {r['name']} | {r['tris']} | `{r['file']}` |"
        )
    lines.append("")
    lines.append("## Notes")
    lines.append("")
    lines.append("- Duplicate variants keep the pack naming (`jdam-b`, `pl-11-b`, `r-27-b`).")
    lines.append("- Materials come from the source GLB; no bake in this pass.")
    lines.append("- Public copies live under `apps/web/public/models/missiles/`.")
    lines.append("")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    log(f"catalog {path}")


def process_one(root: bpy.types.Object) -> dict | None:
    name = display_name(root.name)
    slug = slugify(name)
    meshes = mesh_under(root)
    if not meshes:
        log(f"skip {root.name}: no mesh")
        return None

    # Duplicate hierarchy so the import scene stays intact for the next weapon.
    select_hierarchy(root)
    bpy.ops.object.duplicate()
    dup_root = bpy.context.view_layer.objects.active
    dup_meshes = mesh_under(dup_root)
    for m in dup_meshes:
        bake_world(m)
    joined = join_meshes(dup_meshes, name)
    # Drop leftover empties from the duplicate.
    for o in list(bpy.context.scene.objects):
        if o == joined:
            continue
        # Only remove objects created for this duplicate pass:
        # anything still parented under the duplicated empty tree.
        pass
    # Remove the duplicated empty root if it still exists empty.
    if dup_root.name in bpy.data.objects and dup_root != joined:
        try:
            bpy.data.objects.remove(dup_root, do_unlink=True)
        except ReferenceError:
            pass

    orient_nose_neg_z(joined)
    outward_normals(joined)
    joined.data.calc_loop_triangles()
    tris = len(joined.data.loop_triangles)

    out_path = os.path.join(OUT_DIR, f"{slug}.glb")
    public_path = os.path.join(PUBLIC_DIR, f"{slug}.glb")
    export_glb(joined, out_path)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    shutil.copyfile(out_path, public_path)

    # Clean this weapon from the scene before the next.
    bpy.data.objects.remove(joined, do_unlink=True)
    return {
        "slug": slug,
        "name": name,
        "tris": tris,
        "file": f"{slug}.glb",
    }


def main() -> None:
    if not os.path.isfile(SRC):
        raise SystemExit(f"missing {SRC}")
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(PUBLIC_DIR, exist_ok=True)

    clear_scene()
    log(f"import {SRC}")
    bpy.ops.import_scene.gltf(filepath=SRC)

    roots = find_weapon_roots()
    log(f"found {len(roots)} weapons")
    # Snapshot names first — processing mutates the scene.
    named = [(r, display_name(r.name), slugify(display_name(r.name))) for r in roots]
    # Re-import fresh for each weapon to avoid hierarchy corruption.
    rows: list[dict] = []
    for _root, name, slug in named:
        clear_scene()
        bpy.ops.import_scene.gltf(filepath=SRC)
        match = None
        for o in find_weapon_roots():
            if slugify(display_name(o.name)) == slug:
                match = o
                break
        if match is None:
            log(f"missing after reimport: {name}")
            continue
        log(f"process {name} → {slug}")
        row = process_one(match)
        if row:
            rows.append(row)

    write_catalog(rows)
    log(f"done {len(rows)} weapons")


if __name__ == "__main__":
    main()
