extends Node3D
## Detailed MultiMesh buildings: city towers, suburb houses, farm barns.
## Axis-aligned collision boxes rebuilt with the sliding MultiMesh window.

const MAX_CITY := 280
const MAX_SUBURB := 200
const MAX_FARM := 60
const SNAP := 140.0
## Inset vs visual mesh so edges feel fair for arcade hits.
const COLLISION_XZ := 0.92

var _gen: TerrainGenerator
var _city: MultiMeshInstance3D
var _suburb: MultiMeshInstance3D
var _farm: MultiMeshInstance3D
var _mat: ShaderMaterial
var _last_snap := Vector2(INF, INF)
var _centers: PackedVector3Array = PackedVector3Array()
var _halfs: PackedVector3Array = PackedVector3Array()
var _box_count: int = 0
var _player_xz: Vector2 = Vector2.ZERO


func setup(gen: TerrainGenerator) -> void:
	_gen = gen
	_mat = ShaderMaterial.new()
	_mat.shader = load("res://shaders/building.gdshader")
	_mat.set_shader_parameter("day_factor", Game.day_factor)
	_mat.set_shader_parameter("sun_dir", Game.sun_dir)

	_city = _make_mm("CityTowers", _build_tower_mesh(), MAX_CITY)
	_suburb = _make_mm("SuburbHouses", _build_house_mesh(), MAX_SUBURB)
	_farm = _make_mm("FarmBarns", _build_barn_mesh(), MAX_FARM)
	add_child(_city)
	add_child(_suburb)
	add_child(_farm)
	_hide_all(_city.multimesh, MAX_CITY)
	_hide_all(_suburb.multimesh, MAX_SUBURB)
	_hide_all(_farm.multimesh, MAX_FARM)
	Game.building_roof_at = roof_at
	Game.building_contains = contains_point
	Game.building_segment_hit = segment_hit
	set_process(true)


func _process(_dt: float) -> void:
	if _mat:
		_mat.set_shader_parameter("day_factor", Game.day_factor)
		_mat.set_shader_parameter("sun_dir", Game.sun_dir)


func refresh_around(center: Vector3) -> void:
	if _gen == null:
		return
	_player_xz = Vector2(center.x, center.z)
	var sx: float = snappedf(center.x, SNAP)
	var sz: float = snappedf(center.z, SNAP)
	# Hysteresis: only rebuild after leaving the snap cell — no alpha fade (that caused flicker).
	if Vector2(sx, sz).distance_to(_last_snap) < SNAP * 0.55:
		return
	_last_snap = Vector2(sx, sz)
	_rebuild(center)


func _rebuild(center: Vector3) -> void:
	var sx: float = snappedf(center.x, SNAP)
	var sz: float = snappedf(center.z, SNAP)
	_player_xz = Vector2(center.x, center.z)

	var cell: float = Game.BUILDING_CELL
	var radius: float = Game.BUILDING_RADIUS
	var half_w: float = Game.WORLD_SIZE * 0.5
	var i0: int = int(floor((sx + half_w - radius) / cell))
	var i1: int = int(floor((sx + half_w + radius) / cell))
	var j0: int = int(floor((sz + half_w - radius) / cell))
	var j1: int = int(floor((sz + half_w + radius) / cell))

	var city_i := 0
	var suburb_i := 0
	var farm_i := 0
	var mm_city: MultiMesh = _city.multimesh
	var mm_sub: MultiMesh = _suburb.multimesh
	var mm_farm: MultiMesh = _farm.multimesh
	_centers = PackedVector3Array()
	_halfs = PackedVector3Array()

	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			var cx: float = wrapf(-half_w + (float(i) + 0.5) * cell, -half_w, half_w)
			var cz: float = wrapf(-half_w + (float(j) + 0.5) * cell, -half_w, half_w)
			var dx: float = absf(cx - sx)
			var dz: float = absf(cz - sz)
			dx = minf(dx, Game.WORLD_SIZE - dx)
			dz = minf(dz, Game.WORLD_SIZE - dz)
			var dist2: float = dx * dx + dz * dz
			if dist2 > radius * radius:
				continue
			var edge_a: float = _edge_alpha(sqrt(dist2), radius)

			var region: int = _gen.sample_region(cx, cz)
			if region != TerrainGenerator.Region.CITY and region != TerrainGenerator.Region.SUBURB and region != TerrainGenerator.Region.FARM:
				continue
			if _gen.is_roadish(cx, cz):
				continue

			var gh: float = _gen.sample_height(cx, cz)
			if gh <= Game.WATER_LEVEL + 2.0:
				continue

			var seed_h: int = i * 73856093 ^ j * 19349663
			var yaw: float = float(posmod(seed_h >> 9, 4)) * (PI * 0.5)

			if region == TerrainGenerator.Region.CITY and city_i < MAX_CITY:
				var h: float = 22.0 + float(posmod(seed_h, 78))
				var w: float = 42.0 + float(posmod(seed_h >> 3, 58))
				var d: float = 42.0 + float(posmod(seed_h >> 7, 58))
				# Occasional slender tower
				if posmod(seed_h, 11) == 0:
					h *= 1.45
					w *= 0.72
					d *= 0.72
				var xf := _xf(cx, gh, cz, w, h, d, yaw)
				mm_city.set_instance_transform(city_i, xf)
				var col := _city_color(seed_h)
				col.a = edge_a
				mm_city.set_instance_color(city_i, col)
				_push_box(cx, gh, cz, w, h, d, yaw)
				city_i += 1
			elif region == TerrainGenerator.Region.SUBURB and suburb_i < MAX_SUBURB:
				var h: float = 7.0 + float(posmod(seed_h, 10))
				var w: float = 26.0 + float(posmod(seed_h >> 2, 30))
				var d: float = 22.0 + float(posmod(seed_h >> 5, 28))
				var xf := _xf(cx, gh, cz, w, h, d, yaw)
				mm_sub.set_instance_transform(suburb_i, xf)
				var scol := _suburb_color(seed_h)
				scol.a = edge_a
				mm_sub.set_instance_color(suburb_i, scol)
				_push_box(cx, gh, cz, w, h, d, yaw)
				suburb_i += 1
			elif region == TerrainGenerator.Region.FARM and farm_i < MAX_FARM:
				if posmod(seed_h, 7) != 0:
					continue
				var h: float = 10.0 + float(posmod(seed_h, 12))
				var w: float = 24.0 + float(posmod(seed_h >> 1, 22))
				var d: float = 18.0 + float(posmod(seed_h >> 4, 20))
				var xf := _xf(cx, gh, cz, w, h, d, yaw)
				mm_farm.set_instance_transform(farm_i, xf)
				mm_farm.set_instance_color(farm_i, Color(0.58, 0.44, 0.30, edge_a))
				_push_box(cx, gh, cz, w, h, d, yaw)
				farm_i += 1

	_box_count = _centers.size()
	_hide_from(mm_city, city_i, MAX_CITY)
	_hide_from(mm_sub, suburb_i, MAX_SUBURB)
	_hide_from(mm_farm, farm_i, MAX_FARM)


func _edge_alpha(dist: float, radius: float) -> float:
	var fade_start: float = radius * 0.72
	if dist <= fade_start:
		return 1.0
	return clampf(1.0 - (dist - fade_start) / maxf(radius - fade_start, 1.0), 0.0, 1.0)


func _push_box(cx: float, gh: float, cz: float, w: float, h: float, d: float, yaw: float) -> void:
	# Yaw is multiple of 90° — swap XZ half-extents when rotated.
	var hx: float = w * 0.5 * COLLISION_XZ
	var hz: float = d * 0.5 * COLLISION_XZ
	var yaw_q: int = posmod(int(round(yaw / (PI * 0.5))), 4)
	if yaw_q == 1 or yaw_q == 3:
		var tmp := hx
		hx = hz
		hz = tmp
	_centers.append(Vector3(cx, gh + h * 0.5, cz))
	_halfs.append(Vector3(hx, h * 0.5, hz))


func roof_at(x: float, z: float) -> float:
	## Highest building roof under (x,z), or -INF if none.
	var best: float = -INF
	for i in _box_count:
		var c: Vector3 = _centers[i]
		var he: Vector3 = _halfs[i]
		if absf(x - c.x) <= he.x and absf(z - c.z) <= he.z:
			best = maxf(best, c.y + he.y)
	return best


func contains_point(p: Vector3) -> bool:
	for i in _box_count:
		var c: Vector3 = _centers[i]
		var he: Vector3 = _halfs[i]
		var d: Vector3 = (p - c).abs()
		if d.x <= he.x and d.y <= he.y and d.z <= he.z:
			return true
	return false


func segment_hit(from: Vector3, to: Vector3) -> Variant:
	## First AABB hit along segment, or null.
	var delta: Vector3 = to - from
	var len_sq: float = delta.length_squared()
	if len_sq < 0.0001:
		return from if contains_point(from) else null
	var best_t: float = 2.0
	var best_p: Vector3 = to
	var found := false
	for i in _box_count:
		var t: float = _segment_aabb_t(from, delta, _centers[i], _halfs[i])
		if t >= 0.0 and t <= 1.0 and t < best_t:
			best_t = t
			best_p = from + delta * t
			found = true
	return best_p if found else null


func _segment_aabb_t(origin: Vector3, delta: Vector3, center: Vector3, half: Vector3) -> float:
	## Slab method; returns entry t in [0,1] or -1.
	var tmin: float = 0.0
	var tmax: float = 1.0
	for axis in 3:
		var o: float = origin[axis]
		var d: float = delta[axis]
		var c: float = center[axis]
		var h: float = half[axis]
		var bmin: float = c - h
		var bmax: float = c + h
		if absf(d) < 0.000001:
			if o < bmin or o > bmax:
				return -1.0
			continue
		var inv: float = 1.0 / d
		var t1: float = (bmin - o) * inv
		var t2: float = (bmax - o) * inv
		if t1 > t2:
			var tmp := t1
			t1 = t2
			t2 = tmp
		tmin = maxf(tmin, t1)
		tmax = minf(tmax, t2)
		if tmin > tmax:
			return -1.0
	return tmin


func _xf(cx: float, gh: float, cz: float, w: float, h: float, d: float, yaw: float) -> Transform3D:
	var basis := Basis(Vector3.UP, yaw).scaled(Vector3(w, h, d))
	return Transform3D(basis, Vector3(cx, gh + h * 0.5, cz))


func _make_mm(node_name: String, mesh: Mesh, count: int) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = mesh
	mm.instance_count = count
	var mi := MultiMeshInstance3D.new()
	mi.name = node_name
	mi.multimesh = mm
	mi.material_override = _mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


func _hide_all(mm: MultiMesh, n: int) -> void:
	_hide_from(mm, 0, n)


func _hide_from(mm: MultiMesh, from_i: int, n: int) -> void:
	var xf := Transform3D(Basis.from_scale(Vector3(0.01, 0.01, 0.01)), Vector3(0, -9999, 0))
	for k in range(from_i, n):
		mm.set_instance_transform(k, xf)


func _city_color(seed_h: int) -> Color:
	match posmod(seed_h, 7):
		0: return Color(0.72, 0.74, 0.78)
		1: return Color(0.62, 0.48, 0.40)
		2: return Color(0.48, 0.56, 0.66)
		3: return Color(0.70, 0.68, 0.62)
		4: return Color(0.55, 0.52, 0.50)
		5: return Color(0.78, 0.72, 0.60)
		_: return Color(0.42, 0.44, 0.48)


func _suburb_color(seed_h: int) -> Color:
	match posmod(seed_h, 6):
		0: return Color(0.82, 0.70, 0.58)
		1: return Color(0.70, 0.42, 0.34)
		2: return Color(0.62, 0.70, 0.58)
		3: return Color(0.78, 0.76, 0.72)
		4: return Color(0.58, 0.52, 0.62)
		_: return Color(0.74, 0.62, 0.48)


# --- Unit meshes in [-0.5, 0.5]^3 (scaled by instance) ---

func _build_tower_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var wall := Color(1, 1, 1)
	var plinth := Color(0.55, 0.55, 0.58)
	var roof := Color(0.72, 0.72, 0.76)
	var trim := Color(0.82, 0.82, 0.85)
	var glass := Color(0.22, 0.28, 0.36)
	var ledge := Color(0.88, 0.88, 0.90)

	# Main shaft
	_box(st, Vector3(0, -0.02, 0), Vector3(0.88, 0.90, 0.88), wall)
	# Darker ground floor / lobby
	_box(st, Vector3(0, -0.42, 0), Vector3(0.90, 0.14, 0.90), plinth)
	# Mid ledge
	_box(st, Vector3(0, 0.05, 0), Vector3(0.94, 0.03, 0.94), ledge)
	# Upper setback
	_box(st, Vector3(0, 0.32, 0), Vector3(0.72, 0.28, 0.72), wall)
	# Crown / roof slab
	_box(st, Vector3(0, 0.48, 0), Vector3(0.80, 0.05, 0.80), roof)
	_box(st, Vector3(0, 0.455, 0), Vector3(0.84, 0.02, 0.84), trim)
	# Mechanical penthouse
	_box(st, Vector3(0.08, 0.46, -0.05), Vector3(0.28, 0.08, 0.22), plinth)

	# Facade inset window bands (4 sides)
	_facade_windows(st, glass, 0.45)
	st.generate_normals()
	return st.commit()


func _build_house_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var wall := Color(1, 1, 1)
	var roof_c := Color(0.55, 0.28, 0.22)
	var trim := Color(0.90, 0.88, 0.84)
	var door := Color(0.25, 0.2, 0.18)
	var glass := Color(0.25, 0.32, 0.40)
	var chimney := Color(0.45, 0.42, 0.40)

	# Body
	_box(st, Vector3(0, -0.08, 0), Vector3(0.92, 0.62, 0.78), wall)
	# Front porch slab
	_box(st, Vector3(0, -0.36, 0.42), Vector3(0.55, 0.04, 0.22), trim)
	# Door
	_box(st, Vector3(0, -0.22, 0.40), Vector3(0.14, 0.28, 0.04), door)
	# Windows front
	_box(st, Vector3(-0.28, -0.05, 0.40), Vector3(0.16, 0.16, 0.03), glass)
	_box(st, Vector3(0.28, -0.05, 0.40), Vector3(0.16, 0.16, 0.03), glass)
	# Side windows
	_box(st, Vector3(0.47, -0.05, 0.0), Vector3(0.03, 0.16, 0.16), glass)
	_box(st, Vector3(-0.47, -0.05, 0.0), Vector3(0.03, 0.16, 0.16), glass)

	# Pitched roof (two slabs)
	_box(st, Vector3(0, 0.28, -0.12), Vector3(1.02, 0.08, 0.55), roof_c)
	_box(st, Vector3(0, 0.28, 0.12), Vector3(1.02, 0.08, 0.55), roof_c)
	_box(st, Vector3(0, 0.36, 0), Vector3(0.95, 0.1, 0.2), roof_c)
	# Ridge trim
	_box(st, Vector3(0, 0.42, 0), Vector3(0.98, 0.03, 0.08), Color(0.4, 0.22, 0.18))
	# Chimney
	_box(st, Vector3(0.28, 0.42, -0.1), Vector3(0.1, 0.22, 0.1), chimney)

	st.generate_normals()
	return st.commit()


func _build_barn_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var wall := Color(1, 1, 1)
	var roof_c := Color(0.35, 0.38, 0.42)
	var door := Color(0.2, 0.16, 0.12)
	var trim := Color(0.75, 0.7, 0.6)

	_box(st, Vector3(0, -0.05, 0), Vector3(0.95, 0.75, 0.7), wall)
	# Big barn door
	_box(st, Vector3(0, -0.15, 0.36), Vector3(0.42, 0.48, 0.04), door)
	# Roof overhang
	_box(st, Vector3(0, 0.38, 0), Vector3(1.08, 0.1, 0.82), roof_c)
	_box(st, Vector3(0, 0.46, 0), Vector3(0.7, 0.12, 0.55), roof_c)
	# Silo hint attached
	_box(st, Vector3(0.55, 0.05, -0.05), Vector3(0.22, 0.95, 0.22), trim)
	_box(st, Vector3(0.55, 0.52, -0.05), Vector3(0.26, 0.08, 0.26), roof_c)

	st.generate_normals()
	return st.commit()


func _facade_windows(st: SurfaceTool, glass: Color, depth: float) -> void:
	# Shallow inset panes on four walls — pixel-readable from air.
	var cols := [-0.28, -0.09, 0.09, 0.28]
	var rows := [-0.28, -0.12, 0.04, 0.20]
	for z_sign in [-1.0, 1.0]:
		for c in cols:
			for r in rows:
				_box(st, Vector3(c, r, z_sign * 0.445), Vector3(0.12, 0.10, 0.03), glass)
	for x_sign in [-1.0, 1.0]:
		for c in cols:
			for r in rows:
				_box(st, Vector3(x_sign * 0.445, r, c), Vector3(0.03, 0.10, 0.12), glass)


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
	var faces := [
		[0, 1, 2, 3],
		[5, 4, 7, 6],
		[4, 0, 3, 7],
		[1, 5, 6, 2],
		[3, 2, 6, 7],
		[4, 5, 1, 0],
	]
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
