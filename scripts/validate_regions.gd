extends SceneTree
func _initialize() -> void:
	call_deferred("_run")
func _run() -> void:
	change_scene_to_file("res://scenes/main.tscn")
	await process_frame
	var game = root.get_node("Game")
	while game.generating:
		await process_frame
	var world = root.get_node_or_null("Main/PixelLayer/SubViewportContainer/GameViewport/World")
	if world == null:
		# find World
		world = _find(root, "World")
	var gen = world.terrain_gen
	var counts = {}
	for r in gen.regions:
		counts[r] = int(counts.get(r, 0)) + 1
	print("[regions] ", counts)
	print("[regions] CITY=", counts.get(2,0), " SUBURB=", counts.get(3,0), " FARM=", counts.get(4,0), " FOREST=", counts.get(5,0), " WATER=", counts.get(0,0), " RIVER=", counts.get(1,0))
	quit(0)
func _find(n, name):
	if n.name == name: return n
	for c in n.get_children():
		var f = _find(c, name)
		if f: return f
	return null
