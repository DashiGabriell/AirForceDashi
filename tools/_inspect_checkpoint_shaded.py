import bpy, os
SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "3d", "checkpoint", "base_basic_shaded.glb"))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
print("=== SHADED ===", flush=True)
for o in bpy.context.scene.objects:
    if o.type=="MESH":
        o.data.calc_loop_triangles()
        print(f"MESH|{o.name}|tris={len(o.data.loop_triangles)}|mats={[s.material.name for s in o.material_slots if s.material]}", flush=True)
for m in bpy.data.materials:
    print(f"MAT|{m.name}", flush=True)
    if m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type=="TEX_IMAGE" and n.image:
                print(f"  TEX|{n.image.name}|{tuple(n.image.size)}", flush=True)
            if n.type=="EMISSION":
                print(f"  EMISSION strength={n.inputs[1].default_value}", flush=True)
            if n.type=="BSDF_PRINCIPLED":
                es=n.inputs.get("Emission Strength")
                print(f"  BSDF emit_str={es.default_value if es else 0}", flush=True)
for img in bpy.data.images:
    print(f"IMG|{img.name}|{tuple(img.size)}", flush=True)
