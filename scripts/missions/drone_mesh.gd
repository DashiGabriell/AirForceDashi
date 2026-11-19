extends Node3D
class_name DroneMesh
## Procedural 3D drones matching Geran-2 / Orlan-10 / Lancet silhouettes.
## Nose toward local -Z. Spinning prop + outline for pixel-look readability.


const KIND_GERAN := 0
const KIND_ORLAN := 1
const KIND_LANCET := 2

const C_GERAN := Color(0.72, 0.74, 0.76)
const C_GERAN_D := Color(0.48, 0.50, 0.52)
const C_GERAN_L := Color(0.86, 0.87, 0.88)
const C_ORLAN := Color(0.62, 0.66, 0.70)
const C_ORLAN_D := Color(0.40, 0.44, 0.48)
const C_ORLAN_W := Color(0.78, 0.80, 0.82)
const C_LANCET := Color(0.38, 0.44, 0.28) ## olive body
const C_LANCET_D := Color(0.22, 0.26, 0.16) ## dark camo
const C_LANCET_L := Color(0.52, 0.58, 0.38) ## light olive
const C_LANCET_NOSE := Color(0.62, 0.64, 0.66) ## metallic grey nose
const C_LANCET_LENS := Color(0.08, 0.09, 0.1)
const C_PROP := Color(0.18, 0.18, 0.2)
const C_STAR := Color(0.82, 0.12, 0.14)

var kind: int = KIND_GERAN
var _prop: Node3D
var _smoke_dmg: GPUParticles3D
var damaged: bool = false


func setup(k: int) -> void:
	kind = k
	_clear()
	match kind:
		KIND_ORLAN:
			_build_orlan()
		KIND_LANCET:
			_build_lancet()
		_:
			_build_geran()
	_prop = _make_prop()
	add_child(_prop)
	set_process(true)


func set_damaged(on: bool) -> void:
	damaged = on
	if on and _smoke_dmg == null:
		_smoke_dmg = _make_damage_smoke()
		add_child(_smoke_dmg)
	elif _smoke_dmg:
		_smoke_dmg.emitting = on


func _process(dt: float) -> void:
	if _prop:
		var spin: float = 28.0 if kind != KIND_LANCET else 36.0
		_prop.rotate_z(spin * dt)


func _clear() -> void:
	for c in get_children():
		c.queue_free()
	_prop = null
	_smoke_dmg = null


func _build_geran() -> void:
	## Delta-wing suicide UAV, pusher prop, tip fins — Geran-2 / Shahed-136.
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_box(st, Vector3(0, 0.0, -0.2), Vector3(0.55, 0.48, 3.6), C_GERAN)
	_box(st, Vector3(0, 0.02, -1.85), Vector3(0.38, 0.36, 0.9), C_GERAN_L)
	_box(st, Vector3(0, 0.0, -2.35), Vector3(0.22, 0.22, 0.35), C_GERAN_D) # nose tip
	# Delta wing
	_delta_wing(st, C_GERAN_L, C_GERAN_D, 2.85, 1.55)
	# Wingtip verticals
	_box(st, Vector3(-2.7, 0.35, 0.95), Vector3(0.08, 0.7, 0.55), C_GERAN_D)
	_box(st, Vector3(2.7, 0.35, 0.95), Vector3(0.08, 0.7, 0.55), C_GERAN_D)
	# Engine pod aft
	_box(st, Vector3(0, 0.05, 1.55), Vector3(0.42, 0.42, 0.7), C_GERAN_D)
	_box(st, Vector3(0, -0.05, 0.4), Vector3(0.35, 0.2, 1.2), C_GERAN_D) # belly
	# Panel lines
	_box(st, Vector3(0, 0.22, -0.4), Vector3(0.5, 0.06, 1.6), C_GERAN_L)
	_commit_body(st)
	_add_mark(Vector3(0, 0.26, 0.2), Vector2(0.9, 0.22), "ГЕРАНЬ-2")


func _build_orlan() -> void:
	## High-wing recon: long boom, V-tail, nose prop, optical pod.
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_box(st, Vector3(0, 0.05, -0.15), Vector3(0.38, 0.34, 2.4), C_ORLAN)
	_box(st, Vector3(0, 0.05, -1.35), Vector3(0.32, 0.3, 0.55), C_ORLAN_W) # nose
	# High wing
	_box(st, Vector3(0, 0.28, -0.15), Vector3(3.4, 0.08, 0.55), C_ORLAN_W)
	_box(st, Vector3(-1.5, 0.28, -0.15), Vector3(0.35, 0.06, 0.48), C_ORLAN_D)
	_box(st, Vector3(1.5, 0.28, -0.15), Vector3(0.35, 0.06, 0.48), C_ORLAN_D)
	# Boom + V-tail
	_box(st, Vector3(0, 0.08, 1.35), Vector3(0.12, 0.12, 1.5), C_ORLAN_D)
	_box(st, Vector3(-0.35, 0.35, 2.0), Vector3(0.08, 0.55, 0.4), C_ORLAN_W, 0.45)
	_box(st, Vector3(0.35, 0.35, 2.0), Vector3(0.08, 0.55, 0.4), C_ORLAN_W, -0.45)
	# Optical pod
	_box(st, Vector3(0, -0.22, -0.5), Vector3(0.22, 0.2, 0.28), C_ORLAN_D)
	_box(st, Vector3(0, -0.28, -0.5), Vector3(0.14, 0.1, 0.14), Color(0.15, 0.2, 0.35))
	_commit_body(st)
	# Red star wing marks
	_add_star(Vector3(-1.2, 0.34, -0.15))
	_add_star(Vector3(1.2, 0.34, -0.15))


func _build_lancet() -> void:
	## Lancet loitering munition — dual X-wing stations, olive camo, grey seeker nose.
	## Matches the provided sprite sheet silhouette.
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# Slender tubular fuselage
	_box(st, Vector3(0, 0.0, 0.05), Vector3(0.28, 0.26, 2.05), C_LANCET)
	_box(st, Vector3(0, 0.0, -0.55), Vector3(0.26, 0.24, 0.7), C_LANCET_L)
	# Camo panel breaks
	_box(st, Vector3(0, 0.12, 0.15), Vector3(0.22, 0.04, 0.9), C_LANCET_D)
	_box(st, Vector3(0.1, -0.05, 0.4), Vector3(0.08, 0.14, 0.55), C_LANCET_D)
	_box(st, Vector3(-0.1, 0.02, -0.2), Vector3(0.08, 0.12, 0.4), C_LANCET_L)
	# Metallic seeker nose + dark lens
	_box(st, Vector3(0, 0.0, -1.15), Vector3(0.24, 0.22, 0.38), C_LANCET_NOSE)
	_box(st, Vector3(0, 0.0, -1.38), Vector3(0.16, 0.16, 0.14), C_LANCET_NOSE)
	_box(st, Vector3(0, 0.0, -1.48), Vector3(0.1, 0.1, 0.08), C_LANCET_LENS)
	# Dual X-wing stations (forward + aft) — 45° cruciform
	_lancet_x_station(st, -0.55, 0.95) # forward pair
	_lancet_x_station(st, 0.55, 1.05) # aft pair
	# Aft motor ring
	_box(st, Vector3(0, 0.0, 1.05), Vector3(0.3, 0.3, 0.32), C_LANCET_D)
	_box(st, Vector3(0, 0.0, 1.22), Vector3(0.22, 0.22, 0.12), C_LANCET_NOSE)
	_commit_body(st)


func _lancet_x_station(st: SurfaceTool, z: float, span: float) -> void:
	## Four blades at 45°/135° around fuselage (true X / cruciform).
	var half: float = span * 0.5
	var thick := Vector3(span, 0.055, 0.22)
	var tip := Vector3(0.28, 0.045, 0.16)
	# Angles around local Z (roll): ±45°, ±135°
	for a in [PI * 0.25, PI * 0.75, PI * 1.25, PI * 1.75]:
		var dir := Vector3(cos(a), sin(a), 0.0)
		var center: Vector3 = dir * (half * 0.55) + Vector3(0, 0, z)
		_box_euler(st, center, thick, C_LANCET_L, 0.0, 0.0, a)
		# Dark tip / joint
		var tip_c: Vector3 = dir * (half * 0.95) + Vector3(0, 0, z)
		_box_euler(st, tip_c, tip, C_LANCET_D, 0.0, 0.0, a)
		# Small grey hinge near root
		var root_c: Vector3 = dir * 0.18 + Vector3(0, 0, z)
		_box_euler(st, root_c, Vector3(0.2, 0.07, 0.14), C_LANCET_NOSE, 0.0, 0.0, a)


func _delta_wing(st: SurfaceTool, top: Color, bot: Color, span: float, root_z: float) -> void:
	var y: float = 0.02
	var root_le := Vector3(0.2, y, -1.2)
	var root_te := Vector3(0.2, y, root_z)
	var tip_le := Vector3(span, y, 0.55)
	var tip_te := Vector3(span, y, 1.15)
	for s in [-1.0, 1.0]:
		var rl := Vector3(s * root_le.x, y, root_le.z)
		var rt := Vector3(s * root_te.x, y, root_te.z)
		var tl := Vector3(s * tip_le.x, y, tip_le.z)
		var tt := Vector3(s * tip_te.x, y, tip_te.z)
		var th := 0.07
		_tri(st, rl + Vector3(0, th, 0), tl + Vector3(0, th, 0), tt + Vector3(0, th, 0), top)
		_tri(st, rl + Vector3(0, th, 0), tt + Vector3(0, th, 0), rt + Vector3(0, th, 0), top)
		_tri(st, rl, tt, tl, bot)
		_tri(st, rl, rt, tt, bot)


func _make_prop() -> Node3D:
	var root := Node3D.new()
	root.name = "Prop"
	root.position = Vector3(0, 0.05, 1.95) if kind == KIND_GERAN else (
		Vector3(0, 0.0, 1.32) if kind == KIND_LANCET else Vector3(0, 0.05, -1.65)
	)
	var blade_len: float = 0.55 if kind == KIND_GERAN else (0.42 if kind == KIND_ORLAN else 0.36)
	for i in 2:
		var mi := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(blade_len * 2.0, 0.04, 0.1)
		mi.mesh = box
		var mat := StandardMaterial3D.new()
		mat.albedo_color = C_PROP
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mi.material_override = mat
		mi.rotation.z = float(i) * PI * 0.5
		root.add_child(mi)
	# Motion disc (Lancet sheet uses a cool pale blur)
	var disc := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = blade_len
	cyl.bottom_radius = blade_len
	cyl.height = 0.02
	cyl.radial_segments = 12
	disc.mesh = cyl
	var dm := StandardMaterial3D.new()
	if kind == KIND_LANCET:
		dm.albedo_color = Color(0.72, 0.82, 0.88, 0.28)
	else:
		dm.albedo_color = Color(0.7, 0.72, 0.75, 0.22)
	dm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	dm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	disc.material_override = dm
	disc.rotation.x = PI * 0.5
	root.add_child(disc)
	return root


func _commit_body(st: SurfaceTool) -> void:
	st.generate_normals()
	var body := MeshInstance3D.new()
	body.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	body.material_override = mat
	add_child(body)
	var outline := body.duplicate()
	var om := StandardMaterial3D.new()
	om.albedo_color = Color(0.06, 0.06, 0.08)
	om.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	om.cull_mode = BaseMaterial3D.CULL_FRONT
	om.grow = true
	om.grow_amount = 0.035
	outline.material_override = om
	add_child(outline)
	move_child(outline, 0)


func _add_mark(pos: Vector3, size: Vector2, _text: String) -> void:
	var mi := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = size
	mi.mesh = quad
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.12, 0.12, 0.14, 0.85)
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mi.material_override = mat
	mi.position = pos
	mi.rotation.x = -PI * 0.5
	add_child(mi)


func _add_star(pos: Vector3) -> void:
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.22, 0.02, 0.22)
	mi.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = C_STAR
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mi.material_override = mat
	mi.position = pos
	add_child(mi)


func _make_damage_smoke() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = 24
	p.lifetime = 1.2
	p.emitting = true
	p.position = Vector3(0, 0.1, 0.6)
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0.4)
	pm.spread = 25.0
	pm.initial_velocity_min = 1.5
	pm.initial_velocity_max = 4.0
	pm.gravity = Vector3(0, 1.5, 0)
	pm.scale_min = 0.2
	pm.scale_max = 0.7
	var grad := Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.4, 1.0])
	grad.colors = PackedColorArray([
		Color(0.25, 0.22, 0.2, 0.7),
		Color(0.2, 0.2, 0.22, 0.4),
		Color(0.15, 0.15, 0.16, 0.0),
	])
	var gt := GradientTexture1D.new()
	gt.gradient = grad
	pm.color_ramp = gt
	p.process_material = pm
	var dm := SphereMesh.new()
	dm.radius = 0.2
	var sm := StandardMaterial3D.new()
	sm.vertex_color_use_as_albedo = true
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	dm.material = sm
	p.draw_pass_1 = dm
	return p


func _box(st: SurfaceTool, center: Vector3, size: Vector3, color: Color, yaw: float = 0.0) -> void:
	_box_euler(st, center, size, color, 0.0, yaw, 0.0)


func _box_euler(st: SurfaceTool, center: Vector3, size: Vector3, color: Color, pitch: float = 0.0, yaw: float = 0.0, roll: float = 0.0) -> void:
	var hx := size.x * 0.5
	var hy := size.y * 0.5
	var hz := size.z * 0.5
	var corners: Array[Vector3] = [
		Vector3(-hx, -hy, -hz), Vector3(hx, -hy, -hz), Vector3(hx, hy, -hz), Vector3(-hx, hy, -hz),
		Vector3(-hx, -hy, hz), Vector3(hx, -hy, hz), Vector3(hx, hy, hz), Vector3(-hx, hy, hz),
	]
	var b := Basis.from_euler(Vector3(pitch, yaw, roll))
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
