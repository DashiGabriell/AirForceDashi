extends SceneTree
func _initialize():
	call_deferred("_run")
func _run():
	change_scene_to_file("res://scenes/main.tscn")
	await process_frame
	var game = root.get_node("Game")
	while game.generating:
		await process_frame
	var world = null
	for n in [root]:
		world = _find(root, "World")
	var bf = world.building_field
	var jet = _find(root, "Jet")
	if jet: jet.global_position = Vector3(500, 200, -400)
	for i in 40: await process_frame
	print("[bld] city=", bf.get("_city") != null, " suburb=", bf.get("_suburb") != null, " farm=", bf.get("_farm") != null, " snap=", bf.get("_last_snap"))
	if bf.get("_city") == null:
		push_error("missing city mm")
		quit(1)
		return
	print("[bld] ok")
	quit(0)
func _find(n, name):
	if n.name == name: return n
	for c in n.get_children():
		var f = _find(c, name)
		if f: return f
	return null
