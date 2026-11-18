extends ColorRect
## Soft red vignette when below safe AGL. Audio is driven by PatrolAudio.


var _mat: ShaderMaterial
var _pulse: float = 0.0
var _shown: float = 0.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_mat = ShaderMaterial.new()
	_mat.shader = load("res://shaders/low_alt_vignette.gdshader")
	_mat.set_shader_parameter("intensity", 0.0)
	_mat.set_shader_parameter("pulse", 0.0)
	material = _mat
	color = Color(1, 1, 1, 1)
	set_process(true)


func _process(dt: float) -> void:
	if Game.generating or not Game.title_dismissed or Game.paused or Game.screenshot_mode:
		_shown = move_toward(_shown, 0.0, dt * 4.0)
		_apply()
		return

	var target: float = Game.low_alt_intensity if Game.warn_low_alt else 0.0
	# Hide in free cam photo wander unless critically low
	if Game.camera_mode == Game.Cam.FREE and target < 0.55:
		target *= 0.35

	_shown = lerpf(_shown, target, 1.0 - exp(-6.0 * dt))
	if _shown > 0.02:
		_pulse = fposmod(_pulse + dt * lerpf(1.6, 3.2, _shown), TAU)
	_apply()


func _apply() -> void:
	if _mat == null:
		return
	var pulse_n: float = 0.5 + 0.5 * sin(_pulse)
	_mat.set_shader_parameter("intensity", _shown)
	_mat.set_shader_parameter("pulse", pulse_n)
	visible = _shown > 0.01
