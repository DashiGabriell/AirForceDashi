extends Node3D
class_name AimMarker
## Subtle ground CCIP mark — thin cross, no flashy diamond.

var _cross: MeshInstance3D


func _ready() -> void:
	_cross = MeshInstance3D.new()
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var y := 0.5
	var c := Color(0.35, 1.0, 0.45, 0.75)
	# + cross on ground
	_box(st, Vector3(0, y, 0), Vector3(6.0, 0.08, 0.35), c)
	_box(st, Vector3(0, y, 0), Vector3(0.35, 0.08, 6.0), c)
	_cross.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.no_depth_test = true
	mat.render_priority = 10
	_cross.material_override = mat
	add_child(_cross)


func _box(st: SurfaceTool, center: Vector3, size: Vector3, color: Color) -> void:
	var hx := size.x * 0.5
	var hy := size.y * 0.5
	var hz := size.z * 0.5
	var v: Array[Vector3] = [
		center + Vector3(-hx, -hy, -hz), center + Vector3(hx, -hy, -hz),
		center + Vector3(hx, hy, -hz), center + Vector3(-hx, hy, -hz),
		center + Vector3(-hx, -hy, hz), center + Vector3(hx, -hy, hz),
		center + Vector3(hx, hy, hz), center + Vector3(-hx, hy, hz),
	]
	for f in [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]]:
		_tri(st, v[f[0]], v[f[1]], v[f[2]], color)
		_tri(st, v[f[0]], v[f[2]], v[f[3]], color)


func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, col: Color) -> void:
	st.set_color(col)
	st.add_vertex(a)
	st.set_color(col)
	st.add_vertex(b)
	st.set_color(col)
	st.add_vertex(c)


func _process(_dt: float) -> void:
	# Hide ground CCIP during CheckPoint — race mode, not A/G.
	if (
		Game.generating
		or not Game.title_dismissed
		or not Game.aim_valid
		or Game.play_mode == Game.PlayMode.CHECKPOINT
	):
		visible = false
		return
	visible = true
	global_position = Game.aim_world
	var mat := _cross.material_override as StandardMaterial3D
	if Game.aim_in_dlz:
		mat.albedo_color = Color(0.35, 1.0, 0.45, 0.7)
	elif Game.aim_ready:
		mat.albedo_color = Color(1.0, 0.85, 0.25, 0.55)
	else:
		mat.albedo_color = Color(1.0, 0.3, 0.25, 0.45)
