extends Node3D
class_name ImpactFX
## Multi-stage blast (2× scale): flash → fireball → shock → sparks / smoke.


const SCALE := 2.0


static func spawn(parent: Node, pos: Vector3, on_water: bool) -> void:
	var fx := ImpactFX.new()
	parent.add_child(fx)
	fx.global_position = pos
	fx._run(on_water)


func _run(on_water: bool) -> void:
	PatrolAudio.play_boom(on_water)

	# --- Stage 1: white-hot flash ---
	var flash := _sphere(1.8 * SCALE, Color(1, 1, 0.92), Color(1, 0.96, 0.75), 14.0, 0.95)
	add_child(flash)
	var flash2 := _sphere(1.05 * SCALE, Color(1, 0.72, 0.28, 0.85), Color(1, 0.42, 0.06), 9.0, 0.88)
	add_child(flash2)
	# Soft heat halo (light detail)
	var halo := _sphere(2.6 * SCALE, Color(1, 0.55, 0.2, 0.35), Color(1, 0.35, 0.05), 3.5, 0.35)
	add_child(halo)

	# --- Stage 2: fireball burst ---
	var fire := _burst_particles(
		56, 1.05, 0.95,
		18.0, 48.0,
		Vector3(0, -5, 0),
		_fire_grad(),
		0.55, 2.2,
		true
	)
	add_child(fire)

	# Secondary slower fire bloom
	var bloom := _burst_particles(
		32, 1.45, 0.72,
		6.0, 18.0,
		Vector3(0, -2.5, 0),
		_fire_grad_soft(),
		0.95, 3.2,
		true
	)
	add_child(bloom)

	# Hot spark streaks (light detail)
	var sparks := _burst_particles(
		28, 0.85, 0.98,
		22.0, 55.0,
		Vector3(0, -8, 0),
		_spark_grad(),
		0.04, 0.12,
		true
	)
	var spm := sparks.process_material as ParticleProcessMaterial
	spm.spread = 160.0
	spm.damping_min = 1.5
	spm.damping_max = 3.5
	add_child(sparks)

	# --- Shock rings ---
	var ring := _shock_ring(Color(1, 0.95, 0.8, 0.85), Color(1, 0.8, 0.4), 3.2)
	add_child(ring)
	var ring2 := _shock_ring(Color(0.9, 0.95, 1.0, 0.42), Color(0.7, 0.85, 1.0), 1.8)
	ring2.position.y = 0.55
	add_child(ring2)

	# --- Lingering smoke column ---
	var smoke := _burst_particles(
		52, 5.2, 0.32,
		3.0, 12.0,
		Vector3(0, 4.5, 0),
		_smoke_grad(),
		1.4, 4.4,
		false
	)
	add_child(smoke)

	# Delayed secondary puff (light detail)
	_spawn_delayed_puff(0.18)

	if on_water:
		_water_burst()
	else:
		_land_burst()

	# Animate flash + rings (2× expansion)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(flash, "scale", Vector3.ONE * 7.0 * SCALE, 0.14)
	tw.tween_property(flash.material_override, "albedo_color:a", 0.0, 0.2)
	tw.tween_property(flash2, "scale", Vector3.ONE * 5.2 * SCALE, 0.26)
	tw.tween_property(flash2.material_override, "albedo_color:a", 0.0, 0.32)
	tw.tween_property(halo, "scale", Vector3.ONE * 4.5 * SCALE, 0.4)
	tw.tween_property(halo.material_override, "albedo_color:a", 0.0, 0.45)
	var rm := ring.material_override as StandardMaterial3D
	var rm2 := ring2.material_override as StandardMaterial3D
	tw.tween_property(ring, "scale", Vector3.ONE * 16.0 * SCALE, 0.6)
	tw.tween_property(rm, "albedo_color:a", 0.0, 0.6)
	tw.tween_property(rm, "emission_energy_multiplier", 0.0, 0.6)
	tw.tween_property(ring2, "scale", Vector3.ONE * 22.0 * SCALE, 0.82).set_delay(0.05)
	tw.tween_property(rm2, "albedo_color:a", 0.0, 0.75).set_delay(0.05)

	await get_tree().create_timer(5.5).timeout
	queue_free()


func _spawn_delayed_puff(delay: float) -> void:
	await get_tree().create_timer(delay).timeout
	if not is_inside_tree():
		return
	var puff := _burst_particles(
		18, 1.1, 0.9,
		8.0, 20.0,
		Vector3(0, -3, 0),
		_fire_grad_soft(),
		0.7, 2.4,
		true
	)
	add_child(puff)


func _shock_ring(albedo: Color, emission: Color, energy: float) -> MeshInstance3D:
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 1.0 * SCALE
	torus.outer_radius = 1.55 * SCALE
	torus.rings = 12
	torus.ring_segments = 28
	ring.mesh = torus
	var rm := StandardMaterial3D.new()
	rm.albedo_color = albedo
	rm.emission_enabled = true
	rm.emission = emission
	rm.emission_energy_multiplier = energy
	rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rm.no_depth_test = true
	ring.material_override = rm
	ring.rotation.x = PI * 0.5
	ring.position.y = 0.45
	return ring


func _water_burst() -> void:
	var spray := _burst_particles(
		72, 1.7, 1.0,
		20.0, 52.0,
		Vector3(0, -28, 0),
		_water_grad(),
		0.25, 1.15,
		true
	)
	var pm := spray.process_material as ParticleProcessMaterial
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 38.0
	add_child(spray)

	# Droplet mist (light detail)
	var mist := _burst_particles(
		24, 2.0, 0.75,
		4.0, 12.0,
		Vector3(0, -2, 0),
		_water_grad(),
		0.5, 1.6,
		false
	)
	add_child(mist)

	var foam := GPUParticles3D.new()
	foam.amount = 48
	foam.lifetime = 2.6
	foam.one_shot = true
	foam.emitting = true
	foam.explosiveness = 0.85
	foam.visibility_aabb = AABB(Vector3(-60, -8, -60), Vector3(120, 50, 120))
	var fpm := ParticleProcessMaterial.new()
	fpm.direction = Vector3(0, 0.15, 0)
	fpm.spread = 180.0
	fpm.flatness = 0.85
	fpm.initial_velocity_min = 10.0
	fpm.initial_velocity_max = 24.0
	fpm.gravity = Vector3(0, -1.0, 0)
	fpm.scale_min = 0.7
	fpm.scale_max = 2.0
	fpm.color = Color(0.92, 0.96, 1.0, 0.7)
	var grad := Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	grad.colors = PackedColorArray([
		Color(1, 1, 1, 0.85),
		Color(0.85, 0.92, 0.98, 0.45),
		Color(0.7, 0.8, 0.9, 0.0),
	])
	var gt := GradientTexture1D.new()
	gt.gradient = grad
	fpm.color_ramp = gt
	foam.process_material = fpm
	foam.draw_pass_1 = _billboard_sphere(0.55, true)
	foam.position.y = 0.35
	add_child(foam)


func _land_burst() -> void:
	# Scorch mark (2×)
	var scorch := MeshInstance3D.new()
	var disc := CylinderMesh.new()
	disc.top_radius = 5.5 * SCALE
	disc.bottom_radius = 5.5 * SCALE
	disc.height = 0.22
	scorch.mesh = disc
	var scm := StandardMaterial3D.new()
	scm.albedo_color = Color(0.08, 0.05, 0.04, 0.9)
	scm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	scm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	scorch.material_override = scm
	scorch.position.y = 0.28
	add_child(scorch)

	# Inner charcoal ring (light detail)
	var scor2 := MeshInstance3D.new()
	var disc2 := CylinderMesh.new()
	disc2.top_radius = 2.2 * SCALE
	disc2.bottom_radius = 2.2 * SCALE
	disc2.height = 0.16
	scor2.mesh = disc2
	var scm2 := StandardMaterial3D.new()
	scm2.albedo_color = Color(0.04, 0.03, 0.02, 0.85)
	scm2.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	scm2.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	scor2.material_override = scm2
	scor2.position.y = 0.32
	add_child(scor2)

	# Dirt / debris
	var debris := _burst_particles(
		36, 1.9, 0.9,
		12.0, 32.0,
		Vector3(0, -18, 0),
		_debris_grad(),
		0.12, 0.55,
		false
	)
	var dpm := debris.process_material as ParticleProcessMaterial
	dpm.direction = Vector3(0, 1, 0)
	dpm.spread = 72.0
	add_child(debris)

	# A few chunky debris bits (light detail, capped)
	_spawn_chunks(6)

	# Embers
	var embers := _burst_particles(
		44, 2.8, 0.82,
		3.0, 14.0,
		Vector3(0, -3.5, 0),
		_ember_grad(),
		0.07, 0.22,
		true
	)
	add_child(embers)

	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(scm, "albedo_color:a", 0.0, 4.8).set_delay(0.55)
	tw.tween_property(scm2, "albedo_color:a", 0.0, 4.2).set_delay(0.45)


func _spawn_chunks(n: int) -> void:
	for i in n:
		var mi := MeshInstance3D.new()
		var box := BoxMesh.new()
		var s: float = randf_range(0.18, 0.45) * SCALE
		box.size = Vector3(s, s * randf_range(0.5, 1.2), s * randf_range(0.6, 1.1))
		mi.mesh = box
		var mat := StandardMaterial3D.new()
		var col := Color(0.28, 0.2, 0.14).lerp(Color(0.12, 0.1, 0.08), randf())
		col.a = 1.0
		mat.albedo_color = col
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mi.material_override = mat
		mi.position = Vector3(randf_range(-0.4, 0.4), 0.4, randf_range(-0.4, 0.4)) * SCALE
		mi.rotation = Vector3(randf() * TAU, randf() * TAU, randf() * TAU)
		add_child(mi)
		var dir := Vector3(randf_range(-1, 1), randf_range(0.6, 1.4), randf_range(-1, 1)).normalized()
		var dist: float = randf_range(6.0, 14.0) * SCALE
		var tw := create_tween()
		tw.set_parallel(true)
		tw.tween_property(mi, "position", mi.position + dir * dist, randf_range(0.45, 0.85)).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		tw.tween_property(mi, "rotation", mi.rotation + Vector3(randf_range(-4, 4), randf_range(-4, 4), randf_range(-4, 4)), 0.8)
		tw.tween_property(mat, "albedo_color:a", 0.0, 0.35).set_delay(0.55)


func _sphere(radius: float, albedo: Color, emission: Color, energy: float, alpha: float) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = radius
	sph.height = radius * 2.0
	mi.mesh = sph
	var m := StandardMaterial3D.new()
	var c := albedo
	c.a = alpha
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = emission
	m.emission_energy_multiplier = energy
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.no_depth_test = true
	mi.material_override = m
	return mi


func _burst_particles(
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
	p.visibility_aabb = AABB(Vector3(-80, -20, -80), Vector3(160, 140, 160))
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
	var scale_curve := Curve.new()
	scale_curve.add_point(Vector2(0.0, 0.45))
	scale_curve.add_point(Vector2(0.2, 1.25))
	scale_curve.add_point(Vector2(1.0, 0.15))
	var st := CurveTexture.new()
	st.curve = scale_curve
	pm.scale_curve = st
	p.process_material = pm
	p.draw_pass_1 = _billboard_sphere(0.55, emissive)
	return p


func _billboard_sphere(radius: float, emissive: bool) -> SphereMesh:
	var dm := SphereMesh.new()
	dm.radius = radius
	dm.height = radius * 2.0
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(1, 1, 1)
	sm.vertex_color_use_as_albedo = true
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	if emissive:
		sm.emission_enabled = true
		sm.emission = Color(1.0, 0.45, 0.1)
		sm.emission_energy_multiplier = 2.8
	dm.material = sm
	return dm


func _fire_grad() -> Gradient:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.15, 0.45, 0.75, 1.0])
	g.colors = PackedColorArray([
		Color(1.0, 1.0, 0.9, 1.0),
		Color(1.0, 0.75, 0.25, 0.98),
		Color(1.0, 0.4, 0.06, 0.9),
		Color(0.7, 0.12, 0.02, 0.55),
		Color(0.12, 0.04, 0.02, 0.0),
	])
	return g


func _fire_grad_soft() -> Gradient:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.35, 1.0])
	g.colors = PackedColorArray([
		Color(1.0, 0.62, 0.22, 0.75),
		Color(0.5, 0.15, 0.05, 0.42),
		Color(0.1, 0.05, 0.05, 0.0),
	])
	return g


func _spark_grad() -> Gradient:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.4, 1.0])
	g.colors = PackedColorArray([
		Color(1.0, 1.0, 0.85, 1.0),
		Color(1.0, 0.55, 0.1, 0.95),
		Color(0.4, 0.05, 0.0, 0.0),
	])
	return g


func _smoke_grad() -> Gradient:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.2, 0.65, 1.0])
	g.colors = PackedColorArray([
		Color(0.5, 0.45, 0.4, 0.6),
		Color(0.32, 0.32, 0.34, 0.52),
		Color(0.22, 0.22, 0.24, 0.28),
		Color(0.14, 0.14, 0.15, 0.0),
	])
	return g


func _water_grad() -> Gradient:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.35, 1.0])
	g.colors = PackedColorArray([
		Color(1.0, 1.0, 1.0, 0.95),
		Color(0.75, 0.88, 0.98, 0.55),
		Color(0.5, 0.7, 0.85, 0.0),
	])
	return g


func _debris_grad() -> Gradient:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 1.0])
	g.colors = PackedColorArray([
		Color(0.35, 0.25, 0.15, 0.95),
		Color(0.15, 0.1, 0.08, 0.0),
	])
	return g


func _ember_grad() -> Gradient:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	g.colors = PackedColorArray([
		Color(1.0, 0.9, 0.4, 1.0),
		Color(1.0, 0.35, 0.05, 0.9),
		Color(0.3, 0.05, 0.0, 0.0),
	])
	return g
