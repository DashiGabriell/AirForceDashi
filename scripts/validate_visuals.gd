extends SceneTree
## Headless smoke: vapor API, night glow fields, free cam / screenshot mode.
## godot --headless --path . -s res://scripts/validate_visuals.gd


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[visuals] boot")
	var err := change_scene_to_file("res://scenes/main.tscn")
	if err != OK:
		push_error("[visuals] failed to load main: %s" % err)
		quit(1)
		return

	var game := root.get_node_or_null("Game")
	if game == null:
		push_error("[visuals] Game missing")
		quit(1)
		return

	var frames := 0
	while bool(game.get("generating")) and frames < 900:
		await process_frame
		frames += 1
	if bool(game.get("generating")):
		push_error("[visuals] generation timeout")
		quit(1)
		return

	game.set("title_dismissed", true)
	game.set("player_engaged", true)

	var jet: Node = game.get("jet")
	if jet == null:
		push_error("[visuals] jet missing")
		quit(1)
		return
	var mesh: Node = jet.get_node_or_null("JetMesh")
	if mesh == null or not mesh.has_method("update_vapor"):
		push_error("[visuals] JetMesh.update_vapor missing")
		quit(1)
		return
	if mesh.get("contrail_l") == null or mesh.get("trail_l") == null:
		push_error("[visuals] contrail/wing vapor nodes missing")
		quit(1)
		return

	# Force high-altitude AB vapor
	jet.global_position = Vector3(0, 2800, 0)
	game.set("airspeed", 200.0)
	game.set("g_force", 2.8)
	if jet.has_method("set_afterburner_hold"):
		jet.call("set_afterburner_hold", true)
	for i in 20:
		await process_frame
	var cl: GPUParticles3D = mesh.get("contrail_l")
	if not cl.emitting:
		push_error("[visuals] engine contrail not emitting at altitude+AB")
		quit(1)
		return

	# Night landmarks / headlights exist
	var world: Node = root.find_child("World", true, false)
	if world == null:
		push_error("[visuals] World missing")
		quit(1)
		return
	var lm: Node = world.get_node_or_null("LandmarkField")
	var df: Node = world.get_node_or_null("DetailField")
	if lm == null or lm.get_node_or_null("CityGlow") == null:
		push_error("[visuals] CityGlow missing")
		quit(1)
		return
	if df == null or df.get_node_or_null("Headlights") == null:
		push_error("[visuals] Headlights missing")
		quit(1)
		return

	# Drive the day cycle into night so world_root applies night visuals.
	game.set("time_of_day", 0.68)
	for i in 30:
		await process_frame
	if float(game.get("day_factor")) > 0.4:
		push_error("[visuals] day_factor still bright at night TOD (%s)" % game.get("day_factor"))
		quit(1)
		return
	if lm.has_method("refresh_around") and jet is Node3D:
		# Force snap rebuild of lights/glow
		lm.set("_last_snap", Vector2(INF, INF))
		lm.call("refresh_around", (jet as Node3D).global_position)
	for i in 10:
		await process_frame
	var glow: Node3D = lm.get_node("CityGlow")
	if not glow.visible:
		push_error("[visuals] CityGlow not visible at night (day_factor=%s)" % game.get("day_factor"))
		quit(1)
		return

	# Free cam cycle (TOP -> CHASE -> COCKPIT -> FREE)
	game.set("camera_mode", 0)
	game.cycle_camera() # 1 chase
	game.cycle_camera() # 2 cockpit
	game.cycle_camera() # 3 free
	if int(game.get("camera_mode")) != 3:
		push_error("[visuals] expected FREE cam mode (3), got %s" % game.get("camera_mode"))
		quit(1)
		return
	for i in 15:
		await process_frame

	game.toggle_screenshot_mode()
	if not bool(game.get("screenshot_mode")):
		push_error("[visuals] screenshot_mode failed to enable")
		quit(1)
		return
	game.toggle_screenshot_mode()

	# Leave free cam
	game.cycle_camera() # top
	if jet.has_method("set_afterburner_hold"):
		jet.call("set_afterburner_hold", false)

	print("[visuals] ok")
	quit(0)
