extends Node3D
## Sliding-window terrain + water + MultiMesh buildings on a 10× world.

signal ready_world

const TERRAIN_SNAP := 64.0

@onready var sun: DirectionalLight3D = $Sun
@onready var env_node: WorldEnvironment = $WorldEnvironment

var terrain_gen: TerrainGenerator
var terrain_mesh: MeshInstance3D
var water_mesh: MeshInstance3D
var building_field: Node3D
var vegetation_field: Node3D
var landmark_field: Node3D
var detail_field: Node3D
var street_field: Node3D
var cloud_root: Node3D
var air_traffic: Node3D
var weather_fx: Node3D
var _sky_mat: ShaderMaterial
var _cloud_mat: ShaderMaterial
var _terrain_mat: ShaderMaterial
var _water_mat: ShaderMaterial
var _cloud_puffs: Array[Node3D] = []
var _cloud_shadows: Array[MeshInstance3D] = []
var _cloud_base_scales: Array[Vector3] = []
var _follow_snap := Vector2(INF, INF)
var _rain_timer: float = 90.0
var _rain_left: float = 0.0


func begin_generation() -> void:
	terrain_gen = TerrainGenerator.new()
	await terrain_gen.generate(func(p: float): Game.set_progress(p))
	Game.height_sampler = terrain_gen.sample_height
	_build_terrain()
	_build_water()
	_build_buildings()
	_build_vegetation()
	_build_landmarks()
	_build_details()
	_build_streets()
	_build_sky()
	_build_clouds()
	_build_air_traffic()
	_build_weather_fx()
	_setup_sun()
	_apply_time_visuals()
	Game.finish_generation()
	ready_world.emit()
	set_process(true)


func _process(dt: float) -> void:
	if Game.generating:
		return
	if Game.paused:
		return
	_advance_time(dt)
	_update_weather(dt)
	_drift_clouds(dt)
	_follow_player()
	_apply_time_visuals()


func _follow_player() -> void:
	var jet: Node3D = Game.jet
	if jet == null or terrain_mesh == null:
		return
	var p: Vector3 = jet.global_position
	var sx: float = snappedf(p.x, TERRAIN_SNAP)
	var sz: float = snappedf(p.z, TERRAIN_SNAP)
	if Vector2(sx, sz).distance_squared_to(_follow_snap) > 0.01:
		_follow_snap = Vector2(sx, sz)
		terrain_mesh.global_position = Vector3(sx, 0.0, sz)
		if water_mesh:
			water_mesh.global_position = Vector3(sx, Game.WATER_LEVEL + 0.05, sz)
	if building_field:
		building_field.call("refresh_around", p)
	if vegetation_field:
		vegetation_field.call("refresh_around", p)
	if landmark_field:
		landmark_field.call("refresh_around", p)
	if detail_field:
		detail_field.call("refresh_around", p)
	if street_field:
		street_field.call("refresh_around", p)
	_update_region_under_jet(p)


func _update_region_under_jet(p: Vector3) -> void:
	if terrain_gen == null:
		return
	var r: int = terrain_gen.sample_region(p.x, p.z)
	Game.over_region = r
	Game.over_region_name = TerrainGenerator.region_label(r)

	var place: Dictionary = terrain_gen.nearest_place(p.x, p.z)
	if place.is_empty():
		Game.place_name = ""
		Game.place_kind = ""
		Game.place_dist = 0.0
	else:
		Game.place_name = str(place.get("name", ""))
		Game.place_kind = str(place.get("kind", ""))
		Game.place_dist = float(place.get("dist", 0.0))

	var ap: Dictionary = terrain_gen.nearest_airport(p.x, p.z)
	if ap.is_empty():
		Game.nearest_airport_name = ""
		Game.nearest_airport_pos = Vector2.ZERO
		Game.nearest_airport_dist = 0.0
		Game.nearest_airport_brg = 0.0
	else:
		Game.nearest_airport_name = str(ap.get("name", "Airfield"))
		var apos: Vector2 = ap.get("pos", Vector2.ZERO)
		Game.nearest_airport_pos = apos
		Game.nearest_airport_dist = float(ap.get("dist", 0.0))
		var delta: Vector2 = TerrainGenerator.wrap_delta(Vector2(p.x, p.z), apos)
		var brg: float = rad_to_deg(atan2(delta.x, -delta.y))
		if brg < 0.0:
			brg += 360.0
		Game.nearest_airport_brg = brg

	Game.compass_pois = terrain_gen.nearby_pois(p.x, p.z, 8, 6500.0)
	Game.near_airport = Game.nearest_airport_dist > 0.0 and Game.nearest_airport_dist < 900.0


func _advance_time(dt: float) -> void:
	var cycle: float = Game.DAY_PHASE_SECONDS * 2.0
	Game.time_of_day = fposmod(Game.time_of_day + dt / cycle, 1.0)
	var elev: float = sin(Game.time_of_day * TAU)
	var az: float = cos(Game.time_of_day * TAU)
	Game.sun_dir = Vector3(az * 0.85, elev, 0.4 * az + 0.15).normalized()
	Game.day_factor = smoothstep(-0.08, 0.35, Game.sun_dir.y)
	Game.is_night = Game.day_factor < 0.35


func _update_weather(dt: float) -> void:
	var tod: float = Game.time_of_day
	var morning: float = 0.0
	if tod < 0.22:
		morning = 1.0 - tod / 0.22
	elif tod > 0.92:
		morning = (tod - 0.92) / 0.08
	Game.fog_boost = clampf(morning * Game.day_factor, 0.0, 1.0)

	var afternoon: float = 0.0
	if tod >= 0.18 and tod <= 0.48:
		afternoon = sin(((tod - 0.18) / 0.30) * PI)
	Game.cloud_density = lerpf(0.45, 1.15, clampf(afternoon, 0.0, 1.0) * Game.day_factor)
	if Game.is_night:
		Game.cloud_density = lerpf(Game.cloud_density, 0.4, 0.5)

	if _rain_left > 0.0:
		_rain_left -= dt
		Game.raining = true
		Game.rain_intensity = clampf(_rain_left / 18.0, 0.25, 0.85) * maxf(Game.cloud_density, 0.5)
		if _rain_left <= 0.0:
			Game.raining = false
			Game.rain_intensity = 0.0
			_rain_timer = randf_range(70.0, 160.0)
	else:
		Game.raining = false
		Game.rain_intensity = 0.0
		_rain_timer -= dt
		if _rain_timer <= 0.0 and Game.cloud_density > 0.75 and Game.day_factor > 0.35:
			_rain_left = randf_range(22.0, 48.0)
			_rain_timer = 9999.0
		elif _rain_timer <= 0.0:
			_rain_timer = randf_range(40.0, 90.0)

	var dens: float = Game.cloud_density
	for i in _cloud_puffs.size():
		var base: Vector3 = _cloud_base_scales[i] if i < _cloud_base_scales.size() else Vector3.ONE
		var s: float = lerpf(0.85, 1.35, clampf((dens - 0.45) / 0.7, 0.0, 1.0))
		_cloud_puffs[i].scale = base * s


func _drift_clouds(dt: float) -> void:
	if cloud_root == null:
		return
	var half := Game.WORLD_SIZE * 0.5
	var wind_mul: float = lerpf(1.0, 1.45, clampf(Game.cloud_density - 0.45, 0.0, 1.0))
	var drift: Vector3 = Game.wind_dir * Game.wind_speed * wind_mul * dt
	drift.y = 0.0
	for puff in _cloud_puffs:
		puff.position += drift
		puff.position.x = wrapf(puff.position.x, -half, half)
		puff.position.z = wrapf(puff.position.z, -half, half)
	for i in _cloud_shadows.size():
		if i >= _cloud_puffs.size():
			break
		var p: Node3D = _cloud_puffs[i]
		var sh: MeshInstance3D = _cloud_shadows[i]
		sh.position = Vector3(p.position.x + 40.0, 1.2, p.position.z + 28.0)
		sh.scale = Vector3.ONE * lerpf(0.9, 1.35, clampf(Game.cloud_density - 0.4, 0.0, 1.0))
		var sm := sh.material_override as StandardMaterial3D
		if sm:
			sm.albedo_color.a = lerpf(0.18, 0.38, clampf(Game.cloud_density - 0.4, 0.0, 1.0)) * Game.day_factor


func _apply_time_visuals() -> void:
	var d: float = Game.day_factor
	var sd: Vector3 = Game.sun_dir
	if _sky_mat:
		_sky_mat.set_shader_parameter("sun_dir", sd)
		_sky_mat.set_shader_parameter("day_factor", d)
	if _cloud_mat:
		_cloud_mat.set_shader_parameter("sun_dir", sd)
		_cloud_mat.set_shader_parameter("day_factor", d)
		_cloud_mat.set_shader_parameter("density", Game.cloud_density)
	if _terrain_mat:
		_terrain_mat.set_shader_parameter("sun_dir", sd)
	if _water_mat:
		_water_mat.set_shader_parameter("sun_dir", sd)
	if landmark_field:
		landmark_field.call("set_night_factor", d)

	if sun:
		sun.global_transform = _look_from_dir(sd)
		sun.light_color = Color(1.0, 0.78, 0.52).lerp(Color(0.55, 0.65, 0.95), 1.0 - d)
		var overcast: float = clampf((Game.cloud_density - 0.6) * 1.2, 0.0, 1.0)
		if Game.raining:
			overcast = maxf(overcast, 0.55)
		sun.light_energy = lerpf(0.12, 1.2, d) * lerpf(1.0, 0.55, overcast)
		sun.shadow_enabled = d > 0.2 and overcast < 0.85

	if env_node and env_node.environment:
		var e := env_node.environment
		e.ambient_light_color = Color(0.48, 0.62, 0.82).lerp(Color(0.06, 0.08, 0.14), 1.0 - d)
		e.ambient_light_energy = lerpf(0.16, 0.52, d)
		var fog_col_day := Color(0.62, 0.78, 0.95).lerp(Color(0.78, 0.84, 0.90), Game.fog_boost)
		e.fog_light_color = fog_col_day.lerp(Color(0.08, 0.1, 0.16), 1.0 - d)
		var base_fog: float = lerpf(0.00010, 0.00018, d)
		e.fog_density = base_fog + Game.fog_boost * 0.00055 + Game.rain_intensity * 0.00022
		e.fog_aerial_perspective = lerpf(0.35, 0.55, Game.fog_boost)


func _build_terrain() -> void:
	terrain_mesh = MeshInstance3D.new()
	terrain_mesh.name = "Terrain"
	var plane := PlaneMesh.new()
	plane.size = Vector2(Game.TERRAIN_VIEW, Game.TERRAIN_VIEW)
	plane.subdivide_width = Game.TERRAIN_SUBDIV
	plane.subdivide_depth = Game.TERRAIN_SUBDIV
	terrain_mesh.mesh = plane
	_terrain_mat = ShaderMaterial.new()
	_terrain_mat.shader = load("res://shaders/terrain.gdshader")
	_terrain_mat.set_shader_parameter("height_tex", terrain_gen.height_tex)
	_terrain_mat.set_shader_parameter("color_tex", terrain_gen.color_tex)
	_terrain_mat.set_shader_parameter("world_size", Game.WORLD_SIZE)
	_terrain_mat.set_shader_parameter("height_scale", TerrainGenerator.HEIGHT_SCALE)
	_terrain_mat.set_shader_parameter("height_res", float(TerrainGenerator.RES))
	_terrain_mat.set_shader_parameter("sun_dir", Game.sun_dir)
	terrain_mesh.material_override = _terrain_mat
	terrain_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(terrain_mesh)


func _build_water() -> void:
	water_mesh = MeshInstance3D.new()
	water_mesh.name = "Water"
	var plane := PlaneMesh.new()
	plane.size = Vector2(Game.TERRAIN_VIEW * 1.05, Game.TERRAIN_VIEW * 1.05)
	plane.subdivide_width = 48
	plane.subdivide_depth = 48
	water_mesh.mesh = plane
	_water_mat = ShaderMaterial.new()
	_water_mat.shader = load("res://shaders/water.gdshader")
	_water_mat.set_shader_parameter("height_tex", terrain_gen.height_tex)
	_water_mat.set_shader_parameter("world_size", Game.WORLD_SIZE)
	_water_mat.set_shader_parameter("height_scale", TerrainGenerator.HEIGHT_SCALE)
	_water_mat.set_shader_parameter("sun_dir", Game.sun_dir)
	water_mesh.material_override = _water_mat
	water_mesh.position.y = Game.WATER_LEVEL + 0.05
	water_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(water_mesh)


func _build_buildings() -> void:
	var bf_script: GDScript = load("res://scripts/world/building_field.gd")
	building_field = bf_script.new()
	building_field.name = "BuildingField"
	add_child(building_field)
	building_field.call("setup", terrain_gen)


func _build_vegetation() -> void:
	var vg_script: GDScript = load("res://scripts/world/vegetation_field.gd")
	vegetation_field = vg_script.new()
	vegetation_field.name = "VegetationField"
	add_child(vegetation_field)
	vegetation_field.call("setup", terrain_gen)


func _build_landmarks() -> void:
	var lm_script: GDScript = load("res://scripts/world/landmark_field.gd")
	landmark_field = lm_script.new()
	landmark_field.name = "LandmarkField"
	add_child(landmark_field)
	landmark_field.call("setup", terrain_gen)
	landmark_field.call("set_night_factor", Game.day_factor)


func _build_details() -> void:
	var df_script: GDScript = load("res://scripts/world/detail_field.gd")
	detail_field = df_script.new()
	detail_field.name = "DetailField"
	add_child(detail_field)
	detail_field.call("setup", terrain_gen)


func _build_streets() -> void:
	var sf_script: GDScript = load("res://scripts/world/street_field.gd")
	street_field = sf_script.new()
	street_field.name = "StreetField"
	add_child(street_field)
	street_field.call("setup", terrain_gen)


func _build_air_traffic() -> void:
	var at_script: GDScript = load("res://scripts/world/air_traffic.gd")
	air_traffic = at_script.new()
	air_traffic.name = "AirTraffic"
	add_child(air_traffic)
	air_traffic.call("setup")


func _build_weather_fx() -> void:
	var wx_script: GDScript = load("res://scripts/fx/weather_fx.gd")
	weather_fx = wx_script.new()
	weather_fx.name = "WeatherFX"
	add_child(weather_fx)
	weather_fx.call("setup")


func _build_sky() -> void:
	var sky := Sky.new()
	_sky_mat = ShaderMaterial.new()
	_sky_mat.shader = load("res://shaders/sky.gdshader")
	_sky_mat.set_shader_parameter("sun_dir", Game.sun_dir)
	_sky_mat.set_shader_parameter("day_factor", Game.day_factor)
	sky.sky_material = _sky_mat
	var e := Environment.new()
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.48, 0.62, 0.82)
	e.ambient_light_energy = 0.52
	e.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	e.fog_enabled = true
	e.fog_light_color = Color(0.62, 0.78, 0.95)
	e.fog_density = 0.00012
	e.fog_aerial_perspective = 0.35
	env_node.environment = e


func _build_clouds() -> void:
	cloud_root = Node3D.new()
	cloud_root.name = "Clouds"
	add_child(cloud_root)
	_cloud_mat = ShaderMaterial.new()
	_cloud_mat.shader = load("res://shaders/cloud.gdshader")
	_cloud_mat.set_shader_parameter("day_factor", Game.day_factor)
	_cloud_mat.set_shader_parameter("sun_dir", Game.sun_dir)

	var rng := RandomNumberGenerator.new()
	rng.seed = 1234
	_cloud_puffs.clear()
	_cloud_shadows.clear()
	_cloud_base_scales.clear()

	# Sparse banks over the large map (cost stays flat).
	for i in 48:
		var bank := Node3D.new()
		var x: float = rng.randf_range(-Game.WORLD_SIZE * 0.48, Game.WORLD_SIZE * 0.48)
		var z: float = rng.randf_range(-Game.WORLD_SIZE * 0.48, Game.WORLD_SIZE * 0.48)
		var base_y: float = rng.randf_range(Game.CLOUD_BASE_MIN, Game.CLOUD_BASE_MAX)
		bank.position = Vector3(x, base_y, z)
		cloud_root.add_child(bank)
		_cloud_puffs.append(bank)
		_cloud_base_scales.append(Vector3.ONE)

		var blobs: int = rng.randi_range(5, 9)
		var bank_scale: float = rng.randf_range(1.0, 1.7)
		for b in blobs:
			var mi := MeshInstance3D.new()
			var sphere := SphereMesh.new()
			var r: float = rng.randf_range(28.0, 70.0) * bank_scale
			sphere.radius = r
			sphere.height = r * rng.randf_range(1.5, 2.1)
			sphere.radial_segments = 8
			sphere.rings = 5
			mi.mesh = sphere
			mi.material_override = _cloud_mat
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mi.position = Vector3(
				rng.randf_range(-55.0, 55.0) * bank_scale,
				rng.randf_range(0.0, 90.0) * bank_scale,
				rng.randf_range(-45.0, 45.0) * bank_scale
			)
			mi.scale = Vector3(
				rng.randf_range(0.9, 1.4),
				rng.randf_range(1.0, 1.5),
				rng.randf_range(0.9, 1.4)
			)
			bank.add_child(mi)

		var shadow := MeshInstance3D.new()
		var disc := CylinderMesh.new()
		disc.top_radius = 90.0 * bank_scale
		disc.bottom_radius = disc.top_radius
		disc.height = 0.5
		disc.radial_segments = 10
		shadow.mesh = disc
		var sm := StandardMaterial3D.new()
		sm.albedo_color = Color(0.2, 0.16, 0.28, 0.28)
		sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		shadow.material_override = sm
		shadow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		shadow.position = Vector3(x + 40.0, 1.2, z + 28.0)
		cloud_root.add_child(shadow)
		_cloud_shadows.append(shadow)


func _setup_sun() -> void:
	sun.light_color = Color(1.0, 0.78, 0.52)
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 6000.0
	sun.global_transform = _look_from_dir(Game.sun_dir)


func _look_from_dir(dir: Vector3) -> Transform3D:
	var d := dir.normalized()
	if absf(d.y) > 0.99:
		d = Vector3(0.2, d.y, 0.1).normalized()
	var origin := d * 800.0
	return Transform3D(Basis.looking_at(-d, Vector3.UP), origin)
