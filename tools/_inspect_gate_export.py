import bpy, os
SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "3d", "checkpoint_gate.glb"))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
print("size", os.path.getsize(SRC), flush=True)
for m in bpy.data.materials:
    print("MAT", m.name, flush=True)
    if not m.use_nodes: continue
    bsdf = next((n for n in m.node_tree.nodes if n.type=="BSDF_PRINCIPLED"), None)
    if bsdf:
        es = bsdf.inputs.get("Emission Strength")
        print("  emit_str", es.default_value if es else None, "linked_emit", bsdf.inputs.get("Emission Color").is_linked if bsdf.inputs.get("Emission Color") else bsdf.inputs.get("Emission").is_linked, flush=True)
        print("  metal", bsdf.inputs["Metallic"].default_value, "linked", bsdf.inputs["Metallic"].is_linked, flush=True)
    for n in m.node_tree.nodes:
        if n.type=="TEX_IMAGE" and n.image:
            print("  TEX", n.image.name, tuple(n.image.size), flush=True)
for img in bpy.data.images:
    print("IMG", img.name, tuple(img.size), flush=True)
