extends SceneTree
## Headless check: landmarks / skyline / night lights.
## godot --headless --path . -s res://scripts/validate_phase4.gd


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[phase4] boot")
	var err := change_scene_to_file("res://scenes/main.tscn")
	if err != OK:
		push_error("[phase4] failed to load main")
		quit(1)
		return
	await process_frame
	var game: Node = root.get_node("Game")
	var frames := 0
	while bool(game.get("generating")) and frames < 1200:
		await process_frame
		frames += 1
	if bool(game.get("generating")):
		push_error("[phase4] generation timeout")
		quit(1)
		return

	var world: Node = _find(root, "World")
	if world == null or world.get("landmark_field") == null:
		push_error("[phase4] landmark field missing")
		quit(1)
		return

	var jet: Node3D = _find(root, "Jet") as Node3D
	if jet:
		jet.global_position = Vector3(400.0, 300.0, -200.0)
	for i in 30:
		await process_frame

	# Drive the day cycle into night so landmark lights enable via _process.
	game.set("time_of_day", 0.72)
	for i in 45:
		await process_frame
	if jet:
		jet.global_position = Vector3(900.0, 280.0, 500.0)
	for i in 30:
		await process_frame

	var lm: Node = world.get("landmark_field")
	print("[phase4] night=", lm.get("_night"), " day_factor=", game.get("day_factor"), " snap=", lm.get("_last_snap"))
	if float(lm.get("_night")) < 0.5:
		push_error("[phase4] night factor not applied")
		quit(1)
		return
	if lm.get("_skyline") == null or lm.get("_lights") == null or lm.get("_bridges") == null:
		push_error("[phase4] skyline/lights/bridges missing")
		quit(1)
		return
	if not bool(lm.get("_lights").visible):
		push_error("[phase4] night lights should be visible")
		quit(1)
		return

	print("[phase4] ok")
	quit(0)


func _find(n: Node, named: String) -> Node:
	if n.name == named:
		return n
	for c in n.get_children():
		var f: Node = _find(c, named)
		if f:
			return f
	return null
