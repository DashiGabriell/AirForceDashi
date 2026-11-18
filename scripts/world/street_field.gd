extends Node3D
## Detailed street layer near the jet: asphalt, curbs, markings, lamps, crosswalks.

const MAX_ASPHALT := 520
const MAX_CURB := 480
const MAX_MARK := 420
const MAX_LAMP := 180
const SNAP := 100.0

var _gen: TerrainGenerator
var _asphalt: MultiMeshInstance3D
var _curb: MultiMeshInstance3D
var _mark: MultiMeshInstance3D
var _lamp: MultiMeshInstance3D
var _last_snap := Vector2(INF, INF)
var _texel_m: float = 40.0
var _lod_fade: float = 1.0
var _fade_dir: float = 0.0
var _pending_center: Vector3 = Vector3.ZERO
var _has_pending: bool = false
var _mats: Array[StandardMaterial3D] = []


func setup(gen: TerrainGenerator) -> void:
	_gen = gen
	_texel_m = Game.WORLD_SIZE / float(TerrainGenerator.RES)
	_asphalt = _make_mm("Asphalt", _build_deck_mesh(), MAX_ASPHALT)
	_curb = _make_mm("Curbs", _build_curb_mesh(), MAX_CURB)
	_mark = _make_mm("Markings", _build_mark_mesh(), MAX_MARK)
	_lamp = _make_mm("StreetLamps", _build_lamp_mesh(), MAX_LAMP)
	add_child(_asphalt)
	add_child(_curb)
	add_child(_mark)
	add_child(_lamp)
	_hide_all(_asphalt.multimesh, MAX_ASPHALT)
	_hide_all(_curb.multimesh, MAX_CURB)
	_hide_all(_mark.multimesh, MAX_MARK)
	_hide_all(_lamp.multimesh, MAX_LAMP)
	set_process(true)


func _process(dt: float) -> void:
	if _fade_dir < 0.0:
		_lod_fade = maxf(_lod_fade - dt * 3.5, 0.0)
		_apply_fade()
		if _lod_fade <= 0.02 and _has_pending:
			_rebuild(_pending_center)
			_has_pending = false
			_fade_dir = 1.0
	elif _fade_dir > 0.0:
		_lod_fade = minf(_lod_fade + dt * 2.8, 1.0)
		_apply_fade()
		if _lod_fade >= 0.99:
			_lod_fade = 1.0
			_fade_dir = 0.0
			_apply_fade()


func _apply_fade() -> void:
	for m in _mats:
		m.albedo_color.a = _lod_fade


func refresh_around(center: Vector3) -> void:
	if _gen == null:
		return
	var sx: float = snappedf(center.x, SNAP)
	var sz: float = snappedf(center.z, SNAP)
	if Vector2(sx, sz).distance_to(_last_snap) < SNAP * 0.4:
		return
	if _last_snap.x < 1.0e8:
		_pending_center = center
		_has_pending = true
		_fade_dir = -1.0
		_last_snap = Vector2(sx, sz)
		return
	_last_snap = Vector2(sx, sz)
	_rebuild(center)


func _rebuild(center: Vector3) -> void:
	var sx: float = snappedf(center.x, SNAP)
	var sz: float = snappedf(center.z, SNAP)

	var radius: float = Game.STREET_RADIUS
	var span: int = int(ceil(radius / _texel_m)) + 2
	var c: Vector2i = _gen.world_to_texel_i(sx, sz)

	var a_i := 0
	var c_i := 0
	var m_i := 0
	var l_i := 0
	var mm_a: MultiMesh = _asphalt.multimesh
	var mm_c: MultiMesh = _curb.multimesh
	var mm_m: MultiMesh = _mark.multimesh
	var mm_l: MultiMesh = _lamp.multimesh

	for oy in range(-span, span + 1):
		for ox in range(-span, span + 1):
			var tx: int = posmod(c.x + ox, TerrainGenerator.RES)
			var ty: int = posmod(c.y + oy, TerrainGenerator.RES)
			var center_xz: Vector2 = _gen.texel_world_center(tx, ty)
			var cx: float = center_xz.x
			var cz: float = center_xz.y
			if _torus_dist2(cx, cz, sx, sz) > radius * radius:
				continue

			var region: int = _gen.sample_region(cx, cz)
			if region != TerrainGenerator.Region.CITY and region != TerrainGenerator.Region.SUBURB:
				continue
			var bits: int = _gen.road_bits_at(tx, ty, region == TerrainGenerator.Region.CITY)
			if bits == 0:
				continue

			var gh: float = _gen.sample_height(cx, cz)
			if gh <= Game.WATER_LEVEL + 1.0:
				continue

			var is_ave: bool = (bits & TerrainGenerator.ROAD_AVE) != 0
			var ew: bool = (bits & TerrainGenerator.ROAD_EW) != 0
			var ns: bool = (bits & TerrainGenerator.ROAD_NS) != 0
			var wide: float = _texel_m * (1.55 if is_ave else 1.0)
			var thick: float = _texel_m * 0.92
			var y_deck: float = gh + 0.55

			if ew and ns:
				# Intersection pad
				if a_i < MAX_ASPHALT:
					mm_a.set_instance_transform(a_i, _xf(cx, y_deck, cz, wide, 0.7, wide, 0.0))
					mm_a.set_instance_color(a_i, Color(0.16, 0.16, 0.18) if is_ave else Color(0.20, 0.19, 0.21))
					a_i += 1
				# Crosswalk stripes on four approaches
				m_i = _add_crosswalk(mm_m, m_i, cx, y_deck, cz, true, wide)
				m_i = _add_crosswalk(mm_m, m_i, cx, y_deck, cz, false, wide)
				# Corner curbs
				c_i = _add_corner_curbs(mm_c, c_i, cx, gh, cz, wide)
				# Traffic light / lamp at corner
				if l_i < MAX_LAMP and posmod(tx + ty, 2) == 0:
					l_i = _add_lamp(mm_l, l_i, cx + wide * 0.42, gh, cz + wide * 0.42, true)
			elif ew:
				if a_i < MAX_ASPHALT:
					mm_a.set_instance_transform(a_i, _xf(cx, y_deck, cz, thick, 0.65, wide * 0.92, 0.0))
					mm_a.set_instance_color(a_i, Color(0.15, 0.15, 0.17) if is_ave else Color(0.19, 0.18, 0.20))
					a_i += 1
				# Sidewalks north/south of EW road
				c_i = _add_sidewalks(mm_c, c_i, cx, gh, cz, true, thick, wide)
				# Center dashed line
				m_i = _add_center_dashes(mm_m, m_i, cx, y_deck, cz, true, thick)
				if is_ave:
					m_i = _add_edge_lines(mm_m, m_i, cx, y_deck, cz, true, wide)
				if l_i < MAX_LAMP and posmod(tx, 3) == 0:
					l_i = _add_lamp(mm_l, l_i, cx, gh, cz - wide * 0.55, false)
			elif ns:
				if a_i < MAX_ASPHALT:
					mm_a.set_instance_transform(a_i, _xf(cx, y_deck, cz, wide * 0.92, 0.65, thick, 0.0))
					mm_a.set_instance_color(a_i, Color(0.15, 0.15, 0.17) if is_ave else Color(0.19, 0.18, 0.20))
					a_i += 1
				c_i = _add_sidewalks(mm_c, c_i, cx, gh, cz, false, thick, wide)
				m_i = _add_center_dashes(mm_m, m_i, cx, y_deck, cz, false, thick)
				if is_ave:
					m_i = _add_edge_lines(mm_m, m_i, cx, y_deck, cz, false, wide)
				if l_i < MAX_LAMP and posmod(ty, 3) == 0:
					l_i = _add_lamp(mm_l, l_i, cx - wide * 0.55, gh, cz, false)

	_hide_from(mm_a, a_i, MAX_ASPHALT)
	_hide_from(mm_c, c_i, MAX_CURB)
	_hide_from(mm_m, m_i, MAX_MARK)
	_hide_from(mm_l, l_i, MAX_LAMP)


func _add_sidewalks(mm: MultiMesh, idx: int, cx: float, gh: float, cz: float, ew: bool, thick: float, wide: float) -> int:
	var y: float = gh + 0.95
	var sw: float = _texel_m * 0.28
	if ew:
		# curbs along +Z/-Z edges
		if idx < MAX_CURB:
			mm.set_instance_transform(idx, _xf(cx, y, cz + wide * 0.48, thick * 0.95, 0.55, sw, 0.0))
			mm.set_instance_color(idx, Color(0.55, 0.54, 0.52))
			idx += 1
		if idx < MAX_CURB:
			mm.set_instance_transform(idx, _xf(cx, y, cz - wide * 0.48, thick * 0.95, 0.55, sw, 0.0))
			mm.set_instance_color(idx, Color(0.55, 0.54, 0.52))
			idx += 1
	else:
		if idx < MAX_CURB:
			mm.set_instance_transform(idx, _xf(cx + wide * 0.48, y, cz, sw, 0.55, thick * 0.95, 0.0))
			mm.set_instance_color(idx, Color(0.55, 0.54, 0.52))
			idx += 1
		if idx < MAX_CURB:
			mm.set_instance_transform(idx, _xf(cx - wide * 0.48, y, cz, sw, 0.55, thick * 0.95, 0.0))
			mm.set_instance_color(idx, Color(0.55, 0.54, 0.52))
			idx += 1
	return idx


func _add_corner_curbs(mm: MultiMesh, idx: int, cx: float, gh: float, cz: float, wide: float) -> int:
	var y: float = gh + 0.95
	var s: float = _texel_m * 0.3
	for ox in [-1.0, 1.0]:
		for oz in [-1.0, 1.0]:
			if idx >= MAX_CURB:
				return idx
			mm.set_instance_transform(idx, _xf(cx + ox * wide * 0.45, y, cz + oz * wide * 0.45, s, 0.55, s, 0.0))
			mm.set_instance_color(idx, Color(0.52, 0.51, 0.49))
			idx += 1
	return idx


func _add_center_dashes(mm: MultiMesh, idx: int, cx: float, y: float, cz: float, ew: bool, thick: float) -> int:
	var dash: float = _texel_m * 0.22
	var gap: float = _texel_m * 0.18
	var n: int = 3
	for k in n:
		if idx >= MAX_MARK:
			return idx
		var t: float = (float(k) - float(n - 1) * 0.5) * (dash + gap)
		var px: float = cx + (t if ew else 0.0)
		var pz: float = cz + (0.0 if ew else t)
		var sx: float = dash if ew else 0.55
		var sz: float = 0.55 if ew else dash
		mm.set_instance_transform(idx, _xf(px, y + 0.12, pz, sx, 0.15, sz, 0.0))
		mm.set_instance_color(idx, Color(0.92, 0.88, 0.55))
		idx += 1
	return idx


func _add_edge_lines(mm: MultiMesh, idx: int, cx: float, y: float, cz: float, ew: bool, wide: float) -> int:
	for side in [-1.0, 1.0]:
		if idx >= MAX_MARK:
			return idx
		var px: float = cx + (0.0 if ew else side * wide * 0.38)
		var pz: float = cz + (side * wide * 0.38 if ew else 0.0)
		var sx: float = _texel_m * 0.85 if ew else 0.45
		var sz: float = 0.45 if ew else _texel_m * 0.85
		mm.set_instance_transform(idx, _xf(px, y + 0.1, pz, sx, 0.12, sz, 0.0))
		mm.set_instance_color(idx, Color(0.9, 0.9, 0.92))
		idx += 1
	return idx


func _add_crosswalk(mm: MultiMesh, idx: int, cx: float, y: float, cz: float, ew_approach: bool, wide: float) -> int:
	# Stripes across the street at intersection edge.
	var stripes: int = 5
	for k in stripes:
		if idx >= MAX_MARK:
			return idx
		var t: float = (float(k) - float(stripes - 1) * 0.5) * (_texel_m * 0.14)
		if ew_approach:
			# stripes along Z, placed on +X and -X lips
			for side in [-1.0, 1.0]:
				if idx >= MAX_MARK:
					return idx
				mm.set_instance_transform(idx, _xf(cx + side * wide * 0.36, y + 0.14, cz + t, 2.2, 0.12, _texel_m * 0.1, 0.0))
				mm.set_instance_color(idx, Color(0.93, 0.93, 0.95))
				idx += 1
		else:
			for side in [-1.0, 1.0]:
				if idx >= MAX_MARK:
					return idx
				mm.set_instance_transform(idx, _xf(cx + t, y + 0.14, cz + side * wide * 0.36, _texel_m * 0.1, 0.12, 2.2, 0.0))
				mm.set_instance_color(idx, Color(0.93, 0.93, 0.95))
				idx += 1
	return idx


func _add_lamp(mm: MultiMesh, idx: int, x: float, gh: float, z: float, tall: bool) -> int:
	if idx >= MAX_LAMP:
		return idx
	var h: float = 11.0 if tall else 8.5
	mm.set_instance_transform(idx, _xf(x, gh + h * 0.5, z, 1.0, h, 1.0, 0.0))
	mm.set_instance_color(idx, Color(0.35, 0.35, 0.38))
	return idx + 1


func _xf(x: float, y: float, z: float, w: float, h: float, d: float, yaw: float) -> Transform3D:
	var basis := Basis(Vector3.UP, yaw).scaled(Vector3(w, h, d))
	return Transform3D(basis, Vector3(x, y, z))


func _torus_dist2(cx: float, cz: float, sx: float, sz: float) -> float:
	var dx: float = absf(cx - sx)
	var dz: float = absf(cz - sz)
	dx = minf(dx, Game.WORLD_SIZE - dx)
	dz = minf(dz, Game.WORLD_SIZE - dz)
	return dx * dx + dz * dz


func _make_mm(node_name: String, mesh: Mesh, count: int) -> MultiMeshInstance3D:
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1.0
	mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Color(1, 1, 1, 1)
	_mats.append(mat)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = mesh
	mm.instance_count = count
	var mi := MultiMeshInstance3D.new()
	mi.name = node_name
	mi.multimesh = mm
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


func _hide_all(mm: MultiMesh, n: int) -> void:
	_hide_from(mm, 0, n)


func _hide_from(mm: MultiMesh, from_i: int, n: int) -> void:
	var xf := Transform3D(Basis.from_scale(Vector3(0.01, 0.01, 0.01)), Vector3(0, -9999, 0))
	for k in range(from_i, n):
		mm.set_instance_transform(k, xf)


func _build_deck_mesh() -> ArrayMesh:
	return _unit_box_mesh(Color(1, 1, 1))


func _build_curb_mesh() -> ArrayMesh:
	return _unit_box_mesh(Color(1, 1, 1))


func _build_mark_mesh() -> ArrayMesh:
	return _unit_box_mesh(Color(1, 1, 1))


func _build_lamp_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# Pole + lamp head (unit height ~1, scaled in Y)
	_box(st, Vector3(0, 0.0, 0), Vector3(0.12, 0.92, 0.12), Color(0.85, 0.85, 0.88))
	_box(st, Vector3(0.08, 0.42, 0), Vector3(0.35, 0.08, 0.14), Color(0.95, 0.9, 0.7))
	_box(st, Vector3(0.18, 0.38, 0), Vector3(0.16, 0.06, 0.16), Color(1.0, 0.92, 0.65))
	st.generate_normals()
	return st.commit()


func _unit_box_mesh(col: Color) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_box(st, Vector3.ZERO, Vector3.ONE, col)
	st.generate_normals()
	return st.commit()


func _box(st: SurfaceTool, center: Vector3, size: Vector3, col: Color) -> void:
	var hx := size.x * 0.5
	var hy := size.y * 0.5
	var hz := size.z * 0.5
	var p := [
		center + Vector3(-hx, -hy, -hz),
		center + Vector3(hx, -hy, -hz),
		center + Vector3(hx, hy, -hz),
		center + Vector3(-hx, hy, -hz),
		center + Vector3(-hx, -hy, hz),
		center + Vector3(hx, -hy, hz),
		center + Vector3(hx, hy, hz),
		center + Vector3(-hx, hy, hz),
	]
	var faces := [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]
	for f in faces:
		_quad(st, p[f[0]], p[f[1]], p[f[2]], p[f[3]], col)


func _quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color) -> void:
	st.set_color(col)
	st.add_vertex(a)
	st.set_color(col)
	st.add_vertex(b)
	st.set_color(col)
	st.add_vertex(c)
	st.set_color(col)
	st.add_vertex(a)
	st.set_color(col)
	st.add_vertex(c)
	st.set_color(col)
	st.add_vertex(d)
