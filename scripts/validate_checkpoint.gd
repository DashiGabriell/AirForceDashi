extends SceneTree
## Headless: 30 level defs + course boot smoke.


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[cp] boot")
	var Levels = load("res://scripts/missions/checkpoint_levels.gd")
	for i in range(1, 31):
		var d: Dictionary = Levels.def(i)
		if int(d.rings) < 3 or float(d.radius) < 10.0:
			push_error("[cp] bad def level %d" % i)
			quit(1)
			return
		var pts: Array = Levels.build_points(i, Vector3(0, 300, 0), 0.0)
		if pts.size() != int(d.rings):
			push_error("[cp] ring count mismatch lv %d" % i)
			quit(1)
			return
	print("[cp] defs ok 30")

	change_scene_to_file("res://scenes/main.tscn")
	await process_frame
	var game = root.get_node("Game")
	while game.generating:
		await process_frame

	game.set_play_mode(game.PlayMode.FREE_FLIGHT)
	game.title_dismissed = true
	await process_frame

	var course = _find(root, "CheckpointCourse")
	if course == null:
		push_error("[cp] course missing")
		quit(1)
		return
	course.call("start_level", 1, Vector3(0, 300, 0), 0.0)
	for i in 45:
		await process_frame
	if int(game.cp_ring_total) < 3:
		push_error("[cp] course rings missing")
		quit(1)
		return
	print("[cp] course ok rings=", game.cp_ring_total, " time=", snappedf(game.cp_time_left, 0.1))
	print("[cp] ok")
	quit(0)


func _find(n: Node, name: String) -> Node:
	if n.name == name:
		return n
	for c in n.get_children():
		var f := _find(c, name)
		if f:
			return f
	return null
