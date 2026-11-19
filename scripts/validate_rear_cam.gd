extends SceneTree
## Headless: REAR mode + look-back hold pose.


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[rear] boot")
	var err := change_scene_to_file("res://scenes/main.tscn")
	if err != OK:
		push_error("[rear] failed to load main")
		quit(1)
		return

	var game := root.get_node_or_null("Game")
	if game == null:
		push_error("[rear] Game missing")
		quit(1)
		return

	var frames := 0
	while bool(game.get("generating")) and frames < 900:
		await process_frame
		frames += 1
	if bool(game.get("generating")):
		push_error("[rear] generation timeout")
		quit(1)
		return

	game.set("title_dismissed", true)
	game.set("player_engaged", true)

	# Permanent REAR
	game.set("camera_mode", 2)
	game.camera_changed.emit(2)
	await process_frame
	await process_frame
	if int(game.call("view_camera")) != 2:
		push_error("[rear] view_camera not REAR")
		quit(1)
		return

	var rig: Node = null
	for n in root.get_children():
		var found: Node = n.find_child("CameraRig", true, false)
		if found != null:
			rig = found
			break
	if rig == null:
		var jet: Node = game.get("jet") as Node
		if jet != null:
			rig = jet.get_tree().root.find_child("CameraRig", true, false) as Node

	if rig and rig.has_method("is_rear"):
		if not bool(rig.call("is_rear")):
			push_error("[rear] camera_rig.is_rear false in REAR mode")
			quit(1)
			return

	# Hold look-back from CHASE
	game.set("camera_mode", 1)
	game.camera_changed.emit(1)
	game.call("set_look_back_hold", true)
	await process_frame
	if int(game.call("view_camera")) != 2:
		push_error("[rear] look_back_hold did not force REAR view")
		quit(1)
		return
	game.call("set_look_back_hold", false)
	await process_frame
	if int(game.call("view_camera")) != 1:
		push_error("[rear] look_back release did not restore CHASE")
		quit(1)
		return

	print("[rear] ok")
	quit(0)
