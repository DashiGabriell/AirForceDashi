extends Node3D
## Distant silhouette traffic so the sky isn't empty — 1 fighter + 1 airliner.


class Craft:
	var root: Node3D
	var kind: int ## 0 fighter, 1 airliner
	var yaw: float
	var speed: float
	var radius: float
	var alt: float
	var phase: float
	var center: Vector2


var _crafts: Array = []


func setup() -> void:
	_spawn(0, 3200.0, 2400.0, 110.0) # fighter silhouette
	_spawn(1, 4800.0, 3100.0, 72.0) # commercial
	set_process(true)


func _spawn(kind: int, radius: float, alt: float, speed: float) -> void:
	var c := Craft.new()
	c.kind = kind
	c.radius = radius
	c.alt = alt
	c.speed = speed
	c.phase = randf() * TAU
	c.yaw = c.phase + PI * 0.5
	c.center = Vector2.ZERO
	c.root = Node3D.new()
	c.root.name = "Traffic_%d" % kind
	add_child(c.root)
	_build_mesh(c.root, kind)
	_crafts.append(c)


func _build_mesh(root: Node3D, kind: int) -> void:
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(0.12, 0.13, 0.16, 0.92)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.no_depth_test = false

	if kind == 0:
		# Compact fighter silhouette (nose -Z)
		_box(root, mat, Vector3(0, 0, 0), Vector3(1.2, 0.55, 5.5))
		_box(root, mat, Vector3(0, 0.05, -0.2), Vector3(7.5, 0.12, 2.2))
		_box(root, mat, Vector3(-0.7, 0.7, 1.6), Vector3(0.12, 1.4, 1.2))
		_box(root, mat, Vector3(0.7, 0.7, 1.6), Vector3(0.12, 1.4, 1.2))
	else:
		# Airliner: long tube + high wings + twin engines + T-tail feel
		_box(root, mat, Vector3(0, 0, 0), Vector3(2.2, 2.0, 18.0))
		_box(root, mat, Vector3(0, 0.2, -8.5), Vector3(1.4, 1.4, 3.0))
		_box(root, mat, Vector3(0, 0.15, 0.5), Vector3(22.0, 0.25, 3.2))
		_box(root, mat, Vector3(-4.5, -0.7, 0.2), Vector3(1.4, 1.2, 3.5))
		_box(root, mat, Vector3(4.5, -0.7, 0.2), Vector3(1.4, 1.2, 3.5))
		_box(root, mat, Vector3(0, 2.4, 7.5), Vector3(0.25, 3.2, 2.0))
		_box(root, mat, Vector3(0, 3.8, 7.8), Vector3(5.5, 0.2, 1.4))


func _box(parent: Node3D, mat: Material, pos: Vector3, size: Vector3) -> void:
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	mi.mesh = box
	mi.material_override = mat
	mi.position = pos
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)


func _process(dt: float) -> void:
	if Game.generating or Game.paused:
		return
	var jet: Node3D = Game.jet
	if jet == null:
		return
	var half := Game.WORLD_SIZE * 0.5
	# Softly recenter orbits on the player so traffic stays visible
	var target := Vector2(jet.global_position.x, jet.global_position.z)
	for c in _crafts:
		c.center = c.center.lerp(target, 1.0 - exp(-0.08 * dt))
		c.phase += (c.speed / maxf(c.radius, 1.0)) * dt
		var x: float = c.center.x + cos(c.phase) * c.radius
		var z: float = c.center.y + sin(c.phase) * c.radius
		x = wrapf(x, -half, half)
		z = wrapf(z, -half, half)
		var y: float = c.alt + sin(c.phase * 0.7) * 40.0
		c.root.global_position = Vector3(x, y, z)
		# Face along tangent (nose -Z)
		var tx: float = -sin(c.phase)
		var tz: float = cos(c.phase)
		var look := Vector3(x + tx, y, z + tz)
		c.root.look_at(look, Vector3.UP)
		# Slight bank into turn
		c.root.rotate_object_local(Vector3.FORWARD, 0.22 if c.kind == 0 else 0.12)
