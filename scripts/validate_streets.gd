extends SceneTree
func _initialize():
	call_deferred("_run")
func _run():
	change_scene_to_file("res://scenes/main.tscn")
	await process_frame
	var game = root.get_node("Game")
	while game.generating:
		await process_frame
	var world = _find(root, "World")
	if world.get("street_field") == null:
		push_error("street_field missing")
		quit(1)
		return
	var jet = _find(root, "Jet")
	if jet:
		jet.global_position = Vector3(600, 120, -300)
	for i in 45:
		await process_frame
	var sf = world.street_field
	print("[street] snap=", sf.get("_last_snap"), " asphalt=", sf.get("_asphalt") != null, " mark=", sf.get("_mark") != null, " lamp=", sf.get("_lamp") != null)
	print("[street] ok")
	quit(0)
func _find(n, name):
	if n.name == name: return n
	for c in n.get_children():
		var f = _find(c, name)
		if f: return f
	return null
