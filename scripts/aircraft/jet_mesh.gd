extends Node3D
class_name JetMesh
## Procedural fighter mesh (F-22 / F-15). Nose = local -Z.
## Flat vertex colors + inverted outline for a pixel-jet read.

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
var kind: int = 0

# Light grey airframe (ref prints)
const C_DARK := Color(0.42, 0.44, 0.46)
const C_MID := Color(0.72, 0.74, 0.76)
const C_LIGHT := Color(0.88, 0.90, 0.92)
const C_RADOME := Color(0.55, 0.57, 0.59)
const C_CANOPY := Color(0.35, 0.42, 0.48, 0.72)
const C_INTAKE := Color(0.18, 0.18, 0.2)
const C_NOZZLE := Color(0.28, 0.28, 0.3)
const C_STRIPE_RED := Color(0.82, 0.12, 0.14)
const C_STRIPE_WHITE := Color(0.96, 0.96, 0.97)
const C_STRIPE_BLACK := Color(0.08, 0.08, 0.09)
const C_MISSILE := Color(0.9, 0.91, 0.93)
const C_TANK := Color(0.62, 0.64, 0.66)


func _ready() -> void:
	apply_aircraft(Game.aircraft)


func apply_aircraft(aircraft_kind: int) -> void:
	kind = clampi(aircraft_kind, 0, 1)
	_clear_visuals()
	if kind == Game.Aircraft.F15_EAGLE:
		_build_f15()
	else:
		_build_f22()


func _clear_visuals() -> void:
	while get_child_count() > 0:
		var c: Node = get_child(0)
		remove_child(c)
		c.free()
	body = null
	outline = null
	canopy = null
	nozzle_l = null
	nozzle_r = null
	trail_l = null
	trail_r = null
	contrail_l = null
	contrail_r = null
	plume_l = null
	plume_r = null
	spray = null
	wake = null
	shadow = null


func _finish_airframe(st: SurfaceTool) -> void:
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


func _make_canopy(pos: Vector3, scale_v: Vector3, radius: float = 0.48, height: float = 0.72, tint: Color = C_CANOPY) -> void:
	canopy = MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = radius
	sph.height = height
	sph.radial_segments = 8
	sph.rings = 4
	canopy.mesh = sph
	var cm := StandardMaterial3D.new()
	cm.albedo_color = tint
	cm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	cm.roughness = 0.12
	cm.metallic = 0.35
	canopy.material_override = cm
	canopy.position = pos
	canopy.scale = scale_v
	add_child(canopy)


func _make_canopy_f22(pos: Vector3, scale_v: Vector3) -> void:
	## Sheet canopy reads amber / gold over dark glass.
	_make_canopy(pos, scale_v, 0.5, 0.74, Color(0.55, 0.48, 0.28, 0.78))


func _build_f22() -> void:
	## F-22 Raptor — São Paulo sheet: cool grey stealth planform,
	## diamond wings, canted tails, amber canopy, SP roundels.
	var c_dark := Color(0.38, 0.42, 0.46)
	var c_mid := Color(0.68, 0.74, 0.78)
	var c_light := Color(0.82, 0.88, 0.92)
	var c_panel := Color(0.58, 0.64, 0.68)
	var c_radome := Color(0.52, 0.56, 0.60)
	var c_intake := Color(0.14, 0.16, 0.18)
	var c_nozzle := Color(0.22, 0.24, 0.26)
	var c_edge := Color(0.30, 0.34, 0.38)

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	# Blended stealth fuselage (wider mid-body, tapering nose)
	_box(st, Vector3(0, 0.04, -0.25), Vector3(1.48, 0.72, 5.6), c_mid)
	_box(st, Vector3(0, 0.02, -2.55), Vector3(1.18, 0.58, 2.0), c_light)
	_box(st, Vector3(0, -0.08, -0.15), Vector3(1.62, 0.32, 4.4), c_dark)
	# Needle nose + radome
	_box(st, Vector3(0, 0.06, -3.65), Vector3(0.78, 0.44, 1.45), c_light)
	_box(st, Vector3(0, 0.05, -4.45), Vector3(0.42, 0.30, 0.58), c_radome)
	_box(st, Vector3(0, 0.04, -4.85), Vector3(0.22, 0.18, 0.32), c_radome)
	# Sharp chines (sheet TOP silhouette)
	_box(st, Vector3(-0.92, -0.02, -1.35), Vector3(0.42, 0.18, 4.0), c_light)
	_box(st, Vector3(0.92, -0.02, -1.35), Vector3(0.42, 0.18, 4.0), c_light)
	_box(st, Vector3(-1.05, -0.04, -2.4), Vector3(0.22, 0.14, 1.6), c_panel)
	_box(st, Vector3(1.05, -0.04, -2.4), Vector3(0.22, 0.14, 1.6), c_panel)
	# Dorsal spine / weapons-bay door lines
	_box(st, Vector3(0, 0.38, -0.55), Vector3(0.62, 0.14, 3.6), c_light)
	_box(st, Vector3(0, 0.34, 1.35), Vector3(0.78, 0.12, 2.1), c_panel)
	_box(st, Vector3(-0.28, 0.36, -0.2), Vector3(0.08, 0.08, 2.8), c_edge)
	_box(st, Vector3(0.28, 0.36, -0.2), Vector3(0.08, 0.08, 2.8), c_edge)

	_diamond_wing(st, true)
	_diamond_wing(st, false)
	# Leading-edge / sawtooth panel accents on wings
	_box(st, Vector3(-2.4, 0.1, -0.55), Vector3(1.6, 0.05, 0.18), c_edge)
	_box(st, Vector3(2.4, 0.1, -0.55), Vector3(1.6, 0.05, 0.18), c_edge)
	_box(st, Vector3(-3.2, 0.1, 0.55), Vector3(1.2, 0.05, 0.14), c_panel)
	_box(st, Vector3(3.2, 0.1, 0.55), Vector3(1.2, 0.05, 0.14), c_panel)

	# Twin buried engines
	_box(st, Vector3(-0.58, -0.14, 1.95), Vector3(0.92, 0.55, 2.9), c_dark)
	_box(st, Vector3(0.58, -0.14, 1.95), Vector3(0.92, 0.55, 2.9), c_dark)
	_box(st, Vector3(-0.58, -0.02, 1.15), Vector3(0.78, 0.36, 1.35), c_mid)
	_box(st, Vector3(0.58, -0.02, 1.15), Vector3(0.78, 0.36, 1.35), c_mid)
	# Diverterless side intakes (blended, sheet FRONT/SIDE)
	_box(st, Vector3(-1.02, -0.06, -0.55), Vector3(0.58, 0.44, 1.85), c_intake)
	_box(st, Vector3(1.02, -0.06, -0.55), Vector3(0.58, 0.44, 1.85), c_intake)
	_box(st, Vector3(-1.18, -0.06, -1.35), Vector3(0.22, 0.40, 0.48), c_edge)
	_box(st, Vector3(1.18, -0.06, -1.35), Vector3(0.22, 0.40, 0.48), c_edge)
	_box(st, Vector3(-1.12, 0.12, -0.4), Vector3(0.16, 0.10, 1.4), c_light)
	_box(st, Vector3(1.12, 0.12, -0.4), Vector3(0.16, 0.10, 1.4), c_light)

	_stab(st, true)
	_stab(st, false)

	# Strongly canted twin tails (Raptor)
	var cant := 0.52
	_box(st, Vector3(-0.88, 0.92, 2.55), Vector3(0.1, 1.72, 1.7), c_mid, cant)
	_box(st, Vector3(0.88, 0.92, 2.55), Vector3(0.1, 1.72, 1.7), c_mid, -cant)
	_box(st, Vector3(-0.88, 1.05, 1.92), Vector3(0.12, 1.45, 0.34), c_dark, cant)
	_box(st, Vector3(0.88, 1.05, 1.92), Vector3(0.12, 1.45, 0.34), c_dark, -cant)
	_box(st, Vector3(-0.88, 1.55, 2.85), Vector3(0.08, 0.35, 0.85), c_panel, cant)
	_box(st, Vector3(0.88, 1.55, 2.85), Vector3(0.08, 0.35, 0.85), c_panel, -cant)

	# Rectangular thrust-vectoring nozzles (sheet REAR/BOOST)
	_box(st, Vector3(-0.58, -0.08, 3.48), Vector3(0.86, 0.40, 0.58), c_nozzle)
	_box(st, Vector3(0.58, -0.08, 3.48), Vector3(0.86, 0.40, 0.58), c_nozzle)
	_box(st, Vector3(-0.58, 0.14, 3.72), Vector3(0.90, 0.08, 0.22), c_edge)
	_box(st, Vector3(0.58, 0.14, 3.72), Vector3(0.90, 0.08, 0.22), c_edge)
	_box(st, Vector3(-0.58, -0.30, 3.72), Vector3(0.90, 0.08, 0.22), c_edge)
	_box(st, Vector3(0.58, -0.30, 3.72), Vector3(0.90, 0.08, 0.22), c_edge)
	# Serrated nozzle petals
	_box(st, Vector3(-0.58, -0.08, 3.88), Vector3(0.78, 0.06, 0.12), c_dark)
	_box(st, Vector3(0.58, -0.08, 3.88), Vector3(0.78, 0.06, 0.12), c_dark)
	_box(st, Vector3(-0.78, -0.08, 3.82), Vector3(0.12, 0.28, 0.14), c_dark)
	_box(st, Vector3(0.78, -0.08, 3.82), Vector3(0.12, 0.28, 0.14), c_dark)
	_box(st, Vector3(-0.38, -0.08, 3.82), Vector3(0.12, 0.28, 0.14), c_dark)
	_box(st, Vector3(0.38, -0.08, 3.82), Vector3(0.12, 0.28, 0.14), c_dark)

	# Stealth panel breaks (sheet TOP)
	_box(st, Vector3(-0.45, 0.30, -1.1), Vector3(0.48, 0.08, 1.7), c_light)
	_box(st, Vector3(0.45, 0.28, 0.2), Vector3(0.42, 0.08, 1.5), c_panel)
	_box(st, Vector3(0, -0.22, -1.8), Vector3(0.85, 0.08, 1.2), c_edge)

	_finish_airframe(st)
	# Amber / gold canopy like the São Paulo sheet
	_make_canopy_f22(Vector3(0, 0.50, -1.72), Vector3(0.88, 0.62, 1.55))
	# SP markings — fuselage sides + wing tops + canted fins
	_add_sp_flag(Vector3(-0.78, 0.16, -0.35), true)
	_add_sp_flag(Vector3(0.78, 0.16, -0.35), false)
	_add_sp_roundel(Vector3(-2.55, 0.14, 0.15), 0.72)
	_add_sp_roundel(Vector3(2.55, 0.14, 0.15), 0.72)
	_add_sp_fin_mark(Vector3(-1.05, 1.25, 2.55), true, cant)
	_add_sp_fin_mark(Vector3(1.05, 1.25, 2.55), false, -cant)

	nozzle_l = _make_nozzle(Vector3(-0.58, -0.08, 3.95), Vector3(0.62, 0.20, 0.14))
	nozzle_r = _make_nozzle(Vector3(0.58, -0.08, 3.95), Vector3(0.62, 0.20, 0.14))
	# Hotter AB glow (sheet BOOST / AFTERBURNER)
	for n in [nozzle_l, nozzle_r]:
		var nm := n.material_override as StandardMaterial3D
		if nm:
			nm.albedo_color = Color(1.0, 0.55, 0.12)
			nm.emission = Color(1.0, 0.42, 0.05)
			nm.emission_energy_multiplier = 3.4
	trail_l = _make_wing_vapor(Vector3(-4.65, 0.06, 0.45))
	trail_r = _make_wing_vapor(Vector3(4.65, 0.06, 0.45))
	contrail_l = _make_contrail(Vector3(-0.58, -0.08, 4.15))
	contrail_r = _make_contrail(Vector3(0.58, -0.08, 4.15))
	plume_l = _make_plume(Vector3(-0.58, -0.08, 4.05))
	plume_r = _make_plume(Vector3(0.58, -0.08, 4.05))
	_tune_f22_plumes()
	spray = _make_spray()
	wake = _make_wake()
	_make_shadow()


func _tune_f22_plumes() -> void:
	for p in [plume_l, plume_r]:
		if p == null:
			continue
		p.amount = 56
		p.lifetime = 0.48
		var mat := p.process_material as ParticleProcessMaterial
		if mat:
			mat.color = Color(1.0, 0.62, 0.18, 0.95)
			mat.initial_velocity_min = 26.0
			mat.initial_velocity_max = 42.0
			mat.scale_max = 0.58
		var dm: Mesh = p.draw_pass_1
		if dm is BoxMesh:
			var box := dm as BoxMesh
			var sm := box.material as StandardMaterial3D
			if sm:
				sm.albedo_color = Color(1.0, 0.9, 0.35)
				sm.emission = Color(1.0, 0.55, 0.08)
				sm.emission_energy_multiplier = 4.2


func _build_f15() -> void:
	## F-15 Eagle — twin tails upright, rectangular side intakes,
	## trapezoid wings, underwing tanks + rails (pixel-sheet silhouette).
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	# Long cylindrical fuselage
	_box(st, Vector3(0, 0.02, -0.15), Vector3(1.28, 0.82, 6.4), C_MID)
	_box(st, Vector3(0, 0.0, -2.55), Vector3(1.05, 0.68, 2.35), C_LIGHT)
	_box(st, Vector3(0, -0.12, -0.1), Vector3(1.42, 0.38, 4.6), C_DARK)
	# Pointed nose + radome
	_box(st, Vector3(0, 0.04, -3.85), Vector3(0.68, 0.48, 1.55), C_LIGHT)
	_box(st, Vector3(0, 0.04, -4.75), Vector3(0.34, 0.28, 0.62), C_RADOME)
	_box(st, Vector3(0, 0.02, -5.15), Vector3(0.18, 0.16, 0.28), C_RADOME)
	# Spine / dorsal ridge
	_box(st, Vector3(0, 0.42, -0.35), Vector3(0.55, 0.18, 4.2), C_LIGHT)
	_box(st, Vector3(0, 0.36, 1.6), Vector3(0.7, 0.16, 2.0), C_DARK)

	_trap_wing(st, true)
	_trap_wing(st, false)

	# Twin engine nacelles (close-set)
	_box(st, Vector3(-0.55, -0.14, 2.05), Vector3(0.92, 0.62, 3.1), C_DARK)
	_box(st, Vector3(0.55, -0.14, 2.05), Vector3(0.92, 0.62, 3.1), C_DARK)
	_box(st, Vector3(-0.55, -0.02, 1.2), Vector3(0.78, 0.42, 1.4), C_MID)
	_box(st, Vector3(0.55, -0.02, 1.2), Vector3(0.78, 0.42, 1.4), C_MID)

	# Distinctive rectangular side intakes
	_box(st, Vector3(-1.05, -0.08, -0.35), Vector3(0.62, 0.52, 2.35), C_INTAKE)
	_box(st, Vector3(1.05, -0.08, -0.35), Vector3(0.62, 0.52, 2.35), C_INTAKE)
	_box(st, Vector3(-1.22, -0.08, -1.35), Vector3(0.22, 0.48, 0.55), C_DARK)
	_box(st, Vector3(1.22, -0.08, -1.35), Vector3(0.22, 0.48, 0.55), C_DARK)
	_box(st, Vector3(-1.18, 0.14, -0.2), Vector3(0.18, 0.12, 1.6), C_LIGHT)
	_box(st, Vector3(1.18, 0.14, -0.2), Vector3(0.18, 0.12, 1.6), C_LIGHT)

	_f15_stab(st, true)
	_f15_stab(st, false)

	# Twin vertical tails — nearly upright (Eagle)
	_box(st, Vector3(-0.72, 0.95, 2.7), Vector3(0.1, 1.85, 1.75), C_MID)
	_box(st, Vector3(0.72, 0.95, 2.7), Vector3(0.1, 1.85, 1.75), C_MID)
	_box(st, Vector3(-0.72, 1.05, 2.0), Vector3(0.12, 1.55, 0.32), C_DARK)
	_box(st, Vector3(0.72, 1.05, 2.0), Vector3(0.12, 1.55, 0.32), C_DARK)
	# Red / white / black fin stripes (sheet markings)
	_box(st, Vector3(-0.78, 1.35, 2.55), Vector3(0.04, 0.85, 0.55), C_STRIPE_RED)
	_box(st, Vector3(0.78, 1.35, 2.55), Vector3(0.04, 0.85, 0.55), C_STRIPE_RED)
	_box(st, Vector3(-0.78, 1.35, 2.95), Vector3(0.04, 0.85, 0.22), C_STRIPE_WHITE)
	_box(st, Vector3(0.78, 1.35, 2.95), Vector3(0.04, 0.85, 0.22), C_STRIPE_WHITE)
	_box(st, Vector3(-0.78, 1.35, 3.18), Vector3(0.04, 0.85, 0.18), C_STRIPE_BLACK)
	_box(st, Vector3(0.78, 1.35, 3.18), Vector3(0.04, 0.85, 0.18), C_STRIPE_BLACK)

	# Circular nozzles
	_box(st, Vector3(-0.55, -0.1, 3.7), Vector3(0.72, 0.52, 0.55), C_NOZZLE)
	_box(st, Vector3(0.55, -0.1, 3.7), Vector3(0.72, 0.52, 0.55), C_NOZZLE)
	_box(st, Vector3(-0.55, -0.1, 3.95), Vector3(0.58, 0.4, 0.22), C_DARK)
	_box(st, Vector3(0.55, -0.1, 3.95), Vector3(0.58, 0.4, 0.22), C_DARK)

	# External fuel tanks (centerline + wing)
	_box(st, Vector3(0, -0.48, 0.15), Vector3(0.38, 0.32, 2.4), C_TANK)
	_box(st, Vector3(-2.35, -0.42, 0.05), Vector3(0.32, 0.28, 2.1), C_TANK)
	_box(st, Vector3(2.35, -0.42, 0.05), Vector3(0.32, 0.28, 2.1), C_TANK)
	# Wing pylons
	_box(st, Vector3(-2.35, -0.22, 0.05), Vector3(0.12, 0.28, 0.55), C_DARK)
	_box(st, Vector3(2.35, -0.22, 0.05), Vector3(0.12, 0.28, 0.55), C_DARK)
	_box(st, Vector3(0, -0.28, 0.15), Vector3(0.12, 0.22, 0.45), C_DARK)
	# Hardpoint missiles (white)
	_box(st, Vector3(-3.35, -0.38, -0.15), Vector3(0.16, 0.16, 1.35), C_MISSILE)
	_box(st, Vector3(3.35, -0.38, -0.15), Vector3(0.16, 0.16, 1.35), C_MISSILE)
	_box(st, Vector3(-1.55, -0.45, -0.35), Vector3(0.14, 0.14, 1.15), C_MISSILE)
	_box(st, Vector3(1.55, -0.45, -0.35), Vector3(0.14, 0.14, 1.15), C_MISSILE)
	# Wing root / panel accents
	_box(st, Vector3(-0.55, 0.22, -1.0), Vector3(0.5, 0.1, 1.6), C_LIGHT)
	_box(st, Vector3(0.55, 0.22, -1.0), Vector3(0.5, 0.1, 1.6), C_LIGHT)
	_box(st, Vector3(-0.35, 0.18, 0.8), Vector3(0.35, 0.08, 1.2), C_DARK)
	_box(st, Vector3(0.35, 0.18, 0.8), Vector3(0.35, 0.08, 1.2), C_DARK)

	_finish_airframe(st)
	# Bubble canopy further forward
	_make_canopy(Vector3(0, 0.58, -1.85), Vector3(0.85, 0.7, 1.55), 0.5, 0.78)
	# Eagle wing-root stripe accents (sheet red/white)
	_add_fin_decal(Vector3(-0.95, 0.22, -0.2), true)
	_add_fin_decal(Vector3(0.95, 0.22, -0.2), false)

	nozzle_l = _make_nozzle(Vector3(-0.55, -0.1, 4.15), Vector3(0.48, 0.28, 0.16))
	nozzle_r = _make_nozzle(Vector3(0.55, -0.1, 4.15), Vector3(0.48, 0.28, 0.16))
	trail_l = _make_wing_vapor(Vector3(-4.85, 0.02, 0.55))
	trail_r = _make_wing_vapor(Vector3(4.85, 0.02, 0.55))
	contrail_l = _make_contrail(Vector3(-0.55, -0.1, 4.35))
	contrail_r = _make_contrail(Vector3(0.55, -0.1, 4.35))
	plume_l = _make_plume(Vector3(-0.55, -0.1, 4.25))
	plume_r = _make_plume(Vector3(0.55, -0.1, 4.25))
	spray = _make_spray()
	wake = _make_wake()
	_make_shadow(3.1, 4.6)


func _trap_wing(st: SurfaceTool, left: bool) -> void:
	## F-15 trapezoidal wing — clipped tip, modest sweep.
	var s: float = -1.0 if left else 1.0
	var y: float = -0.02
	var root_le := Vector3(s * 0.75, y, -1.55)
	var root_te := Vector3(s * 0.75, y, 1.85)
	var tip_le := Vector3(s * 4.7, y, -0.15)
	var tip_te := Vector3(s * 4.7, y, 1.05)
	var up := Vector3(0, 0.11, 0)
	_tri(st, root_le + up, tip_te + up, tip_le + up, C_LIGHT)
	_tri(st, root_le + up, root_te + up, tip_te + up, C_LIGHT)
	_tri(st, root_le, tip_le, tip_te, C_MID)
	_tri(st, root_le, tip_te, root_te, C_MID)
	_tri(st, root_le, tip_le + up, tip_le, C_DARK)
	_tri(st, root_le, root_le + up, tip_le + up, C_DARK)
	_tri(st, root_te, tip_te, tip_te + up, C_DARK)
	_tri(st, root_te, tip_te + up, root_te + up, C_DARK)
	_tri(st, tip_le, tip_te + up, tip_te, C_DARK)
	_tri(st, tip_le, tip_le + up, tip_te + up, C_DARK)


func _f15_stab(st: SurfaceTool, left: bool) -> void:
	var s: float = -1.0 if left else 1.0
	var y: float = 0.02
	var root_le := Vector3(s * 0.5, y, 2.55)
	var root_te := Vector3(s * 0.5, y, 3.85)
	var tip_le := Vector3(s * 2.55, y, 2.95)
	var tip_te := Vector3(s * 2.55, y, 3.95)
	var up := Vector3(0, 0.09, 0)
	_tri(st, root_le + up, tip_te + up, tip_le + up, C_LIGHT)
	_tri(st, root_le + up, root_te + up, tip_te + up, C_LIGHT)
	_tri(st, root_le, tip_le, tip_te, C_MID)
	_tri(st, root_le, tip_te, root_te, C_MID)


func _add_fin_decal(pos: Vector3, left_side: bool) -> void:
	var mi := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = Vector2(0.55, 0.28)
	mi.mesh = quad
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = _eagle_stripe_texture()
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = mat
	mi.position = pos
	mi.rotation.y = -PI * 0.5 if left_side else PI * 0.5
	add_child(mi)


func _eagle_stripe_texture() -> ImageTexture:
	const W := 16
	const H := 8
	var img := Image.create(W, H, false, Image.FORMAT_RGBA8)
	var red := Color(0.82, 0.12, 0.14)
	var white := Color(0.96, 0.96, 0.97)
	var black := Color(0.08, 0.08, 0.09)
	for y in H:
		for x in W:
			var band: int = int(float(x) / float(W) * 3.0)
			var col: Color = red if band == 0 else (white if band == 1 else black)
			img.set_pixel(x, y, col)
	return ImageTexture.create_from_image(img)


func _add_sp_flag(pos: Vector3, left_side: bool) -> void:
	var mi := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = Vector2(0.58, 0.34)
	mi.mesh = quad
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = _sp_flag_texture()
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = mat
	mi.position = pos
	mi.rotation.y = -PI * 0.5 if left_side else PI * 0.5
	add_child(mi)


func _add_sp_roundel(pos: Vector3, size: float) -> void:
	## Wing-top São Paulo roundel from the sheet (red disc + star + stripes).
	var mi := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = Vector2(size, size * 0.72)
	mi.mesh = quad
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = _sp_roundel_texture()
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mi.material_override = mat
	mi.position = pos
	mi.rotation.x = -PI * 0.5
	add_child(mi)


func _add_sp_fin_mark(pos: Vector3, left_side: bool, cant: float) -> void:
	var mi := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = Vector2(0.48, 0.42)
	mi.mesh = quad
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = _sp_roundel_texture()
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mi.material_override = mat
	mi.position = pos
	mi.rotation = Vector3(0.0, (-PI * 0.5 if left_side else PI * 0.5), cant * 0.35)
	add_child(mi)


func _sp_flag_texture() -> ImageTexture:
	# Fuselage side — black/white stripes with red canton + star (sheet SP mark).
	const W := 26
	const H := 13
	var img := Image.create(W, H, false, Image.FORMAT_RGBA8)
	var black := Color(0.05, 0.05, 0.05)
	var white := Color(0.95, 0.95, 0.95)
	var red := Color(0.86, 0.10, 0.12)
	for y in H:
		var stripe: Color = black if (y % 2 == 0) else white
		for x in W:
			img.set_pixel(x, y, stripe)
	const CW := 9
	const CH := 8
	for y in CH:
		for x in CW:
			img.set_pixel(x, y, red)
	_stamp_star(img, 4.0, 3.5, 2.6, white)
	return ImageTexture.create_from_image(img)


func _sp_roundel_texture() -> ImageTexture:
	## Matches wing/fin badge on the São Paulo F-22 sheet.
	const W := 24
	const H := 18
	var img := Image.create(W, H, false, Image.FORMAT_RGBA8)
	var clear := Color(0, 0, 0, 0)
	var black := Color(0.05, 0.05, 0.05, 1)
	var white := Color(0.96, 0.96, 0.97, 1)
	var red := Color(0.86, 0.10, 0.12, 1)
	for y in H:
		for x in W:
			img.set_pixel(x, y, clear)
	# Horizontal black/white bars behind disc
	for y in H:
		var stripe: Color = black if (y % 2 == 0) else white
		for x in W:
			if x < 4 or x >= W - 4:
				img.set_pixel(x, y, stripe)
	var cx := float(W) * 0.5
	var cy := float(H) * 0.5
	var r_outer := 7.2
	var r_inner := 6.2
	for y in H:
		for x in W:
			var dx: float = float(x) + 0.5 - cx
			var dy: float = float(y) + 0.5 - cy
			var d2: float = dx * dx + dy * dy
			if d2 <= r_outer * r_outer:
				img.set_pixel(x, y, red if d2 <= r_inner * r_inner else white)
	_stamp_star(img, cx, cy, 3.4, white)
	return ImageTexture.create_from_image(img)


func _stamp_star(img: Image, cx: float, cy: float, radius: float, col: Color) -> void:
	## Tiny 5-point star for SP roundel (pixel-friendly).
	var w: int = img.get_width()
	var h: int = img.get_height()
	for y in h:
		for x in w:
			var dx: float = float(x) + 0.5 - cx
			var dy: float = float(y) + 0.5 - cy
			var ang: float = atan2(dy, dx)
			var dist: float = sqrt(dx * dx + dy * dy)
			# 5 lobes
			var lobe: float = absf(sin(ang * 2.5))
			var r: float = radius * lerpf(0.35, 1.0, 1.0 - lobe)
			if dist <= r:
				img.set_pixel(x, y, col)


func _diamond_wing(st: SurfaceTool, left: bool) -> void:
	## Sheet TOP diamond — long LE sweep, clipped tip, broad root.
	var s: float = -1.0 if left else 1.0
	var y: float = -0.02
	var c_top := Color(0.82, 0.88, 0.92)
	var c_bot := Color(0.58, 0.64, 0.68)
	var c_edge := Color(0.30, 0.34, 0.38)
	var root_le := Vector3(s * 0.72, y, -1.55)
	var root_te := Vector3(s * 0.72, y, 1.72)
	var tip_le := Vector3(s * 4.55, y, -0.15)
	var tip_te := Vector3(s * 4.55, y, 0.95)
	var root_le_t := root_le + Vector3(0, 0.12, 0)
	var root_te_t := root_te + Vector3(0, 0.12, 0)
	var tip_le_t := tip_le + Vector3(0, 0.12, 0)
	var tip_te_t := tip_te + Vector3(0, 0.12, 0)
	_tri(st, root_le_t, tip_te_t, tip_le_t, c_top)
	_tri(st, root_le_t, root_te_t, tip_te_t, c_top)
	_tri(st, root_le, tip_le, tip_te, c_bot)
	_tri(st, root_le, tip_te, root_te, c_bot)
	_tri(st, root_le, tip_le_t, tip_le, c_edge)
	_tri(st, root_le, root_le_t, tip_le_t, c_edge)
	_tri(st, root_te, tip_te, tip_te_t, c_edge)
	_tri(st, root_te, tip_te_t, root_te_t, c_edge)
	_tri(st, tip_le, tip_te_t, tip_te, c_edge)
	_tri(st, tip_le, tip_le_t, tip_te_t, c_edge)


func _stab(st: SurfaceTool, left: bool) -> void:
	## All-moving F-22 stabs — more aft sweep, sheet SIDE/ISO.
	var s: float = -1.0 if left else 1.0
	var y: float = 0.04
	var c_top := Color(0.82, 0.88, 0.92)
	var c_bot := Color(0.68, 0.74, 0.78)
	var root_le := Vector3(s * 0.52, y, 2.45)
	var root_te := Vector3(s * 0.52, y, 3.68)
	var tip_le := Vector3(s * 2.45, y, 2.95)
	var tip_te := Vector3(s * 2.45, y, 3.78)
	var up := Vector3(0, 0.09, 0)
	_tri(st, root_le + up, tip_te + up, tip_le + up, c_top)
	_tri(st, root_le + up, root_te + up, tip_te + up, c_top)
	_tri(st, root_le, tip_le, tip_te, c_bot)
	_tri(st, root_le, tip_te, root_te, c_bot)


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


func _make_nozzle(pos: Vector3, size: Vector3 = Vector3(0.55, 0.22, 0.15)) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var m := BoxMesh.new()
	m.size = size
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
	if trail_l == null or trail_r == null or contrail_l == null or contrail_r == null:
		return
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


func _make_shadow(top_r: float = 2.8, bottom_r: float = 4.2) -> void:
	shadow = MeshInstance3D.new()
	var disc := CylinderMesh.new()
	disc.top_radius = top_r
	disc.bottom_radius = bottom_r
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
	if plume_l == null or plume_r == null or nozzle_l == null or nozzle_r == null:
		return
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
	if spray == null or wake == null:
		return
	spray.emitting = on
	wake.emitting = on


func set_external_visible(on: bool) -> void:
	## Used by cockpit cam — hide airframe/FX so the 2D canopy owns the view.
	for c in get_children():
		if c == shadow:
			continue
		c.visible = on
	if not on:
		if plume_l:
			plume_l.emitting = false
		if plume_r:
			plume_r.emitting = false
		if trail_l:
			trail_l.emitting = false
		if trail_r:
			trail_r.emitting = false
		if contrail_l:
			contrail_l.emitting = false
		if contrail_r:
			contrail_r.emitting = false
		if spray:
			spray.emitting = false
		if wake:
			wake.emitting = false
