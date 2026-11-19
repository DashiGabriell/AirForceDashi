extends Node3D
class_name DroneExplosion
## 4-stage airburst matching the Geran/Orlan sheet: flash → fireball → pillar → smoke.


static func spawn(parent: Node, pos: Vector3, kind: int = 0) -> void:
	var fx := DroneExplosion.new()
	parent.add_child(fx)
	fx.global_position = pos
	fx._run(kind)


func _run(kind: int) -> void:
	PatrolAudio.play_boom(false)
	var scale: float = 1.0
	match kind:
		2: # Lancet
			scale = 0.72
		1: # Orlan
			scale = 0.9
		_:
			scale = 1.15

	# Frame 1 — white/yellow spike flash
	var flash := _sphere(0.9 * scale, Color(1, 1, 0.85, 0.95), Color(1, 0.95, 0.55), 16.0)
	add_child(flash)
	var spike := _sphere(0.45 * scale, Color(1, 0.85, 0.3, 0.9), Color(1, 0.55, 0.08), 12.0)
	add_child(spike)

	# Frame 2 — rounded fireball
	var fire := _burst(48, 0.95, 0.95, 14.0 * scale, 40.0 * scale, Vector3(0, -4, 0), _fire_grad(), 0.4 * scale, 1.8 * scale, true)
	add_child(fire)
	var core := _burst(22, 0.7, 1.0, 8.0 * scale, 22.0 * scale, Vector3(0, -2, 0), _core_grad(), 0.25 * scale, 0.9 * scale, true)
	add_child(core)

	# Frame 3 — dark smoke pillar with embers
	var pillar := _burst(40, 2.8, 0.35, 2.0 * scale, 9.0 * scale, Vector3(0, 6.0 * scale, 0), _pillar_grad(), 0.8 * scale, 2.6 * scale, false)
	add_child(pillar)
	var embers := _burst(28, 1.6, 0.85, 4.0 * scale, 16.0 * scale, Vector3(0, -1.5, 0), _ember_grad(), 0.05 * scale, 0.16 * scale, true)
	add_child(embers)

	# Debris chunks
	_spawn_chunks(5 + int(scale * 3.0), scale)

	# Shock ring
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.7 * scale
	torus.outer_radius = 1.05 * scale
	torus.rings = 10
	torus.ring_segments = 24
	ring.mesh = torus
	var rm := StandardMaterial3D.new()
	rm.albedo_color = Color(1, 0.9, 0.55, 0.8)
	rm.emission_enabled = true
	rm.emission = Color(1, 0.6, 0.15)
	rm.emission_energy_multiplier = 4.0
	rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rm.no_depth_test = true
	ring.material_override = rm
	ring.rotation.x = PI * 0.5
	add_child(ring)

	# Frame 4 — dissipating grey haze (delayed)
	_spawn_haze(0.35, scale)

	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(flash, "scale", Vector3.ONE * 5.5 * scale, 0.12)
	tw.tween_property(flash.material_override, "albedo_color:a", 0.0, 0.18)
	tw.tween_property(spike, "scale", Vector3.ONE * 3.8 * scale, 0.2)
	tw.tween_property(spike.material_override, "albedo_color:a", 0.0, 0.28)
	tw.tween_property(ring, "scale", Vector3.ONE * 10.0 * scale, 0.55)
	tw.tween_property(rm, "albedo_color:a", 0.0, 0.55)
	tw.tween_property(rm, "emission_energy_multiplier", 0.0, 0.55)

	await get_tree().create_timer(4.2).timeout
	queue_free()


func _spawn_haze(delay: float, scale: float) -> void:
	await get_tree().create_timer(delay).timeout
	if not is_inside_tree():
		return
	var haze := _burst(26, 2.4, 0.4, 1.5 * scale, 6.0 * scale, Vector3(0, 2.5, 0), _haze_grad(), 1.0 * scale, 3.2 * scale, false)
	add_child(haze)


func _spawn_chunks(n: int, scale: float) -> void:
	for i in n:
		var mi := MeshInstance3D.new()
		var box := BoxMesh.new()
		var s: float = randf_range(0.1, 0.32) * scale
		box.size = Vector3(s, s * randf_range(0.4, 1.1), s * randf_range(0.5, 1.2))
		mi.mesh = box
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.35, 0.36, 0.34).lerp(Color(0.15, 0.12, 0.1), randf())
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mi.material_override = mat
		mi.position = Vector3(randf_range(-0.3, 0.3), randf_range(0.0, 0.3), randf_range(-0.3, 0.3)) * scale
		add_child(mi)
		var dir := Vector3(randf_range(-1, 1), randf_range(0.4, 1.2), randf_range(-1, 1)).normalized()
		var tw := create_tween()
		tw.set_parallel(true)
		tw.tween_property(mi, "position", mi.position + dir * randf_range(4.0, 11.0) * scale, randf_range(0.4, 0.75)).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		tw.tween_property(mi, "rotation", mi.rotation + Vector3(randf_range(-5, 5), randf_range(-5, 5), randf_range(-5, 5)), 0.7)
		tw.tween_property(mat, "albedo_color:a", 0.0, 0.3).set_delay(0.45)


func _sphere(radius: float, albedo: Color, emission: Color, energy: float) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = radius
	sph.height = radius * 2.0
	mi.mesh = sph
	var m := StandardMaterial3D.new()
	m.albedo_color = albedo
	m.emission_enabled = true
	m.emission = emission
	m.emission_energy_multiplier = energy
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.no_depth_test = true
	mi.material_override = m
	return mi


func _burst(
	amount: int, lifetime: float, explosiveness: float,
	vmin: float, vmax: float, gravity: Vector3,
	grad: Gradient, scale_min: float, scale_max: float,
	emissive: bool
) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = amount
	p.lifetime = lifetime
	p.one_shot = true
	p.emitting = true
	p.explosiveness = explosiveness
	p.visibility_aabb = AABB(Vector3(-50, -20, -50), Vector3(100, 100, 100))
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 180.0
	pm.initial_velocity_min = vmin
	pm.initial_velocity_max = vmax
	pm.gravity = gravity
	pm.scale_min = scale_min
	pm.scale_max = scale_max
	var gt := GradientTexture1D.new()
	gt.gradient = grad
	pm.color_ramp = gt
	p.process_material = pm
	var dm := SphereMesh.new()
	dm.radius = 0.4
	var sm := StandardMaterial3D.new()
	sm.vertex_color_use_as_albedo = true
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	if emissive:
		sm.emission_enabled = true
		sm.emission = Color(1.0, 0.45, 0.1)
		sm.emission_energy_multiplier = 2.5
	dm.material = sm
	p.draw_pass_1 = dm
	return p


func _fire_grad() -> Gradient:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.2, 0.55, 1.0])
	g.colors = PackedColorArray([
		Color(1.0, 1.0, 0.75, 1.0),
		Color(1.0, 0.55, 0.12, 0.95),
		Color(0.85, 0.2, 0.05, 0.7),
		Color(0.15, 0.08, 0.05, 0.0),
	])
	return g


func _core_grad() -> Gradient:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.4, 1.0])
	g.colors = PackedColorArray([
		Color(1.0, 0.95, 0.7, 1.0),
		Color(1.0, 0.7, 0.2, 0.85),
		Color(0.9, 0.3, 0.05, 0.0),
	])
	return g


func _pillar_grad() -> Gradient:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.25, 0.7, 1.0])
	g.colors = PackedColorArray([
		Color(0.45, 0.28, 0.12, 0.75),
		Color(0.28, 0.26, 0.25, 0.6),
		Color(0.18, 0.18, 0.2, 0.35),
		Color(0.12, 0.12, 0.14, 0.0),
	])
	return g


func _ember_grad() -> Gradient:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.45, 1.0])
	g.colors = PackedColorArray([
		Color(1.0, 0.9, 0.4, 1.0),
		Color(1.0, 0.35, 0.05, 0.9),
		Color(0.25, 0.05, 0.0, 0.0),
	])
	return g


func _haze_grad() -> Gradient:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	g.colors = PackedColorArray([
		Color(0.4, 0.4, 0.42, 0.45),
		Color(0.28, 0.28, 0.3, 0.25),
		Color(0.2, 0.2, 0.22, 0.0),
	])
	return g
