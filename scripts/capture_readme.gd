extends SceneTree
## Boot once and dump README screenshots from the game SubViewport.


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[shot] boot")
	DirAccess.make_dir_recursive_absolute("res://docs/images")
	change_scene_to_file("res://scenes/main.tscn")
	await process_frame
	var game = root.get_node("Game")
	while game.generating:
		await process_frame

	# Free-flight look: dismiss title state for a clean world shot
	game.set_play_mode(game.PlayMode.FREE_FLIGHT)
	game.title_dismissed = true
	var title = _find(root, "TitleCard")
	if title:
		title.visible = false
	# Prefer chase cam for a cinematic frame
	game.camera_mode = game.Cam.CHASE
	game.camera_changed.emit(game.camera_mode)

	var jet = _find(root, "Jet")
	if jet and jet.has_method("reset_pose"):
		jet.reset_pose(Vector3(0, 420, 0), 0.35)

	for i in 90:
		await process_frame

	_save_viewport("docs/images/screenshot-voo-livre.png")

	# Checkpoint rings shot
	var course = _find(root, "CheckpointCourse")
	if course and jet and jet.has_method("reset_pose"):
		var origin := Vector3(0, 320, 0)
		jet.reset_pose(origin, 0.0)
		game.set_play_mode(game.PlayMode.CHECKPOINT)
		course.call("start_level", 5, origin, 0.0)
		for i in 60:
			await process_frame
		_save_viewport("docs/images/screenshot-checkpoint.png")

	print("[shot] done")
	quit(0)


func _save_viewport(rel_path: String) -> void:
	var vp: SubViewport = _find(root, "GameViewport") as SubViewport
	if vp == null:
		push_error("[shot] GameViewport missing")
		return
	var tex: ViewportTexture = vp.get_texture()
	if tex == null:
		push_error("[shot] no texture")
		return
	var img: Image = tex.get_image()
	if img == null:
		push_error("[shot] no image")
		return
	# Upscale a bit for README clarity
	img.resize(img.get_width() * 2, img.get_height() * 2, Image.INTERPOLATE_NEAREST)
	var abs_path: String = ProjectSettings.globalize_path("res://" + rel_path)
	var err := img.save_png(abs_path)
	print("[shot] saved ", abs_path, " err=", err, " size=", img.get_width(), "x", img.get_height())


func _find(n: Node, name: String) -> Node:
	if n.name == name:
		return n
	for c in n.get_children():
		var f := _find(c, name)
		if f:
			return f
	return null
