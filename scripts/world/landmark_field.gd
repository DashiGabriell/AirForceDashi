extends Node3D
## Phase 4: distant skyline LOD, night lights, river bridges, radio towers.

const MAX_SKYLINE := 420
const MAX_LIGHTS := 520
const MAX_GLOW := 28
const MAX_BRIDGES := 48
const MAX_TOWERS := 36
const SNAP := 180.0

var _gen: TerrainGenerator
var _skyline: MultiMeshInstance3D
var _lights: MultiMeshInstance3D
var _glow: MultiMeshInstance3D
var _bridges: MultiMeshInstance3D
var _towers: MultiMeshInstance3D
var _last_snap := Vector2(INF, INF)
var _night: float = 0.0
var _beacon_indices: PackedInt32Array = PackedInt32Array()


func setup(gen: TerrainGenerator) -> void:
	_gen = gen
	_skyline = _make_mm("Skyline", _box_mesh(), MAX_SKYLINE, false)
	_lights = _make_mm("NightLights", _box_mesh(), MAX_LIGHTS, true)
	_glow = _make_glow_mm("CityGlow", MAX_GLOW)
	_bridges = _make_mm("Bridges", _box_mesh(), MAX_BRIDGES, false)
	_towers = _make_mm("Towers", _box_mesh(), MAX_TOWERS, false)
	add_child(_skyline)
	add_child(_lights)
	add_child(_glow)
	add_child(_bridges)
	add_child(_towers)
	_hide_all(_skyline.multimesh, MAX_SKYLINE)
	_hide_all(_lights.multimesh, MAX_LIGHTS)
	_hide_all(_glow.multimesh, MAX_GLOW)
	_hide_all(_bridges.multimesh, MAX_BRIDGES)
	_hide_all(_towers.multimesh, MAX_TOWERS)
	set_process(true)


func set_night_factor(day_factor: float) -> void:
	# day_factor 1 = day, 0 = night
	_night = 1.0 - clampf(day_factor, 0.0, 1.0)
	# Hysteresis on light toggle — avoids flicker at the dusk/dawn threshold.
	if _lights:
		if _lights.visible:
			_lights.visible = _night > 0.28
		else:
			_lights.visible = _night > 0.45
	if _glow:
		if _glow.visible:
			_glow.visible = _night > 0.22
		else:
			_glow.visible = _night > 0.38
		var mat := _glow.material_override as StandardMaterial3D
		if mat:
			mat.albedo_color.a = lerpf(0.0, 0.22, clampf((_night - 0.22) / 0.5, 0.0, 1.0))
			mat.emission_energy_multiplier = lerpf(0.0, 1.8, clampf(_night, 0.0, 1.0))



func _process(_dt: float) -> void:
	if _night < 0.35 or _towers == null or _beacon_indices.is_empty():
		return
	var mm: MultiMesh = _towers.multimesh
	var t: float = Time.get_ticks_msec() * 0.001
	var flash: bool = int(t * 1.6) % 2 == 0
	var on_col := Color(1.0, 0.22, 0.18)
	var off_col := Color(0.35, 0.12, 0.1)
	for idx in _beacon_indices:
		mm.set_instance_color(idx, on_col if flash else off_col)


func refresh_around(center: Vector3) -> void:
	if _gen == null:
		return
	var sx: float = snappedf(center.x, SNAP)
	var sz: float = snappedf(center.z, SNAP)
	if Vector2(sx, sz).distance_to(_last_snap) < SNAP * 0.4:
		return
	_last_snap = Vector2(sx, sz)
	_refresh_skyline(sx, sz)
	_refresh_lights(sx, sz)
	_refresh_city_glow(sx, sz)
	_refresh_bridges(sx, sz)
	_refresh_towers(sx, sz)


func _refresh_skyline(sx: float, sz: float) -> void:
	# Richer far LOD: stepped towers, twin masses, spires — ring outside near buildings.
	var cell: float = Game.SKYLINE_CELL
	var r_in: float = Game.BUILDING_RADIUS * 0.82
	var r_out: float = Game.SKYLINE_RADIUS
	var half_w: float = Game.WORLD_SIZE * 0.5
	var i0: int = int(floor((sx + half_w - r_out) / cell))
	var i1: int = int(floor((sx + half_w + r_out) / cell))
	var j0: int = int(floor((sz + half_w - r_out) / cell))
	var j1: int = int(floor((sz + half_w + r_out) / cell))
	var mm: MultiMesh = _skyline.multimesh
	var count: int = 0

	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			if count >= MAX_SKYLINE:
				break
			var cx: float = wrapf(-half_w + (float(i) + 0.5) * cell, -half_w, half_w)
			var cz: float = wrapf(-half_w + (float(j) + 0.5) * cell, -half_w, half_w)
			var dist2: float = _torus_dist2(cx, cz, sx, sz)
			if dist2 < r_in * r_in or dist2 > r_out * r_out:
				continue
			var region: int = _gen.sample_region(cx, cz)
			if region != TerrainGenerator.Region.CITY and region != TerrainGenerator.Region.SUBURB:
				continue
			if _gen.is_roadish(cx, cz):
				continue
			var gh: float = _gen.sample_height(cx, cz)
			if gh <= Game.WATER_LEVEL + 2.0:
				continue
			var seed_h: int = i * 73856093 ^ j * 19349663
			var h: float
			var w: float
			var d: float
			if region == TerrainGenerator.Region.CITY:
				h = 48.0 + float(posmod(seed_h, 110))
				w = cell * (0.38 + float(posmod(seed_h >> 2, 40)) * 0.01)
				d = w * (0.72 + float(posmod(seed_h >> 5, 20)) * 0.02)
			else:
				h = 12.0 + float(posmod(seed_h, 22))
				w = cell * (0.32 + float(posmod(seed_h >> 3, 28)) * 0.01)
				d = w * 0.85
			var col := Color(0.36, 0.34, 0.40) if region == TerrainGenerator.Region.CITY else Color(0.50, 0.40, 0.34)
			match posmod(seed_h, 5):
				1: col = Color(0.42, 0.40, 0.38)
				2: col = Color(0.32, 0.38, 0.44)
				3: col = Color(0.46, 0.36, 0.32)
			if _night > 0.4:
				col = col.lerp(Color(0.55, 0.48, 0.35), _night * 0.45)
			# Main mass
			mm.set_instance_transform(count, Transform3D(Basis.from_scale(Vector3(w, h, d)), Vector3(cx, gh + h * 0.5, cz)))
			mm.set_instance_color(count, col)
			count += 1
			if count >= MAX_SKYLINE:
				break
			# Upper setback / crown for city towers
			if region == TerrainGenerator.Region.CITY and posmod(seed_h, 3) != 0:
				var h2: float = h * 0.28
				var w2: float = w * 0.62
				var d2: float = d * 0.62
				mm.set_instance_transform(count, Transform3D(Basis.from_scale(Vector3(w2, h2, d2)), Vector3(cx, gh + h + h2 * 0.45, cz)))
				mm.set_instance_color(count, col.lightened(0.08))
				count += 1
				if count >= MAX_SKYLINE:
					break
				# Occasional spire
				if posmod(seed_h, 7) == 0:
					var sp: float = 18.0 + float(posmod(seed_h >> 4, 24))
					mm.set_instance_transform(count, Transform3D(Basis.from_scale(Vector3(4.0, sp, 4.0)), Vector3(cx, gh + h + h2 + sp * 0.5, cz)))
					mm.set_instance_color(count, Color(0.55, 0.55, 0.58))
					count += 1
			# Twin slab for some suburbs / city blocks
			elif posmod(seed_h, 4) == 0 and count + 1 < MAX_SKYLINE:
				var ox: float = w * 0.55
				mm.set_instance_transform(count, Transform3D(Basis.from_scale(Vector3(w * 0.55, h * 0.75, d * 0.7)), Vector3(cx + ox, gh + h * 0.375, cz)))
				mm.set_instance_color(count, col.darkened(0.06))
				count += 1
		if count >= MAX_SKYLINE:
			break
	_hide_from(mm, count, MAX_SKYLINE)


func _refresh_lights(sx: float, sz: float) -> void:
	var cell: float = Game.BUILDING_CELL * 0.42
	var radius: float = Game.BUILDING_RADIUS * 0.95
	var half_w: float = Game.WORLD_SIZE * 0.5
	var i0: int = int(floor((sx + half_w - radius) / cell))
	var i1: int = int(floor((sx + half_w + radius) / cell))
	var j0: int = int(floor((sz + half_w - radius) / cell))
	var j1: int = int(floor((sz + half_w + radius) / cell))
	var mm: MultiMesh = _lights.multimesh
	var count: int = 0

	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			if count >= MAX_LIGHTS:
				break
			var seed_h: int = i * 83492791 ^ j * 2971215073
			# Densidade maior de janelas / postes
			if posmod(seed_h, 2) != 0:
				continue
			var cx: float = wrapf(-half_w + (float(i) + 0.5) * cell, -half_w, half_w)
			var cz: float = wrapf(-half_w + (float(j) + 0.5) * cell, -half_w, half_w)
			if _torus_dist2(cx, cz, sx, sz) > radius * radius:
				continue
			var region: int = _gen.sample_region(cx, cz)
			if region != TerrainGenerator.Region.CITY and region != TerrainGenerator.Region.SUBURB:
				continue
			var gh: float = _gen.sample_height(cx, cz)
			if gh <= Game.WATER_LEVEL + 2.0:
				continue

			var on_road: bool = _gen.is_roadish(cx, cz)
			var h: float
			var w: float
			var d: float
			var y: float
			var col: Color
			if on_road:
				h = 7.0 + float(posmod(seed_h, 4))
				w = 1.35
				d = 1.35
				y = gh + h
				col = Color(1.0, 0.88, 0.58)
			else:
				h = 2.2 + float(posmod(seed_h >> 2, 7))
				w = 14.0 + float(posmod(seed_h >> 4, 32))
				d = 2.5 + float(posmod(seed_h >> 6, 10))
				var base_h: float = 10.0 + float(posmod(seed_h, 70))
				y = gh + base_h
				col = Color(1.0, 0.80, 0.44) if posmod(seed_h, 4) != 0 else Color(0.78, 0.88, 1.0)

			var xf := Transform3D(Basis.from_scale(Vector3(w, h, d)), Vector3(cx, y, cz))
			mm.set_instance_transform(count, xf)
			mm.set_instance_color(count, col)
			count += 1
		if count >= MAX_LIGHTS:
			break
	_hide_from(mm, count, MAX_LIGHTS)
	_lights.visible = _night > 0.32


func _refresh_city_glow(sx: float, sz: float) -> void:
	var cell: float = Game.SKYLINE_CELL * 1.1
	var radius: float = Game.SKYLINE_RADIUS * 0.85
	var half_w: float = Game.WORLD_SIZE * 0.5
	var i0: int = int(floor((sx + half_w - radius) / cell))
	var i1: int = int(floor((sx + half_w + radius) / cell))
	var j0: int = int(floor((sz + half_w - radius) / cell))
	var j1: int = int(floor((sz + half_w + radius) / cell))
	var mm: MultiMesh = _glow.multimesh
	var count: int = 0
	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			if count >= MAX_GLOW:
				break
			var seed_h: int = i * 2654435761 ^ j * 1597334677
			if posmod(seed_h, 5) != 0:
				continue
			var cx: float = wrapf(-half_w + (float(i) + 0.5) * cell, -half_w, half_w)
			var cz: float = wrapf(-half_w + (float(j) + 0.5) * cell, -half_w, half_w)
			if _torus_dist2(cx, cz, sx, sz) > radius * radius:
				continue
			if _gen.sample_region(cx, cz) != TerrainGenerator.Region.CITY:
				continue
			var gh: float = _gen.sample_height(cx, cz)
			var r: float = 180.0 + float(posmod(seed_h >> 3, 160))
			var xf := Transform3D(Basis.from_scale(Vector3(r, 1.0, r)), Vector3(cx, gh + 12.0, cz))
			mm.set_instance_transform(count, xf)
			mm.set_instance_color(count, Color(1.0, 0.72, 0.38, 0.55))
			count += 1
		if count >= MAX_GLOW:
			break
	_hide_from(mm, count, MAX_GLOW)
	_glow.visible = _night > 0.28


func _refresh_bridges(sx: float, sz: float) -> void:
	var cell: float = Game.BRIDGE_CELL
	var radius: float = Game.LANDMARK_RADIUS
	var half_w: float = Game.WORLD_SIZE * 0.5
	var i0: int = int(floor((sx + half_w - radius) / cell))
	var i1: int = int(floor((sx + half_w + radius) / cell))
	var j0: int = int(floor((sz + half_w - radius) / cell))
	var j1: int = int(floor((sz + half_w + radius) / cell))
	var mm: MultiMesh = _bridges.multimesh
	var count: int = 0

	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			if count >= MAX_BRIDGES:
				break
			var seed_h: int = i * 2654435761 ^ j * 2246822519
			if posmod(seed_h, 5) != 0:
				continue
			var cx: float = wrapf(-half_w + (float(i) + 0.5) * cell, -half_w, half_w)
			var cz: float = wrapf(-half_w + (float(j) + 0.5) * cell, -half_w, half_w)
			if _torus_dist2(cx, cz, sx, sz) > radius * radius:
				continue
			if _gen.sample_region(cx, cz) != TerrainGenerator.Region.RIVER:
				continue

			# Span across the river: pick axis with more land on both sides.
			var land_x: int = 0
			var land_z: int = 0
			for s in [-120.0, 120.0]:
				var rx: int = _gen.sample_region(cx + s, cz)
				var rz: int = _gen.sample_region(cx, cz + s)
				if rx != TerrainGenerator.Region.RIVER and rx != TerrainGenerator.Region.WATER:
					land_x += 1
				if rz != TerrainGenerator.Region.RIVER and rz != TerrainGenerator.Region.WATER:
					land_z += 1
			var along_x: bool = land_x >= land_z

			var deck_len: float = 140.0 + float(posmod(seed_h, 80))
			var deck_w: float = 18.0
			var deck_h: float = 4.0
			var water_y: float = Game.WATER_LEVEL
			var deck_y: float = water_y + 12.0
			var sx_sc: float = deck_len if along_x else deck_w
			var sz_sc: float = deck_w if along_x else deck_len
			var xf := Transform3D(Basis.from_scale(Vector3(sx_sc, deck_h, sz_sc)), Vector3(cx, deck_y, cz))
			mm.set_instance_transform(count, xf)
			mm.set_instance_color(count, Color(0.42, 0.40, 0.38))
			count += 1
			if count >= MAX_BRIDGES:
				break
			# Two piers
			var pier_h: float = maxf(deck_y - water_y, 8.0)
			var pier_y: float = water_y + pier_h * 0.5
			var off: float = deck_len * 0.28
			var p1 := Vector3(cx + (off if along_x else 0.0), pier_y, cz + (0.0 if along_x else off))
			var p2 := Vector3(cx - (off if along_x else 0.0), pier_y, cz - (0.0 if along_x else off))
			mm.set_instance_transform(count, Transform3D(Basis.from_scale(Vector3(8, pier_h, 8)), p1))
			mm.set_instance_color(count, Color(0.35, 0.34, 0.32))
			count += 1
			if count >= MAX_BRIDGES:
				break
			mm.set_instance_transform(count, Transform3D(Basis.from_scale(Vector3(8, pier_h, 8)), p2))
			mm.set_instance_color(count, Color(0.35, 0.34, 0.32))
			count += 1
		if count >= MAX_BRIDGES:
			break
	_hide_from(mm, count, MAX_BRIDGES)


func _refresh_towers(sx: float, sz: float) -> void:
	var cell: float = Game.TOWER_CELL
	var radius: float = Game.LANDMARK_RADIUS
	var half_w: float = Game.WORLD_SIZE * 0.5
	var i0: int = int(floor((sx + half_w - radius) / cell))
	var i1: int = int(floor((sx + half_w + radius) / cell))
	var j0: int = int(floor((sz + half_w - radius) / cell))
	var j1: int = int(floor((sz + half_w + radius) / cell))
	var mm: MultiMesh = _towers.multimesh
	var count: int = 0
	_beacon_indices = PackedInt32Array()

	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			if count >= MAX_TOWERS:
				break
			var seed_h: int = i * 1597334677 ^ j * 3812015801
			if posmod(seed_h, 11) != 0:
				continue
			var cx: float = wrapf(-half_w + (float(i) + 0.5) * cell, -half_w, half_w)
			var cz: float = wrapf(-half_w + (float(j) + 0.5) * cell, -half_w, half_w)
			if _torus_dist2(cx, cz, sx, sz) > radius * radius:
				continue
			var region: int = _gen.sample_region(cx, cz)
			if region == TerrainGenerator.Region.WATER or region == TerrainGenerator.Region.RIVER:
				continue
			var gh: float = _gen.sample_height(cx, cz)
			if gh < 25.0:
				continue
			# Prefer high ground / city edge.
			if region != TerrainGenerator.Region.CITY and region != TerrainGenerator.Region.ROCK and region != TerrainGenerator.Region.SUBURB:
				if posmod(seed_h, 3) != 0:
					continue
			var mast_h: float = 55.0 + float(posmod(seed_h, 70))
			var xf := Transform3D(Basis.from_scale(Vector3(3.5, mast_h, 3.5)), Vector3(cx, gh + mast_h * 0.5, cz))
			mm.set_instance_transform(count, xf)
			mm.set_instance_color(count, Color(0.55, 0.55, 0.58))
			count += 1
			if count >= MAX_TOWERS:
				break
			# Tip beacon
			var tip := Transform3D(Basis.from_scale(Vector3(5.5, 5.5, 5.5)), Vector3(cx, gh + mast_h + 2.0, cz))
			mm.set_instance_transform(count, tip)
			var beacon := Color(1.0, 0.25, 0.2) if _night > 0.4 else Color(0.7, 0.3, 0.25)
			mm.set_instance_color(count, beacon)
			_beacon_indices.append(count)
			count += 1
		if count >= MAX_TOWERS:
			break
	_hide_from(mm, count, MAX_TOWERS)


func _torus_dist2(cx: float, cz: float, sx: float, sz: float) -> float:
	var dx: float = absf(cx - sx)
	var dz: float = absf(cz - sz)
	dx = minf(dx, Game.WORLD_SIZE - dx)
	dz = minf(dz, Game.WORLD_SIZE - dz)
	return dx * dx + dz * dz


func _box_mesh() -> BoxMesh:
	var box := BoxMesh.new()
	box.size = Vector3.ONE
	return box


func _make_mm(node_name: String, mesh: Mesh, count: int, emissive: bool) -> MultiMeshInstance3D:
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1.0
	mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	if emissive:
		mat.emission_enabled = true
		mat.emission = Color(1, 0.85, 0.55)
		mat.emission_energy_multiplier = 2.8
		mat.vertex_color_is_srgb = true
		# Avoid z-fight flicker against building facades
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
		mat.albedo_color = Color(1, 1, 1, 0.92)

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
	if emissive:
		mi.sorting_offset = 2.0
	return mi


func _make_glow_mm(node_name: String, count: int) -> MultiMeshInstance3D:
	var disc := CylinderMesh.new()
	disc.top_radius = 1.0
	disc.bottom_radius = 1.0
	disc.height = 0.08
	disc.radial_segments = 12
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.vertex_color_use_as_albedo = true
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Color(1.0, 0.7, 0.35, 0.18)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.65, 0.3)
	mat.emission_energy_multiplier = 1.2
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.no_depth_test = false
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = disc
	mm.instance_count = count
	var mi := MultiMeshInstance3D.new()
	mi.name = node_name
	mi.multimesh = mm
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.visible = false
	return mi


func _hide_all(mm: MultiMesh, n: int) -> void:
	_hide_from(mm, 0, n)


func _hide_from(mm: MultiMesh, from_i: int, n: int) -> void:
	var xf := Transform3D(Basis.from_scale(Vector3(0.01, 0.01, 0.01)), Vector3(0, -9999, 0))
	for k in range(from_i, n):
		mm.set_instance_transform(k, xf)
