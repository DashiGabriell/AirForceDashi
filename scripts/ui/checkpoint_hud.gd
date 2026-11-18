extends Control
## CheckPoint mission overlay — black / red / white / grey.


const C_WHITE := Color(0.96, 0.96, 0.97, 1.0)
const C_GREY := Color(0.58, 0.58, 0.60, 1.0)
const C_RED := Color(0.82, 0.12, 0.14, 1.0)

var _display: FontFile
var _ui: FontFile
var _banner: String = ""
var _banner_t: float = 0.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_display = _load_font("res://fonts/BebasNeue-Regular.ttf")
	_ui = _load_font("res://fonts/Barlow-Regular.ttf")
	if _display == null:
		_display = _load_font("res://fonts/RobotoMono-Regular.ttf")
	if _ui == null:
		_ui = _load_font("res://fonts/RobotoMono-Regular.ttf")
	set_process(true)


func show_banner(text: String, seconds: float = 2.2) -> void:
	_banner = text
	_banner_t = seconds


func _process(dt: float) -> void:
	visible = Game.title_dismissed and not Game.generating and Game.play_mode == Game.PlayMode.CHECKPOINT and not Game.screenshot_mode
	if _banner_t > 0.0:
		_banner_t -= dt
		if _banner_t <= 0.0:
			_banner = ""
	queue_redraw()


func _draw() -> void:
	if not visible:
		return
	var s := size
	var font_title: Font = _display if _display else ThemeDB.fallback_font
	var font_ui: Font = _ui if _ui else ThemeDB.fallback_font

	# Top strip
	draw_rect(Rect2(0, 0, s.x, 36), Color(0.04, 0.04, 0.05, 0.72))
	draw_rect(Rect2(0, 0, s.x, 2), C_RED)

	var title := "CHECKPOINT  %d / %d" % [Game.cp_level, CheckpointLevels.LEVEL_COUNT]
	draw_string(font_title, Vector2(18, 26), title, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, C_WHITE)

	var rings := "GATES  %d / %d" % [Game.cp_ring_index, Game.cp_ring_total]
	draw_string(font_ui, Vector2(s.x * 0.5 - 40, 24), rings, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, C_GREY)

	var tcol := C_WHITE if Game.cp_time_left > 12.0 else C_RED
	var tstr := "TIME  %.0f" % ceil(Game.cp_time_left)
	draw_string(font_title, Vector2(s.x - 130, 26), tstr, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, tcol)

	# Status / banner
	if _banner != "":
		var bw := 320.0
		draw_rect(Rect2(s.x * 0.5 - bw * 0.5, s.y * 0.38, bw, 48), Color(0.05, 0.05, 0.06, 0.85))
		draw_rect(Rect2(s.x * 0.5 - bw * 0.5, s.y * 0.38, bw, 3), C_RED)
		draw_string(font_title, Vector2(s.x * 0.5 - 100, s.y * 0.38 + 34), _banner, HORIZONTAL_ALIGNMENT_LEFT, -1, 28, C_WHITE)

	if Game.cp_status == "WIN":
		draw_string(font_ui, Vector2(s.x * 0.5 - 150, s.y * 0.38 + 70), "N next   ·   R retry   ·   Esc menu", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, C_GREY)
	elif Game.cp_status == "FAIL":
		draw_string(font_ui, Vector2(s.x * 0.5 - 90, s.y * 0.38 + 70), "R retry   ·   Esc pause", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, C_GREY)
	elif Game.cp_active:
		draw_string(font_ui, Vector2(18, s.y - 18), "fly through the red gate  ·  R restart", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, C_GREY)

	# Direction caret toward next gate
	if Game.cp_active and Game.cp_ring_index < Game.cp_ring_total and Game.jet:
		_draw_gate_caret(s, font_ui)


func _draw_gate_caret(s: Vector2, font: Font) -> void:
	var jet: Node3D = Game.jet
	var to: Vector3 = Game.cp_next_pos - jet.global_position
	var dist: float = to.length()
	var local: Vector3 = jet.global_transform.basis.inverse() * to
	var ang: float = atan2(local.x, -local.z)
	var cx: float = s.x * 0.5
	var cy: float = 64.0
	var col := C_RED if absf(ang) < 0.35 else C_WHITE
	draw_string(font, Vector2(cx - 50, cy), "GATE  %.0fm" % dist, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, col)
	# Simple arrow
	var ax: float = cx + sin(ang) * 40.0
	var ay: float = cy + 18.0 - cos(ang) * 10.0
	draw_circle(Vector2(ax, ay), 4.0, col)


func _load_font(path: String) -> FontFile:
	if not FileAccess.file_exists(path):
		return null
	var f := FontFile.new()
	if f.load_dynamic_font(path) != OK:
		return null
	return f
