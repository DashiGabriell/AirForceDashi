extends SceneTree
## Headless: 30 Anti-Drone defs + course boot smoke.


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[ad] boot")
	var Levels = load("res://scripts/missions/antidrone_levels.gd")
	for i in range(1, 31):
		var d: Dictionary = Levels.def(i)
		if int(d.total) < 1 or int(d.max_leaks) < 1:
			push_error("[ad] bad def level %d" % i)
			quit(1)
			return
		if (d.waves as Array).is_empty():
			push_error("[ad] empty waves lv %d" % i)
			quit(1)
			return
	print("[ad] defs ok 30")

	# Mesh build smoke
	var mesh_script: GDScript = load("res://scripts/missions/drone_mesh.gd")
	for k in [0, 1, 2]:
		var m: Node3D = mesh_script.new()
		root.add_child(m)
		m.call("setup", k)
		await process_frame
		m.queue_free()
	print("[ad] meshes ok")

	change_scene_to_file("res://scenes/main.tscn")
	await process_frame
	var game = root.get_node("Game")
	while game.generating:
		await process_frame

	game.set_play_mode(game.PlayMode.ANTI_DRONE)
	game.title_dismissed = true
	await process_frame

	var course = _find(root, "AntiDroneCourse")
	if course == null:
		push_error("[ad] course missing")
		quit(1)
		return
	course.call("start_level", 1, Vector3(0, 400, 0), 0.0)
	for i in 60:
		await process_frame
	if int(game.ad_total) < 1:
		push_error("[ad] course total missing")
		quit(1)
		return
	if int(game.ad_alive) < 1 and game.ad_status == "RUN":
		# first wave should have spawned
		push_error("[ad] no drones spawned")
		quit(1)
		return
	print("[ad] course ok total=", game.ad_total, " alive=", game.ad_alive, " leaks_max=", game.ad_max_leaks)
	print("[ad] ok")
	quit(0)


func _find(n: Node, name: String) -> Node:
	if n.name == name:
		return n
	for c in n.get_children():
		var f := _find(c, name)
		if f:
			return f
	return null
