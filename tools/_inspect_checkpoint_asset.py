"""Inspect assets/3d/checkpoint/base_basic_pbr.glb hierarchy + materials."""
from __future__ import annotations

import os

import bpy

SRC = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "assets",
        "3d",
        "checkpoint",
        "base_basic_pbr.glb",
    )
)


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    print(f"[inspect] {SRC}", flush=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    print("=== OBJECTS ===", flush=True)
    for o in bpy.context.scene.objects:
        p = o.parent.name if o.parent else "-"
        tris = 0
        if o.type == "MESH":
            o.data.calc_loop_triangles()
            tris = len(o.data.loop_triangles)
        mats = [s.material.name for s in o.material_slots if s.material]
        print(f"{o.type}|{o.name}|parent={p}|tris={tris}|mats={mats}", flush=True)
    print("=== MATERIALS ===", flush=True)
    for m in bpy.data.materials:
        print(f"MAT|{m.name}", flush=True)
        if not m.use_nodes:
            continue
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                print(
                    f"  TEX|{n.name}|img={n.image.name}|size={tuple(n.image.size)}",
                    flush=True,
                )
            if n.type == "BSDF_PRINCIPLED":
                em = n.inputs.get("Emission Color") or n.inputs.get("Emission")
                es = n.inputs.get("Emission Strength")
                print(
                    f"  BSDF metallic={n.inputs['Metallic'].default_value:.2f} "
                    f"rough={n.inputs['Roughness'].default_value:.2f} "
                    f"emit_str={es.default_value if es else '?'}",
                    flush=True,
                )
    print("=== IMAGES ===", flush=True)
    for img in bpy.data.images:
        print(f"IMG|{img.name}|{tuple(img.size)}|{img.filepath}", flush=True)


if __name__ == "__main__":
    main()
