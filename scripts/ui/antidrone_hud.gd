extends Control
## Anti-Drone overlay: lock ring, kill/leak strip, threat radar.


const C_WHITE := Color(0.96, 0.96, 0.97, 1.0)
const C_GREY := Color(0.58, 0.58, 0.60, 1.0)
const C_RED := Color(0.82, 0.12, 0.14, 1.0)
const C_LOCK := Color(0.95, 0.22, 0.18, 1.0)
const C_OK := Color(0.55, 0.85, 0.45, 1.0)
const C_PANEL := Color(0.05, 0.05, 0.06, 0.88)

const RADAR_RANGE := 1600.0
const RADAR_R := 78.0
const LOCK_R := 72.0

var _display: FontFile
var _ui: FontFile
var _banner: String = ""
var _banner_t: float = 0.0
var _popup_title: String = ""
var _popup_sub: String = ""
var _popup_t: float = 0.0
var _popup_max: float = 1.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_display = _load_font("res://fonts/BebasNeue-Regular.ttf")
	_ui = _load_font("res://fonts/Barlow-Regular.ttf")
	if _display == null:
		_display = _load_font("res://fonts/RobotoMono-Regular.ttf")
	if _ui == null:
		_ui = _load_font("res://fonts/RobotoMono-Regular.ttf")
	set_process(true)


func show_banner(text: String, seconds: float = 2.0) -> void:
	_banner = text
	_banner_t = seconds
	_popup_title = ""
	_popup_t = 0.0


func show_level_popup(title: String, subtitle: String, seconds: float = 2.4) -> void:
	_banner = ""
	_banner_t = 0.0
	_popup_title = title
	_popup_sub = subtitle
	_popup_t = seconds
	_popup_max = maxf(seconds, 0.01)


func _process(dt: float) -> void:
	visible = Game.title_dismissed and not Game.generating and Game.play_mode == Game.PlayMode.ANTI_DRONE and not Game.screenshot_mode
	if _banner_t > 0.0:
		_banner_t -= dt
		if _banner_t <= 0.0:
			_banner = ""
	if _popup_t > 0.0:
		_popup_t -= dt
		if _popup_t <= 0.0:
			_popup_title = ""
			_popup_sub = ""
	queue_redraw()


func _draw() -> void:
	if not visible:
		return
	var s := size
	var font_title: Font = _display if _display else ThemeDB.fallback_font
	var font_ui: Font = _ui if _ui else ThemeDB.fallback_font

	draw_rect(Rect2(0, 0, s.x, 36), Color(0.04, 0.04, 0.05, 0.72))
	draw_rect(Rect2(0, 0, s.x, 2), C_RED)

	var title := "ANTI-DRONE  %d / %d" % [Game.ad_level, AntiDroneLevels.LEVEL_COUNT]
	draw_string(font_title, Vector2(18, 26), title, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, C_WHITE)

	var kills := "KILLS  %d / %d" % [Game.ad_kills, Game.ad_total]
	draw_string(font_ui, Vector2(s.x * 0.38, 24), kills, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, C_GREY)

	var leak_col := C_WHITE if Game.ad_leaks < Game.ad_max_leaks else C_RED
	var leaks := "LEAKS  %d / %d" % [Game.ad_leaks, Game.ad_max_leaks]
	draw_string(font_title, Vector2(s.x - 150, 26), leaks, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, leak_col)

	if Game.ad_active or Game.ad_status == "RUN":
		_draw_lock_ring(s, font_title, font_ui)

	if _popup_title != "":
		_draw_popup(s, font_title, font_ui)
	elif _banner != "":
		var bw := 360.0
		draw_rect(Rect2(s.x * 0.5 - bw * 0.5, s.y * 0.36, bw, 48), Color(0.05, 0.05, 0.06, 0.88))
		draw_rect(Rect2(s.x * 0.5 - bw * 0.5, s.y * 0.36, bw, 3), C_RED)
		var tw: float = font_title.get_string_size(_banner, HORIZONTAL_ALIGNMENT_LEFT, -1, 26).x
		draw_string(font_title, Vector2(s.x * 0.5 - tw * 0.5, s.y * 0.36 + 34), _banner, HORIZONTAL_ALIGNMENT_LEFT, -1, 26, C_WHITE)

	if Game.ad_status == "WIN" and Game.ad_level >= AntiDroneLevels.LEVEL_COUNT and _popup_title == "":
		draw_string(font_ui, Vector2(s.x * 0.5 - 90, s.y * 0.36 + 70), "R retry   ·   Esc menu", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, C_GREY)
	elif Game.ad_status == "FAIL":
		draw_string(font_ui, Vector2(s.x * 0.5 - 90, s.y * 0.36 + 70), "R retry   ·   Esc pause", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, C_GREY)
	elif Game.ad_active:
		# Keep clear of bottom-left pilot badge
		draw_string(font_ui, Vector2(18, s.y - 78), "hold bore on target 3s to lock  ·  LMB fire  ·  R restart", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, C_GREY)

	if Game.ad_active and Game.jet:
		_draw_radar(s, font_title, font_ui)


func _draw_lock_ring(s: Vector2, font_title: Font, font_ui: Font) -> void:
	var center := s * 0.5
	# Lock ring follows nose boresight (not ground CCIP)
	if Game.bore_screen.x >= 0.0:
		center = Game.bore_screen

	var prog: float = clampf(Game.ad_lock_progress, 0.0, 1.0)
	var locked: bool = Game.ad_locked
	var col := C_OK if locked else C_LOCK.lerp(C_WHITE, 0.35)
	var pulse: float = 1.0
	if locked:
		pulse = 0.75 + 0.25 * sin(Time.get_ticks_msec() * 0.012)

	# Outer ring
	draw_arc(center, LOCK_R, 0.0, TAU, 64, Color(col.r, col.g, col.b, 0.35 * pulse), 2.0, true)
	# Progress arc
	if prog > 0.001 and not locked:
		var a0: float = -PI * 0.5
		var a1: float = a0 + TAU * prog
		draw_arc(center, LOCK_R, a0, a1, 48, col, 3.5, true)
	elif locked:
		draw_arc(center, LOCK_R, 0.0, TAU, 64, Color(col.r, col.g, col.b, pulse), 3.5, true)
		# Corner brackets
		var b: float = LOCK_R * 0.72
		var tick := 10.0
		for dir in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
			var corner: Vector2 = center + dir * b
			draw_line(corner, corner - Vector2(dir.x, 0) * tick, col, 2.0)
			draw_line(corner, corner - Vector2(0, dir.y) * tick, col, 2.0)

	# Crosshair
	draw_line(center + Vector2(-12, 0), center + Vector2(12, 0), Color(C_WHITE.r, C_WHITE.g, C_WHITE.b, 0.7), 1.0)
	draw_line(center + Vector2(0, -12), center + Vector2(0, 12), Color(C_WHITE.r, C_WHITE.g, C_WHITE.b, 0.7), 1.0)

	var label := "LOCK" if locked else ("TRACK  %d%%" % int(prog * 100.0) if prog > 0.02 else "SEEK")
	var lw: float = font_title.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
	draw_string(font_title, Vector2(center.x - lw * 0.5, center.y + LOCK_R + 22.0), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, col)

	if locked and is_instance_valid(Game.ad_lock_target) and Game.ad_lock_target is DroneUnit:
		var kind_n: String = AntiDroneLevels.kind_name((Game.ad_lock_target as DroneUnit).kind)
		var kw: float = font_ui.get_string_size(kind_n, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
		draw_string(font_ui, Vector2(center.x - kw * 0.5, center.y + LOCK_R + 38.0), kind_n, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, C_GREY)


func _draw_popup(s: Vector2, font_title: Font, font_ui: Font) -> void:
	var elapsed: float = _popup_max - _popup_t
	var a: float = minf(clampf(elapsed / 0.12, 0.0, 1.0), clampf(_popup_t / 0.2, 0.0, 1.0))
	var bw := 440.0
	var bh := 96.0
	var bx: float = s.x * 0.5 - bw * 0.5
	var by: float = s.y * 0.34
	draw_rect(Rect2(bx, by, bw, bh), Color(0.05, 0.05, 0.06, 0.92 * a))
	draw_rect(Rect2(bx, by, bw, 4.0), Color(C_RED.r, C_RED.g, C_RED.b, a))
	var tsz := 34
	var tw: float = font_title.get_string_size(_popup_title, HORIZONTAL_ALIGNMENT_LEFT, -1, tsz).x
	draw_string(font_title, Vector2(bx + (bw - tw) * 0.5, by + 42.0), _popup_title, HORIZONTAL_ALIGNMENT_LEFT, -1, tsz, Color(C_WHITE.r, C_WHITE.g, C_WHITE.b, a))
	var ssz := 14
	var sw: float = font_ui.get_string_size(_popup_sub, HORIZONTAL_ALIGNMENT_LEFT, -1, ssz).x
	draw_string(font_ui, Vector2(bx + (bw - sw) * 0.5, by + 72.0), _popup_sub, HORIZONTAL_ALIGNMENT_LEFT, -1, ssz, Color(C_GREY.r, C_GREY.g, C_GREY.b, a))


func _draw_radar(s: Vector2, font_title: Font, font_ui: Font) -> void:
	var jet: Node3D = Game.jet
	var cx: float = s.x - 28.0 - RADAR_R
	var cy: float = s.y - 28.0 - RADAR_R
	var center := Vector2(cx, cy)
	var pad := 18.0
	var panel := Rect2(cx - RADAR_R - pad, cy - RADAR_R - pad - 18.0, (RADAR_R + pad) * 2.0, (RADAR_R + pad) * 2.0 + 22.0)
	draw_rect(panel, C_PANEL)
	draw_rect(Rect2(panel.position.x, panel.position.y, panel.size.x, 2.0), C_RED)
	draw_string(font_title, Vector2(panel.position.x + 12.0, panel.position.y + 16.0), "THREAT", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, C_WHITE)

	draw_circle(center, RADAR_R + 2.0, Color(0.12, 0.12, 0.14, 1.0))
	draw_arc(center, RADAR_R, 0.0, TAU, 48, Color(0.45, 0.45, 0.48, 0.9), 2.0, true)
	draw_arc(center, RADAR_R * 0.5, 0.0, TAU, 32, Color(0.3, 0.3, 0.32, 0.5), 1.0, true)
	draw_line(center + Vector2(-RADAR_R, 0), center + Vector2(RADAR_R, 0), Color(0.28, 0.28, 0.3, 0.7), 1.0)
	draw_line(center + Vector2(0, -RADAR_R), center + Vector2(0, RADAR_R), Color(0.28, 0.28, 0.3, 0.7), 1.0)

	var nose := PackedVector2Array([
		center + Vector2(0, -7),
		center + Vector2(-5, 6),
		center + Vector2(0, 3),
		center + Vector2(5, 6),
	])
	draw_colored_polygon(nose, C_WHITE)

	# Plot all threats from course children via Game.ad_threat_pos + scan
	var course: Node = get_tree().get_first_node_in_group("antidrone_course")
	var listed: Array = []
	if course and course.has_method("get_alive_drones"):
		listed = course.get_alive_drones()
	elif Game.ad_threat_pos != Vector3.ZERO:
		listed = [null]

	var scale: float = (RADAR_R - 8.0) / RADAR_RANGE
	if listed.is_empty() and Game.ad_threat_pos != Vector3.ZERO:
		_plot_blip(center, jet, Game.ad_threat_pos, scale, C_RED, false)
	else:
		for d in listed:
			if d == null or not is_instance_valid(d):
				continue
			var is_lock: bool = (d == Game.ad_lock_target)
			var col := C_OK if is_lock and Game.ad_locked else C_RED
			_plot_blip(center, jet, d.global_position, scale, col, is_lock)

	draw_string(font_ui, Vector2(panel.position.x + 12.0, panel.end.y - 8.0), "ALIVE %d" % Game.ad_alive, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, C_GREY)


func _plot_blip(center: Vector2, jet: Node3D, world_pos: Vector3, scale: float, col: Color, highlight: bool) -> void:
	var to: Vector3 = world_pos - jet.global_position
	var local: Vector3 = jet.global_transform.basis.inverse() * to
	var flat := Vector2(local.x, local.z)
	if flat.length() < 0.001:
		flat = Vector2(0, -1)
	var blip: Vector2 = flat * scale
	if blip.length() > RADAR_R - 8.0:
		blip = blip.normalized() * (RADAR_R - 8.0)
	var p: Vector2 = center + blip
	if highlight:
		draw_circle(p, 7.0, Color(col.r, col.g, col.b, 0.25))
	draw_circle(p, 4.0, col)
	draw_circle(p, 1.6, C_WHITE)


func _load_font(path: String) -> FontFile:
	if not FileAccess.file_exists(path):
		return null
	var f := FontFile.new()
	if f.load_dynamic_font(path) != OK:
		return null
	return f
