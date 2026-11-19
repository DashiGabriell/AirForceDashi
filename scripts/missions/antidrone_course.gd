extends Node3D
## Anti-Drone mission: spawn waves, lock-on tracking, win / leak fail.


signal drone_killed(kind: int, kills: int, total: int)
signal drone_leaked(leaks: int, max_leaks: int)
signal course_won(level: int)
signal course_failed(level: int, reason: String)
signal course_reset(level: int)

const LOCK_HOLD := 3.0
const LOCK_RADIUS_PX := 78.0

var active: bool = false
var level: int = 1
var _finished: bool = false
var _origin: Vector3 = Vector3.ZERO
var _heading: float = 0.0
var _waves: Array = []
var _wave_i: int = 0
var _wave_t: float = 0.0
var _wave_gap: float = 3.5
var _pending: int = 0
var _spawned: int = 0
var _drones: Array[DroneUnit] = []
var _lock_hold: float = 0.0
var _cam: Camera3D


func clear() -> void:
	active = false
	_finished = false
	_waves.clear()
	_drones.clear()
	_wave_i = 0
	_pending = 0
	_spawned = 0
	_lock_hold = 0.0
	Game.clear_antidrone_lock()
	for c in get_children():
		c.queue_free()


func _ready() -> void:
	add_to_group("antidrone_course")


func start_level(lv: int, origin: Vector3, heading: float) -> void:
	clear()
	level = clampi(lv, 1, AntiDroneLevels.LEVEL_COUNT)
	_origin = origin
	_heading = heading
	var d: Dictionary = AntiDroneLevels.def(level)
	_waves = d.waves.duplicate(true)
	_wave_gap = float(d.wave_gap)
	_wave_i = 0
	_wave_t = 0.6
	_pending = int(d.total)
	_spawned = 0
	_finished = false
	active = true
	Game.ad_active = true
	Game.ad_level = level
	Game.ad_kills = 0
	Game.ad_total = int(d.total)
	Game.ad_alive = 0
	Game.ad_leaks = 0
	Game.ad_max_leaks = int(d.max_leaks)
	Game.ad_status = "RUN"
	Game.clear_antidrone_lock()
	course_reset.emit(level)
	set_process(true)
	# Immediate first wave kick
	_spawn_wave()


func restart() -> void:
	if level < 1:
		return
	start_level(level, _origin, _heading)


func get_alive_drones() -> Array[DroneUnit]:
	var out: Array[DroneUnit] = []
	for d in _drones:
		if is_instance_valid(d) and d.alive:
			out.append(d)
	return out


func notify_missile_segment(from: Vector3, to: Vector3) -> void:
	if not active or _finished:
		return
	for d in get_alive_drones():
		if d.try_hit_segment(from, to, 1.15):
			break


func notify_missile_blast(pos: Vector3, radius: float = 14.0) -> void:
	if not active or _finished:
		return
	for d in get_alive_drones():
		d.try_proximity(pos, radius, 1.25)


func _process(dt: float) -> void:
	if not active or _finished or Game.paused or Game.generating:
		return
	_prune_drones()
	_update_lock(dt)
	_update_threat()
	if _wave_i < _waves.size():
		_wave_t -= dt
		if _wave_t <= 0.0:
			_spawn_wave()
	_check_win()


func _spawn_wave() -> void:
	if _wave_i >= _waves.size():
		return
	var w: Dictionary = _waves[_wave_i]
	_wave_i += 1
	_wave_t = _wave_gap
	var kind: int = int(w.kind)
	var count: int = int(w.count)
	var spd: float = float(w.speed)
	var dive: float = float(w.dive)
	var fwd := Vector3(-sin(_heading), 0.0, -cos(_heading))
	var right := Vector3(cos(_heading), 0.0, -sin(_heading))
	# Jet at _origin looks along fwd. Drones spawn ahead and fly farther ahead
	# so the player starts behind them (chase), not head-on.
	var d: Dictionary = AntiDroneLevels.def(level)
	var spawn_near: float = float(d.spawn_near)
	var impact_dist: float = float(d.impact_dist)
	var impact := _origin + fwd * impact_dist
	if Game.height_sampler.is_valid():
		impact.y = float(Game.height_sampler.call(impact.x, impact.z))
	else:
		impact.y = Game.WATER_LEVEL
	for i in count:
		var ang: float = randf_range(-0.7, 0.7) + float(i) * 0.14
		var dist: float = spawn_near + randf_range(-40.0, 90.0) + float(i) * 28.0
		var side: float = randf_range(-220.0, 220.0) + sin(ang) * 70.0
		var pos: Vector3 = _origin + fwd * dist + right * side
		var alt: float = lerpf(240.0, 460.0, float(i % 5) / 4.0)
		match kind:
			1: # Orlan
				alt += 120.0
			2: # Lancet
				alt += 40.0
			_:
				alt += 20.0
		if Game.height_sampler.is_valid():
			alt = maxf(alt, float(Game.height_sampler.call(pos.x, pos.z)) + 140.0)
		pos.y = alt
		var tgt: Vector3 = impact + right * randf_range(-80.0, 80.0) + fwd * randf_range(-40.0, 120.0)
		if Game.height_sampler.is_valid():
			tgt.y = float(Game.height_sampler.call(tgt.x, tgt.z))
		else:
			tgt.y = Game.WATER_LEVEL
		var drone := DroneUnit.new()
		add_child(drone)
		drone.setup(kind, pos, tgt, spd, dive)
		drone.destroyed.connect(_on_destroyed)
		drone.leaked.connect(_on_leaked)
		_drones.append(drone)
		_spawned += 1
	Game.ad_alive = get_alive_drones().size()


func _on_destroyed(drone: DroneUnit, kind: int, pos: Vector3) -> void:
	if _finished:
		return
	Game.ad_kills += 1
	Game.ad_alive = maxi(0, get_alive_drones().size())
	if Game.ad_lock_target == drone:
		Game.clear_antidrone_lock()
		_lock_hold = 0.0
	DroneExplosion.spawn(self, pos, kind)
	drone_killed.emit(kind, Game.ad_kills, Game.ad_total)
	_check_win()


func _on_leaked(drone: DroneUnit, kind: int, pos: Vector3) -> void:
	if _finished:
		return
	Game.ad_leaks += 1
	Game.ad_alive = maxi(0, get_alive_drones().size())
	if Game.ad_lock_target == drone:
		Game.clear_antidrone_lock()
		_lock_hold = 0.0
	# Ground impact blast
	DroneExplosion.spawn(self, pos, kind)
	drone_leaked.emit(Game.ad_leaks, Game.ad_max_leaks)
	if Game.ad_leaks >= Game.ad_max_leaks:
		_fail("LEAK")
	else:
		_check_win()


func _check_win() -> void:
	if _finished or not active:
		return
	if _wave_i < _waves.size():
		return
	if get_alive_drones().size() > 0:
		return
	if Game.ad_kills + Game.ad_leaks < Game.ad_total and _spawned < Game.ad_total:
		return
	# All accounted for
	if Game.ad_leaks >= Game.ad_max_leaks:
		return
	_win()


func _win() -> void:
	_finished = true
	active = false
	Game.ad_status = "WIN"
	Game.ad_active = false
	Game.clear_antidrone_lock()
	Game.unlock_antidrone_level(level + 1)
	course_won.emit(level)


func _fail(reason: String) -> void:
	_finished = true
	active = false
	Game.ad_status = "FAIL"
	Game.ad_active = false
	Game.clear_antidrone_lock()
	course_failed.emit(level, reason)


func _prune_drones() -> void:
	var keep: Array[DroneUnit] = []
	for d in _drones:
		if is_instance_valid(d) and d.alive:
			keep.append(d)
	_drones = keep
	Game.ad_alive = keep.size()


func _update_threat() -> void:
	var best: DroneUnit = null
	var best_d: float = 1.0e12
	var jet: Node3D = Game.jet
	if jet == null:
		return
	for d in get_alive_drones():
		var dist: float = jet.global_position.distance_to(d.global_position)
		if dist < best_d:
			best_d = dist
			best = d
	if best:
		Game.ad_threat_pos = best.global_position


func _update_lock(dt: float) -> void:
	_cam = _find_camera()
	var jet: Node3D = Game.jet
	if _cam == null or jet == null:
		Game.clear_antidrone_lock()
		_lock_hold = 0.0
		return

	var center: Vector2 = _cam.get_viewport().get_visible_rect().size * 0.5
	# Nose boresight only (CCIP aim is ground-biased — wrong for UAVs)
	var aim: Vector2 = Game.bore_screen if Game.bore_screen.x >= 0.0 else center

	var best: DroneUnit = null
	var best_dist: float = LOCK_RADIUS_PX
	for d in get_alive_drones():
		if not _cam.is_position_behind(d.global_position):
			var sp: Vector2 = _cam.unproject_position(d.global_position)
			var dist: float = sp.distance_to(aim)
			if dist < best_dist:
				best_dist = dist
				best = d

	if best == null:
		_lock_hold = 0.0
		Game.ad_lock_progress = 0.0
		Game.ad_locked = false
		Game.ad_lock_target = null
		return

	# Same target continuity
	if Game.ad_lock_target != best:
		if not Game.ad_locked:
			_lock_hold = 0.0
		Game.ad_lock_target = best
		Game.ad_locked = false

	_lock_hold = minf(_lock_hold + dt, LOCK_HOLD)
	Game.ad_lock_progress = _lock_hold / LOCK_HOLD
	if _lock_hold >= LOCK_HOLD:
		Game.ad_locked = true
	else:
		Game.ad_locked = false


func _find_camera() -> Camera3D:
	var vp := get_viewport()
	if vp:
		var c := vp.get_camera_3d()
		if c:
			return c
	return null
