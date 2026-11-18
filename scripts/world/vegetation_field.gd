extends Node3D
## Phase 3: MultiMesh trees + farm hedges near the jet only.

const MAX_TREES := 880
const MAX_HEDGES := 420
const SNAP := 110.0

var _gen: TerrainGenerator
var _trees: MultiMeshInstance3D
var _hedges: MultiMeshInstance3D
var _last_snap := Vector2(INF, INF)


func setup(gen: TerrainGenerator) -> void:
	_gen = gen
	_trees = _make_mm("Trees", _build_tree_mesh(), MAX_TREES)
	_hedges = _make_mm("Hedges", _build_hedge_mesh(), MAX_HEDGES)
	add_child(_trees)
	add_child(_hedges)
	_hide_all(_trees.multimesh, MAX_TREES)
	_hide_all(_hedges.multimesh, MAX_HEDGES)


func refresh_around(center: Vector3) -> void:
	if _gen == null or _trees == null:
		return
	var sx: float = snappedf(center.x, SNAP)
	var sz: float = snappedf(center.z, SNAP)
	if Vector2(sx, sz).distance_to(_last_snap) < SNAP * 0.45:
		return
	_last_snap = Vector2(sx, sz)
	_refresh_trees(sx, sz)
	_refresh_hedges(sx, sz)


func _refresh_trees(sx: float, sz: float) -> void:
	var cell: float = Game.VEG_TREE_CELL
	var radius: float = Game.VEG_RADIUS
	var half_w: float = Game.WORLD_SIZE * 0.5
	var i0: int = int(floor((sx + half_w - radius) / cell))
	var i1: int = int(floor((sx + half_w + radius) / cell))
	var j0: int = int(floor((sz + half_w - radius) / cell))
	var j1: int = int(floor((sz + half_w + radius) / cell))
	var mm: MultiMesh = _trees.multimesh
	var count: int = 0

	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			if count >= MAX_TREES:
				break
			var seed_h: int = i * 73856093 ^ j * 19349663
			var jitter_x: float = (float(posmod(seed_h, 1000)) / 1000.0 - 0.5) * cell * 0.7
			var jitter_z: float = (float(posmod(seed_h >> 5, 1000)) / 1000.0 - 0.5) * cell * 0.7
			var cx: float = wrapf(-half_w + (float(i) + 0.5) * cell + jitter_x, -half_w, half_w)
			var cz: float = wrapf(-half_w + (float(j) + 0.5) * cell + jitter_z, -half_w, half_w)
			if not _in_radius(cx, cz, sx, sz, radius):
				continue

			var region: int = _gen.sample_region(cx, cz)
			if not _tree_allowed(region, seed_h):
				continue
			if _gen.is_roadish(cx, cz):
				continue

			var gh: float = _gen.sample_height(cx, cz)
			if gh <= Game.WATER_LEVEL + 1.5:
				continue

			var scale_y: float = 10.0 + float(posmod(seed_h, 18))
			var scale_xz: float = 6.0 + float(posmod(seed_h >> 3, 10))
			if region == TerrainGenerator.Region.FOREST:
				scale_y *= 1.25
				scale_xz *= 1.15
			elif region == TerrainGenerator.Region.SUBURB:
				scale_y *= 0.75
				scale_xz *= 0.8

			var yaw: float = float(posmod(seed_h >> 8, 628)) * 0.01
			var basis := Basis(Vector3.UP, yaw).scaled(Vector3(scale_xz, scale_y, scale_xz))
			var xf := Transform3D(basis, Vector3(cx, gh, cz))
			mm.set_instance_transform(count, xf)
			mm.set_instance_color(count, _tree_color(region, seed_h))
			count += 1
		if count >= MAX_TREES:
			break

	_hide_from(mm, count, MAX_TREES)


func _refresh_hedges(sx: float, sz: float) -> void:
	var cell: float = Game.VEG_HEDGE_CELL
	var radius: float = Game.VEG_RADIUS * 0.92
	var half_w: float = Game.WORLD_SIZE * 0.5
	var i0: int = int(floor((sx + half_w - radius) / cell))
	var i1: int = int(floor((sx + half_w + radius) / cell))
	var j0: int = int(floor((sz + half_w - radius) / cell))
	var j1: int = int(floor((sz + half_w + radius) / cell))
	var mm: MultiMesh = _hedges.multimesh
	var count: int = 0

	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			if count >= MAX_HEDGES:
				break
			var seed_h: int = i * 83492791 ^ j * 2971215073
			var cx: float = wrapf(-half_w + (float(i) + 0.5) * cell, -half_w, half_w)
			var cz: float = wrapf(-half_w + (float(j) + 0.5) * cell, -half_w, half_w)
			if not _in_radius(cx, cz, sx, sz, radius):
				continue

			var region: int = _gen.sample_region(cx, cz)
			if region != TerrainGenerator.Region.FARM:
				continue

			var gh: float = _gen.sample_height(cx, cz)
			if gh <= Game.WATER_LEVEL + 2.0:
				continue

			# Alternate horizontal / vertical hedge segments along the farm grid.
			var horizontal: bool = posmod(i + j, 2) == 0
			var length: float = cell * 0.86
			var thick: float = 3.2 + float(posmod(seed_h, 3))
			var tall: float = 3.5 + float(posmod(seed_h >> 2, 4))
			var w: float = length if horizontal else thick
			var d: float = thick if horizontal else length
			var basis := Basis.from_scale(Vector3(w, tall, d))
			var xf := Transform3D(basis, Vector3(cx, gh + tall * 0.5, cz))
			mm.set_instance_transform(count, xf)
			mm.set_instance_color(count, Color(0.20, 0.28, 0.16))
			count += 1
		if count >= MAX_HEDGES:
			break

	_hide_from(mm, count, MAX_HEDGES)


func _tree_allowed(region: int, seed_h: int) -> bool:
	match region:
		TerrainGenerator.Region.FOREST:
			return posmod(seed_h, 3) != 0  # dense
		TerrainGenerator.Region.FARM:
			return posmod(seed_h, 5) == 0  # windbreaks / clumps
		TerrainGenerator.Region.MEADOW:
			return posmod(seed_h, 8) == 0
		TerrainGenerator.Region.SUBURB:
			return posmod(seed_h, 11) == 0
		_:
			return false


func _tree_color(region: int, seed_h: int) -> Color:
	if region == TerrainGenerator.Region.FOREST:
		match posmod(seed_h, 5):
			0: return Color(0.72, 0.22, 0.18)
			1: return Color(0.85, 0.45, 0.18)
			2: return Color(0.82, 0.68, 0.22)
			3: return Color(0.28, 0.38, 0.22)
			_: return Color(0.55, 0.42, 0.18)
	if region == TerrainGenerator.Region.FARM:
		return Color(0.34, 0.44, 0.24) if posmod(seed_h, 2) == 0 else Color(0.48, 0.52, 0.26)
	return Color(0.40, 0.50, 0.28)


func _in_radius(cx: float, cz: float, sx: float, sz: float, radius: float) -> bool:
	var dx: float = absf(cx - sx)
	var dz: float = absf(cz - sz)
	dx = minf(dx, Game.WORLD_SIZE - dx)
	dz = minf(dz, Game.WORLD_SIZE - dz)
	return dx * dx + dz * dz <= radius * radius


func _make_mm(node_name: String, mesh: Mesh, count: int) -> MultiMeshInstance3D:
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1.0
	mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED

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


func _build_tree_mesh() -> ArrayMesh:
	# Unit tree: trunk + canopy blob (scaled per instance).
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_add_box(st, Vector3(0.0, 0.18, 0.0), Vector3(0.14, 0.36, 0.14), Color(0.32, 0.20, 0.12))
	_add_box(st, Vector3(0.0, 0.62, 0.0), Vector3(0.62, 0.55, 0.62), Color(1.0, 1.0, 1.0))
	_add_box(st, Vector3(0.0, 0.95, 0.0), Vector3(0.42, 0.35, 0.42), Color(0.92, 0.92, 0.92))
	st.generate_normals()
	return st.commit()


func _build_hedge_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_add_box(st, Vector3.ZERO, Vector3.ONE, Color(1, 1, 1))
	st.generate_normals()
	return st.commit()


func _add_box(st: SurfaceTool, center: Vector3, size: Vector3, col: Color) -> void:
	var hx: float = size.x * 0.5
	var hy: float = size.y * 0.5
	var hz: float = size.z * 0.5
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
		[0, 1, 2, 3], # -Z
		[5, 4, 7, 6], # +Z
		[4, 0, 3, 7], # -X
		[1, 5, 6, 2], # +X
		[3, 2, 6, 7], # +Y
		[4, 5, 1, 0], # -Y
	]
	for f in faces:
		_add_quad(st, p[f[0]], p[f[1]], p[f[2]], p[f[3]], col)


func _add_quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color) -> void:
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
