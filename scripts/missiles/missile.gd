extends Node3D
class_name Missile
## Arcade missile with bright tracer core + layered smoke trail.

signal impacted(pos: Vector3, on_water: bool)
signal segment_moved(from: Vector3, to: Vector3)

var velocity: Vector3 = Vector3.ZERO
var life: float = 6.0
var seek_target: Node3D = null
var seek_strength: float = 0.0
var _smoke: GPUParticles3D
var _embers: GPUParticles3D
var _flame: MeshInstance3D
var _tracer: MeshInstance3D
var _glow: MeshInstance3D
var _flicker: float = 0.0


func setup(origin: Vector3, dir: Vector3, target: Node3D = null, guided: bool = false) -> void:
	global_position = origin
	velocity = dir.normalized() * 280.0
	seek_target = target
	seek_strength = 9.5 if guided and target != null else 0.0
	if guided:
		life = 7.5
		velocity = dir.normalized() * 310.0
	look_at(origin + dir, Vector3.UP)
	_build_visual()


func _build_visual() -> void:
	# Body
	var body := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.16, 0.16, 1.5)
	body.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.5, 0.52, 0.48)
	mat.roughness = 0.7
	body.material_override = mat
	add_child(body)

	# Bright tracer beam behind the missile (the "traçante")
	_tracer = MeshInstance3D.new()
	var beam := BoxMesh.new()
	beam.size = Vector3(0.12, 0.12, 4.5)
	_tracer.mesh = beam
	var tm := StandardMaterial3D.new()
	tm.albedo_color = Color(1.0, 0.85, 0.35, 0.85)
	tm.emission_enabled = true
	tm.emission = Color(1.0, 0.55, 0.1)
	tm.emission_energy_multiplier = 6.0
	tm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	tm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	tm.no_depth_test = true
	_tracer.material_override = tm
	_tracer.position = Vector3(0, 0, 2.8)  # aft (local +Z with our look_at)
	add_child(_tracer)

	# Soft glow halo at nozzle
	_glow = MeshInstance3D.new()
	var halo := SphereMesh.new()
	halo.radius = 0.45
	halo.height = 0.9
	_glow.mesh = halo
	var gm := StandardMaterial3D.new()
	gm.albedo_color = Color(1.0, 0.5, 0.15, 0.45)
	gm.emission_enabled = true
	gm.emission = Color(1.0, 0.4, 0.05)
	gm.emission_energy_multiplier = 5.0
	gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	gm.no_depth_test = true
	_glow.material_override = gm
	_glow.position = Vector3(0, 0, 0.85)
	add_child(_glow)

	# Hot core flame
	_flame = MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = 0.22
	_flame.mesh = sph
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(1.0, 0.95, 0.7)
	fm.emission_enabled = true
	fm.emission = Color(1.0, 0.7, 0.2)
	fm.emission_energy_multiplier = 8.0
	fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_flame.material_override = fm
	_flame.position = Vector3(0, 0, 0.85)
	add_child(_flame)

	# Dense smoke trail
	_smoke = _make_trail_smoke()
	add_child(_smoke)

	# Hot ember sparks in the trail
	_embers = _make_trail_embers()
	add_child(_embers)


func _make_trail_smoke() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = 96
	p.lifetime = 2.4
	p.preprocess = 0.15
	p.visibility_aabb = AABB(Vector3(-30, -30, -30), Vector3(60, 60, 60))
	p.emitting = true
	p.position = Vector3(0, 0, 1.0)
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 0, 1)
	pm.spread = 8.0
	pm.initial_velocity_min = 1.5
	pm.initial_velocity_max = 4.0
	pm.gravity = Vector3(0, 2.5, 0)
	pm.damping_min = 0.4
	pm.damping_max = 1.2
	pm.scale_min = 0.25
	pm.scale_max = 1.1
	pm.color = Color(0.55, 0.55, 0.58, 0.7)
	# Fade smoke: hot grey → cool transparent
	var grad := Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.15, 0.55, 1.0])
	grad.colors = PackedColorArray([
		Color(0.95, 0.75, 0.4, 0.85),
		Color(0.55, 0.55, 0.58, 0.65),
		Color(0.35, 0.35, 0.38, 0.35),
		Color(0.25, 0.25, 0.28, 0.0),
	])
	var gt := GradientTexture1D.new()
	gt.gradient = grad
	pm.color_ramp = gt
	var scale_curve := Curve.new()
	scale_curve.add_point(Vector2(0.0, 0.4))
	scale_curve.add_point(Vector2(0.35, 1.0))
	scale_curve.add_point(Vector2(1.0, 1.6))
	var st := CurveTexture.new()
	st.curve = scale_curve
	pm.scale_curve = st
	p.process_material = pm
	var dm := SphereMesh.new()
	dm.radius = 0.28
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(1, 1, 1, 1)
	sm.vertex_color_use_as_albedo = true
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	dm.material = sm
	p.draw_pass_1 = dm
	return p


func _make_trail_embers() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = 40
	p.lifetime = 0.55
	p.emitting = true
	p.position = Vector3(0, 0, 0.95)
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 0, 1)
	pm.spread = 18.0
	pm.initial_velocity_min = 6.0
	pm.initial_velocity_max = 16.0
	pm.gravity = Vector3(0, -2.0, 0)
	pm.scale_min = 0.04
	pm.scale_max = 0.12
	pm.color = Color(1.0, 0.55, 0.15, 1.0)
	var grad := Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.4, 1.0])
	grad.colors = PackedColorArray([
		Color(1.0, 1.0, 0.7, 1.0),
		Color(1.0, 0.4, 0.05, 0.9),
		Color(0.4, 0.05, 0.0, 0.0),
	])
	var gt := GradientTexture1D.new()
	gt.gradient = grad
	pm.color_ramp = gt
	p.process_material = pm
	var dm := SphereMesh.new()
	dm.radius = 0.07
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(1, 1, 1)
	sm.vertex_color_use_as_albedo = true
	sm.emission_enabled = true
	sm.emission = Color(1.0, 0.5, 0.1)
	sm.emission_energy_multiplier = 4.0
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	dm.material = sm
	p.draw_pass_1 = dm
	return p


func _physics_process(dt: float) -> void:
	if Game.paused:
		return
	life -= dt
	if life <= 0.0:
		queue_free()
		return
	var prev: Vector3 = global_position
	if seek_strength > 0.0 and is_instance_valid(seek_target):
		var to: Vector3 = seek_target.global_position - global_position
		if to.length() > 0.5:
			var desired: Vector3 = to.normalized() * velocity.length()
			velocity = velocity.lerp(desired, clampf(seek_strength * dt, 0.0, 1.0))
			# Proximity fuse on seek target
			if to.length() <= 9.0:
				impacted.emit(seek_target.global_position, false)
				queue_free()
				return
	elif seek_strength > 0.0:
		seek_strength = 0.0
	global_position += velocity * dt
	velocity.y -= 8.0 * dt if seek_strength <= 0.0 else 2.0 * dt
	if velocity.length() > 0.1:
		look_at(global_position + velocity, Vector3.UP)
	segment_moved.emit(prev, global_position)

	# Flicker tracer / flame for life
	_flicker += dt * 28.0
	var pulse: float = 0.85 + 0.15 * sin(_flicker) + 0.08 * sin(_flicker * 2.7)
	if _flame:
		_flame.scale = Vector3.ONE * pulse
		(_flame.material_override as StandardMaterial3D).emission_energy_multiplier = 6.0 + 4.0 * pulse
	if _glow:
		_glow.scale = Vector3(1.2, 1.2, 1.6) * pulse
	if _tracer:
		var tm := _tracer.material_override as StandardMaterial3D
		tm.emission_energy_multiplier = 4.5 + 3.0 * pulse
		tm.albedo_color.a = 0.55 + 0.3 * pulse

	# Building collision along travel segment
	if Game.building_segment_hit.is_valid():
		var bhit: Variant = Game.building_segment_hit.call(prev, global_position)
		if bhit != null:
			impacted.emit(bhit as Vector3, false)
			queue_free()
			return

	var gh: float = 0.0
	if Game.height_sampler.is_valid():
		gh = Game.height_sampler.call(global_position.x, global_position.z)
	var water: bool = gh < Game.WATER_LEVEL + 1.0
	var surface: float = maxf(gh, Game.WATER_LEVEL)
	if global_position.y <= surface + 0.5:
		impacted.emit(Vector3(global_position.x, surface, global_position.z), water)
		queue_free()
