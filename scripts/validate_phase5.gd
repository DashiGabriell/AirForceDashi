extends SceneTree
## Headless check: detail field (traffic/airport) + region HUD state.
## godot --headless --path . -s res://scripts/validate_phase5.gd


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[phase5] boot")
	var err := change_scene_to_file("res://scenes/main.tscn")
	if err != OK:
		push_error("[phase5] failed to load main")
		quit(1)
		return
	await process_frame
	var game: Node = root.get_node("Game")
	var frames := 0
	while bool(game.get("generating")) and frames < 1200:
		await process_frame
		frames += 1
	if bool(game.get("generating")):
		push_error("[phase5] generation timeout")
		quit(1)
		return

	var world: Node = _find(root, "World")
	if world == null or world.get("detail_field") == null:
		push_error("[phase5] detail field missing")
		quit(1)
		return

	var gen = world.get("terrain_gen")
	var ap_count: int = gen.airports.size()
	print("[phase5] airports=", ap_count)
	if ap_count < 1:
		push_error("[phase5] expected at least one airport site")
		quit(1)
		return

	var jet: Node3D = _find(root, "Jet") as Node3D
	if jet:
		var ap: Vector2 = gen.airports[0]
		jet.global_position = Vector3(ap.x, 220.0, ap.y)
	for i in 50:
		await process_frame

	var df: Node = world.get("detail_field")
	if df.get("_cars") == null or df.get("_airport") == null:
		push_error("[phase5] cars/airport multimesshes missing")
		quit(1)
		return

	var name_s: String = str(game.get("over_region_name"))
	print("[phase5] over_region_name=", name_s, " snap=", df.get("_last_snap"))
	if name_s.is_empty():
		push_error("[phase5] region name empty")
		quit(1)
		return

	print("[phase5] ok")
	quit(0)


func _find(n: Node, named: String) -> Node:
	if n.name == named:
		return n
	for c in n.get_children():
		var f: Node = _find(c, named)
		if f:
			return f
	return null
