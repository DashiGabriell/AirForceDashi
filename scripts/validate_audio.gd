extends SceneTree
## Headless audio smoke test.
## godot --headless --path . -s res://scripts/validate_audio.gd


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[audio] boot")
	var err := change_scene_to_file("res://scenes/main.tscn")
	if err != OK:
		push_error("[audio] failed to load main: %s" % err)
		quit(1)
		return
	await process_frame
	await process_frame

	var game := root.get_node_or_null("Game")
	var audio := root.get_node_or_null("PatrolAudio")
	if game == null or audio == null:
		push_error("[audio] Game/PatrolAudio autoload missing")
		quit(1)
		return

	var missing: PackedStringArray = []
	for path in [
		"res://assets/audio/engine_loop.wav",
		"res://assets/audio/afterburner_loop.wav",
		"res://assets/audio/missile.wav",
		"res://assets/audio/boom.wav",
		"res://assets/audio/boom_water.wav",
		"res://assets/audio/roll.wav",
		"res://assets/audio/ambient_city.wav",
		"res://assets/audio/ambient_wind.wav",
		"res://assets/audio/ambient_forest.wav",
		"res://assets/audio/ambient_water.wav",
	]:
		if load(path) == null:
			missing.append(path)
	if not missing.is_empty():
		push_error("[audio] missing samples: %s" % ", ".join(missing))
		quit(1)
		return

	game.toggle_sound()
	for i in 20:
		await process_frame

	if not audio._engine.playing:
		push_error("[audio] engine not playing after sound on")
		quit(1)
		return
	if audio._stream_engine == null or audio._stream_ab == null:
		push_error("[audio] loop streams failed to load")
		quit(1)
		return

	game.afterburner = true
	for i in 20:
		await process_frame
	if not audio._ab.playing:
		push_error("[audio] afterburner not playing")
		quit(1)
		return

	audio.play_missile()
	audio.play_boom(false)
	audio.play_boom(true)
	audio.play_roll()
	for i in 10:
		await process_frame

	game.afterburner = false
	game.toggle_sound()
	for i in 10:
		await process_frame
	if audio._engine.playing or audio._ab.playing:
		push_error("[audio] players still active after sound off")
		quit(1)
		return

	print("[audio] ok - samples load, engine/AB/SFX paths work")
	quit(0)
