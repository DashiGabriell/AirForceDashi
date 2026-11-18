extends Node3D
## Active CheckPoint course: rings, pass detection, timer, complete/fail.


signal passed_ring(index: int, total: int)
signal course_won(level: int, time_left: float)
signal course_failed(level: int, reason: String)
signal course_reset(level: int)

var active: bool = false
var level: int = 1
var _rings: Array[Dictionary] = [] ## {pos, normal, radius, node, done}
var _index: int = 0
var _time_left: float = 0.0
var _time_limit: float = 0.0
var _origin: Vector3 = Vector3.ZERO
var _heading: float = 0.0
var _finished: bool = false


func clear() -> void:
	active = false
	_finished = false
	_rings.clear()
	_index = 0
	for c in get_children():
		c.queue_free()


func start_level(lv: int, origin: Vector3, heading: float) -> void:
	clear()
	level = clampi(lv, 1, CheckpointLevels.LEVEL_COUNT)
	_origin = origin
	_heading = heading
	var d: Dictionary = CheckpointLevels.def(level)
	_time_limit = float(d.time_limit)
	_time_left = _time_limit
	var pts: Array = CheckpointLevels.build_points(level, origin, heading, Game.height_sampler)
	for i in pts.size():
		var p: Dictionary = pts[i]
		var node := _make_ring(float(p.radius), i == 0)
		add_child(node)
		node.global_position = p.pos
		_orient_ring(node, p.normal)
		_rings.append({
			"pos": p.pos,
			"normal": p.normal,
			"radius": p.radius,
			"node": node,
			"done": false,
		})
	_index = 0
	_finished = false
	active = true
	Game.cp_active = true
	Game.cp_level = level
	Game.cp_ring_index = 0
	Game.cp_ring_total = _rings.size()
	Game.cp_time_left = _time_left
	Game.cp_time_limit = _time_limit
	Game.cp_status = "RUN"
	if _rings.size() > 0:
		Game.cp_next_pos = _rings[0].pos
	course_reset.emit(level)
	set_process(true)


func restart() -> void:
	if level < 1:
		return
	start_level(level, _origin, _heading)


func _process(dt: float) -> void:
	if not active or _finished or Game.paused or Game.generating:
		return
	_time_left = maxf(_time_left - dt, 0.0)
	Game.cp_time_left = _time_left
	if _time_left <= 0.0:
		_fail("TIME")
		return
	_check_pass()
	_pulse_active_ring(dt)


func _check_pass() -> void:
	if _index >= _rings.size():
		return
	var jet: Node3D = Game.jet
	if jet == null:
		return
	var r: Dictionary = _rings[_index]
	var pos: Vector3 = r.pos
	var n: Vector3 = r.normal
	var rad: float = float(r.radius)
	var to_jet: Vector3 = jet.global_position - pos
	# Plane distance along ring normal (thin slab)
	var plane_d: float = absf(to_jet.dot(n))
	if plane_d > 18.0:
		return
	var radial: Vector3 = to_jet - n * to_jet.dot(n)
	if radial.length() > rad * 0.92:
		return
	# Mark passed
	r.done = true
	_rings[_index] = r
	_set_ring_done(r.node)
	passed_ring.emit(_index + 1, _rings.size())
	_index += 1
	Game.cp_ring_index = _index
	if _index >= _rings.size():
		_win()
	else:
		Game.cp_next_pos = _rings[_index].pos
		_set_ring_active(_rings[_index].node, true)
		# Dim upcoming
		for i in range(_index + 1, _rings.size()):
			_set_ring_active(_rings[i].node, false)


func _win() -> void:
	_finished = true
	active = false
	Game.cp_status = "WIN"
	Game.cp_active = false
	Game.unlock_checkpoint_level(level + 1)
	course_won.emit(level, _time_left)


func _fail(reason: String) -> void:
	_finished = true
	active = false
	Game.cp_status = "FAIL"
	Game.cp_active = false
	course_failed.emit(level, reason)


func _pulse_active_ring(_dt: float) -> void:
	if _index >= _rings.size():
		return
	var node: Node3D = _rings[_index].node
	if node == null:
		return
	var s: float = 1.0 + 0.04 * sin(Time.get_ticks_msec() * 0.008)
	node.scale = Vector3.ONE * s


func _orient_ring(node: Node3D, normal: Vector3) -> void:
	var n := normal.normalized()
	if absf(n.dot(Vector3.UP)) > 0.95:
		n = Vector3(0, 0, -1)
	node.look_at(node.global_position + n, Vector3.UP)


func _make_ring(radius: float, active_first: bool) -> Node3D:
	var root := Node3D.new()
	root.name = "Ring"
	# Torus gate
	var mi := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = radius * 0.88
	torus.outer_radius = radius
	torus.rings = 16
	torus.ring_segments = 28
	mi.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(0.95, 0.95, 0.97, 0.95) if active_first else Color(0.55, 0.55, 0.58, 0.55)
	mat.emission_enabled = true
	mat.emission = Color(0.82, 0.12, 0.14) if active_first else Color(0.35, 0.35, 0.38)
	mat.emission_energy_multiplier = 2.2 if active_first else 0.6
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mi)
	# Center marker diamond
	var core := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(3.5, 3.5, 3.5)
	core.mesh = box
	var cm := StandardMaterial3D.new()
	cm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	cm.albedo_color = Color(0.82, 0.12, 0.14, 0.85) if active_first else Color(0.4, 0.4, 0.42, 0.35)
	cm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	core.material_override = cm
	core.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(core)
	root.set_meta("mat", mat)
	root.set_meta("core_mat", cm)
	return root


func _set_ring_active(node: Node3D, on: bool) -> void:
	if node == null:
		return
	var mat: StandardMaterial3D = node.get_meta("mat")
	var cm: StandardMaterial3D = node.get_meta("core_mat")
	if on:
		mat.albedo_color = Color(0.96, 0.96, 0.97, 0.95)
		mat.emission = Color(0.82, 0.12, 0.14)
		mat.emission_energy_multiplier = 2.4
		cm.albedo_color = Color(0.82, 0.12, 0.14, 0.9)
	else:
		mat.albedo_color = Color(0.55, 0.55, 0.58, 0.45)
		mat.emission = Color(0.3, 0.3, 0.32)
		mat.emission_energy_multiplier = 0.5
		cm.albedo_color = Color(0.4, 0.4, 0.42, 0.3)


func _set_ring_done(node: Node3D) -> void:
	if node == null:
		return
	var mat: StandardMaterial3D = node.get_meta("mat")
	var cm: StandardMaterial3D = node.get_meta("core_mat")
	mat.albedo_color = Color(0.82, 0.12, 0.14, 0.35)
	mat.emission = Color(0.5, 0.08, 0.1)
	mat.emission_energy_multiplier = 0.8
	cm.albedo_color = Color(0.82, 0.12, 0.14, 0.2)
	node.scale = Vector3.ONE * 0.92
