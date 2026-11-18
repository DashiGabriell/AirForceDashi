extends SceneTree
## Headless check: large world + buildings + vegetation.
## godot --headless --path . -s res://scripts/validate_phase3.gd


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[phase3] boot")
	var err := change_scene_to_file("res://scenes/main.tscn")
	if err != OK:
		push_error("[phase3] failed to load main")
		quit(1)
		return
	await process_frame
	var game: Node = root.get_node("Game")
	var frames := 0
	while bool(game.get("generating")) and frames < 1200:
		await process_frame
		frames += 1
		if frames % 120 == 0:
			print("[phase3] frame ", frames, " gen=", game.get("gen_progress"))
	if bool(game.get("generating")):
		push_error("[phase3] generation timeout")
		quit(1)
		return

	var world: Node = _find(root, "World")
	if world == null:
		push_error("[phase3] World missing")
		quit(1)
		return
	if world.get("building_field") == null or world.get("vegetation_field") == null:
		push_error("[phase3] building/vegetation fields missing")
		quit(1)
		return

	var jet: Node3D = _find(root, "Jet") as Node3D
	if jet:
		# Seed into farmland-ish area then city-ish sweeps.
		jet.global_position = Vector3(800.0, 180.0, -600.0)
	for i in 40:
		await process_frame
	if jet:
		jet.global_position = Vector3(-1200.0, 220.0, 900.0)
	for i in 40:
		await process_frame

	var veg: Node = world.get("vegetation_field")
	var snap: Variant = veg.get("_last_snap")
	print("[phase3] vegetation snap=", snap)
	print("[phase3] WORLD_SIZE=", game.get("WORLD_SIZE"))
	print("[phase3] ok")
	quit(0)


func _find(n: Node, named: String) -> Node:
	if n.name == named:
		return n
	for c in n.get_children():
		var f: Node = _find(c, named)
		if f:
			return f
	return null
