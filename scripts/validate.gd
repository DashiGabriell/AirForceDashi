extends SceneTree
## Headless validation: boot main scene, wait for world gen, advance frames, quit.
## godot --headless --path . -s res://scripts/validate.gd


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[validate] boot")
	var err := change_scene_to_file("res://scenes/main.tscn")
	if err != OK:
		push_error("[validate] failed to load main: %s" % err)
		quit(1)
		return
	await process_frame
	var game := root.get_node_or_null("Game")
	var frames := 0
	while game and bool(game.get("generating")) and frames < 1200:
		await process_frame
		frames += 1
		if frames % 60 == 0:
			print("[validate] frame %d gen=%.2f" % [frames, float(game.get("gen_progress"))])
	if game and bool(game.get("generating")):
		push_error("[validate] generation timeout")
		quit(1)
		return
	# Extra settle frames for sliding terrain / MultiMesh refresh.
	for i in 60:
		await process_frame
	if game:
		print("[validate] done — generation progress %.0f%% generating=%s" % [
			float(game.get("gen_progress")) * 100.0, str(game.get("generating"))
		])
	else:
		print("[validate] done — Game autoload missing")
	quit(0)
