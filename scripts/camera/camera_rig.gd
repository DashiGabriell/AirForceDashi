extends Node3D
## Four views: top / cinematic chase / cockpit / free cam (screenshot wander).

@onready var cam: Camera3D = $Camera3D

var blend: float = 0.0
var from_mode: int = Game.Cam.TOP
var to_mode: int = Game.Cam.TOP
var blending: bool = false
const BLEND_TIME := 1.0

var _shake: Vector3 = Vector3.ZERO
var _fov_punch: float = 0.0
var _chase_pivot: Vector3 = Vector3.ZERO
var _look_ahead: Vector3 = Vector3.ZERO
var _ab_was: bool = false

# Free cam
var _free_pos: Vector3 = Vector3.ZERO
var _free_yaw: float = 0.0
var _free_pitch: float = -0.25
var _free_ready: bool = false
var _free_boost: float = 1.0


func _ready() -> void:
	Game.camera_changed.connect(_on_cam)
	cam.current = true
	cam.fov = 55.0
	cam.near = 0.2
	cam.far = 36000.0
	set_process_input(true)


func _on_cam(mode: int) -> void:
	from_mode = to_mode
	to_mode = mode
	blend = 0.0
	blending = true
	if mode == Game.Cam.FREE:
		_enter_free()
	elif from_mode == Game.Cam.FREE:
		_exit_free()


func _enter_free() -> void:
	var jet: Node3D = Game.jet
	if jet:
		_free_pos = jet.global_position + Vector3(18, 12, 28)
		_free_yaw = atan2(-jet.global_transform.basis.z.x, -jet.global_transform.basis.z.z)
		_free_pitch = -0.2
	_free_ready = true
	if not Game.paused and Game.title_dismissed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _exit_free() -> void:
	_free_ready = false
	if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _input(event: InputEvent) -> void:
	if to_mode != Game.Cam.FREE or not _free_ready:
		return
	if Game.paused or Game.generating or not Game.title_dismissed:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var mm := event as InputEventMouseMotion
		_free_yaw -= mm.relative.x * 0.0025 * Game.mouse_sens
		_free_pitch -= mm.relative.y * 0.0022 * Game.mouse_sens
		_free_pitch = clampf(_free_pitch, -1.35, 1.35)
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed and mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			Game.free_cam_speed = minf(Game.free_cam_speed * 1.15, 900.0)
		elif mb.pressed and mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			Game.free_cam_speed = maxf(Game.free_cam_speed / 1.15, 20.0)


func _process(dt: float) -> void:
	var jet: Node3D = Game.jet
	if jet == null:
		return

	if to_mode == Game.Cam.FREE and _free_ready and not Game.paused:
		_update_free(dt)
		global_transform = _free_pose()
		cam.fov = 58.0 + _fov_punch
		return

	if blending:
		blend = minf(blend + dt / BLEND_TIME, 1.0)
		if blend >= 1.0:
			blending = false
			from_mode = to_mode

	_update_feel(dt, jet)

	var a := _pose(from_mode, jet)
	var b := _pose(to_mode, jet)
	var t: float = _smooth(blend if blending else 1.0)
	global_transform = a.interpolate_with(b, t)

	var base_fov: float = lerpf(_fov(from_mode), _fov(to_mode), t)
	cam.fov = base_fov + _fov_punch


func _update_free(dt: float) -> void:
	var wish := Vector3.ZERO
	if Input.is_action_pressed("climb"):
		wish.z -= 1.0
	if Input.is_action_pressed("dive"):
		wish.z += 1.0
	if Input.is_action_pressed("bank_left"):
		wish.x -= 1.0
	if Input.is_action_pressed("bank_right"):
		wish.x += 1.0
	# Q / E vertical (physical keys — no action map required)
	if Input.is_physical_key_pressed(KEY_E) or Input.is_physical_key_pressed(KEY_PAGEUP):
		wish.y += 1.0
	if Input.is_physical_key_pressed(KEY_Q) or Input.is_physical_key_pressed(KEY_PAGEDOWN):
		wish.y -= 1.0
	_free_boost = 2.6 if Input.is_physical_key_pressed(KEY_SHIFT) else 1.0

	var basis := Basis.from_euler(Vector3(_free_pitch, _free_yaw, 0.0))
	var move := Vector3.ZERO
	if wish.length_squared() > 0.001:
		wish = wish.normalized()
		move += -basis.z * wish.z
		move += basis.x * wish.x
		move.y += wish.y
	_free_pos += move * Game.free_cam_speed * _free_boost * dt
	_free_pos.y = clampf(_free_pos.y, 8.0, Game.MAX_ALT)


func _free_pose() -> Transform3D:
	var basis := Basis.from_euler(Vector3(_free_pitch, _free_yaw, 0.0))
	return Transform3D(basis, _free_pos)


func _update_feel(dt: float, _jet: Node3D) -> void:
	var ab: bool = Game.afterburner
	if ab and not _ab_was:
		_fov_punch = maxf(_fov_punch, 7.0)
	_ab_was = ab
	var ab_hold: float = 4.5 if ab else 0.0
	var speed_fov: float = clampf((Game.airspeed - 140.0) * 0.02, 0.0, 4.0)
	var target_punch: float = ab_hold + speed_fov
	_fov_punch = lerpf(_fov_punch, target_punch, 1.0 - exp(-3.5 * dt))

	var g_ex: float = absf(Game.g_force - 1.0)
	var wind: float = clampf(Game.airspeed / 220.0, 0.0, 1.2)
	var buffet: float = wind * wind * (0.35 + absf(Game.slip) * 0.8 + absf(Game.pitch_deg) * 0.01)
	if Game.afterburner:
		buffet += 0.55
	var shake_amp: float = g_ex * 0.35 + buffet * 0.25
	if to_mode == Game.Cam.TOP and (not blending or blend > 0.6):
		shake_amp *= 0.15
	if to_mode == Game.Cam.COCKPIT:
		shake_amp *= 0.45
	if to_mode == Game.Cam.FREE:
		shake_amp = 0.0
	var noise := Vector3(
		sin(Time.get_ticks_msec() * 0.041) * 0.6 + sin(Time.get_ticks_msec() * 0.017) * 0.4,
		sin(Time.get_ticks_msec() * 0.033 + 1.7) * 0.5,
		sin(Time.get_ticks_msec() * 0.029 + 0.9) * 0.55
	)
	var target_shake: Vector3 = noise * shake_amp
	if g_ex > 2.2:
		target_shake += Vector3(randf_range(-1, 1), randf_range(-0.6, 0.6), 0.0) * (g_ex - 2.0) * 0.15
	_shake = _shake.lerp(target_shake, 1.0 - exp(-14.0 * dt))


func _smooth(t: float) -> float:
	return t * t * (3.0 - 2.0 * t)


func _fov(mode: int) -> float:
	match mode:
		Game.Cam.TOP:
			return 48.0
		Game.Cam.CHASE:
			return 58.0
		Game.Cam.FREE:
			return 58.0
		Game.Cam.COCKPIT:
			return 62.0
		_:
			return 62.0


func _pose(mode: int, jet: Node3D) -> Transform3D:
	match mode:
		Game.Cam.TOP:
			var top_h: float = clampf(jet.global_position.y * 0.35 + 280.0, 280.0, 2500.0)
			var p := jet.global_position + Vector3(0, top_h, 0) + _shake * 8.0
			return Transform3D(Basis.from_euler(Vector3(-PI * 0.5, 0, 0)), p)
		Game.Cam.CHASE:
			return _chase_pose(jet)
		Game.Cam.FREE:
			return _free_pose() if _free_ready else _chase_pose(jet)
		_:
			return _cockpit_pose(jet)


func _cockpit_pose(jet: Node3D) -> Transform3D:
	## Seat-ish: slightly aft of canopy, raised — less nose fill, clear glass.
	var basis: Basis = jet.global_transform.basis
	var local := Vector3(0.0, 0.78, 0.15) # +Z aft of nose (-Z)
	var p: Vector3 = jet.global_position + basis * local
	p += basis * (_shake * 0.22)
	p += basis.y * clampf(1.0 - Game.g_force, -0.25, 0.4) * 0.12
	# Look slightly above the nose line so coaming / HUD brow reads cleanly.
	var look: Vector3 = jet.global_position + basis * Vector3(0.0, 0.55, -12.0)
	var xf := Transform3D()
	xf.origin = p
	xf = xf.looking_at(look, basis.y.normalized())
	return xf


func _chase_pose(jet: Node3D) -> Transform3D:
	var basis: Basis = jet.global_transform.basis
	var ab_pull: float = 6.0 if Game.afterburner else 0.0
	var g_pull: float = clampf(Game.g_force - 1.0, 0.0, 3.0) * 1.8
	var back: Vector3 = basis.z * (20.0 + ab_pull + g_pull) + basis.y * (5.5 + g_pull * 0.35)
	back += basis.x * (-Game.roll_deg * 0.04 + Game.turn_rate * 2.5)
	var desired_pivot: Vector3 = jet.global_position + back
	var dt: float = maxf(get_process_delta_time(), 0.0001)
	_chase_pivot = _chase_pivot.lerp(desired_pivot, 1.0 - exp(-5.5 * dt))

	var ahead: Vector3 = -basis.z * (14.0 + (8.0 if Game.afterburner else 0.0)) + basis.y * 1.2
	var desired_look: Vector3 = jet.global_position + ahead
	_look_ahead = _look_ahead.lerp(desired_look, 1.0 - exp(-6.0 * dt))

	var cam_pos: Vector3 = _chase_pivot + _shake * 0.85
	cam_pos += basis.y * clampf(Game.g_force - 1.0, -1.0, 3.0) * -0.25

	var xf := Transform3D()
	xf.origin = cam_pos
	xf = xf.looking_at(_look_ahead, basis.y.lerp(Vector3.UP, 0.35).normalized())
	return xf


func is_cockpit() -> bool:
	return to_mode == Game.Cam.COCKPIT and (not blending or blend > 0.5)


func is_free() -> bool:
	return to_mode == Game.Cam.FREE and (not blending or blend > 0.5)
