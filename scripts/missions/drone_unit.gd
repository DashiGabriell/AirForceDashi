extends Node3D
class_name DroneUnit
## Single hostile UAV: cruise → dive → impact (leak) or destroy.


signal destroyed(drone: DroneUnit, kind: int, pos: Vector3)
signal leaked(drone: DroneUnit, kind: int, pos: Vector3)

const KIND_GERAN := 0
const KIND_ORLAN := 1
const KIND_LANCET := 2

var kind: int = KIND_GERAN
var speed: float = 55.0
var dive_aggression: float = 0.5
var hit_radius: float = 7.0
var alive: bool = true
var hp: float = 1.0

var _target: Vector3 = Vector3.ZERO
var _velocity: Vector3 = Vector3.ZERO
var _phase: String = "CRUISE" ## CRUISE / DIVE
var _dive_t: float = 0.0
var _mesh: DroneMesh
var _wobble: float = 0.0
var _bank: float = 0.0


func setup(k: int, origin: Vector3, target: Vector3, spd: float, dive: float) -> void:
	kind = k
	speed = spd
	dive_aggression = dive
	match k:
		KIND_GERAN:
			hit_radius = 7.5
			hp = 1.35
		KIND_ORLAN:
			hit_radius = 5.5
			hp = 1.0
		_:
			hit_radius = 4.2
			hp = 1.0
	_target = target
	global_position = origin
	var to: Vector3 = target - origin
	to.y = 0.0
	if to.length() < 1.0:
		to = Vector3(0, 0, -1)
	_velocity = to.normalized() * speed
	_velocity.y = randf_range(-2.0, 1.0)
	_phase = "CRUISE"
	# Longer cruise before dive — at least ~2× the original window.
	_dive_t = lerpf(14.0, 7.0, dive_aggression) + randf_range(-0.8, 1.2)
	_wobble = randf() * TAU
	_mesh = DroneMesh.new()
	add_child(_mesh)
	_mesh.setup(kind)
	_orient()
	set_physics_process(true)


func apply_damage(amount: float = 1.0) -> void:
	if not alive:
		return
	hp -= amount
	if hp <= 0.35 and _mesh:
		_mesh.set_damaged(true)
	if hp <= 0.0:
		_kill()


func try_hit_segment(from: Vector3, to: Vector3, blast: float = 1.0) -> bool:
	if not alive:
		return false
	var p: Vector3 = Geometry3D.get_closest_point_to_segment(global_position, from, to)
	if p.distance_to(global_position) <= hit_radius + 3.5:
		apply_damage(blast)
		return not alive
	return false


func try_proximity(pos: Vector3, radius: float, blast: float = 1.0) -> bool:
	if not alive:
		return false
	if pos.distance_to(global_position) <= hit_radius + radius:
		apply_damage(blast)
		return not alive
	return false


func _physics_process(dt: float) -> void:
	if not alive or Game.paused:
		return
	_wobble += dt * (1.2 + dive_aggression)
	match _phase:
		"CRUISE":
			_dive_t -= dt
			# Gentle weave
			var right := Vector3(-_velocity.z, 0, _velocity.x).normalized()
			if right.length() < 0.1:
				right = Vector3.RIGHT
			var weave: float = sin(_wobble) * lerpf(4.0, 14.0, dive_aggression)
			if kind == KIND_ORLAN:
				weave *= 1.35
				_velocity.y = sin(_wobble * 0.7) * 6.0
			elif kind == KIND_LANCET:
				weave *= 1.6
			_velocity += right * weave * dt * 8.0
			var flat := Vector3(_velocity.x, 0, _velocity.z)
			if flat.length() > 0.1:
				_velocity = flat.normalized() * speed + Vector3(0, _velocity.y, 0)
			# Turn toward target zone
			var desire: Vector3 = _target - global_position
			desire.y = 0.0
			if desire.length() > 40.0:
				var turn: Vector3 = desire.normalized() * speed
				_velocity.x = lerpf(_velocity.x, turn.x, dt * 0.6)
				_velocity.z = lerpf(_velocity.z, turn.z, dt * 0.6)
			# Only commit to dive when close enough after cruise timer
			if _dive_t <= 0.0 and global_position.distance_to(_target) < lerpf(780.0, 520.0, dive_aggression):
				_phase = "DIVE"
			elif _dive_t <= 0.0 and global_position.distance_to(_target) < lerpf(1100.0, 850.0, dive_aggression):
				# Soft sink toward target while still chaseable
				_velocity.y = lerpf(_velocity.y, -speed * 0.12, dt * 0.8)
		"DIVE":
			var to_g: Vector3 = _target - global_position
			var dive_spd: float = speed * lerpf(1.05, 1.28, dive_aggression)
			if kind == KIND_LANCET:
				dive_spd *= 1.12
			var dir: Vector3 = to_g.normalized()
			# Lancet jinks while diving
			if kind == KIND_LANCET:
				dir += Vector3(sin(_wobble * 3.0), 0, cos(_wobble * 2.5)) * 0.18
				dir = dir.normalized()
			_velocity = _velocity.lerp(dir * dive_spd, dt * (1.1 + dive_aggression * 0.6))
	global_position += _velocity * dt
	_bank = lerpf(_bank, clampf(-_velocity.x * 0.02, -0.55, 0.55), dt * 4.0)
	_orient()

	var gh: float = Game.WATER_LEVEL
	if Game.height_sampler.is_valid():
		gh = float(Game.height_sampler.call(global_position.x, global_position.z))
	var surface: float = maxf(gh, Game.WATER_LEVEL)
	if global_position.y <= surface + 2.0:
		_leak(Vector3(global_position.x, surface, global_position.z))


func _orient() -> void:
	if _velocity.length() < 0.2:
		return
	var look: Vector3 = global_position + _velocity
	look_at(look, Vector3.UP)
	rotate_object_local(Vector3.FORWARD, _bank)


func _kill() -> void:
	if not alive:
		return
	alive = false
	set_physics_process(false)
	var pos: Vector3 = global_position
	var k: int = kind
	if _mesh:
		_mesh.visible = false
	destroyed.emit(self, k, pos)
	queue_free()


func _leak(pos: Vector3) -> void:
	if not alive:
		return
	alive = false
	set_physics_process(false)
	var k: int = kind
	leaked.emit(self, k, pos)
	queue_free()
