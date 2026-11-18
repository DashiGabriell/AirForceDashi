extends Node3D
## Phase 5 (final world layer): traffic, airports, industrial stacks + smoke.

const MAX_CARS := 220
const MAX_HEADLIGHTS := 440
const MAX_AIRPORT := 64
const MAX_STACKS := 40
const MAX_SMOKE := 8
const SNAP := 120.0

var _gen: TerrainGenerator
var _cars: MultiMeshInstance3D
var _headlights: MultiMeshInstance3D
var _airport: MultiMeshInstance3D
var _stacks: MultiMeshInstance3D
var _smoke_nodes: Array[GPUParticles3D] = []
var _last_snap := Vector2(INF, INF)
var _car_meta: Array[Dictionary] = []


func setup(gen: TerrainGenerator) -> void:
	_gen = gen
	_cars = _make_mm("Cars", _box_mesh(), MAX_CARS, false)
	_headlights = _make_mm("Headlights", _box_mesh(), MAX_HEADLIGHTS, true)
	_airport = _make_mm("Airport", _box_mesh(), MAX_AIRPORT, false)
	_stacks = _make_mm("Stacks", _box_mesh(), MAX_STACKS, false)
	add_child(_cars)
	add_child(_headlights)
	add_child(_airport)
	add_child(_stacks)
	_hide_all(_cars.multimesh, MAX_CARS)
	_hide_all(_headlights.multimesh, MAX_HEADLIGHTS)
	_hide_all(_airport.multimesh, MAX_AIRPORT)
	_hide_all(_stacks.multimesh, MAX_STACKS)
	_build_smoke_pool()
	set_process(true)


func _process(dt: float) -> void:
	_tick_cars(dt)


func refresh_around(center: Vector3) -> void:
	if _gen == null:
		return
	var sx: float = snappedf(center.x, SNAP)
	var sz: float = snappedf(center.z, SNAP)
	if Vector2(sx, sz).distance_to(_last_snap) < SNAP * 0.4:
		return
	_last_snap = Vector2(sx, sz)
	_refresh_cars(sx, sz)
	_refresh_airports(sx, sz)
	_refresh_stacks(sx, sz)


func _refresh_cars(sx: float, sz: float) -> void:
	var cell: float = Game.TRAFFIC_CELL
	var radius: float = Game.TRAFFIC_RADIUS
	var half_w: float = Game.WORLD_SIZE * 0.5
	var i0: int = int(floor((sx + half_w - radius) / cell))
	var i1: int = int(floor((sx + half_w + radius) / cell))
	var j0: int = int(floor((sz + half_w - radius) / cell))
	var j1: int = int(floor((sz + half_w + radius) / cell))
	var mm: MultiMesh = _cars.multimesh
	_car_meta.clear()
	var count: int = 0

	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			if count >= MAX_CARS:
				break
			var seed_h: int = i * 2654435761 ^ j * 1597334677
			if posmod(seed_h, 3) != 0:
				continue
			var cx: float = wrapf(-half_w + (float(i) + 0.5) * cell, -half_w, half_w)
			var cz: float = wrapf(-half_w + (float(j) + 0.5) * cell, -half_w, half_w)
			if _torus_dist2(cx, cz, sx, sz) > radius * radius:
				continue
			var region: int = _gen.sample_region(cx, cz)
			if region != TerrainGenerator.Region.CITY and region != TerrainGenerator.Region.SUBURB:
				continue
			if not _gen.is_roadish(cx, cz):
				continue
			var gh: float = _gen.sample_height(cx, cz)
			if gh <= Game.WATER_LEVEL + 1.0:
				continue

			# Avenue alignment: prefer the axis that still looks like road nearby.
			var along_x: bool = _gen.is_roadish(cx + 40.0, cz) or _gen.is_roadish(cx - 40.0, cz)
			if not along_x and not (_gen.is_roadish(cx, cz + 40.0) or _gen.is_roadish(cx, cz - 40.0)):
				along_x = posmod(seed_h, 2) == 0

			var speed: float = 28.0 + float(posmod(seed_h >> 3, 35))
			var phase: float = float(posmod(seed_h >> 7, 1000)) * 0.001
			_car_meta.append({
				"i": count,
				"ox": cx,
				"oz": cz,
				"along_x": along_x,
				"speed": speed,
				"phase": phase,
				"gh": gh + 1.2,
				"len": 7.5 + float(posmod(seed_h >> 2, 6)),
				"wid": 3.2,
				"col": _car_color(seed_h),
			})
			count += 1
		if count >= MAX_CARS:
			break

	_hide_from(mm, count, MAX_CARS)
	_tick_cars(0.0)


func _tick_cars(_dt: float) -> void:
	if _cars == null:
		return
	if _car_meta.is_empty():
		if _headlights:
			_hide_all(_headlights.multimesh, MAX_HEADLIGHTS)
			_headlights.visible = false
		return
	var mm: MultiMesh = _cars.multimesh
	var hm: MultiMesh = _headlights.multimesh if _headlights else null
	var night: bool = Game.day_factor < 0.42
	var t: float = Time.get_ticks_msec() * 0.001
	var span: float = Game.TRAFFIC_CELL * 0.85
	var hi: int = 0
	for meta in _car_meta:
		var i: int = int(meta["i"])
		var along_x: bool = bool(meta["along_x"])
		var travel: float = fposmod(t * float(meta["speed"]) + float(meta["phase"]) * span, span) - span * 0.5
		var x: float = float(meta["ox"]) + (travel if along_x else 0.0)
		var z: float = float(meta["oz"]) + (0.0 if along_x else travel)
		var length: float = float(meta["len"])
		var wid: float = float(meta["wid"])
		var sx: float = length if along_x else wid
		var sz: float = wid if along_x else length
		var y: float = float(meta["gh"])
		var xf := Transform3D(Basis.from_scale(Vector3(sx, 2.2, sz)), Vector3(x, y, z))
		mm.set_instance_transform(i, xf)
		mm.set_instance_color(i, meta["col"])

		if hm and night and hi + 1 < MAX_HEADLIGHTS:
			var fwd: float = length * 0.52
			var hx: float = x + (fwd if along_x else 0.0)
			var hz: float = z + (0.0 if along_x else fwd)
			var hsx: float = (1.8 if along_x else 1.1)
			var hsz: float = (1.1 if along_x else 1.8)
			hm.set_instance_transform(hi, Transform3D(Basis.from_scale(Vector3(hsx, 0.9, hsz)), Vector3(hx, y + 0.6, hz)))
			hm.set_instance_color(hi, Color(1.0, 0.92, 0.65))
			hi += 1
			# Tail lights
			var tx: float = x - (fwd if along_x else 0.0)
			var tz: float = z - (0.0 if along_x else fwd)
			hm.set_instance_transform(hi, Transform3D(Basis.from_scale(Vector3(hsx * 0.7, 0.7, hsz * 0.7)), Vector3(tx, y + 0.5, tz)))
			hm.set_instance_color(hi, Color(1.0, 0.2, 0.15))
			hi += 1
	if hm:
		_hide_from(hm, hi, MAX_HEADLIGHTS)
		_headlights.visible = night


func _refresh_airports(sx: float, sz: float) -> void:
	var mm: MultiMesh = _airport.multimesh
	var count: int = 0
	var radius: float = Game.AIRPORT_RADIUS
	for ap in _gen.airports:
		var cx: float = ap.x
		var cz: float = ap.y
		if _torus_dist2(cx, cz, sx, sz) > radius * radius:
			continue
		var gh: float = maxf(_gen.sample_height(cx, cz), Game.WATER_LEVEL + 1.0)
		var seed_h: int = int(cx * 0.1) * 73856093 ^ int(cz * 0.1) * 19349663
		var along_x: bool = posmod(seed_h, 2) == 0

		# Runway strip
		var run_len: float = 520.0
		var run_w: float = 28.0
		var rsx: float = run_len if along_x else run_w
		var rsz: float = run_w if along_x else run_len
		mm.set_instance_transform(count, Transform3D(Basis.from_scale(Vector3(rsx, 1.2, rsz)), Vector3(cx, gh + 0.6, cz)))
		mm.set_instance_color(count, Color(0.22, 0.22, 0.24))
		count += 1
		if count >= MAX_AIRPORT:
			break

		# Taxi / apron
		var apron := Vector3(cx + (0.0 if along_x else 90.0), gh + 0.5, cz + (90.0 if along_x else 0.0))
		mm.set_instance_transform(count, Transform3D(Basis.from_scale(Vector3(120, 1.0, 80)), apron))
		mm.set_instance_color(count, Color(0.28, 0.28, 0.30))
		count += 1
		if count >= MAX_AIRPORT:
			break

		# Terminal + hangars
		var terminal := Vector3(cx + (0.0 if along_x else 130.0), gh + 10.0, cz + (130.0 if along_x else 0.0))
		mm.set_instance_transform(count, Transform3D(Basis.from_scale(Vector3(90, 18, 40)), terminal))
		mm.set_instance_color(count, Color(0.62, 0.64, 0.68))
		count += 1
		if count >= MAX_AIRPORT:
			break
		for h in 3:
			if count >= MAX_AIRPORT:
				break
			var hx: float = cx + ( -140.0 + float(h) * 70.0 if along_x else 160.0)
			var hz: float = cz + (160.0 if along_x else -140.0 + float(h) * 70.0)
			mm.set_instance_transform(count, Transform3D(Basis.from_scale(Vector3(48, 14, 36)), Vector3(hx, gh + 7.0, hz)))
			mm.set_instance_color(count, Color(0.45, 0.42, 0.38))
			count += 1

		# Runway threshold marks (bright)
		if count < MAX_AIRPORT:
			var tip := Vector3(
				cx + (run_len * 0.42 if along_x else 0.0),
				gh + 1.0,
				cz + (0.0 if along_x else run_len * 0.42)
			)
			mm.set_instance_transform(count, Transform3D(Basis.from_scale(Vector3(18 if along_x else 8, 0.8, 8 if along_x else 18)), tip))
			mm.set_instance_color(count, Color(0.9, 0.9, 0.85))
			count += 1

	_hide_from(mm, count, MAX_AIRPORT)


func _refresh_stacks(sx: float, sz: float) -> void:
	var cell: float = Game.STACK_CELL
	var radius: float = Game.TRAFFIC_RADIUS
	var half_w: float = Game.WORLD_SIZE * 0.5
	var i0: int = int(floor((sx + half_w - radius) / cell))
	var i1: int = int(floor((sx + half_w + radius) / cell))
	var j0: int = int(floor((sz + half_w - radius) / cell))
	var j1: int = int(floor((sz + half_w + radius) / cell))
	var mm: MultiMesh = _stacks.multimesh
	var count: int = 0
	var smoke_pts: Array[Vector3] = []

	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			if count >= MAX_STACKS:
				break
			var seed_h: int = i * 2246822519 ^ j * 3266489917
			if posmod(seed_h, 9) != 0:
				continue
			var cx: float = wrapf(-half_w + (float(i) + 0.5) * cell, -half_w, half_w)
			var cz: float = wrapf(-half_w + (float(j) + 0.5) * cell, -half_w, half_w)
			if _torus_dist2(cx, cz, sx, sz) > radius * radius:
				continue
			if _gen.sample_region(cx, cz) != TerrainGenerator.Region.CITY:
				continue
			if _gen.is_roadish(cx, cz):
				continue
			var gh: float = _gen.sample_height(cx, cz)
			var h: float = 35.0 + float(posmod(seed_h, 45))
			mm.set_instance_transform(count, Transform3D(Basis.from_scale(Vector3(10, h, 10)), Vector3(cx, gh + h * 0.5, cz)))
			mm.set_instance_color(count, Color(0.35, 0.34, 0.36))
			smoke_pts.append(Vector3(cx, gh + h + 2.0, cz))
			count += 1
		if count >= MAX_STACKS:
			break

	_hide_from(mm, count, MAX_STACKS)
	_place_smoke(smoke_pts)


func _place_smoke(pts: Array[Vector3]) -> void:
	for i in _smoke_nodes.size():
		var p: GPUParticles3D = _smoke_nodes[i]
		if i < pts.size():
			p.global_position = pts[i]
			p.emitting = true
			p.visible = true
		else:
			p.emitting = false
			p.visible = false


func _build_smoke_pool() -> void:
	_smoke_nodes.clear()
	for i in MAX_SMOKE:
		var p := GPUParticles3D.new()
		p.name = "Smoke%d" % i
		p.amount = 18
		p.lifetime = 4.5
		p.emitting = false
		p.visible = false
		p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var pm := ParticleProcessMaterial.new()
		pm.direction = Vector3(0, 1, 0)
		pm.spread = 12.0
		pm.initial_velocity_min = 4.0
		pm.initial_velocity_max = 9.0
		pm.gravity = Vector3(Game.wind_dir.x * 2.0, 1.5, Game.wind_dir.z * 2.0)
		pm.scale_min = 2.5
		pm.scale_max = 6.0
		pm.color = Color(0.35, 0.35, 0.38, 0.35)
		p.process_material = pm
		var dm := SphereMesh.new()
		dm.radius = 1.2
		var sm := StandardMaterial3D.new()
		sm.albedo_color = Color(0.4, 0.4, 0.42, 0.3)
		sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		dm.material = sm
		p.draw_pass_1 = dm
		add_child(p)
		_smoke_nodes.append(p)


func _car_color(seed_h: int) -> Color:
	match posmod(seed_h, 6):
		0: return Color(0.75, 0.2, 0.18)
		1: return Color(0.2, 0.25, 0.55)
		2: return Color(0.85, 0.85, 0.88)
		3: return Color(0.15, 0.15, 0.16)
		4: return Color(0.2, 0.45, 0.28)
		_: return Color(0.7, 0.55, 0.2)


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
		mat.emission = Color(1.0, 0.9, 0.6)
		mat.emission_energy_multiplier = 3.2
		mat.vertex_color_use_as_albedo = true
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
