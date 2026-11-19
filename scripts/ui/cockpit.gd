extends Control
## Pixel cockpit — canopy frame + coaming + integrated instrument dash.
## Draws above the world; HUD is masked to the glass area separately.

const GLASS_FRAC := 0.56 ## bottom of canopy glass (shared with HUD)
const C_PANEL := Color(0.11, 0.12, 0.14, 0.98)
const C_PANEL_HI := Color(0.18, 0.19, 0.22, 1.0)
const C_PANEL_LO := Color(0.07, 0.07, 0.08, 1.0)
const C_EDGE := Color(0.04, 0.04, 0.05, 1.0)
const C_FRAME := Color(0.16, 0.17, 0.19, 0.96)
const C_RIM := Color(0.32, 0.34, 0.36, 1.0)
const C_GLASS_TINT := Color(0.55, 0.72, 0.85, 0.06)
const C_AMBER := Color(0.95, 0.78, 0.35, 1.0)
const C_GREEN := Color(0.45, 0.9, 0.5, 1.0)
const C_RED := Color(0.9, 0.28, 0.22, 1.0)
const C_DIM := Color(0.55, 0.58, 0.55, 1.0)
const C_LIT := Color(0.85, 0.9, 0.75, 1.0)

var _radar_angle: float = 0.0
var _font: Font


func _ready() -> void:
	_font = _load_mono()
	if _font == null:
		_font = ThemeDB.fallback_font
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _load_mono() -> Font:
	var path := "res://fonts/RobotoMono-Regular.ttf"
	if not FileAccess.file_exists(path):
		return null
	var f := FontFile.new()
	if f.load_dynamic_font(path) != OK:
		return null
	return f


func _process(dt: float) -> void:
	_radar_angle = fmod(_radar_angle + dt * 2.2, TAU)
	visible = (
		Game.view_camera() == Game.Cam.COCKPIT
		and Game.title_dismissed
		and not Game.generating
		and not Game.screenshot_mode
		and not Game.paused
	)
	if visible:
		queue_redraw()


func glass_bottom(s: Vector2 = Vector2.ZERO) -> float:
	var h: float = s.y if s.y > 1.0 else size.y
	return h * GLASS_FRAC


func _draw() -> void:
	if not visible:
		return
	var s := size
	var gb: float = glass_bottom(s)
	_draw_canopy_frame(s, gb)
	_draw_coaming(s, gb)
	_draw_side_pillars(s, gb)
	_draw_dash(s, gb)
	_draw_instruments(s, gb)
	_draw_footer(s)


func _draw_canopy_frame(s: Vector2, gb: float) -> void:
	# Soft glass tint only in the view area
	draw_rect(Rect2(0, 0, s.x, gb), C_GLASS_TINT)
	# Top bow
	draw_rect(Rect2(0, 0, s.x, 10), C_FRAME)
	draw_rect(Rect2(0, 10, s.x, 2), C_RIM)
	# Corner fillets (pixel wedges)
	for i in 14:
		var t: float = float(i) / 14.0
		var w: float = lerpf(54.0, 8.0, t)
		draw_rect(Rect2(0, 12 + float(i) * 3.0, w, 3), C_FRAME)
		draw_rect(Rect2(s.x - w, 12 + float(i) * 3.0, w, 3), C_FRAME)


func _draw_side_pillars(s: Vector2, gb: float) -> void:
	var pillar_w: float = 18.0
	# Left / right canopy rails
	draw_rect(Rect2(0, 0, pillar_w, gb), C_FRAME)
	draw_rect(Rect2(s.x - pillar_w, 0, pillar_w, gb), C_FRAME)
	draw_rect(Rect2(pillar_w, 0, 2, gb), C_EDGE)
	draw_rect(Rect2(s.x - pillar_w - 2, 0, 2, gb), C_EDGE)
	# Inner highlight
	draw_rect(Rect2(pillar_w - 3, 14, 2, gb - 28), Color(0.28, 0.3, 0.32, 0.55))
	draw_rect(Rect2(s.x - pillar_w + 1, 14, 2, gb - 28), Color(0.28, 0.3, 0.32, 0.55))
	# HUD combiner reflection stub (center top)
	var cx: float = s.x * 0.5
	draw_rect(Rect2(cx - 70, 12, 140, 3), Color(0.4, 0.55, 0.5, 0.25))


func _draw_coaming(s: Vector2, gb: float) -> void:
	## Glare shield / coaming between glass and dash — hides the “flat cut”.
	var h: float = 22.0
	var y: float = gb - h
	draw_rect(Rect2(0, y, s.x, h), C_PANEL_LO)
	# Soft lip
	draw_rect(Rect2(0, y, s.x, 3), C_RIM)
	draw_rect(Rect2(0, y + 3, s.x, 2), C_EDGE)
	# Center HUD brow
	var cx: float = s.x * 0.5
	draw_colored_polygon(PackedVector2Array([
		Vector2(cx - 90, y + 4),
		Vector2(cx + 90, y + 4),
		Vector2(cx + 70, y + h),
		Vector2(cx - 70, y + h),
	]), C_PANEL)
	draw_line(Vector2(cx - 88, y + 5), Vector2(cx + 88, y + 5), C_AMBER * Color(1, 1, 1, 0.35), 1.0)


func _draw_dash(s: Vector2, gb: float) -> void:
	var top: float = gb
	var h: float = s.y - top
	# Main dash body
	draw_rect(Rect2(0, top, s.x, h), C_PANEL)
	# Upper bevel
	draw_rect(Rect2(0, top, s.x, 4), C_PANEL_HI)
	draw_rect(Rect2(0, top + 4, s.x, 2), C_EDGE)
	# Lower kick panel
	draw_rect(Rect2(0, s.y - 16, s.x, 16), C_PANEL_LO)
	# Center console recess
	var cx: float = s.x * 0.5
	draw_rect(Rect2(cx - 78, top + 10, 156, h - 30), C_PANEL_LO)
	draw_rect(Rect2(cx - 78, top + 10, 156, h - 30), C_RIM, false, 1.0)
	# Screws / rivets
	for i in 6:
		var x: float = 28.0 + float(i) * ((s.x - 56.0) / 5.0)
		draw_circle(Vector2(x, top + 8), 1.5, C_RIM)
		draw_circle(Vector2(x, s.y - 10), 1.5, C_RIM)


func _draw_instruments(s: Vector2, gb: float) -> void:
	var top: float = gb + 14.0
	var cx: float = s.x * 0.5
	var font: Font = _font

	# Left cluster
	_draw_asi(Vector2(48, top + 30), 24)
	_draw_horizon(Vector2(112, top + 30), 26)
	_draw_altimeter(Vector2(176, top + 30), 24)
	_draw_vsi(Vector2(48, top + 88), 20)
	_draw_turn_slip(Vector2(112, top + 88), 20)
	_draw_heading(Vector2(176, top + 88), 22)

	# Center — radar + engines
	_draw_radar(Vector2(cx, top + 40), 30)
	_draw_engines(Vector2(cx - 34, top + 82))

	# Right cluster
	_draw_clock(Vector2(s.x - 176, top + 30))
	_draw_aoa_gauge(Vector2(s.x - 112, top + 30), 22)
	_draw_gmeter(Vector2(s.x - 48, top + 30), 22)
	_draw_warnings(Vector2(s.x - 200, top + 78))
	_draw_throttle(Vector2(s.x - 28, top + 8), s.y - top - 28)

	# Aircraft plate
	var plate := Game.aircraft_label()
	draw_string(font, Vector2(cx - 40, s.y - 6), "AF DASHI  ·  %s" % plate, HORIZONTAL_ALIGNMENT_LEFT, -1, 8, C_DIM)


func _draw_footer(s: Vector2) -> void:
	draw_rect(Rect2(0, s.y - 2, s.x, 2), C_EDGE)


func _draw_asi(c: Vector2, r: float) -> void:
	_bezel(c, r, "ASI")
	var spd: float = clampf(Game.airspeed / 400.0, 0.0, 1.0)
	var ang: float = -PI * 0.75 + spd * PI * 1.5
	draw_line(c, c + Vector2(cos(ang), sin(ang)) * (r - 5), C_LIT, 1.6)
	draw_circle(c, 2.0, C_AMBER)
	draw_string(_font, c + Vector2(-12, 5), "%d" % int(Game.airspeed), HORIZONTAL_ALIGNMENT_LEFT, -1, 9, C_LIT)


func _draw_horizon(c: Vector2, r: float) -> void:
	_bezel(c, r, "AH")
	var inner: float = r - 3.0
	draw_circle(c, inner, Color(0.32, 0.52, 0.72))
	var pitch_off: float = clampf(Game.pitch_deg * 0.28, -inner + 2.0, inner - 2.0)
	# Ground
	draw_rect(Rect2(c.x - inner, c.y + pitch_off, inner * 2.0, inner - pitch_off), Color(0.52, 0.38, 0.22))
	# Clip ring by redrawing bezel ring
	draw_arc(c, inner, 0, TAU, 28, Color(0.1, 0.11, 0.12), 2.0)
	var roll := deg_to_rad(wrapf(Game.roll_deg, -180.0, 180.0))
	var a := Vector2(cos(roll), sin(roll))
	draw_line(c - a * (inner - 3), c + a * (inner - 3), Color(0.08, 0.08, 0.09), 1.4)
	draw_line(Vector2(c.x - 9, c.y), Vector2(c.x + 9, c.y), C_AMBER, 1.5)
	draw_line(Vector2(c.x, c.y), Vector2(c.x, c.y + 5), C_AMBER, 1.2)


func _draw_altimeter(c: Vector2, r: float) -> void:
	_bezel(c, r, "ALT")
	var alt := Game.altitude
	var ang: float = -PI * 0.5 + fmod(alt, 1000.0) / 1000.0 * TAU
	draw_line(c, c + Vector2(cos(ang), sin(ang)) * (r - 5), C_LIT, 1.6)
	draw_circle(c, 2.0, C_AMBER)
	draw_string(_font, c + Vector2(-18, 5), "%05d" % int(alt), HORIZONTAL_ALIGNMENT_LEFT, -1, 8, C_LIT)


func _draw_turn_slip(c: Vector2, r: float) -> void:
	_bezel(c, r, "T/S")
	var turn := clampf(Game.turn_rate, -1, 1)
	draw_arc(c, r - 6, -0.65, 0.65, 10, Color(0.4, 0.4, 0.42), 1.0)
	draw_circle(c + Vector2(turn * (r - 8), -4), 3.0, C_AMBER)
	var slip := clampf(Game.slip, -1, 1)
	draw_rect(Rect2(c.x - 12, c.y + 7, 24, 6), Color(0.16, 0.16, 0.18))
	draw_circle(Vector2(c.x + slip * 10.0, c.y + 10), 2.8, Color(0.75, 0.75, 0.7))


func _draw_heading(c: Vector2, r: float) -> void:
	_bezel(c, r, "HDG")
	var hdg := deg_to_rad(Game.heading_deg)
	draw_line(c, c + Vector2(sin(hdg), -cos(hdg)) * (r - 5), C_RED, 1.6)
	draw_circle(c, 2.0, C_AMBER)
	draw_string(_font, c + Vector2(-12, 5), "%03d" % int(Game.heading_deg), HORIZONTAL_ALIGNMENT_LEFT, -1, 9, C_LIT)


func _draw_vsi(c: Vector2, r: float) -> void:
	_bezel(c, r, "VSI")
	var vs := clampf(Game.vspeed / 40.0, -1, 1)
	var ang: float = -PI * 0.5 - vs * PI * 0.75
	draw_line(c, c + Vector2(cos(ang), sin(ang)) * (r - 5), C_GREEN, 1.6)


func _draw_aoa_gauge(c: Vector2, r: float) -> void:
	_bezel(c, r, "AOA")
	var path_pitch: float = rad_to_deg(atan2(Game.vspeed, maxf(Game.airspeed * 0.5, 1.0)))
	var aoa: float = clampf(Game.pitch_deg - path_pitch * 0.35, -15.0, 25.0)
	var t: float = inverse_lerp(-10.0, 20.0, aoa)
	var ang: float = -PI * 0.75 + clampf(t, 0.0, 1.0) * PI * 1.5
	var col: Color = C_RED if aoa > 14.0 else (C_AMBER if aoa > 10.0 else C_GREEN)
	draw_line(c, c + Vector2(cos(ang), sin(ang)) * (r - 5), col, 1.6)


func _draw_gmeter(c: Vector2, r: float) -> void:
	_bezel(c, r, "G")
	var g: float = clampf(Game.g_force, -2.0, 9.0)
	var t: float = inverse_lerp(-1.0, 7.0, g)
	var ang: float = -PI * 0.75 + clampf(t, 0.0, 1.0) * PI * 1.5
	var col: Color = C_RED if g > 6.0 else (C_AMBER if g > 4.0 else C_LIT)
	draw_line(c, c + Vector2(cos(ang), sin(ang)) * (r - 5), col, 1.6)
	draw_string(_font, c + Vector2(-10, 5), "%.1f" % g, HORIZONTAL_ALIGNMENT_LEFT, -1, 8, C_LIT)


func _draw_radar(c: Vector2, r: float) -> void:
	draw_circle(c, r + 2, C_PANEL_HI)
	draw_circle(c, r, Color(0.06, 0.09, 0.05))
	draw_arc(c, r, 0, TAU, 32, Color(0.55, 0.42, 0.12), 1.2)
	draw_arc(c, r * 0.66, 0, TAU, 24, Color(0.35, 0.28, 0.08), 1.0)
	draw_arc(c, r * 0.33, 0, TAU, 16, Color(0.35, 0.28, 0.08), 1.0)
	draw_line(c + Vector2(0, -r), c + Vector2(0, r), Color(0.35, 0.28, 0.08, 0.7), 1.0)
	draw_line(c + Vector2(-r, 0), c + Vector2(r, 0), Color(0.35, 0.28, 0.08, 0.7), 1.0)
	var a := _radar_angle
	draw_line(c, c + Vector2(cos(a), sin(a)) * r, Color(1.0, 0.78, 0.2, 0.9), 1.2)
	for i in 8:
		var ang: float = float(i) * 0.9 + Game.heading_deg * 0.02
		var dist: float = r * (0.3 + fmod(float(i) * 0.17 + Game.altitude * 0.001, 0.6))
		var p: Vector2 = c + Vector2(cos(ang), sin(ang)) * dist
		draw_rect(Rect2(p.x - 1, p.y - 1, 2, 2), Color(1.0, 0.72, 0.18))
	draw_string(_font, c + Vector2(-18, r + 11), "GND MAP", HORIZONTAL_ALIGNMENT_LEFT, -1, 7, Color(0.72, 0.55, 0.22))


func _draw_engines(origin: Vector2) -> void:
	draw_string(_font, origin, "ENG", HORIZONTAL_ALIGNMENT_LEFT, -1, 8, C_DIM)
	for i in 2:
		var x: float = origin.x + float(i) * 36.0
		draw_rect(Rect2(x, origin.y + 12, 16, 44), Color(0.06, 0.06, 0.08))
		draw_rect(Rect2(x, origin.y + 12, 16, 44), C_RIM, false, 1.0)
		var h: float = Game.throttle * 38.0 + (8.0 if Game.afterburner else 0.0)
		var col: Color = Color(1.0, 0.45, 0.15) if Game.afterburner else C_GREEN
		draw_rect(Rect2(x + 2, origin.y + 54 - h, 12, h), col)
		draw_string(_font, Vector2(x + 2, origin.y + 66), "%s" % ["L", "R"][i], HORIZONTAL_ALIGNMENT_LEFT, -1, 7, C_DIM)


func _draw_clock(c: Vector2) -> void:
	var t := Time.get_time_dict_from_system()
	_bezel(c, 20, "CLK")
	draw_string(_font, c + Vector2(-16, 4), "%02d:%02d" % [t.hour, t.minute], HORIZONTAL_ALIGNMENT_LEFT, -1, 9, C_LIT)


func _draw_warnings(origin: Vector2) -> void:
	var lamps := [
		["TRN", Game.warn_terrain or Game.warn_low_alt, C_RED],
		["AB", Game.afterburner, Color(1.0, 0.55, 0.12)],
		["MSL", Game.warn_missile, C_AMBER],
		["SND", Game.sound_on, C_GREEN],
	]
	for i in lamps.size():
		var x: float = origin.x + float(i) * 40.0
		var on: bool = lamps[i][1]
		var bg: Color = Color(0.14, 0.12, 0.1) if not on else lamps[i][2] * Color(1, 1, 1, 0.9)
		draw_rect(Rect2(x, origin.y, 34, 16), bg)
		draw_rect(Rect2(x, origin.y, 34, 16), C_EDGE, false, 1.0)
		draw_string(_font, Vector2(x + 5, origin.y + 12), lamps[i][0], HORIZONTAL_ALIGNMENT_LEFT, -1, 8, Color(0.08, 0.08, 0.08) if on else Color(0.42, 0.4, 0.36))


func _draw_throttle(origin: Vector2, h: float) -> void:
	draw_rect(Rect2(origin.x, origin.y, 14, h), Color(0.06, 0.06, 0.08))
	draw_rect(Rect2(origin.x, origin.y, 14, h), C_RIM, false, 1.0)
	# Detents
	for i in 4:
		var yy: float = origin.y + h * float(i) / 4.0
		draw_line(Vector2(origin.x - 2, yy), Vector2(origin.x + 16, yy), Color(0.25, 0.25, 0.28), 1.0)
	var t: float = clampf(Game.throttle, 0.0, 1.0)
	var lever_y: float = origin.y + h - t * (h - 12.0) - 6.0
	draw_rect(Rect2(origin.x - 5, lever_y, 24, 10), Color(0.72, 0.55, 0.22))
	draw_rect(Rect2(origin.x - 5, lever_y, 24, 10), C_AMBER, false, 1.0)
	draw_string(_font, Vector2(origin.x - 8, origin.y + h + 12), "THR", HORIZONTAL_ALIGNMENT_LEFT, -1, 7, C_DIM)


func _bezel(c: Vector2, r: float, label: String) -> void:
	draw_circle(c, r + 1.5, C_PANEL_HI)
	draw_circle(c, r, Color(0.16, 0.16, 0.18))
	draw_arc(c, r, 0, TAU, 28, C_RIM, 1.2)
	draw_circle(c, r - 2.5, Color(0.08, 0.09, 0.1))
	# Tick marks
	for i in 8:
		var a: float = float(i) / 8.0 * TAU
		var p0: Vector2 = c + Vector2(cos(a), sin(a)) * (r - 4.5)
		var p1: Vector2 = c + Vector2(cos(a), sin(a)) * (r - 2.5)
		draw_line(p0, p1, Color(0.35, 0.35, 0.38), 1.0)
	draw_string(_font, c + Vector2(-10, r + 10), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 7, C_DIM)
