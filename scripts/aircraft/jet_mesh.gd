extends Node3D
class_name JetMesh
## F-22 procedural: nose toward local -Z (Godot forward), light grey,
## São Paulo flag on the fuselage, flat shade + outline.

var body: MeshInstance3D
var outline: MeshInstance3D
var canopy: MeshInstance3D
var nozzle_l: MeshInstance3D
var nozzle_r: MeshInstance3D
var trail_l: GPUParticles3D ## wingtip vapor
var trail_r: GPUParticles3D
var contrail_l: GPUParticles3D ## engine altitude contrails
var contrail_r: GPUParticles3D
var plume_l: GPUParticles3D
var plume_r: GPUParticles3D
var spray: GPUParticles3D
var wake: GPUParticles3D
var shadow: MeshInstance3D

# Light grey airframe (ref prints)
const C_DARK := Color(0.42, 0.44, 0.46)
const C_MID := Color(0.72, 0.74, 0.76)
const C_LIGHT := Color(0.88, 0.90, 0.92)
const C_RADOME := Color(0.55, 0.57, 0.59)
const C_CANOPY := Color(0.35, 0.42, 0.48, 0.72)
const C_INTAKE := Color(0.18, 0.18, 0.2)
const C_NOZZLE := Color(0.28, 0.28, 0.3)


func _ready() -> void:
	_build()


func _build() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	# Nose = -Z (matches velocity = -basis.z)
	# Fuselage
	_box(st, Vector3(0, 0.02, -0.4), Vector3(1.35, 0.78, 5.8), C_MID)
	_box(st, Vector3(0, 0.0, -2.4), Vector3(1.05, 0.62, 2.2), C_LIGHT)
	_box(st, Vector3(0, -0.05, -0.2), Vector3(1.55, 0.35, 4.2), C_DARK)
	# Nose + radome (forward)
	_box(st, Vector3(0, 0.05, -3.55), Vector3(0.72, 0.48, 1.35), C_LIGHT)
	_box(st, Vector3(0, 0.05, -4.35), Vector3(0.38, 0.32, 0.55), C_RADOME)
	# Chines
	_box(st, Vector3(-0.85, -0.05, -1.2), Vector3(0.35, 0.22, 3.8), C_LIGHT)
	_box(st, Vector3(0.85, -0.05, -1.2), Vector3(0.35, 0.22, 3.8), C_LIGHT)

	_diamond_wing(st, true)
	_diamond_wing(st, false)

	# Engines aft (+Z)
	_box(st, Vector3(-0.62, -0.12, 1.9), Vector3(0.85, 0.58, 2.8), C_DARK)
	_box(st, Vector3(0.62, -0.12, 1.9), Vector3(0.85, 0.58, 2.8), C_DARK)
	# Intakes
	_box(st, Vector3(-0.95, -0.05, -0.6), Vector3(0.55, 0.42, 1.6), C_INTAKE)
	_box(st, Vector3(0.95, -0.05, -0.6), Vector3(0.55, 0.42, 1.6), C_INTAKE)
	_box(st, Vector3(-1.05, -0.05, -1.2), Vector3(0.2, 0.35, 0.5), C_INTAKE)
	_box(st, Vector3(1.05, -0.05, -1.2), Vector3(0.2, 0.35, 0.5), C_INTAKE)

	_stab(st, true)
	_stab(st, false)

	# Canted twin tails
	var cant := 0.48
	_box(st, Vector3(-0.85, 0.85, 2.55), Vector3(0.1, 1.55, 1.65), C_MID, cant)
	_box(st, Vector3(0.85, 0.85, 2.55), Vector3(0.1, 1.55, 1.65), C_MID, -cant)
	_box(st, Vector3(-0.85, 0.95, 1.95), Vector3(0.12, 1.35, 0.35), C_DARK, cant)
	_box(st, Vector3(0.85, 0.95, 1.95), Vector3(0.12, 1.35, 0.35), C_DARK, -cant)

	# Rectangular nozzles (aft)
	_box(st, Vector3(-0.62, -0.08, 3.45), Vector3(0.78, 0.42, 0.55), C_NOZZLE)
	_box(st, Vector3(0.62, -0.08, 3.45), Vector3(0.78, 0.42, 0.55), C_NOZZLE)
	_box(st, Vector3(-0.62, 0.12, 3.7), Vector3(0.82, 0.08, 0.2), C_DARK)
	_box(st, Vector3(0.62, 0.12, 3.7), Vector3(0.82, 0.08, 0.2), C_DARK)
	_box(st, Vector3(-0.62, -0.28, 3.7), Vector3(0.82, 0.08, 0.2), C_DARK)
	_box(st, Vector3(0.62, -0.28, 3.7), Vector3(0.82, 0.08, 0.2), C_DARK)

	# Panel breaks
	_box(st, Vector3(-0.4, 0.28, -0.8), Vector3(0.45, 0.12, 1.8), C_LIGHT)
	_box(st, Vector3(0.55, 0.22, 0.4), Vector3(0.4, 0.1, 1.4), C_DARK)

	st.generate_normals()
	body = MeshInstance3D.new()
	body.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	body.material_override = mat
	add_child(body)

	outline = body.duplicate()
	var om := StandardMaterial3D.new()
	om.albedo_color = Color(0.08, 0.08, 0.1)
	om.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	om.cull_mode = BaseMaterial3D.CULL_FRONT
	om.grow = true
	om.grow_amount = 0.045
	outline.material_override = om
	add_child(outline)
	move_child(outline, 0)

	# Canopy over forward fuselage
	canopy = MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = 0.48
	sph.height = 0.72
	sph.radial_segments = 8
	sph.rings = 4
	canopy.mesh = sph
	var cm := StandardMaterial3D.new()
	cm.albedo_color = C_CANOPY
	cm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	cm.roughness = 0.12
	cm.metallic = 0.35
	canopy.material_override = cm
	canopy.position = Vector3(0, 0.52, -1.55)
	canopy.scale = Vector3(0.9, 0.65, 1.45)
	add_child(canopy)

	# São Paulo flag — both sides, behind canopy (ref)
	_add_sp_flag(Vector3(-0.72, 0.18, -0.55), true)
	_add_sp_flag(Vector3(0.72, 0.18, -0.55), false)

	nozzle_l = _make_nozzle(Vector3(-0.62, -0.08, 3.75))
	nozzle_r = _make_nozzle(Vector3(0.62, -0.08, 3.75))

	# Wingtip vapor (diamond wing tips)
	trail_l = _make_wing_vapor(Vector3(-4.55, 0.05, 0.35))
	trail_r = _make_wing_vapor(Vector3(4.55, 0.05, 0.35))
	# Engine contrails (aft nozzles, +Z)
	contrail_l = _make_contrail(Vector3(-0.62, -0.08, 3.95))
	contrail_r = _make_contrail(Vector3(0.62, -0.08, 3.95))
	plume_l = _make_plume(Vector3(-0.62, -0.08, 3.85))
	plume_r = _make_plume(Vector3(0.62, -0.08, 3.85))
	spray = _make_spray()
	wake = _make_wake()
	_make_shadow()


func _add_sp_flag(pos: Vector3, left_side: bool) -> void:
	var mi := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = Vector2(0.62, 0.38)
	mi.mesh = quad
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = _sp_flag_texture()
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = mat
	mi.position = pos
	# Quad faces +Z by default; rotate to face outward (±X)
	mi.rotation.y = -PI * 0.5 if left_side else PI * 0.5
	add_child(mi)


func _sp_flag_texture() -> ImageTexture:
	# 26x13 px — 13 stripes, red canton with Brazil disc
	const W := 26
	const H := 13
	var img := Image.create(W, H, false, Image.FORMAT_RGBA8)
	var black := Color(0.05, 0.05, 0.05)
	var white := Color(0.95, 0.95, 0.95)
	var red := Color(0.85, 0.12, 0.12)
	var blue := Color(0.12, 0.22, 0.65)
	for y in H:
		var stripe: Color = black if (y % 2 == 0) else white
		for x in W:
			img.set_pixel(x, y, stripe)
	# Canton: 8x7 top-left (hoist)
	const CW := 8
	const CH := 7
	for y in CH:
		for x in CW:
			img.set_pixel(x, y, red)
	# White disc + blue Brazil blob
	var cx := 3.5
	var cy := 3.0
	for y in CH:
		for x in CW:
			var dx: float = float(x) + 0.5 - cx
			var dy: float = float(y) + 0.5 - cy
			if dx * dx + dy * dy <= 2.6 * 2.6:
				img.set_pixel(x, y, white)
			if dx * dx + dy * dy <= 1.7 * 1.7:
				# crude Brazil silhouette — taller south
				var in_br: bool = absf(dx) < 1.1 and dy > -1.3 and dy < 1.4
				if absf(dx) > 0.55 and dy < -0.2:
					in_br = false
				if in_br:
					img.set_pixel(x, y, blue)
	# Four tiny yellow stars as single yellow pixels
	var yellow := Color(0.95, 0.85, 0.2)
	img.set_pixel(3, 2, yellow)
	img.set_pixel(4, 3, yellow)
	img.set_pixel(2, 3, yellow)
	img.set_pixel(3, 4, yellow)
	return ImageTexture.create_from_image(img)


func _diamond_wing(st: SurfaceTool, left: bool) -> void:
	var s: float = -1.0 if left else 1.0
	var y: float = -0.02
	# Tip mid, root forward(-Z)/aft(+Z)
	var root_le := Vector3(s * 0.7, y, -1.35)
	var root_te := Vector3(s * 0.7, y, 1.55)
	var tip_le := Vector3(s * 4.4, y, -0.35)
	var tip_te := Vector3(s * 4.4, y, 0.85)
	var root_le_t := root_le + Vector3(0, 0.11, 0)
	var root_te_t := root_te + Vector3(0, 0.11, 0)
	var tip_le_t := tip_le + Vector3(0, 0.11, 0)
	var tip_te_t := tip_te + Vector3(0, 0.11, 0)
	_tri(st, root_le_t, tip_te_t, tip_le_t, C_LIGHT)
	_tri(st, root_le_t, root_te_t, tip_te_t, C_LIGHT)
	_tri(st, root_le, tip_le, tip_te, C_MID)
	_tri(st, root_le, tip_te, root_te, C_MID)
	_tri(st, root_le, tip_le_t, tip_le, C_DARK)
	_tri(st, root_le, root_le_t, tip_le_t, C_DARK)
	_tri(st, root_te, tip_te, tip_te_t, C_DARK)
	_tri(st, root_te, tip_te_t, root_te_t, C_DARK)
	_tri(st, tip_le, tip_te_t, tip_te, C_DARK)
	_tri(st, tip_le, tip_le_t, tip_te_t, C_DARK)


func _stab(st: SurfaceTool, left: bool) -> void:
	var s: float = -1.0 if left else 1.0
	var y: float = 0.05
	var root_le := Vector3(s * 0.55, y, 2.35)
	var root_te := Vector3(s * 0.55, y, 3.55)
	var tip_le := Vector3(s * 2.35, y, 2.85)
	var tip_te := Vector3(s * 2.35, y, 3.65)
	var up := Vector3(0, 0.09, 0)
	_tri(st, root_le + up, tip_te + up, tip_le + up, C_LIGHT)
	_tri(st, root_le + up, root_te + up, tip_te + up, C_LIGHT)
	_tri(st, root_le, tip_le, tip_te, C_MID)
	_tri(st, root_le, tip_te, root_te, C_MID)


func _box(st: SurfaceTool, center: Vector3, size: Vector3, color: Color, yaw: float = 0.0) -> void:
	var hx := size.x * 0.5
	var hy := size.y * 0.5
	var hz := size.z * 0.5
	var corners: Array[Vector3] = [
		Vector3(-hx, -hy, -hz), Vector3(hx, -hy, -hz), Vector3(hx, hy, -hz), Vector3(-hx, hy, -hz),
		Vector3(-hx, -hy, hz), Vector3(hx, -hy, hz), Vector3(hx, hy, hz), Vector3(-hx, hy, hz),
	]
	var b := Basis.from_euler(Vector3(0, yaw, 0))
	var v: Array[Vector3] = []
	for c in corners:
		v.append(center + b * c)
	var faces := [
		[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]
	]
	for f in faces:
		_tri(st, v[f[0]], v[f[1]], v[f[2]], color)
		_tri(st, v[f[0]], v[f[2]], v[f[3]], color)


func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, color: Color) -> void:
	var n: Vector3 = (b - a).cross(c - a).normalized()
	if n.length_squared() < 0.0001:
		return
	st.set_normal(n)
	st.set_color(color)
	st.add_vertex(a)
	st.set_normal(n)
	st.set_color(color)
	st.add_vertex(b)
	st.set_normal(n)
	st.set_color(color)
	st.add_vertex(c)


func _make_nozzle(pos: Vector3) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var m := BoxMesh.new()
	m.size = Vector3(0.55, 0.22, 0.15)
	mi.mesh = m
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.45, 0.12)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.35, 0.05)
	mat.emission_energy_multiplier = 2.8
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mi.material_override = mat
	mi.position = pos
	add_child(mi)
	return mi


func _make_wing_vapor(pos: Vector3) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.position = pos
	p.amount = 64
	p.lifetime = 1.8
	p.visibility_aabb = AABB(Vector3(-30, -30, -30), Vector3(60, 60, 60))
	p.local_coords = true
	var mat := ParticleProcessMaterial.new()
	mat.direction = Vector3(0, 0, 1)
	mat.spread = 3.0
	mat.initial_velocity_min = 1.5
	mat.initial_velocity_max = 3.5
	mat.gravity = Vector3.ZERO
	mat.damping_min = 0.4
	mat.damping_max = 0.8
	mat.scale_min = 0.04
	mat.scale_max = 0.16
	mat.color = Color(0.92, 0.96, 1.0, 0.35)
	p.process_material = mat
	var dm := SphereMesh.new()
	dm.radius = 0.1
	dm.height = 0.2
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(0.95, 0.98, 1.0, 0.38)
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dm.material = sm
	p.draw_pass_1 = dm
	p.emitting = false
	add_child(p)
	return p


func _make_contrail(pos: Vector3) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.position = pos
	p.amount = 96
	p.lifetime = 4.5
	p.visibility_aabb = AABB(Vector3(-40, -40, -10), Vector3(80, 80, 120))
	p.local_coords = true
	var mat := ParticleProcessMaterial.new()
	mat.direction = Vector3(0, 0, 1)
	mat.spread = 1.2
	mat.initial_velocity_min = 0.8
	mat.initial_velocity_max = 2.2
	mat.gravity = Vector3.ZERO
	mat.damping_min = 0.15
	mat.damping_max = 0.35
	mat.scale_min = 0.08
	mat.scale_max = 0.45
	mat.color = Color(1.0, 1.0, 1.0, 0.55)
	p.process_material = mat
	var dm := SphereMesh.new()
	dm.radius = 0.18
	dm.height = 0.36
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(1.0, 1.0, 1.0, 0.5)
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dm.material = sm
	p.draw_pass_1 = dm
	p.emitting = false
	add_child(p)
	return p


func _make_plume(pos: Vector3) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.position = pos
	p.amount = 48
	p.lifetime = 0.42
	p.emitting = false
	p.visibility_aabb = AABB(Vector3(-12, -12, -4), Vector3(24, 24, 40))
	var mat := ParticleProcessMaterial.new()
	mat.direction = Vector3(0, 0, 1)
	mat.spread = 7.0
	mat.initial_velocity_min = 22.0
	mat.initial_velocity_max = 36.0
	mat.gravity = Vector3.ZERO
	mat.scale_min = 0.14
	mat.scale_max = 0.48
	mat.color = Color(1.0, 0.7, 0.25, 0.92)
	p.process_material = mat
	var dm := BoxMesh.new()
	dm.size = Vector3(0.4, 0.2, 0.5)
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(1.0, 0.85, 0.4)
	sm.emission_enabled = true
	sm.emission = Color(1.0, 0.5, 0.1)
	sm.emission_energy_multiplier = 3.5
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	dm.material = sm
	p.draw_pass_1 = dm
	add_child(p)
	return p


func update_vapor(altitude: float, airspeed: float, g_force: float, ab: bool) -> void:
	# Wingtip vapor: load + speed; stronger high up.
	var alt_n: float = smoothstep(600.0, 3200.0, altitude)
	var spd_n: float = clampf((airspeed - 90.0) / 160.0, 0.0, 1.2)
	var g_n: float = clampf((g_force - 1.15) / 2.5, 0.0, 1.0)
	var wing: float = clampf(g_n * 0.85 + spd_n * 0.25 * alt_n + (0.35 if ab else 0.0) * alt_n, 0.0, 1.0)
	_set_vapor_pair(trail_l, trail_r, wing > 0.08, wing, 0.9, 2.4, Color(0.92, 0.96, 1.0, lerpf(0.15, 0.55, wing)))

	# Engine contrails: cold altitude band, denser with AB.
	var band: float = smoothstep(1400.0, 2200.0, altitude) * (1.0 - smoothstep(9000.0, 11000.0, altitude))
	var trail: float = clampf(band * (0.45 + spd_n * 0.4) + (0.55 if ab else 0.0) * maxf(band, 0.25), 0.0, 1.0)
	_set_vapor_pair(contrail_l, contrail_r, trail > 0.06, trail, lerpf(2.2, 6.5, trail), lerpf(0.12, 0.7, trail), Color(1, 1, 1, lerpf(0.2, 0.7, trail)))


func _set_vapor_pair(a: GPUParticles3D, b: GPUParticles3D, on: bool, strength: float, life: float, scale_max: float, col: Color) -> void:
	for p in [a, b]:
		if p == null:
			continue
		p.emitting = on
		if not on:
			continue
		p.lifetime = life
		p.amount_ratio = clampf(0.25 + strength * 0.75, 0.2, 1.0)
		var mat := p.process_material as ParticleProcessMaterial
		if mat:
			mat.scale_min = scale_max * 0.25
			mat.scale_max = scale_max
			mat.color = col
			mat.initial_velocity_min = lerpf(0.6, 2.5, strength)
			mat.initial_velocity_max = lerpf(1.5, 5.0, strength)


func _make_spray() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.position = Vector3(0, -0.5, 0)
	p.amount = 40
	p.lifetime = 0.6
	p.emitting = false
	var mat := ParticleProcessMaterial.new()
	mat.direction = Vector3(0, 1, 0.2)
	mat.spread = 40.0
	mat.initial_velocity_min = 4.0
	mat.initial_velocity_max = 10.0
	mat.gravity = Vector3(0, -12, 0)
	mat.scale_min = 0.08
	mat.scale_max = 0.2
	mat.color = Color(0.85, 0.92, 0.95, 0.7)
	p.process_material = mat
	var dm := SphereMesh.new()
	dm.radius = 0.1
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(0.9, 0.95, 1.0, 0.6)
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dm.material = sm
	p.draw_pass_1 = dm
	add_child(p)
	return p


func _make_wake() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.position = Vector3(0, -0.4, 2)
	p.amount = 24
	p.lifetime = 1.5
	p.emitting = false
	var mat := ParticleProcessMaterial.new()
	mat.direction = Vector3(0, 0.1, 1)
	mat.spread = 15.0
	mat.initial_velocity_min = 1.0
	mat.initial_velocity_max = 3.0
	mat.gravity = Vector3.ZERO
	mat.scale_min = 0.3
	mat.scale_max = 0.8
	mat.color = Color(0.95, 0.97, 1.0, 0.5)
	p.process_material = mat
	var dm := SphereMesh.new()
	dm.radius = 0.25
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(1, 1, 1, 0.45)
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dm.material = sm
	p.draw_pass_1 = dm
	add_child(p)
	return p


func _make_shadow() -> void:
	shadow = MeshInstance3D.new()
	var disc := CylinderMesh.new()
	disc.top_radius = 2.8
	disc.bottom_radius = 4.2
	disc.height = 0.15
	disc.radial_segments = 8
	shadow.mesh = disc
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(0.15, 0.1, 0.22, 0.4)
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	shadow.material_override = sm
	add_child(shadow)
	shadow.top_level = true


func set_afterburner(on: bool) -> void:
	plume_l.emitting = on
	plume_r.emitting = on
	if on:
		plume_l.amount_ratio = 1.0
		plume_r.amount_ratio = 1.0
		var pm := plume_l.process_material as ParticleProcessMaterial
		if pm:
			pm.initial_velocity_min = 28.0
			pm.initial_velocity_max = 44.0
			pm.scale_max = 0.55
	var e: float = 6.5 if on else 2.2
	(nozzle_l.material_override as StandardMaterial3D).emission_energy_multiplier = e
	(nozzle_r.material_override as StandardMaterial3D).emission_energy_multiplier = e


func set_water_skim(on: bool) -> void:
	spray.emitting = on
	wake.emitting = on
