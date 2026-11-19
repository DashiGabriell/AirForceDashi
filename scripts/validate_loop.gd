extends SceneTree
## Headless: hold climb long enough to pass inverted and complete a loop.


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[loop] boot")
	var err := change_scene_to_file("res://scenes/main.tscn")
	if err != OK:
		push_error("[loop] failed to load main")
		quit(1)
		return

	var game := root.get_node_or_null("Game")
	if game == null:
		push_error("[loop] Game missing")
		quit(1)
		return

	var frames := 0
	while bool(game.get("generating")) and frames < 900:
		await process_frame
		frames += 1
	if bool(game.get("generating")):
		push_error("[loop] generation timeout")
		quit(1)
		return

	game.set("title_dismissed", true)
	game.set("player_engaged", true)
	game.set("paused", false)

	var jet: Node3D = game.get("jet")
	if jet == null or not jet.has_method("reset_pose"):
		push_error("[loop] jet missing")
		quit(1)
		return

	jet.call("reset_pose", Vector3(0, 2200, 0), 0.0, 110.0)
	jet.set("_hold_ab", true)
	jet.set_physics_process(false) # drive integrate ourselves (headless input is flaky)

	var saw_vertical := false
	var saw_inverted := false
	var saw_recover := false
	var min_nose_y := 1.0
	var max_nose_y := -1.0
	var start_yaw: float = float(jet.get("yaw"))
	var dt := 1.0 / 60.0
	for i in 480:
		jet.set("_steer", Vector2(0, -1)) # climb held
		jet.set("_rolling", false)
		jet.call("_integrate", dt)
		var basis: Basis = jet.global_transform.basis.orthonormalized()
		var nose: Vector3 = -basis.z
		min_nose_y = minf(min_nose_y, nose.y)
		max_nose_y = maxf(max_nose_y, nose.y)
		if nose.y > 0.85:
			saw_vertical = true
		if nose.y < -0.45:
			saw_inverted = true
		if saw_inverted and nose.y > -0.15:
			saw_recover = true
			break
		await process_frame

	if not saw_vertical:
		push_error("[loop] never reached vertical up (max nose.y=%.3f)" % max_nose_y)
		quit(1)
		return
	if not saw_inverted:
		push_error("[loop] never went inverted (min nose.y=%.3f)" % min_nose_y)
		quit(1)
		return
	if not saw_recover:
		push_error("[loop] inverted but did not continue the loop")
		quit(1)
		return

	# Attitude should still be finite / orthonormal
	var b2: Basis = jet.global_transform.basis
	if not b2.x.is_finite() or not b2.y.is_finite() or not b2.z.is_finite():
		push_error("[loop] basis not finite")
		quit(1)
		return

	print("[loop] ok inverted+recover min_nose_y=%.3f yaw0=%.2f yaw1=%.2f" % [min_nose_y, start_yaw, float(jet.get("yaw"))])
	quit(0)
