extends Node3D
## Occasional light rain: camera-following streaks + wet ground tiles.


var _rain: GPUParticles3D
var _wet: MultiMeshInstance3D
var _wet_mm: MultiMesh
const WET_MAX := 48


func setup() -> void:
	_rain = GPUParticles3D.new()
	_rain.name = "RainStreaks"
	_rain.amount = 220
	_rain.lifetime = 0.55
	_rain.visibility_aabb = AABB(Vector3(-80, -40, -80), Vector3(160, 120, 160))
	_rain.emitting = false
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0.15, -1.0, 0.08)
	pm.spread = 6.0
	pm.initial_velocity_min = 38.0
	pm.initial_velocity_max = 62.0
	pm.gravity = Vector3(0, -20.0, 0)
	pm.scale_min = 0.04
	pm.scale_max = 0.09
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(55.0, 8.0, 55.0)
	pm.color = Color(0.72, 0.78, 0.88, 0.55)
	_rain.process_material = pm
	var streak := BoxMesh.new()
	streak.size = Vector3(0.04, 0.9, 0.04)
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(0.75, 0.82, 0.92, 0.45)
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.no_depth_test = true
	streak.material = sm
	_rain.draw_pass_1 = streak
	add_child(_rain)

	_wet_mm = MultiMesh.new()
	_wet_mm.transform_format = MultiMesh.TRANSFORM_3D
	_wet_mm.use_colors = true
	_wet_mm.instance_count = WET_MAX
	var disc := CylinderMesh.new()
	disc.top_radius = 1.0
	disc.bottom_radius = 1.0
	disc.height = 0.04
	disc.radial_segments = 8
	_wet_mm.mesh = disc
	_wet = MultiMeshInstance3D.new()
	_wet.name = "WetTiles"
	_wet.multimesh = _wet_mm
	var wm := StandardMaterial3D.new()
	wm.albedo_color = Color(0.25, 0.28, 0.32, 0.35)
	wm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	wm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	wm.vertex_color_use_as_albedo = true
	_wet.material_override = wm
	_wet.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_wet)
	_hide_wet()
	set_process(true)


func _process(_dt: float) -> void:
	if Game.generating or Game.paused:
		return
	var jet: Node3D = Game.jet
	if jet == null:
		return
	var raining: bool = Game.raining and Game.rain_intensity > 0.05
	_rain.emitting = raining
	_rain.amount_ratio = clampf(Game.rain_intensity, 0.15, 1.0)
	# Follow above the jet
	global_position = jet.global_position + Vector3(0, 18.0, 0)
	if raining:
		_layout_wet(jet.global_position)
	else:
		_hide_wet()


func _layout_wet(center: Vector3) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = int(floor(center.x * 0.2) * 73856093) ^ int(floor(center.z * 0.2) * 19349663)
	var n: int = int(lerpf(8.0, float(WET_MAX), Game.rain_intensity))
	for i in WET_MAX:
		if i >= n:
			_wet_mm.set_instance_transform(i, Transform3D(Basis.from_scale(Vector3(0.01, 0.01, 0.01)), Vector3(0, -9999, 0)))
			continue
		var ox: float = rng.randf_range(-48.0, 48.0)
		var oz: float = rng.randf_range(-48.0, 48.0)
		var x: float = center.x + ox
		var z: float = center.z + oz
		var gy: float = Game.WATER_LEVEL
		if Game.height_sampler.is_valid():
			gy = maxf(Game.height_sampler.call(x, z), Game.WATER_LEVEL)
		var r: float = rng.randf_range(1.2, 3.8)
		var xf := Transform3D(Basis.from_scale(Vector3(r, 1.0, r)), Vector3(x, gy + 0.08, z))
		_wet_mm.set_instance_transform(i, xf)
		var a: float = 0.18 + 0.35 * Game.rain_intensity * rng.randf()
		_wet_mm.set_instance_color(i, Color(0.2, 0.24, 0.28, a))


func _hide_wet() -> void:
	for i in WET_MAX:
		_wet_mm.set_instance_transform(i, Transform3D(Basis.from_scale(Vector3(0.01, 0.01, 0.01)), Vector3(0, -9999, 0)))
