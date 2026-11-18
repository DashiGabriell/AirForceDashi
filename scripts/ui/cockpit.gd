extends Control
## Hand-plotted pixel instrument panel — all readings live.

var _radar_angle: float = 0.0


func _process(dt: float) -> void:
	_radar_angle = fmod(_radar_angle + dt * 2.2, TAU)
	visible = Game.camera_mode == Game.Cam.COCKPIT and Game.title_dismissed and not Game.generating and not Game.screenshot_mode and not Game.paused
	queue_redraw()


func _draw() -> void:
	if not visible:
		return
	var s := size
	var panel_h: float = s.y * 0.38
	var top: float = s.y - panel_h
	# Panel body
	draw_rect(Rect2(0, top, s.x, panel_h), Color(0.12, 0.12, 0.14))
	draw_rect(Rect2(0, top, s.x, 2), Color(0.05, 0.05, 0.06))

	var font := ThemeDB.fallback_font
	var y0: float = top + 10.0
	var row: float = 52.0

	_draw_asi(Vector2(36, y0 + 28), 22)
	_draw_horizon(Vector2(100, y0 + 28), 24)
	_draw_altimeter(Vector2(170, y0 + 28), 22)
	_draw_turn_slip(Vector2(236, y0 + 28), 20)
	_draw_heading(Vector2(300, y0 + 28), 22)
	_draw_vsi(Vector2(36, y0 + row + 28), 20)
	_draw_radar(Vector2(110, y0 + row + 32), 28)
	_draw_engines(Vector2(190, y0 + row + 8))
	_draw_clock(Vector2(270, y0 + row + 20))
	_draw_warnings(Vector2(36, y0 + row * 2 + 8))
	_draw_throttle(Vector2(s.x - 40, y0 + 8), panel_h - 20)

	draw_string(font, Vector2(8, s.y - 6), "AF DASHI F-22", HORIZONTAL_ALIGNMENT_LEFT, -1, 8, Color(0.5, 0.55, 0.5))


func _draw_asi(c: Vector2, r: float) -> void:
	_bezel(c, r, "ASI")
	var spd: float = clampf(Game.airspeed / 400.0, 0.0, 1.0)
	var ang: float = -PI * 0.75 + spd * PI * 1.5
	draw_line(c, c + Vector2(cos(ang), sin(ang)) * (r - 4), Color(0.95, 0.95, 0.9), 1.5)
	draw_string(ThemeDB.fallback_font, c + Vector2(-10, 4), "%d" % int(Game.airspeed), HORIZONTAL_ALIGNMENT_LEFT, -1, 8, Color(0.8, 0.85, 0.7))


func _draw_horizon(c: Vector2, r: float) -> void:
	_bezel(c, r, "AH")
	draw_circle(c, r - 3, Color(0.35, 0.55, 0.75))
	var pitch_off: float = clampf(Game.pitch_deg * 0.35, -r + 4, r - 4)
	var sky_rect := Rect2(c.x - r + 3, c.y - r + 3, (r - 3) * 2, r - 3 + pitch_off)
	draw_rect(sky_rect, Color(0.35, 0.55, 0.75))
	draw_rect(Rect2(c.x - r + 3, c.y + pitch_off, (r - 3) * 2, r - 3 - pitch_off), Color(0.55, 0.4, 0.25))
	# Roll bank
	var roll := deg_to_rad(Game.roll_deg)
	var a := Vector2(cos(roll), sin(roll))
	draw_line(c - a * (r - 6), c + a * (r - 6), Color(0.1, 0.1, 0.1), 1.5)
	draw_line(Vector2(c.x - 8, c.y), Vector2(c.x + 8, c.y), Color(1, 0.85, 0.2), 1.5)


func _draw_altimeter(c: Vector2, r: float) -> void:
	_bezel(c, r, "ALT")
	var alt := Game.altitude
	var ang: float = -PI * 0.5 + fmod(alt, 1000.0) / 1000.0 * TAU
	draw_line(c, c + Vector2(cos(ang), sin(ang)) * (r - 5), Color(0.95, 0.9, 0.7), 1.5)
	draw_string(ThemeDB.fallback_font, c + Vector2(-16, 6), "%05d" % int(alt), HORIZONTAL_ALIGNMENT_LEFT, -1, 8, Color(0.85, 0.9, 0.7))


func _draw_turn_slip(c: Vector2, r: float) -> void:
	_bezel(c, r, "T/S")
	var turn := clampf(Game.turn_rate, -1, 1)
	draw_arc(c, r - 6, -0.6, 0.6, 8, Color(0.4, 0.4, 0.4), 1.0)
	draw_circle(c + Vector2(turn * (r - 8), -4), 3.0, Color(0.9, 0.85, 0.3))
	# Slip ball
	var slip := clampf(Game.slip, -1, 1)
	draw_rect(Rect2(c.x - 12, c.y + 8, 24, 6), Color(0.2, 0.2, 0.22))
	draw_circle(Vector2(c.x + slip * 10.0, c.y + 11), 3.0, Color(0.7, 0.7, 0.65))


func _draw_heading(c: Vector2, r: float) -> void:
	_bezel(c, r, "HDG")
	var hdg := deg_to_rad(Game.heading_deg)
	draw_line(c, c + Vector2(sin(hdg), -cos(hdg)) * (r - 5), Color(0.95, 0.4, 0.3), 1.5)
	draw_string(ThemeDB.fallback_font, c + Vector2(-12, 6), "%03d" % int(Game.heading_deg), HORIZONTAL_ALIGNMENT_LEFT, -1, 8, Color(0.85, 0.9, 0.7))


func _draw_vsi(c: Vector2, r: float) -> void:
	_bezel(c, r, "VSI")
	var vs := clampf(Game.vspeed / 40.0, -1, 1)
	var ang: float = -PI * 0.5 - vs * PI * 0.75
	draw_line(c, c + Vector2(cos(ang), sin(ang)) * (r - 5), Color(0.7, 0.95, 0.7), 1.5)


func _draw_radar(c: Vector2, r: float) -> void:
	draw_circle(c, r, Color(0.08, 0.1, 0.05))
	draw_arc(c, r, 0, TAU, 32, Color(0.5, 0.4, 0.1), 1.0)
	draw_arc(c, r * 0.66, 0, TAU, 24, Color(0.35, 0.28, 0.08), 1.0)
	draw_arc(c, r * 0.33, 0, TAU, 16, Color(0.35, 0.28, 0.08), 1.0)
	# Sweep
	var a := _radar_angle
	draw_line(c, c + Vector2(cos(a), sin(a)) * r, Color(1.0, 0.75, 0.15, 0.9), 1.0)
	# Ground blips from relative height noise
	for i in 8:
		var ang: float = float(i) * 0.9 + Game.heading_deg * 0.02
		var dist: float = r * (0.3 + fmod(float(i) * 0.17 + Game.altitude * 0.001, 0.6))
		var p: Vector2 = c + Vector2(cos(ang), sin(ang)) * dist
		draw_rect(Rect2(p.x - 1, p.y - 1, 2, 2), Color(1.0, 0.7, 0.15))
	draw_string(ThemeDB.fallback_font, c + Vector2(-14, r + 10), "GND MAP", HORIZONTAL_ALIGNMENT_LEFT, -1, 7, Color(0.7, 0.55, 0.2))


func _draw_engines(origin: Vector2) -> void:
	draw_string(ThemeDB.fallback_font, origin, "ENG", HORIZONTAL_ALIGNMENT_LEFT, -1, 8, Color(0.6, 0.65, 0.55))
	for i in 2:
		var x: float = origin.x + float(i) * 28.0
		draw_rect(Rect2(x, origin.y + 12, 14, 40), Color(0.08, 0.08, 0.1))
		var h: float = Game.throttle * 36.0 + (8.0 if Game.afterburner else 0.0)
		draw_rect(Rect2(x + 2, origin.y + 50 - h, 10, h), Color(0.3, 0.85, 0.4) if not Game.afterburner else Color(1.0, 0.45, 0.15))


func _draw_clock(c: Vector2) -> void:
	var t := Time.get_time_dict_from_system()
	_bezel(c, 18, "CLK")
	draw_string(ThemeDB.fallback_font, c + Vector2(-14, 4), "%02d:%02d" % [t.hour, t.minute], HORIZONTAL_ALIGNMENT_LEFT, -1, 8, Color(0.85, 0.9, 0.7))


func _draw_warnings(origin: Vector2) -> void:
	var lamps := [
		["TRN", Game.warn_terrain, Color(1, 0.3, 0.15)],
		["AB", Game.afterburner, Color(1, 0.55, 0.1)],
		["MSL", Game.warn_missile, Color(1, 0.8, 0.2)],
		["SND", Game.sound_on, Color(0.3, 0.8, 0.4)],
	]
	for i in lamps.size():
		var x: float = origin.x + float(i) * 42.0
		var on: bool = lamps[i][1]
		draw_rect(Rect2(x, origin.y, 36, 14), Color(0.15, 0.12, 0.1) if not on else lamps[i][2] * Color(1, 1, 1, 0.85))
		draw_string(ThemeDB.fallback_font, Vector2(x + 4, origin.y + 11), lamps[i][0], HORIZONTAL_ALIGNMENT_LEFT, -1, 8, Color(0.1, 0.1, 0.1) if on else Color(0.45, 0.4, 0.35))


func _draw_throttle(origin: Vector2, h: float) -> void:
	draw_rect(Rect2(origin.x, origin.y, 16, h), Color(0.08, 0.08, 0.1))
	var t: float = Game.throttle
	var lever_y: float = origin.y + h - t * (h - 12)
	draw_rect(Rect2(origin.x - 4, lever_y, 24, 8), Color(0.7, 0.55, 0.25))
	draw_string(ThemeDB.fallback_font, Vector2(origin.x - 6, origin.y + h + 10), "THR", HORIZONTAL_ALIGNMENT_LEFT, -1, 7, Color(0.55, 0.55, 0.5))


func _bezel(c: Vector2, r: float, label: String) -> void:
	draw_circle(c, r, Color(0.18, 0.18, 0.2))
	draw_arc(c, r, 0, TAU, 24, Color(0.35, 0.35, 0.38), 1.0)
	draw_circle(c, r - 2, Color(0.1, 0.11, 0.12))
	draw_string(ThemeDB.fallback_font, c + Vector2(-10, r + 9), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 7, Color(0.55, 0.55, 0.5))
