extends Node3D
## Arcade fighter: WASD primary flight, mouse as light trim.
## A/D bank+turn, W/S climb/dive. Auto pull-up, lazy S-turns until engaged.

signal fired_missile(origin: Vector3, direction: Vector3)

const BASE_SPEED := 95.0
const AB_MULT := 1.65
const TURN_RATE := 1.15
const PITCH_RATE := 0.95
const ROLL_RESP := 3.2
const ROLL_AMOUNT := 1.05
const STEER_SMOOTH := 8.0
const MOUSE_TRIM := 0.28
const AUTO_PULL := 2.4
const MIN_AGL := 18.0
const SKIM_AGL := 6.0

@onready var mesh: JetMesh = $JetMesh
@onready var missile_bay: Node3D = $MissileBay

var velocity: Vector3 = Vector3(0, 0, -BASE_SPEED)
var speed: float = BASE_SPEED
var yaw: float = 0.0
var pitch: float = 0.08
var roll: float = 0.0
var target_roll: float = 0.0
var afterburner: bool = false
var _s_turn_t: float = 0.0
var _prev_vel: Vector3 = Vector3.ZERO
var _roll_anim: float = 0.0
var _rolling: bool = false
var _missile_cds: Array[float] = [0.0, 0.0, 0.0, 0.0]
var _rail_idx: int = 0
var _mouse_steer := Vector2.ZERO
var _steer := Vector2.ZERO
var _hold_ab: bool = false
var _using_keys: bool = false


func _ready() -> void:
	Game.jet = self
	position = Vector3(0, Game.CRUISE_ALT, 0)
	_prev_vel = velocity
	# Rails visual placeholders
	for i in 4:
		var m := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(0.12, 0.12, 1.1)
		m.mesh = box
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.35, 0.38, 0.4)
		m.material_override = mat
		# Semi-conformal under-wing stations (nose = -Z)
		var side: float = -1.0 if i < 2 else 1.0
		var along: float = 0.35 if i % 2 == 0 else -0.55
		var span: float = 1.85 + float(i % 2) * 0.85
		m.position = Vector3(side * span, -0.42, along)
		missile_bay.add_child(m)


func _physics_process(dt: float) -> void:
	if Game.generating or Game.paused:
		return
	_update_input(dt)
	_integrate(dt)
	update_aim()
	_update_fx()
	_update_telemetry(dt)
	_tick_missiles(dt)


func _update_input(dt: float) -> void:
	afterburner = _hold_ab
	Game.afterburner = afterburner
	mesh.set_afterburner(afterburner)

	# WASD — primary: A/D bank, W/S altitude
	var key := Vector2(
		Input.get_axis("bank_left", "bank_right"),
		Input.get_axis("climb", "dive")
	)
	_using_keys = key.length() > 0.01
	var desired := Vector2.ZERO
	if _using_keys:
		Game.player_engaged = true
		desired = key
	elif Game.player_engaged:
		# Mouse / touch only as light trim when keys are idle
		desired = _mouse_steer * MOUSE_TRIM * Game.mouse_sens
	else:
		_s_turn_t += dt
		desired = Vector2(sin(_s_turn_t * 0.35) * 0.45, sin(_s_turn_t * 0.22) * 0.12)

	_steer = _steer.lerp(desired.clamp(Vector2(-1, -1), Vector2(1, 1)), 1.0 - exp(-STEER_SMOOTH * dt))

	if _rolling:
		_roll_anim += dt * 6.5
		if _roll_anim >= TAU:
			_roll_anim = 0.0
			_rolling = false
			roll = 0.0


func set_steer(offset: Vector2) -> void:
	## Mouse/touch trim in -1..1 (ignored while WASD is held)
	if _using_keys:
		return
	if offset.length() > 0.04:
		Game.player_engaged = true
	_mouse_steer = offset.clamp(Vector2(-1, -1), Vector2(1, 1))


func set_top_aim(world_dir: Vector3) -> void:
	## Top-down mouse aim — only when WASD idle
	if _using_keys:
		return
	if world_dir.length() > 0.1:
		Game.player_engaged = true
	var desired_yaw: float = atan2(-world_dir.x, -world_dir.z)
	var dy: float = wrapf(desired_yaw - yaw, -PI, PI)
	var sens: float = Game.mouse_sens
	_mouse_steer.x = clampf(dy / 0.9 * sens, -1.0, 1.0)
	_mouse_steer.y = clampf((Game.CRUISE_ALT - position.y) * 0.008 * sens, -0.35, 0.35)


func reset_pose(origin: Vector3, heading: float, start_speed: float = -1.0) -> void:
	## Snap jet for CheckPoint spawn / retry.
	position = origin
	yaw = heading
	pitch = 0.08
	roll = 0.0
	target_roll = 0.0
	_steer = Vector2.ZERO
	_mouse_steer = Vector2.ZERO
	_rolling = false
	_roll_anim = 0.0
	var basis_y := Basis.from_euler(Vector3(pitch, yaw, roll))
	transform.basis = basis_y
	if start_speed < 0.0:
		speed = BASE_SPEED
	else:
		speed = start_speed
	velocity = -basis_y.z * speed
	_prev_vel = velocity
	Game.player_engaged = true


func trigger_barrel_roll() -> void:
	if not _rolling:
		_rolling = true
		_roll_anim = 0.0
		PatrolAudio.play_roll()


func set_afterburner_hold(on: bool) -> void:
	_hold_ab = on


func try_fire() -> void:
	if Game.missiles_ready <= 0:
		return
	var ready_i := -1
	for i in 4:
		var idx: int = (_rail_idx + i) % 4
		if _missile_cds[idx] <= 0.0:
			ready_i = idx
			break
	if ready_i < 0:
		return
	_missile_cds[ready_i] = Game.MISSILE_REARM
	_rail_idx = (ready_i + 1) % 4
	Game.set_missiles(Game.missiles_ready - 1)
	var rail: Node3D = missile_bay.get_child(ready_i)
	var origin: Vector3 = rail.global_position
	# Fire toward current aim point (nose boresight impact)
	var dir: Vector3 = -global_transform.basis.z
	if Game.aim_valid:
		dir = (Game.aim_world - origin).normalized()
	fired_missile.emit(origin, dir)
	PatrolAudio.play_missile()
	Game.warn_missile = true
	get_tree().create_timer(0.4).timeout.connect(func(): Game.warn_missile = false)


func update_aim() -> void:
	## CCIP-style: ray along nose with light ballistic drop → impact
	var nose: Vector3 = -global_transform.basis.z
	var origin: Vector3 = global_position + nose * 4.0
	var vel_dir: Vector3 = velocity.normalized() if velocity.length() > 1.0 else nose

	# FPM / boresight reference points ahead (for HUD projection)
	Game.fpm_world = global_position + vel_dir * 600.0
	Game.bore_world = global_position + nose * 600.0

	var hit := origin + nose * Game.DLZ_RAERO
	var found := false
	var dist: float = 16.0
	var drop: float = 0.0
	var prev_p: Vector3 = origin
	while dist < Game.DLZ_RAERO + 400.0:
		drop += 0.012 * dist * 0.02  # mild missile drop for CCIP feel
		var p: Vector3 = origin + nose * dist + Vector3(0, -drop, 0)
		# Hit building faces along the aim ray
		if Game.building_segment_hit.is_valid():
			var bhit: Variant = Game.building_segment_hit.call(prev_p, p)
			if bhit != null:
				hit = bhit as Vector3
				found = true
				break
		var surface: float = maxf(_ground_h(p.x, p.z), Game.WATER_LEVEL)
		var roof: float = _building_roof(p.x, p.z)
		if roof > -1.0e8:
			surface = maxf(surface, roof)
		if p.y <= surface + 1.0:
			hit = Vector3(p.x, surface + 0.6, p.z)
			found = true
			break
		var agl: float = p.y - surface
		prev_p = p
		dist += clampf(agl * 0.3, 3.5, 36.0)
	if not found:
		var ahead: Vector3 = origin + nose * 500.0
		ahead.y = maxf(_ground_h(ahead.x, ahead.z), Game.WATER_LEVEL) + 0.6
		var roof_a: float = _building_roof(ahead.x, ahead.z)
		if roof_a > -1.0e8:
			ahead.y = maxf(ahead.y, roof_a + 0.6)
		hit = ahead
		found = true

	Game.aim_world = hit
	Game.aim_range = origin.distance_to(hit)
	Game.aim_valid = found
	Game.aim_ready = Game.missiles_ready > 0
	Game.aim_in_dlz = Game.aim_ready and Game.aim_range >= Game.DLZ_RMIN and Game.aim_range <= Game.DLZ_RAERO


func _integrate(dt: float) -> void:
	var steer := _steer
	# A (−x) banks/turns left, D (+x) right; W (−y) climbs, S (+y) dives
	yaw += -steer.x * TURN_RATE * dt
	pitch += -steer.y * PITCH_RATE * dt
	pitch = clampf(pitch, -0.75, 0.85)
	target_roll = -steer.x * ROLL_AMOUNT

	if _rolling:
		roll = _roll_anim
	else:
		roll = lerpf(roll, target_roll, 1.0 - exp(-ROLL_RESP * dt))

	# Auto pull-up before terrain / rooftops
	var floor_probe: float = _solid_floor(position.x, position.z)
	var agl: float = position.y - floor_probe
	Game.warn_terrain = agl < MIN_AGL * 1.8
	Game.warn_low_alt = agl < Game.SAFE_AGL
	if Game.warn_low_alt:
		Game.low_alt_intensity = clampf(
			inverse_lerp(Game.SAFE_AGL, Game.CRITICAL_AGL, agl),
			0.0,
			1.0
		)
	else:
		Game.low_alt_intensity = 0.0
	if agl < MIN_AGL:
		pitch = maxf(pitch, lerpf(pitch, 0.55, 1.0 - exp(-AUTO_PULL * dt)))
	# Soft ceiling — plenty of sky; only nudge near MAX_ALT
	if position.y > Game.MAX_ALT * 0.92:
		pitch = minf(pitch, -0.12)
	if position.y > Game.MAX_ALT:
		position.y = Game.MAX_ALT
		pitch = minf(pitch, -0.25)

	var basis_y := Basis.from_euler(Vector3(pitch, yaw, roll))
	transform.basis = basis_y

	var target_speed: float = BASE_SPEED * (AB_MULT if afterburner else 1.0)
	speed = lerpf(speed, target_speed, 1.0 - exp(-2.0 * dt))
	Game.throttle = 0.85 if afterburner else 0.4
	velocity = -basis_y.z * speed
	# Slight gravity arcade feel
	velocity.y += sin(pitch) * 0.0
	var prev_pos: Vector3 = position
	position += velocity * dt

	# Wrap world
	var half := Game.WORLD_SIZE * 0.5
	position.x = wrapf(position.x, -half, half)
	position.z = wrapf(position.z, -half, half)

	# Building face hits — bounce/skim instead of clipping through towers
	if Game.building_segment_hit.is_valid():
		var bhit: Variant = Game.building_segment_hit.call(prev_pos, position)
		if bhit != null:
			var hit_p: Vector3 = bhit as Vector3
			position = hit_p + Vector3(0, 10.0, 0)
			pitch = maxf(pitch, 0.45)
			velocity.y = maxf(velocity.y, 28.0)

	# Cannot crash — clamp above terrain and rooftops
	var floor_y: float = _solid_floor(position.x, position.z) + 8.0
	floor_y = maxf(floor_y, Game.WATER_LEVEL + 4.0)
	if position.y < floor_y:
		position.y = floor_y
		pitch = maxf(pitch, 0.2)
	# If still inside a volume (side entry), shove up to roof
	if Game.building_contains.is_valid() and Game.building_contains.call(position):
		var roof: float = _building_roof(position.x, position.z)
		if roof > -1.0e8:
			position.y = maxf(position.y, roof + 10.0)
			pitch = maxf(pitch, 0.5)


func _update_fx() -> void:
	var floor_y: float = _solid_floor(position.x, position.z)
	var agl: float = position.y - floor_y
	# Water skim if near water surface (ignore rooftops)
	var over_water: bool = _ground_h(position.x, position.z) < Game.WATER_LEVEL + 2.0
	var water_agl: float = position.y - Game.WATER_LEVEL
	mesh.set_water_skim(over_water and water_agl < SKIM_AGL + 4.0)
	mesh.update_vapor(position.y, Game.airspeed, Game.g_force, afterburner)

	# Ground / cloud shadow — project down (onto roof when over buildings)
	var sh: float = floor_y + 0.5
	mesh.shadow.global_position = Vector3(position.x + 8.0, sh, position.z + 6.0)
	mesh.shadow.scale = Vector3(1, 1, 1) * clampf(1.5 - agl / 200.0, 0.4, 1.6)


func _update_telemetry(dt: float) -> void:
	Game.airspeed = speed * 1.85  # knot-ish display units
	Game.altitude = position.y
	Game.heading_deg = rad_to_deg(wrapf(yaw, 0.0, TAU))
	Game.pitch_deg = rad_to_deg(pitch)
	Game.roll_deg = rad_to_deg(roll)
	Game.vspeed = velocity.y
	Game.radar_height = position.y - _solid_floor(position.x, position.z)
	var accel: Vector3 = (velocity - _prev_vel) / maxf(dt, 0.0001)
	_prev_vel = velocity
	var g: float = 1.0 + accel.dot(transform.basis.y) / 9.81
	Game.g_force = lerpf(Game.g_force, clampf(g, -2.0, 7.0), 0.15)
	Game.turn_rate = -_steer.x
	Game.slip = lerpf(Game.slip, -_steer.x * 0.5, 0.1)


func _tick_missiles(dt: float) -> void:
	for i in 4:
		if _missile_cds[i] > 0.0:
			_missile_cds[i] -= dt
			if _missile_cds[i] <= 0.0:
				_missile_cds[i] = 0.0
				if Game.missiles_ready < Game.MISSILE_MAX:
					Game.set_missiles(Game.missiles_ready + 1)
		var rail: Node3D = missile_bay.get_child(i)
		rail.visible = _missile_cds[i] <= 0.0


func _ground_h(x: float, z: float) -> float:
	if Game.height_sampler.is_valid():
		return Game.height_sampler.call(x, z)
	return 0.0


func _building_roof(x: float, z: float) -> float:
	if Game.building_roof_at.is_valid():
		return Game.building_roof_at.call(x, z)
	return -INF


func _solid_floor(x: float, z: float) -> float:
	var floor_y: float = maxf(_ground_h(x, z), Game.WATER_LEVEL)
	var roof: float = _building_roof(x, z)
	if roof > -1.0e8:
		floor_y = maxf(floor_y, roof)
	return floor_y
