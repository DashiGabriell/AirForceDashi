extends Control
## CheckPoint mission overlay — gates + time first, slim chrome, next-gate cue.


const C_WHITE := Color(0.96, 0.96, 0.97, 1.0)
const C_GREY := Color(0.58, 0.58, 0.60, 1.0)
const C_GREY_DIM := Color(0.40, 0.40, 0.42, 1.0)
const C_RED := Color(0.82, 0.12, 0.14, 1.0)
const C_PANEL := Color(0.05, 0.05, 0.06, 0.88)

## Radar range (metres). Blips outside are clamped to the rim.
const RADAR_RANGE := 900.0
const RADAR_R := 78.0
const STRIP_H := 54.0


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


func show_banner(text: String, seconds: float = 2.2) -> void:
	_banner = text
	_banner_t = seconds
	_popup_title = ""
	_popup_sub = ""
	_popup_t = 0.0


func show_level_popup(title: String, subtitle: String, seconds: float = 2.4) -> void:
	_banner = ""
	_banner_t = 0.0
	_popup_title = title
	_popup_sub = subtitle
	_popup_t = seconds
	_popup_max = maxf(seconds, 0.01)


func _process(dt: float) -> void:
	visible = Game.title_dismissed and not Game.generating and Game.play_mode == Game.PlayMode.CHECKPOINT and not Game.screenshot_mode
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

	_draw_top_strip(s, font_title, font_ui)

	# Slim mission timer — secondary to gates, does not eat the sky
	if Game.cp_time_limit > 0.0 and (Game.cp_active or Game.cp_status == "RUN" or Game.cp_status == "FAIL"):
		_draw_time_counter(s, font_title, font_ui)

	# Status / banner
	if _popup_title != "":
		_draw_level_popup(s, font_title, font_ui)
	elif _banner != "":
		var bw := 320.0
		draw_rect(Rect2(s.x * 0.5 - bw * 0.5, s.y * 0.38, bw, 48), Color(0.05, 0.05, 0.06, 0.85))
		draw_rect(Rect2(s.x * 0.5 - bw * 0.5, s.y * 0.38, bw, 3), C_RED)
		draw_string(font_title, Vector2(s.x * 0.5 - 100, s.y * 0.38 + 34), _banner, HORIZONTAL_ALIGNMENT_LEFT, -1, 28, C_WHITE)

	if Game.cp_status == "WIN" and _popup_title == "" and _cp_is_final_clear():
		draw_string(font_ui, Vector2(s.x * 0.5 - 90, s.y * 0.38 + 70), "R retry   ·   Esc menu", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, C_GREY)
	elif Game.cp_status == "FAIL":
		draw_string(font_ui, Vector2(s.x * 0.5 - 90, s.y * 0.38 + 70), "R retry   ·   Esc pause", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, C_GREY)
	elif Game.cp_active:
		draw_string(font_ui, Vector2(18, s.y - 22), "fly the red gate  ·  R restart", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, C_GREY)

	# Next-gate edge cue + radar
	if Game.cp_active and Game.cp_ring_index < Game.cp_ring_total and Game.jet:
		_draw_next_gate_cue(s, font_ui)
		_draw_radar(s, font_title, font_ui)


func _draw_top_strip(s: Vector2, font_title: Font, font_ui: Font) -> void:
	# Scrim tall enough to hold pilot line (contrast on bright sky)
	draw_rect(Rect2(0, 0, s.x, STRIP_H), Color(0.04, 0.04, 0.05, 0.78))
	draw_rect(Rect2(0, 0, s.x, 2), C_RED)

	# Meta — level (secondary)
	var level := "CP  %d / %d" % [Game.cp_level, CheckpointLevels.LEVEL_COUNT]
	draw_string(font_ui, Vector2(18, 22), level, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, C_GREY)

	var pilot := "%s  ·  %s" % [Game.display_name().to_upper(), Game.aircraft_label()]
	draw_string(font_ui, Vector2(18, 42), pilot, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, C_GREY_DIM)

	# Primary — gates progress (mission-now)
	var rings := "GATES  %d / %d" % [Game.cp_ring_index, Game.cp_ring_total]
	var rings_sz := 28
	var rings_w: float = font_title.get_string_size(rings, HORIZONTAL_ALIGNMENT_LEFT, -1, rings_sz).x
	var rings_x: float = s.x * 0.5 - rings_w * 0.5
	draw_string(font_title, Vector2(rings_x, 30), rings, HORIZONTAL_ALIGNMENT_LEFT, -1, rings_sz, C_WHITE)

	# Tiny progress ticks under gates
	var total: int = maxi(Game.cp_ring_total, 1)
	var done: int = clampi(Game.cp_ring_index, 0, total)
	var tick_w := 8.0
	var gap := 4.0
	var row_w: float = float(total) * tick_w + float(maxi(total - 1, 0)) * gap
	var tick_x: float = s.x * 0.5 - row_w * 0.5
	var tick_y: float = 40.0
	for i in total:
		var filled: bool = i < done
		var col := C_RED if filled else Color(0.28, 0.28, 0.30, 0.95)
		draw_rect(Rect2(tick_x + float(i) * (tick_w + gap), tick_y, tick_w, 3.0), col)


func _cp_is_final_clear() -> bool:
	return Game.cp_level >= CheckpointLevels.LEVEL_COUNT


func _draw_time_counter(s: Vector2, font_title: Font, font_ui: Font) -> void:
	var tleft: float = maxf(Game.cp_time_left, 0.0)
	var urgent: bool = tleft <= 12.0
	var pulse: float = 1.0
	if urgent:
		pulse = 0.72 + 0.28 * (0.5 + 0.5 * sin(Time.get_ticks_msec() * 0.012))

	var mins: int = int(floor(tleft / 60.0))
	var secs: int = int(ceil(fmod(tleft, 60.0)))
	if secs == 60:
		mins += 1
		secs = 0
	var tstr := "%d:%02d" % [mins, secs]
	if mins <= 0:
		tstr = "%02d" % int(ceil(tleft))

	# Compact chip — top-right, semi-transparent, thin
	var box_w := 118.0
	var box_h := 44.0
	var bx: float = s.x - box_w - 18.0
	var by: float = STRIP_H + 8.0
	var panel_a: float = 0.55 if not urgent else 0.72
	draw_rect(Rect2(bx, by, box_w, box_h), Color(0.04, 0.04, 0.05, panel_a))
	var accent := Color(C_RED.r, C_RED.g, C_RED.b, pulse) if urgent else Color(0.35, 0.35, 0.38, 0.9)
	draw_rect(Rect2(bx, by, box_w, 2.0), accent)

	var ratio: float = 0.0
	if Game.cp_time_limit > 0.001:
		ratio = clampf(tleft / Game.cp_time_limit, 0.0, 1.0)
	var bar_pad := 10.0
	var bar_y: float = by + box_h - 7.0
	draw_rect(Rect2(bx + bar_pad, bar_y, box_w - bar_pad * 2.0, 2.0), Color(0.18, 0.18, 0.2, 0.85))
	var bar_col := C_WHITE if not urgent else Color(C_RED.r, C_RED.g, C_RED.b, pulse)
	draw_rect(Rect2(bx + bar_pad, bar_y, (box_w - bar_pad * 2.0) * ratio, 2.0), bar_col)

	draw_string(font_ui, Vector2(bx + 10.0, by + 14.0), "TIME", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, C_GREY)

	var tcol := Color(C_WHITE.r, C_WHITE.g, C_WHITE.b, pulse)
	if urgent:
		tcol = Color(C_RED.r, C_RED.g, C_RED.b, pulse)
	var font_sz := 28
	var tw: float = font_title.get_string_size(tstr, HORIZONTAL_ALIGNMENT_LEFT, -1, font_sz).x
	draw_string(font_title, Vector2(bx + (box_w - tw) * 0.5, by + 34.0), tstr, HORIZONTAL_ALIGNMENT_LEFT, -1, font_sz, tcol)


func _draw_level_popup(s: Vector2, font_title: Font, font_ui: Font) -> void:
	var elapsed: float = _popup_max - _popup_t
	var fade_in: float = clampf(elapsed / 0.12, 0.0, 1.0)
	var fade_out: float = clampf(_popup_t / 0.2, 0.0, 1.0)
	var a: float = minf(fade_in, fade_out)

	var bw := 420.0
	var bh := 96.0
	var bx: float = s.x * 0.5 - bw * 0.5
	var by: float = s.y * 0.34
	draw_rect(Rect2(bx, by, bw, bh), Color(0.05, 0.05, 0.06, 0.92 * a))
	draw_rect(Rect2(bx, by, bw, 4.0), Color(C_RED.r, C_RED.g, C_RED.b, a))
	draw_rect(Rect2(bx, by + bh - 2.0, bw, 2.0), Color(0.25, 0.25, 0.28, 0.85 * a))

	var title_col := Color(C_WHITE.r, C_WHITE.g, C_WHITE.b, a)
	var sub_col := Color(C_GREY.r, C_GREY.g, C_GREY.b, a)
	var tsz := 36
	var tw: float = font_title.get_string_size(_popup_title, HORIZONTAL_ALIGNMENT_LEFT, -1, tsz).x
	draw_string(font_title, Vector2(bx + (bw - tw) * 0.5, by + 42.0), _popup_title, HORIZONTAL_ALIGNMENT_LEFT, -1, tsz, title_col)
	var ssz := 14
	var sw: float = font_ui.get_string_size(_popup_sub, HORIZONTAL_ALIGNMENT_LEFT, -1, ssz).x
	draw_string(font_ui, Vector2(bx + (bw - sw) * 0.5, by + 72.0), _popup_sub, HORIZONTAL_ALIGNMENT_LEFT, -1, ssz, sub_col)


func _draw_next_gate_cue(s: Vector2, font_ui: Font) -> void:
	## Edge chevron when the next gate is off-screen / behind — primary navigation cue.
	var cam: Camera3D = get_viewport().get_camera_3d()
	if cam == null:
		return
	var world: Vector3 = Game.cp_next_pos
	var behind: bool = cam.is_position_behind(world)
	var scr: Vector2 = cam.unproject_position(world)
	var margin := 36.0
	var on_screen: bool = (
		not behind
		and scr.x >= margin
		and scr.y >= STRIP_H + margin
		and scr.x <= s.x - margin
		and scr.y <= s.y - margin
	)
	if on_screen:
		# Soft on-screen pip — thin ring, does not compete with flight FPM
		var pulse: float = 0.55 + 0.45 * sin(Time.get_ticks_msec() * 0.008)
		draw_arc(scr, 16.0, 0.0, TAU, 28, Color(C_RED.r, C_RED.g, C_RED.b, 0.35 * pulse), 1.5, true)
		draw_arc(scr, 4.0, 0.0, TAU, 12, Color(C_WHITE.r, C_WHITE.g, C_WHITE.b, 0.55), 1.0, true)
		return

	var jet: Node3D = Game.jet
	if jet == null:
		return
	var to: Vector3 = world - jet.global_position
	var local: Vector3 = jet.global_transform.basis.inverse() * to
	var bearing_deg: float = rad_to_deg(atan2(local.x, -local.z))
	var ang: float = deg_to_rad(bearing_deg - 90.0)
	var cx: float = s.x * 0.5
	var cy: float = s.y * 0.52
	var radius: float = minf(s.x, s.y) * 0.36
	var edge := Vector2(cx + cos(ang) * radius, cy + sin(ang) * radius)
	edge.x = clampf(edge.x, 28.0, s.x - 28.0)
	edge.y = clampf(edge.y, STRIP_H + 28.0, s.y - 28.0)

	var dir := Vector2(cos(ang), sin(ang))
	var orth := Vector2(-dir.y, dir.x)
	var tip: Vector2 = edge + dir * 10.0
	var pulse: float = 0.7 + 0.3 * sin(Time.get_ticks_msec() * 0.01)
	var col := Color(C_RED.r, C_RED.g, C_RED.b, pulse)
	draw_colored_polygon(PackedVector2Array([
		tip,
		edge - dir * 8.0 + orth * 9.0,
		edge - dir * 8.0 - orth * 9.0,
	]), col)
	draw_string(font_ui, tip + Vector2(-18, 22), "GATE", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, col)


func _draw_radar(s: Vector2, font_title: Font, font_ui: Font) -> void:
	var jet: Node3D = Game.jet
	var cx: float = s.x - 28.0 - RADAR_R
	var cy: float = s.y - 28.0 - RADAR_R
	var center := Vector2(cx, cy)

	# Panel backing
	var pad := 18.0
	var panel := Rect2(cx - RADAR_R - pad, cy - RADAR_R - pad - 18.0, (RADAR_R + pad) * 2.0, (RADAR_R + pad) * 2.0 + 22.0)
	draw_rect(panel, C_PANEL)
	draw_rect(Rect2(panel.position.x, panel.position.y, panel.size.x, 2.0), C_RED)

	draw_string(font_title, Vector2(panel.position.x + 12.0, panel.position.y + 16.0), "RADAR", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, C_WHITE)

	# Scope disc
	draw_circle(center, RADAR_R + 2.0, Color(0.12, 0.12, 0.14, 1.0))
	draw_arc(center, RADAR_R, 0.0, TAU, 48, Color(0.45, 0.45, 0.48, 0.9), 2.0, true)
	draw_arc(center, RADAR_R * 0.66, 0.0, TAU, 40, Color(0.3, 0.3, 0.32, 0.55), 1.0, true)
	draw_arc(center, RADAR_R * 0.33, 0.0, TAU, 32, Color(0.3, 0.3, 0.32, 0.45), 1.0, true)

	# Cross + heading tick (top = nose)
	draw_line(center + Vector2(-RADAR_R, 0), center + Vector2(RADAR_R, 0), Color(0.28, 0.28, 0.3, 0.7), 1.0)
	draw_line(center + Vector2(0, -RADAR_R), center + Vector2(0, RADAR_R), Color(0.28, 0.28, 0.3, 0.7), 1.0)
	draw_line(center + Vector2(0, -RADAR_R), center + Vector2(0, -RADAR_R + 10.0), C_RED, 2.0)

	# Ownship chevron at center
	var nose := PackedVector2Array([
		center + Vector2(0, -7),
		center + Vector2(-5, 6),
		center + Vector2(0, 3),
		center + Vector2(5, 6),
	])
	draw_colored_polygon(nose, C_WHITE)

	# Next gate in jet-local heading-up frame (nose = local -Z).
	# Screen Y grows downward, so local.z maps directly: ahead (z<0) → up.
	var to: Vector3 = Game.cp_next_pos - jet.global_position
	var dist: float = to.length()
	var local: Vector3 = jet.global_transform.basis.inverse() * to
	var flat := Vector2(local.x, local.z)
	var flat_len: float = flat.length()
	var on_rim := false
	if flat_len < 0.001:
		flat = Vector2(0, -1)
		flat_len = 1.0
	var scale: float = (RADAR_R - 8.0) / RADAR_RANGE
	var blip: Vector2 = flat * scale
	if blip.length() > RADAR_R - 8.0:
		blip = blip.normalized() * (RADAR_R - 8.0)
		on_rim = true

	var gate_pos: Vector2 = center + blip
	var pulse: float = 0.65 + 0.35 * sin(Time.get_ticks_msec() * 0.01)
	# Soft glow
	draw_circle(gate_pos, 8.0, Color(C_RED.r, C_RED.g, C_RED.b, 0.22 * pulse))
	draw_circle(gate_pos, 4.5, C_RED)
	draw_circle(gate_pos, 2.0, C_WHITE)
	if on_rim:
		# Rim arrow tip toward off-scope gate
		var dir: Vector2 = blip.normalized()
		var tip: Vector2 = center + dir * (RADAR_R - 2.0)
		draw_line(tip - dir * 8.0 + dir.orthogonal() * 4.0, tip, C_RED, 2.0)
		draw_line(tip - dir * 8.0 - dir.orthogonal() * 4.0, tip, C_RED, 2.0)

	# Bearing / range readout under scope (0° = ahead)
	var bearing_deg: float = rad_to_deg(atan2(local.x, -local.z))
	var dist_txt := "%.0f m" % dist
	var brg_txt := "BRG %+0.0f°" % bearing_deg
	draw_string(font_ui, Vector2(panel.position.x + 12.0, panel.end.y - 8.0), dist_txt + "  ·  " + brg_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, C_GREY if not on_rim else C_RED)


func _load_font(path: String) -> FontFile:
	if not FileAccess.file_exists(path):
		return null
	var f := FontFile.new()
	if f.load_dynamic_font(path) != OK:
		return null
	return f
