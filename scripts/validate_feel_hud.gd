extends SceneTree
## Headless smoke: flight feel telemetry + biome POIs + HUD state.
## godot --headless --path . -s res://scripts/validate_feel_hud.gd


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[feel] boot")
	var err := change_scene_to_file("res://scenes/main.tscn")
	if err != OK:
		push_error("[feel] failed to load main: %s" % err)
		quit(1)
		return

	var game := root.get_node_or_null("Game")
	var audio := root.get_node_or_null("PatrolAudio")
	if game == null or audio == null:
		push_error("[feel] Game/PatrolAudio missing")
		quit(1)
		return

	# Wait for world generation
	var frames := 0
	while bool(game.get("generating")) and frames < 900:
		await process_frame
		frames += 1
	if bool(game.get("generating")):
		push_error("[feel] generation timeout")
		quit(1)
		return

	game.set("title_dismissed", true)
	game.set("player_engaged", true)
	game.toggle_sound()

	var jet: Node = game.get("jet")
	if jet and jet.has_method("set_afterburner_hold"):
		jet.call("set_afterburner_hold", true)

	# Attitude-linked engine
	game.set("throttle", 0.9)
	game.set("pitch_deg", 18.0)
	game.set("g_force", 3.2)
	game.set("airspeed", 190.0)
	game.set("over_region", 2) # CITY
	for i in 30:
		await process_frame
	if not audio._ab.playing:
		push_error("[feel] afterburner not playing")
		quit(1)
		return
	if audio._engine.pitch_scale < 0.95:
		push_error("[feel] engine pitch not attitude-linked (%s)" % audio._engine.pitch_scale)
		quit(1)
		return

	# Biome ambient should be audible-ish over city
	if audio._amb_city == null or audio._amb_city.stream == null:
		push_error("[feel] ambient city missing")
		quit(1)
		return
	if not audio._amb_city.playing:
		push_error("[feel] ambient city not playing")
		quit(1)
		return

	# POI / airport state after a few follow updates
	for i in 60:
		await process_frame
	var place: String = str(game.get("place_name"))
	var ap: String = str(game.get("nearest_airport_name"))
	var pois: Array = game.get("compass_pois")
	print("[feel] place=", place, " airport=", ap, " pois=", pois.size())
	if ap == "":
		push_error("[feel] nearest airport empty")
		quit(1)
		return
	if float(game.get("nearest_airport_dist")) <= 0.0:
		push_error("[feel] airport dist invalid")
		quit(1)
		return

	if jet and jet.has_method("set_afterburner_hold"):
		jet.call("set_afterburner_hold", false)
	game.toggle_sound()
	print("[feel] ok")
	quit(0)
