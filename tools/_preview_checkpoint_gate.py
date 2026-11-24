"""Render orthographic preview sheet of checkpoint_gate.glb."""
from __future__ import annotations

import math
import os

import bpy
import mathutils

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "assets", "3d", "checkpoint_gate.glb")
OUT = os.path.join(ROOT, "assets", "3d", "checkpoint_gate_preview.png")


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)

    # World
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.02, 0.02, 0.025, 1)
    bg.inputs[1].default_value = 1.0

    # Camera
    cam_data = bpy.data.cameras.new("PreviewCam")
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (2.6, -2.4, 1.5)
    cam.rotation_euler = (math.radians(65), 0, math.radians(48))
    cam_data.lens = 50

    # Lights
    key = bpy.data.lights.new("Key", "AREA")
    key.energy = 250
    key.size = 3
    key_o = bpy.data.objects.new("Key", key)
    bpy.context.collection.objects.link(key_o)
    key_o.location = (2, -2, 3)

    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 80
    fill.size = 4
    fill_o = bpy.data.objects.new("Fill", fill)
    bpy.context.collection.objects.link(fill_o)
    fill_o.location = (-2, 1, 2)

    scene = bpy.context.scene
    # Blender 5.x: EEVEE Next
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 1280
    scene.render.filepath = OUT
    scene.render.film_transparent = False
    bpy.ops.render.render(write_still=True)
    print(f"[preview] {OUT}", flush=True)


if __name__ == "__main__":
    main()
