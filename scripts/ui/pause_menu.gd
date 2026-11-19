extends Control
## Pause overlay — black · red · white · grey. Centered panel.
## Mission modes: restart level + return to title.


signal restart_level_pressed
signal return_title_pressed

const C_PANEL := Color(0.10, 0.10, 0.11, 0.96)
const C_GREY := Color(0.58, 0.58, 0.60, 1.0)
const C_WHITE := Color(0.96, 0.96, 0.97, 1.0)
const C_RED := Color(0.82, 0.12, 0.14, 1.0)
const C_RED_HOT := Color(0.95, 0.18, 0.16, 1.0)

var _panel: PanelContainer
var _center: CenterContainer
var _title: Label
var _sound_btn: Button
var _sens_slider: HSlider
var _sens_label: Label
var _resume_btn: Button
var _restart_btn: Button
var _title_btn: Button
var _hint: Label
var _display: FontFile
var _ui: FontFile


func _ready() -> void:
	visible = false
	mouse_filter = Control.MOUSE_FILTER_STOP
	process_mode = Node.PROCESS_MODE_ALWAYS
	z_index = 30
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	grow_horizontal = Control.GROW_DIRECTION_BOTH
	grow_vertical = Control.GROW_DIRECTION_BOTH

	_display = _load_font("res://fonts/BebasNeue-Regular.ttf")
	_ui = _load_font("res://fonts/Barlow-Regular.ttf")
	if _display == null:
		_display = _load_font("res://fonts/RobotoMono-Regular.ttf")
	if _ui == null:
		_ui = _load_font("res://fonts/RobotoMono-Regular.ttf")

	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.02, 0.025, 0.78)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(dim)

	_center = CenterContainer.new()
	_center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_center)

	_panel = PanelContainer.new()
	_panel.custom_minimum_size = Vector2(340, 420)
	var panel_sb := StyleBoxFlat.new()
	panel_sb.bg_color = C_PANEL
	panel_sb.set_border_width_all(1)
	panel_sb.border_color = Color(0.25, 0.25, 0.27, 1.0)
	panel_sb.set_corner_radius_all(2)
	panel_sb.content_margin_left = 22
	panel_sb.content_margin_right = 22
	panel_sb.content_margin_top = 18
	panel_sb.content_margin_bottom = 18
	_panel.add_theme_stylebox_override("panel", panel_sb)
	_center.add_child(_panel)

	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	_panel.add_child(v)

	var accent := ColorRect.new()
	accent.color = C_RED
	accent.custom_minimum_size = Vector2(0, 3)
	v.add_child(accent)

	_title = Label.new()
	_title.text = "PAUSED"
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	if _display:
		_title.add_theme_font_override("font", _display)
		_title.add_theme_font_size_override("font_size", 36)
	_title.add_theme_color_override("font_color", C_WHITE)
	v.add_child(_title)

	_resume_btn = _make_btn("RESUME  (Esc)", true)
	_resume_btn.pressed.connect(func(): Game.set_paused(false))
	v.add_child(_resume_btn)

	_restart_btn = _make_btn("RESTART LEVEL", false)
	_restart_btn.pressed.connect(_on_restart)
	v.add_child(_restart_btn)

	_title_btn = _make_btn("TITLE SCREEN", false)
	_title_btn.pressed.connect(_on_return_title)
	v.add_child(_title_btn)

	_sound_btn = _make_btn("SOUND: OFF", false)
	_sound_btn.pressed.connect(_on_sound)
	v.add_child(_sound_btn)

	_sens_label = Label.new()
	_sens_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	if _ui:
		_sens_label.add_theme_font_override("font", _ui)
		_sens_label.add_theme_font_size_override("font_size", 13)
	_sens_label.add_theme_color_override("font_color", C_GREY)
	v.add_child(_sens_label)

	_sens_slider = HSlider.new()
	_sens_slider.min_value = 0.4
	_sens_slider.max_value = 2.0
	_sens_slider.step = 0.05
	_sens_slider.value = Game.mouse_sens
	_sens_slider.value_changed.connect(_on_sens)
	_style_slider(_sens_slider)
	v.add_child(_sens_slider)

	_hint = Label.new()
	_hint.text = "M sound · SPACE cam · F12 photo · Esc pause"
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint.add_theme_color_override("font_color", C_GREY)
	if _ui:
		_hint.add_theme_font_override("font", _ui)
		_hint.add_theme_font_size_override("font_size", 12)
	v.add_child(_hint)

	Game.pause_toggled.connect(_on_pause)
	Game.sound_toggled.connect(func(_on): _refresh_labels())
	Game.play_mode_changed.connect(func(_m): _refresh_mission_buttons())
	_refresh_labels()
	_refresh_mission_buttons()


func _make_btn(text: String, primary: bool) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.focus_mode = Control.FOCUS_NONE
	btn.custom_minimum_size = Vector2(0, 40)
	if _display and primary:
		btn.add_theme_font_override("font", _display)
		btn.add_theme_font_size_override("font_size", 20)
	elif _ui:
		btn.add_theme_font_override("font", _ui)
		btn.add_theme_font_size_override("font_size", 14)

	var normal := StyleBoxFlat.new()
	normal.set_corner_radius_all(2)
	normal.content_margin_left = 12
	normal.content_margin_right = 12
	normal.content_margin_top = 10
	normal.content_margin_bottom = 10
	var hover := normal.duplicate() as StyleBoxFlat
	var pressed := normal.duplicate() as StyleBoxFlat
	if primary:
		normal.bg_color = C_RED
		hover.bg_color = C_RED_HOT
		pressed.bg_color = Color(0.55, 0.08, 0.1, 1.0)
		btn.add_theme_color_override("font_color", C_WHITE)
		btn.add_theme_color_override("font_hover_color", C_WHITE)
		btn.add_theme_color_override("font_pressed_color", C_WHITE)
	else:
		normal.bg_color = Color(0.16, 0.16, 0.17, 1.0)
		normal.set_border_width_all(1)
		normal.border_color = Color(0.32, 0.32, 0.34, 1.0)
		hover.bg_color = Color(0.22, 0.22, 0.24, 1.0)
		hover.set_border_width_all(1)
		hover.border_color = C_RED
		pressed.bg_color = Color(0.12, 0.12, 0.13, 1.0)
		btn.add_theme_color_override("font_color", C_WHITE)
		btn.add_theme_color_override("font_hover_color", C_WHITE)
	btn.add_theme_stylebox_override("normal", normal)
	btn.add_theme_stylebox_override("hover", hover)
	btn.add_theme_stylebox_override("pressed", pressed)
	btn.add_theme_stylebox_override("focus", normal)
	return btn


func _style_slider(slider: HSlider) -> void:
	var track := StyleBoxFlat.new()
	track.bg_color = Color(0.2, 0.2, 0.22, 1.0)
	track.set_corner_radius_all(2)
	track.content_margin_top = 4
	track.content_margin_bottom = 4
	var fill := StyleBoxFlat.new()
	fill.bg_color = C_RED
	fill.set_corner_radius_all(2)
	slider.add_theme_stylebox_override("slider", track)
	slider.add_theme_stylebox_override("grabber_area", fill)
	slider.add_theme_stylebox_override("grabber_area_highlight", fill)


func _on_pause(on: bool) -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	if get_parent():
		get_parent().move_child(self, get_parent().get_child_count() - 1)
	visible = on
	if on:
		_sens_slider.value = Game.mouse_sens
		_refresh_labels()
		_refresh_mission_buttons()


func _refresh_mission_buttons() -> void:
	var mission: bool = (
		Game.play_mode == Game.PlayMode.CHECKPOINT
		or Game.play_mode == Game.PlayMode.ANTI_DRONE
	)
	if _restart_btn:
		_restart_btn.visible = mission
	if _title_btn:
		_title_btn.visible = Game.title_dismissed
	if _panel:
		_panel.custom_minimum_size = Vector2(340, 420 if mission else 360)


func _on_restart() -> void:
	if Game.play_mode != Game.PlayMode.CHECKPOINT and Game.play_mode != Game.PlayMode.ANTI_DRONE:
		return
	restart_level_pressed.emit()


func _on_return_title() -> void:
	return_title_pressed.emit()


func _on_sound() -> void:
	Game.toggle_sound()


func _on_sens(v: float) -> void:
	Game.set_mouse_sens(v)
	_refresh_labels()


func _refresh_labels() -> void:
	_sound_btn.text = "SOUND: ON" if Game.sound_on else "SOUND: OFF"
	_sens_label.text = "MOUSE SENS  %.0f%%" % (Game.mouse_sens * 100.0)


func _load_font(path: String) -> FontFile:
	if not FileAccess.file_exists(path):
		return null
	var f := FontFile.new()
	if f.load_dynamic_font(path) != OK:
		return null
	return f
