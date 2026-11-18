extends SceneTree
func _initialize() -> void:
	call_deferred("_run")
func _run() -> void:
	print("[bigworld] boot")
	var err := change_scene_to_file("res://scenes/main.tscn")
	if err != OK:
		push_error("fail load")
		quit(1)
		return
	await process_frame
	var game = root.get_node("Game")
	var frames := 0
	while game.generating and frames < 1200:
		await process_frame
		frames += 1
		if frames % 120 == 0:
			print("[bigworld] frame ", frames, " gen=", game.gen_progress)
	if game.generating:
		push_error("[bigworld] generation timeout")
		quit(1)
		return
	print("[bigworld] WORLD_SIZE=", game.WORLD_SIZE, " TERRAIN_VIEW=", game.TERRAIN_VIEW)
	var world = _find(root, "World")
	if world == null:
		push_error("no World")
		quit(1)
		return
	var gen = world.terrain_gen
	var counts = {}
	for r in gen.regions:
		counts[r] = int(counts.get(r, 0)) + 1
	print("[bigworld] CITY=", counts.get(2,0), " SUBURB=", counts.get(3,0), " FARM=", counts.get(4,0), " FOREST=", counts.get(5,0))
	# Move jet and tick so buildings refresh
	var jet = root.get_node_or_null("Main/PixelLayer/SubViewportContainer/GameViewport/Jet")
	if jet == null:
		jet = _find(root, "Jet")
	if jet:
		jet.global_position = Vector3(0, 200, 0)
	for i in 30:
		await process_frame
	var bf = world.building_field
	if bf == null or bf._mm == null:
		push_error("buildings missing")
		quit(1)
		return
	print("[bigworld] buildings ok last_snap=", bf._last_snap)
	print("[bigworld] ok")
	quit(0)
func _find(n, name):
	if n.name == name: return n
	for c in n.get_children():
		var f = _find(c, name)
		if f: return f
	return null
