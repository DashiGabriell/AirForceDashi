extends Control
## F-22-inspired HUD — clarity pack: tapes, AOA, bank scale, warnings, declutter.

const HUD := Color(0.35, 1.0, 0.45, 0.92)
const HUD_DIM := Color(0.35, 1.0, 0.45, 0.45)
const HUD_WARN := Color(1.0, 0.82, 0.25, 0.95)
const HUD_BAD := Color(1.0, 0.35, 0.3, 0.95)
const LOW_ALT_FT := 110.0 ## keep in sync with Game.SAFE_AGL
## Pilot badge (bottom-left) — +30% over the first 36px plate.
const AVATAR_SZ := 47.0
const PILOT_NAME_COL := Color(0.96, 0.96, 0.97, 1.0)
const PILOT_SUB_COL := Color(0.82, 0.84, 0.86, 1.0)
const PILOT_PANEL := Color(0.04, 0.05, 0.06, 0.82)

var _font: Font
var _avatar_tex: Texture2D


func _ready() -> void:
	_font = _load_mono()
	if _font == null:
		_font = ThemeDB.fallback_font
	_avatar_tex = Game.avatar_texture()
	if not Game.avatar_changed.is_connected(_on_avatar_changed):
		Game.avatar_changed.connect(_on_avatar_changed)


func _on_avatar_changed(_id: int) -> void:
	_avatar_tex = Game.avatar_texture()
	queue_redraw()


func _load_mono() -> Font:
	var path := "res://fonts/RobotoMono-Regular.ttf"
	if not FileAccess.file_exists(path):
		return null
	var f := FontFile.new()
	if f.load_dynamic_font(path) != OK:
		return null
	return f


func _mission_declutter() -> bool:
	## CheckPoint race: keep flight basics, drop weapons / tourism chrome.
	return Game.play_mode == Game.PlayMode.CHECKPOINT


func _cockpit_glass_bottom(s: Vector2) -> float:
	## Keep in sync with cockpit.gd GLASS_FRAC (0.56) minus coaming.
	return s.y * 0.52


func _draw() -> void:
	if Game.generating or not Game.title_dismissed or Game.paused:
		return
	if Game.screenshot_mode or Game.camera_mode == Game.Cam.FREE:
		_draw_photo_badge()
		return

	var s := size
	var view: int = Game.view_camera()
	var cockpit: bool = view == Game.Cam.COCKPIT
	var rear: bool = view == Game.Cam.REAR
	var glass_b: float = _cockpit_glass_bottom(s) if cockpit else s.y
	var cx := s.x * 0.5
	# In cockpit, center HUD in the glass — not behind the dash.
	var cy := s.y * (0.30 if cockpit else 0.5)
	var font: Font = _font
	var fs := 10
	var race: bool = _mission_declutter()
	var tape_h: float = 110.0 if cockpit else 150.0

	if not race and not cockpit and not rear:
		_draw_world_readout(s, font)

	if view == Game.Cam.TOP:
		_draw_top_hud(s, font, race)
		_draw_pilot_badge(s, font, cockpit)
		return

	if rear:
		_draw_rear_hud(s, font, race)
		_draw_pilot_badge(s, font, false)
		return

	if not race and not cockpit:
		_draw_bank_scale(cx, font)
	_draw_pitch_ladder(cx, cy, s, font, fs, glass_b)
	# Below CheckPoint strip (54px) so mission chrome stays readable
	_draw_heading_tape(cx, font, fs, 64.0 if race else (18.0 if cockpit else 22.0))
	if not race and not cockpit:
		_draw_compass_pois(cx, font)
		_draw_airport_marker(s, font)
	_draw_speed_tape(Vector2(52 if not cockpit else 40, cy), tape_h, font, glass_b)
	_draw_alt_tape(Vector2(s.x - (52 if not cockpit else 40), cy), tape_h, font, glass_b)
	_draw_waterline(Vector2(cx, cy))

	if _on_screen(Game.fpm_screen, s) and Game.fpm_screen.y < glass_b:
		_draw_fpm(Game.fpm_screen)
		if not race:
			_draw_aoa_bracket(Game.fpm_screen)

	if not race and _on_screen(Game.bore_screen, s) and Game.bore_screen.y < glass_b:
		if Game.bore_screen.distance_to(Game.fpm_screen) > 8.0:
			_draw_bore_ghost(Game.bore_screen)

	if not race and not cockpit:
		_draw_weapon_hud(s, font)
	_draw_warnings(cx, s, font)
	_draw_pilot_badge(s, font, cockpit)


func _draw_rear_hud(s: Vector2, font: Font, race: bool = false) -> void:
	## Compact combat look-aft: speed/alt + reciprocal heading + AFT cue.
	var cx: float = s.x * 0.5
	var cy: float = s.y * 0.48
	_draw_speed_tape(Vector2(48, cy), 120.0, font)
	_draw_alt_tape(Vector2(s.x - 48, cy), 120.0, font)
	# Reciprocal heading (what is behind you)
	var aft_hdg: float = fposmod(Game.heading_deg + 180.0, 360.0)
	draw_string(font, Vector2(cx - 28, 20), "AFT VIEW", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, HUD_WARN)
	if Game.look_back_hold and Game.camera_mode != Game.Cam.REAR:
		draw_string(font, Vector2(cx - 36, 34), "HOLD V", HORIZONTAL_ALIGNMENT_LEFT, -1, 8, HUD_DIM)
	draw_string(font, Vector2(cx - 40, 52), "AFT HDG %03d" % int(aft_hdg), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, HUD)
	_draw_heading_tape(cx, font, 9, 70.0)
	# Center “check six” caret
	draw_line(Vector2(cx - 16, cy), Vector2(cx - 6, cy), HUD, 1.5)
	draw_line(Vector2(cx + 6, cy), Vector2(cx + 16, cy), HUD, 1.5)
	draw_line(Vector2(cx, cy - 16), Vector2(cx, cy - 6), HUD, 1.5)
	draw_line(Vector2(cx, cy + 6), Vector2(cx, cy + 16), HUD, 1.5)
	draw_arc(Vector2(cx, cy), 10.0, 0.0, TAU, 16, HUD_WARN, 1.2, true)
	if not race:
		draw_string(font, Vector2(14, s.y - 16), "SPACE cam  ·  V look aft", HORIZONTAL_ALIGNMENT_LEFT, -1, 8, HUD_DIM)
	_draw_warnings(cx, s, font)


func _draw_top_hud(s: Vector2, font: Font, race: bool = false) -> void:
	_draw_speed_tape(Vector2(48, s.y * 0.42), 110.0, font)
	_draw_alt_tape(Vector2(s.x - 48, s.y * 0.42), 110.0, font)
	_draw_heading_tape(s.x * 0.5, font, 9, 64.0 if race else 22.0)
	if not race:
		_draw_compass_pois(s.x * 0.5, font)
		_draw_airport_marker(s, font)
		_draw_minimap(s, font)
		if Game.aim_ready:
			_draw_dlz(Vector2(s.x - 36, s.y * 0.28), s.y * 0.4, font)
			_draw_weapon_status(Vector2(s.x - 100, s.y - 36), font)
			if Game.aim_valid and _on_screen(Game.aim_screen, s):
				var col: Color = HUD if Game.aim_in_dlz else HUD_WARN
				_draw_ccip_pipper(Game.aim_screen, col)
	_draw_warnings(s.x * 0.5, s, font)


func _draw_photo_badge() -> void:
	var font: Font = _font
	var label := "FREE CAM" if Game.camera_mode == Game.Cam.FREE else "PHOTO"
	var hint := "WASD move  Q/E up  Shift boost  wheel speed  SPACE exit" if Game.camera_mode == Game.Cam.FREE else "F12 exit photo"
	draw_string(font, Vector2(14, 22), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, HUD_DIM)
	draw_string(font, Vector2(14, size.y - 14), hint, HORIZONTAL_ALIGNMENT_LEFT, -1, 8, HUD_DIM)


func _should_show_pilot_badge() -> bool:
	## Identity plate only while flying — not free-cam / photo / title.
	if Game.generating or not Game.title_dismissed or Game.paused:
		return false
	if Game.screenshot_mode or Game.camera_mode == Game.Cam.FREE:
		return false
	match Game.camera_mode:
		Game.Cam.CHASE, Game.Cam.TOP, Game.Cam.COCKPIT:
			return true
		_:
			return false


func _draw_pilot_badge(s: Vector2, font: Font, cockpit: bool = false) -> void:
	if not _should_show_pilot_badge():
		return
	var sz: float = AVATAR_SZ
	var margin: float = 12.0
	# Cockpit: sit on the dash lip (bottom of glass) so it stays readable.
	var bottom_y: float = (_cockpit_glass_bottom(s) - margin) if cockpit else (s.y - margin)
	var origin := Vector2(margin, bottom_y - sz)
	var name: String = Game.display_name().to_upper()
	var ac: String = Game.aircraft_label()
	var fs_name := 12
	var fs_ac := 10
	var name_w: float = font.get_string_size(name, HORIZONTAL_ALIGNMENT_LEFT, -1, fs_name).x
	var ac_w: float = font.get_string_size(ac, HORIZONTAL_ALIGNMENT_LEFT, -1, fs_ac).x
	var text_w: float = maxf(name_w, ac_w)
	var panel_w: float = sz + 10.0 + text_w + 12.0
	var panel := Rect2(origin.x - 4.0, origin.y - 4.0, panel_w, sz + 8.0)
	draw_rect(panel, PILOT_PANEL)
	draw_rect(Rect2(panel.position.x, panel.position.y, 2.0, panel.size.y), Color(0.82, 0.12, 0.14, 0.95))

	if _avatar_tex:
		var r := Rect2(origin.x, origin.y, sz, sz)
		draw_rect(r.grow(1.0), Color(0.02, 0.02, 0.03, 0.9))
		draw_texture_rect(_avatar_tex, r, false)
		draw_rect(r, Color(0.92, 0.92, 0.94, 0.55), false, 1.0)

	var tx: float = origin.x + sz + 10.0
	var ty: float = origin.y + 16.0
	# High-contrast labels over dark panel (readable on sky / terrain / dash)
	draw_string(font, Vector2(tx, ty), name, HORIZONTAL_ALIGNMENT_LEFT, -1, fs_name, PILOT_NAME_COL)
	draw_string(font, Vector2(tx, ty + 16.0), ac, HORIZONTAL_ALIGNMENT_LEFT, -1, fs_ac, PILOT_SUB_COL)


func _draw_world_readout(s: Vector2, font: Font) -> void:
	var y: float = s.y - 14.0
	# Keep tourism readout clear of the bottom-left pilot badge.
	var left_x: float = 12.0 + AVATAR_SZ + 120.0
	draw_string(font, Vector2(left_x, y), "OVF %s" % Game.over_region_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, HUD_DIM)
	if Game.place_name != "":
		var near: bool = Game.place_dist < 1400.0
		var label: String = "%s %s" % [Game.place_kind, Game.place_name.to_upper()]
		if not near:
			label = "%s  %s" % [label, _fmt_dist(Game.place_dist)]
		draw_string(font, Vector2(left_x, y - 14), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, HUD if near else HUD_DIM)
	if Game.nearest_airport_name != "":
		var ap_line: String = "AP %s  %s / %03d" % [
			Game.nearest_airport_name.to_upper(),
			_fmt_dist(Game.nearest_airport_dist),
			int(Game.nearest_airport_brg)
		]
		draw_string(font, Vector2(left_x, y - 28), ap_line, HORIZONTAL_ALIGNMENT_LEFT, -1, 9, HUD_DIM)


func _fmt_dist(meters: float) -> String:
	if meters < 1000.0:
		return "%dm" % int(meters)
	return "%.1fkm" % (meters * 0.001)


func _draw_compass_pois(cx: float, font: Font) -> void:
	var y: float = 36.0
	var hdg: float = Game.heading_deg
	for poi in Game.compass_pois:
		var brg: float = float(poi.get("brg", 0.0))
		var rel: float = brg - hdg
		while rel > 180.0:
			rel -= 360.0
		while rel < -180.0:
			rel += 360.0
		if absf(rel) > 55.0:
			continue
		var x: float = cx + rel * 1.6
		var kind: String = str(poi.get("kind", ""))
		var mark: String = "+" if kind == "AP" else ("o" if kind == "CITY" or kind == "TOWN" else ".")
		var col: Color = HUD_WARN if kind == "AP" else HUD
		draw_line(Vector2(x, y), Vector2(x, y + 6), col, 1.0)
		var nm: String = str(poi.get("name", ""))
		if nm.length() > 10:
			nm = nm.substr(0, 10)
		draw_string(font, Vector2(x - 18, y + 16), "%s %s" % [mark, nm], HORIZONTAL_ALIGNMENT_LEFT, -1, 7, col)


func _draw_airport_marker(s: Vector2, font: Font) -> void:
	if Game.nearest_airport_name == "":
		return
	var cam: Camera3D = get_viewport().get_camera_3d()
	if cam == null:
		return
	var ap: Vector2 = Game.nearest_airport_pos
	var ground_y: float = 0.0
	if Game.height_sampler.is_valid():
		ground_y = Game.height_sampler.call(ap.x, ap.y)
	var world := Vector3(ap.x, ground_y + 8.0, ap.y)
	if cam.is_position_behind(world):
		_draw_airport_caret(s, font)
		return
	var scr: Vector2 = cam.unproject_position(world)
	if not _on_screen(scr, s):
		_draw_airport_caret(s, font)
		return
	var col := HUD_WARN
	draw_line(Vector2(scr.x - 7, scr.y), Vector2(scr.x + 7, scr.y), col, 1.2)
	draw_line(Vector2(scr.x, scr.y - 7), Vector2(scr.x, scr.y + 7), col, 1.2)
	draw_arc(scr, 9.0, 0.0, TAU, 16, col, 1.0, true)
	draw_string(font, Vector2(scr.x + 12, scr.y + 3), "AP %s" % _fmt_dist(Game.nearest_airport_dist), HORIZONTAL_ALIGNMENT_LEFT, -1, 8, col)


func _draw_airport_caret(s: Vector2, font: Font) -> void:
	var rel: float = Game.nearest_airport_brg - Game.heading_deg
	while rel > 180.0:
		rel -= 360.0
	while rel < -180.0:
		rel += 360.0
	var ang: float = deg_to_rad(rel - 90.0)
	var cx: float = s.x * 0.5
	var cy: float = s.y * 0.5
	var edge := Vector2(cx + cos(ang) * minf(s.x, s.y) * 0.38, cy + sin(ang) * minf(s.x, s.y) * 0.38)
	draw_colored_polygon(PackedVector2Array([
		edge,
		edge + Vector2(cos(ang + 2.5), sin(ang + 2.5)) * 10.0,
		edge + Vector2(cos(ang - 2.5), sin(ang - 2.5)) * 10.0,
	]), HUD_WARN)
	draw_string(font, edge + Vector2(-16, 16), "AP", HORIZONTAL_ALIGNMENT_LEFT, -1, 8, HUD_WARN)


func _draw_minimap(s: Vector2, font: Font) -> void:
	var size := 72.0
	var origin := Vector2(s.x - size - 18.0, s.y - size - 48.0)
	var box := Rect2(origin, Vector2(size, size))
	draw_rect(box, Color(0, 0, 0, 0.4))
	draw_rect(box, HUD_DIM, false, 1.0)
	var c: Vector2 = origin + Vector2(size * 0.5, size * 0.5)
	draw_circle(c, 2.0, HUD)
	var hdg: float = deg_to_rad(Game.heading_deg)
	draw_line(c, c + Vector2(sin(hdg), -cos(hdg)) * 14.0, HUD, 1.2)
	var scale: float = size / 5200.0
	for poi in Game.compass_pois:
		var brg: float = float(poi.get("brg", 0.0))
		var dist: float = float(poi.get("dist", 0.0))
		var rel: float = deg_to_rad(brg - Game.heading_deg)
		var px: Vector2 = c + Vector2(sin(rel), -cos(rel)) * dist * scale
		if not box.has_point(px):
			continue
		var kind: String = str(poi.get("kind", ""))
		var col: Color = HUD_WARN if kind == "AP" else (HUD if kind == "CITY" or kind == "TOWN" else HUD_DIM)
		draw_circle(px, 2.2 if kind == "AP" else 1.6, col)
	draw_string(font, Vector2(origin.x, origin.y - 4), "MAP", HORIZONTAL_ALIGNMENT_LEFT, -1, 7, HUD_DIM)


func _draw_speed_tape(center: Vector2, half_h: float, font: Font, clip_b: float = -1.0) -> void:
	var spd: float = Game.airspeed
	var top: float = center.y - half_h
	var bot: float = center.y + half_h
	if clip_b > 0.0:
		bot = minf(bot, clip_b - 8.0)
	if bot <= top + 8.0:
		return
	var x: float = center.x
	draw_line(Vector2(x + 14, top), Vector2(x + 14, bot), HUD_DIM, 1.0)

	var window := 60.0
	var step := 10.0
	var base: float = floorf(spd / step) * step
	for i in range(-8, 9):
		var v: float = base + float(i) * step
		if absf(v - spd) > window:
			continue
		var y: float = center.y - ((v - spd) / window) * half_h
		if y < top or y > bot:
			continue
		var major: bool = int(v) % 20 == 0
		var tick: float = 10.0 if major else 6.0
		draw_line(Vector2(x + 14 - tick, y), Vector2(x + 14, y), HUD if major else HUD_DIM, 1.0)
		if major:
			draw_string(font, Vector2(x - 22, y + 3), "%03d" % int(v), HORIZONTAL_ALIGNMENT_LEFT, -1, 9, HUD_DIM)

	if center.y < bot:
		var box := Rect2(x - 28, center.y - 10, 40, 20)
		draw_rect(box, Color(0, 0, 0, 0.45))
		draw_rect(box, HUD, false, 1.0)
		draw_string(font, Vector2(box.position.x + 4, center.y + 4), "%03d" % int(spd), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, HUD)
		draw_colored_polygon(PackedVector2Array([
			Vector2(x + 14, center.y), Vector2(x + 20, center.y - 5), Vector2(x + 20, center.y + 5)
		]), HUD)
	if bot + 14.0 < (clip_b if clip_b > 0.0 else 1.0e9):
		draw_string(font, Vector2(x - 10, bot + 14), "KTS", HORIZONTAL_ALIGNMENT_LEFT, -1, 8, HUD_DIM)


func _draw_alt_tape(center: Vector2, half_h: float, font: Font, clip_b: float = -1.0) -> void:
	var alt: float = Game.altitude
	var top: float = center.y - half_h
	var bot: float = center.y + half_h
	if clip_b > 0.0:
		bot = minf(bot, clip_b - 8.0)
	if bot <= top + 8.0:
		return
	var x: float = center.x
	draw_line(Vector2(x - 14, top), Vector2(x - 14, bot), HUD_DIM, 1.0)

	var window := 400.0
	var step := 50.0
	var base: float = floorf(alt / step) * step
	for i in range(-12, 13):
		var v: float = base + float(i) * step
		if absf(v - alt) > window:
			continue
		var y: float = center.y - ((v - alt) / window) * half_h
		if y < top or y > bot:
			continue
		var major: bool = int(v) % 100 == 0
		var tick: float = 10.0 if major else 6.0
		draw_line(Vector2(x - 14, y), Vector2(x - 14 + tick, y), HUD if major else HUD_DIM, 1.0)
		if major:
			draw_string(font, Vector2(x + 2, y + 3), "%d" % int(v), HORIZONTAL_ALIGNMENT_LEFT, -1, 8, HUD_DIM)

	if center.y < bot:
		var box := Rect2(x - 12, center.y - 10, 52, 20)
		draw_rect(box, Color(0, 0, 0, 0.45))
		draw_rect(box, HUD, false, 1.0)
		draw_string(font, Vector2(box.position.x + 4, center.y + 4), "%d" % int(alt), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, HUD)
		draw_colored_polygon(PackedVector2Array([
			Vector2(x - 14, center.y), Vector2(x - 20, center.y - 5), Vector2(x - 20, center.y + 5)
		]), HUD)
	var limit: float = clip_b if clip_b > 0.0 else 1.0e9
	if bot + 14.0 < limit:
		draw_string(font, Vector2(x - 6, bot + 14), "ALT", HORIZONTAL_ALIGNMENT_LEFT, -1, 8, HUD_DIM)
	var ralt: int = int(Game.radar_height)
	var rcol: Color = HUD_BAD if float(ralt) < LOW_ALT_FT else HUD
	if bot + 28.0 < limit:
		draw_string(font, Vector2(x - 10, bot + 28), "R %d" % ralt, HORIZONTAL_ALIGNMENT_LEFT, -1, 9, rcol)
	draw_string(font, Vector2(x - 10, top - 12), "G %.1f" % Game.g_force, HORIZONTAL_ALIGNMENT_LEFT, -1, 9, HUD)


func _draw_bank_scale(cx: float, font: Font) -> void:
	var y: float = 48.0
	var r: float = 42.0
	for ang_deg in [0, 10, 20, 30, 45, 60, -10, -20, -30, -45, -60]:
		var a: float = deg_to_rad(float(ang_deg) - 90.0)
		var major: bool = absi(ang_deg) == 0 or absi(ang_deg) == 30 or absi(ang_deg) == 60
		var inner: float = r - (8.0 if major else 5.0)
		var p0 := Vector2(cx + cos(a) * inner, y + 18.0 + sin(a) * inner)
		var p1 := Vector2(cx + cos(a) * r, y + 18.0 + sin(a) * r)
		draw_line(p0, p1, HUD if major else HUD_DIM, 1.0)
	var roll: float = clampf(Game.roll_deg, -60.0, 60.0)
	var ra: float = deg_to_rad(roll - 90.0)
	var tip := Vector2(cx + cos(ra) * (r - 10.0), y + 18.0 + sin(ra) * (r - 10.0))
	draw_colored_polygon(PackedVector2Array([
		tip,
		tip + Vector2(cos(ra + 2.4), sin(ra + 2.4)) * 7.0,
		tip + Vector2(cos(ra - 2.4), sin(ra - 2.4)) * 7.0,
	]), HUD)
	draw_string(font, Vector2(cx - 8, y + 4), "BNK", HORIZONTAL_ALIGNMENT_LEFT, -1, 7, HUD_DIM)


func _draw_aoa_bracket(fpm: Vector2) -> void:
	var path_pitch: float = rad_to_deg(atan2(Game.vspeed, maxf(Game.airspeed * 0.5, 1.0)))
	var aoa: float = clampf(Game.pitch_deg - path_pitch * 0.35, -15.0, 25.0)
	var h: float = 28.0
	var x: float = fpm.x - 28.0
	var y0: float = fpm.y - h * 0.5
	draw_line(Vector2(x, y0), Vector2(x, y0 + h), HUD_DIM, 1.0)
	draw_line(Vector2(x, y0), Vector2(x + 5, y0), HUD_DIM, 1.0)
	draw_line(Vector2(x, y0 + h), Vector2(x + 5, y0 + h), HUD_DIM, 1.0)
	var t: float = inverse_lerp(-10.0, 20.0, aoa)
	var cy: float = lerpf(y0 + h, y0, clampf(t, 0.0, 1.0))
	var col: Color = HUD_BAD if aoa > 14.0 else (HUD_WARN if aoa > 10.0 else HUD)
	draw_colored_polygon(PackedVector2Array([
		Vector2(x, cy), Vector2(x - 6, cy - 4), Vector2(x - 6, cy + 4)
	]), col)


func _draw_warnings(cx: float, s: Vector2, font: Font) -> void:
	var msgs: Array = []
	if Game.warn_terrain:
		msgs.append({"t": "TERRAIN", "c": HUD_BAD})
	elif Game.warn_low_alt:
		if int(Time.get_ticks_msec() / lerpf(320, 160, Game.low_alt_intensity)) % 2 == 0:
			msgs.append({"t": "LOW ALT", "c": HUD_BAD})
	if Game.warn_missile:
		msgs.append({"t": "MSL AWAY", "c": HUD_WARN})

	var y: float = s.y * 0.18
	for m in msgs:
		var text: String = m["t"]
		var col: Color = m["c"]
		var w: float = 10.0 * float(text.length()) + 16.0
		var box := Rect2(cx - w * 0.5, y, w, 18.0)
		draw_rect(box, Color(0, 0, 0, 0.55))
		draw_rect(box, col, false, 1.5)
		draw_string(font, Vector2(box.position.x + 8, y + 13), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, col)
		y += 22.0


func _draw_weapon_hud(s: Vector2, font: Font) -> void:
	if not Game.aim_valid:
		return
	if not Game.aim_ready:
		_draw_weapon_status(Vector2(s.x - 100, s.y - 36), font)
		return

	var pip: Vector2 = Game.aim_screen
	var fpm: Vector2 = Game.fpm_screen
	var in_zone: bool = Game.aim_in_dlz
	var col: Color = HUD if in_zone else HUD_WARN

	if Game.camera_mode != Game.Cam.TOP and _on_screen(fpm, s) and _on_screen(pip, s):
		_draw_dashed(fpm, pip, col, 1.0)

	if _on_screen(pip, s):
		var ase_r: float = 38.0
		if in_zone:
			var t: float = inverse_lerp(Game.DLZ_RAERO, Game.DLZ_ROPT, Game.aim_range)
			t = clampf(t, 0.0, 1.0)
			ase_r = lerpf(36.0, 14.0, t)
			var flash_zone: bool = Game.aim_range < Game.DLZ_RPI and Game.aim_range > Game.DLZ_ROPT
			if not (flash_zone and int(Time.get_ticks_msec() / 180) % 2 == 1):
				draw_arc(pip, ase_r, 0.0, TAU, 32, col, 1.5, true)
		else:
			draw_arc(pip, ase_r, 0.0, TAU, 28, col, 1.0, true)
		_draw_ccip_pipper(pip, col)
		draw_string(font, Vector2(pip.x + ase_r + 6, pip.y + 4), "%d" % int(Game.aim_range), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, col)
	else:
		_draw_offscreen_caret(pip, s, col)

	_draw_dlz(Vector2(s.x - 36, s.y * 0.30), s.y * 0.40, font)
	_draw_weapon_status(Vector2(s.x - 100, s.y - 36), font)


func _draw_ccip_pipper(p: Vector2, col: Color) -> void:
	var arm := 11.0
	var gap := 3.0
	draw_line(Vector2(p.x - arm, p.y), Vector2(p.x - gap, p.y), col, 1.5)
	draw_line(Vector2(p.x + gap, p.y), Vector2(p.x + arm, p.y), col, 1.5)
	draw_line(Vector2(p.x, p.y - arm), Vector2(p.x, p.y - gap), col, 1.5)
	draw_line(Vector2(p.x, p.y + gap), Vector2(p.x, p.y + arm), col, 1.5)
	draw_arc(p, 4.0, 0.0, TAU, 12, col, 1.2, true)
	draw_circle(p, 1.2, col)


func _draw_fpm(p: Vector2) -> void:
	var r := 9.0
	draw_arc(p, r, 0.0, TAU, 20, HUD, 1.5, true)
	draw_line(Vector2(p.x - r - 10, p.y), Vector2(p.x - r, p.y), HUD, 1.5)
	draw_line(Vector2(p.x + r, p.y), Vector2(p.x + r + 10, p.y), HUD, 1.5)
	draw_line(Vector2(p.x, p.y + r), Vector2(p.x, p.y + r + 8), HUD, 1.5)
	var chev: float = 6.0 if Game.afterburner else 0.0
	if absf(Game.vspeed) > 8.0:
		chev += clampf(Game.vspeed * 0.15, -8.0, 8.0)
	if absf(chev) > 0.5:
		var cy := p.y - chev
		draw_line(Vector2(p.x - 16, cy), Vector2(p.x - 10, p.y - chev * 0.3), HUD_DIM, 1.0)
		draw_line(Vector2(p.x + 16, cy), Vector2(p.x + 10, p.y - chev * 0.3), HUD_DIM, 1.0)


func _draw_bore_ghost(p: Vector2) -> void:
	draw_line(Vector2(p.x - 6, p.y), Vector2(p.x - 2, p.y), HUD_DIM, 1.0)
	draw_line(Vector2(p.x + 2, p.y), Vector2(p.x + 6, p.y), HUD_DIM, 1.0)
	draw_line(Vector2(p.x, p.y - 6), Vector2(p.x, p.y - 2), HUD_DIM, 1.0)
	draw_line(Vector2(p.x, p.y + 2), Vector2(p.x, p.y + 6), HUD_DIM, 1.0)


func _draw_waterline(p: Vector2) -> void:
	draw_line(Vector2(p.x - 18, p.y), Vector2(p.x - 6, p.y), HUD, 1.5)
	draw_line(Vector2(p.x + 6, p.y), Vector2(p.x + 18, p.y), HUD, 1.5)
	draw_line(Vector2(p.x - 6, p.y), Vector2(p.x - 3, p.y + 4), HUD, 1.5)
	draw_line(Vector2(p.x - 3, p.y + 4), Vector2(p.x, p.y), HUD, 1.5)
	draw_line(Vector2(p.x, p.y), Vector2(p.x + 3, p.y + 4), HUD, 1.5)
	draw_line(Vector2(p.x + 3, p.y + 4), Vector2(p.x + 6, p.y), HUD, 1.5)


func _draw_dlz(origin: Vector2, height: float, font: Font) -> void:
	var x: float = origin.x
	var top: float = origin.y
	var bot: float = origin.y + height
	draw_line(Vector2(x, top), Vector2(x, bot), HUD_DIM, 1.0)
	var rmax := Game.DLZ_RAERO
	var y_of := func(r: float) -> float:
		return lerpf(bot, top, clampf(r / rmax, 0.0, 1.0))
	var ya: float = y_of.call(Game.DLZ_RAERO)
	draw_colored_polygon(PackedVector2Array([
		Vector2(x + 2, ya), Vector2(x + 8, ya - 4), Vector2(x + 8, ya + 4)
	]), HUD)
	var yo: float = y_of.call(Game.DLZ_ROPT)
	draw_arc(Vector2(x + 6, yo), 3.0, 0.0, TAU, 10, HUD, 1.0, true)
	var yp: float = y_of.call(Game.DLZ_RPI)
	draw_line(Vector2(x + 2, yp), Vector2(x + 9, yp), HUD, 1.0)
	var ym: float = y_of.call(Game.DLZ_RMIN)
	draw_line(Vector2(x + 2, ym), Vector2(x + 9, ym), HUD_WARN, 1.5)
	if Game.aim_valid:
		var yc: float = y_of.call(Game.aim_range)
		var ccol: Color = HUD if Game.aim_in_dlz else HUD_WARN
		draw_colored_polygon(PackedVector2Array([
			Vector2(x - 1, yc), Vector2(x - 7, yc - 4), Vector2(x - 7, yc + 4)
		]), ccol)
	draw_string(font, Vector2(x - 6, top - 4), "DLZ", HORIZONTAL_ALIGNMENT_LEFT, -1, 8, HUD_DIM)
	draw_string(font, Vector2(x + 10, ya + 3), "RA", HORIZONTAL_ALIGNMENT_LEFT, -1, 7, HUD_DIM)
	draw_string(font, Vector2(x + 10, ym + 3), "RM", HORIZONTAL_ALIGNMENT_LEFT, -1, 7, HUD_DIM)


func _draw_weapon_status(pos: Vector2, font: Font) -> void:
	var st := "RDY" if Game.aim_in_dlz else ("WAIT" if Game.aim_ready else "SAFE")
	var col: Color = HUD if Game.aim_in_dlz else (HUD_WARN if Game.aim_ready else HUD_BAD)
	draw_string(font, pos, "A/G CCIP", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, HUD)
	draw_string(font, pos + Vector2(0, 14), "MSL %d  %s" % [Game.missiles_ready, st], HORIZONTAL_ALIGNMENT_LEFT, -1, 10, col)


func _draw_pitch_ladder(cx: float, cy: float, s: Vector2, font: Font, fs: int, clip_b: float = -1.0) -> void:
	var pitch := Game.pitch_deg
	var roll := deg_to_rad(Game.roll_deg)
	var cos_r := cos(roll)
	var sin_r := sin(roll)
	var y_max: float = (clip_b - 6.0) if clip_b > 0.0 else (s.y - 24.0)
	for step in range(-40, 45, 10):
		var dy: float = (pitch - float(step)) * 2.4
		var mid := Vector2(cx - dy * sin_r, cy + dy * cos_r)
		if mid.y < 40.0 or mid.y > y_max:
			continue
		var w: float = 36.0 if step == 0 else 22.0
		if step == 0:
			_draw_rotated_segment(cx, cy, roll, Vector2(-55, dy), Vector2(-12, dy), HUD, 1.5)
			_draw_rotated_segment(cx, cy, roll, Vector2(12, dy), Vector2(55, dy), HUD, 1.5)
		else:
			_draw_rotated_segment(cx, cy, roll, Vector2(-w - 6, dy), Vector2(-8, dy), HUD_DIM, 1.0)
			_draw_rotated_segment(cx, cy, roll, Vector2(8, dy), Vector2(w + 6, dy), HUD_DIM, 1.0)
			var label_pos := Vector2(cx, cy) + Vector2((-w - 20) * cos_r - dy * sin_r, (-w - 20) * sin_r + dy * cos_r)
			if label_pos.y < y_max:
				draw_string(font, label_pos, str(step), HORIZONTAL_ALIGNMENT_LEFT, -1, fs, HUD_DIM)


func _draw_rotated_segment(cx: float, cy: float, roll: float, a: Vector2, b: Vector2, col: Color, width: float) -> void:
	var cos_r := cos(roll)
	var sin_r := sin(roll)
	var pa := Vector2(cx + a.x * cos_r - a.y * sin_r, cy + a.x * sin_r + a.y * cos_r)
	var pb := Vector2(cx + b.x * cos_r - b.y * sin_r, cy + b.x * sin_r + b.y * cos_r)
	draw_line(pa, pb, col, width)


func _draw_heading_tape(cx: float, font: Font, fs: int, y: float = 22.0) -> void:
	var hdg := Game.heading_deg
	draw_line(Vector2(cx - 70, y), Vector2(cx + 70, y), HUD_DIM, 1.0)
	for d in range(-40, 45, 10):
		var hh: float = fposmod(hdg + float(d), 360.0)
		var x: float = cx + float(d) * 1.6
		draw_line(Vector2(x, y - 6), Vector2(x, y), HUD, 1.0)
		if int(hh) % 30 == 0:
			draw_string(font, Vector2(x - 10, y - 8), "%03d" % int(hh), HORIZONTAL_ALIGNMENT_LEFT, -1, fs, HUD)
	draw_line(Vector2(cx, y), Vector2(cx, y + 8), HUD, 1.5)
	draw_colored_polygon(PackedVector2Array([
		Vector2(cx, y + 8), Vector2(cx - 4, y + 14), Vector2(cx + 4, y + 14)
	]), HUD)


func _draw_dashed(a: Vector2, b: Vector2, col: Color, width: float) -> void:
	var delta: Vector2 = b - a
	var length: float = delta.length()
	if length < 1.0:
		return
	var dir: Vector2 = delta / length
	var pos := 0.0
	var draw_on := true
	while pos < length:
		var seg: float = minf(6.0, length - pos)
		if draw_on:
			draw_line(a + dir * pos, a + dir * (pos + seg), col, width)
		pos += seg
		draw_on = not draw_on


func _draw_offscreen_caret(p: Vector2, s: Vector2, col: Color) -> void:
	var cx := s.x * 0.5
	var cy := s.y * 0.5
	var dir: Vector2 = p - Vector2(cx, cy)
	if dir.length_squared() < 0.001:
		return
	dir = dir.normalized()
	var edge: Vector2 = Vector2(cx, cy) + dir * minf(s.x, s.y) * 0.4
	draw_colored_polygon(PackedVector2Array([
		edge,
		edge - dir * 12.0 + Vector2(-dir.y, dir.x) * 7.0,
		edge - dir * 12.0 + Vector2(dir.y, -dir.x) * 7.0,
	]), col)


func _on_screen(p: Vector2, s: Vector2) -> bool:
	return p.x >= 0.0 and p.y >= 0.0 and p.x <= s.x and p.y <= s.y


func _process(_dt: float) -> void:
	queue_redraw()
