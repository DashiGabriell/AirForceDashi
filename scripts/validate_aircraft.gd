extends SceneTree
## Headless: swap F-22 / F-15 mesh and confirm FX hooks.


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[aircraft] boot")
	var err := change_scene_to_file("res://scenes/main.tscn")
	if err != OK:
		push_error("[aircraft] failed to load main: %s" % err)
		quit(1)
		return

	var game := root.get_node_or_null("Game")
	if game == null:
		push_error("[aircraft] Game missing")
		quit(1)
		return

	var frames := 0
	while bool(game.get("generating")) and frames < 900:
		await process_frame
		frames += 1
	if bool(game.get("generating")):
		push_error("[aircraft] generation timeout")
		quit(1)
		return

	var jet: Node = game.get("jet")
	if jet == null:
		push_error("[aircraft] jet missing")
		quit(1)
		return
	var mesh: Node = jet.get_node_or_null("JetMesh")
	if mesh == null or not mesh.has_method("apply_aircraft"):
		push_error("[aircraft] JetMesh.apply_aircraft missing")
		quit(1)
		return

	game.call("set_aircraft", 1) # F15
	await process_frame
	await process_frame
	if int(mesh.get("kind")) != 1:
		push_error("[aircraft] F-15 kind not applied")
		quit(1)
		return
	if mesh.get("trail_l") == null or mesh.get("plume_l") == null or mesh.get("shadow") == null:
		push_error("[aircraft] F-15 FX nodes missing")
		quit(1)
		return
	mesh.call("set_afterburner", true)
	mesh.call("update_vapor", 2800.0, 200.0, 2.5, true)
	mesh.call("set_water_skim", false)

	game.call("set_aircraft", 0) # F22
	await process_frame
	await process_frame
	if int(mesh.get("kind")) != 0:
		push_error("[aircraft] F-22 kind not restored")
		quit(1)
		return
	if mesh.get("trail_l") == null or mesh.get("plume_l") == null:
		push_error("[aircraft] F-22 FX nodes missing after swap")
		quit(1)
		return

	print("[aircraft] ok")
	quit(0)
