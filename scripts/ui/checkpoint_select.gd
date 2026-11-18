extends Control
## Level picker for CheckPoint mode.


signal level_chosen(level: int)
signal cancelled

const C_WHITE := Color(0.96, 0.96, 0.97, 1.0)
const C_GREY := Color(0.55, 0.55, 0.58, 1.0)
const C_RED := Color(0.82, 0.12, 0.14, 1.0)
const C_PANEL := Color(0.08, 0.08, 0.09, 0.96)

var _display: FontFile
var _ui: FontFile
var _grid: GridContainer
var _title: Label
var _back: Button


func _ready() -> void:
	visible = false
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_display = _load_font("res://fonts/BebasNeue-Regular.ttf")
	_ui = _load_font("res://fonts/Barlow-Regular.ttf")
	if _display == null:
		_display = _load_font("res://fonts/RobotoMono-Regular.ttf")
	if _ui == null:
		_ui = _load_font("res://fonts/RobotoMono-Regular.ttf")

	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.02, 0.025, 0.82)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(dim)

	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.offset_left = -260.0
	panel.offset_right = 260.0
	panel.offset_top = -220.0
	panel.offset_bottom = 220.0
	var sb := StyleBoxFlat.new()
	sb.bg_color = C_PANEL
	sb.set_border_width_all(1)
	sb.border_color = Color(0.28, 0.28, 0.3)
	sb.set_corner_radius_all(2)
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 14
	sb.content_margin_bottom = 14
	panel.add_theme_stylebox_override("panel", sb)
	add_child(panel)

	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	panel.add_child(v)

	var accent := ColorRect.new()
	accent.color = C_RED
	accent.custom_minimum_size = Vector2(0, 3)
	v.add_child(accent)

	_title = Label.new()
	_title.text = "CHECKPOINT"
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title.add_theme_color_override("font_color", C_WHITE)
	if _display:
		_title.add_theme_font_override("font", _display)
		_title.add_theme_font_size_override("font_size", 34)
	v.add_child(_title)

	var sub := Label.new()
	sub.text = "30 progressive aerial gates"
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_color_override("font_color", C_GREY)
	if _ui:
		sub.add_theme_font_override("font", _ui)
		sub.add_theme_font_size_override("font_size", 13)
	v.add_child(sub)

	_grid = GridContainer.new()
	_grid.columns = 6
	_grid.add_theme_constant_override("h_separation", 8)
	_grid.add_theme_constant_override("v_separation", 8)
	v.add_child(_grid)

	_back = _make_btn("BACK", false)
	_back.pressed.connect(func(): cancelled.emit(); visible = false)
	v.add_child(_back)


func open_select() -> void:
	_rebuild()
	visible = true
	modulate.a = 1.0


func _rebuild() -> void:
	for c in _grid.get_children():
		c.queue_free()
	var unlocked: int = Game.cp_unlocked_level
	for i in CheckpointLevels.LEVEL_COUNT:
		var lv: int = i + 1
		var locked: bool = lv > unlocked
		var btn := _make_btn("%d" % lv, lv == unlocked and not locked)
		btn.disabled = locked
		btn.custom_minimum_size = Vector2(64, 40)
		if locked:
			btn.modulate = Color(0.45, 0.45, 0.48, 0.7)
		var capture_lv := lv
		btn.pressed.connect(func(): _pick(capture_lv))
		_grid.add_child(btn)


func _pick(lv: int) -> void:
	visible = false
	level_chosen.emit(lv)


func _make_btn(text: String, primary: bool) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.focus_mode = Control.FOCUS_NONE
	if _display:
		btn.add_theme_font_override("font", _display)
		btn.add_theme_font_size_override("font_size", 18)
	var normal := StyleBoxFlat.new()
	normal.set_corner_radius_all(2)
	normal.content_margin_left = 8
	normal.content_margin_right = 8
	normal.content_margin_top = 8
	normal.content_margin_bottom = 8
	var hover := normal.duplicate() as StyleBoxFlat
	var pressed := normal.duplicate() as StyleBoxFlat
	if primary:
		normal.bg_color = C_RED
		hover.bg_color = Color(0.95, 0.18, 0.16)
		pressed.bg_color = Color(0.55, 0.08, 0.1)
	else:
		normal.bg_color = Color(0.16, 0.16, 0.17)
		normal.set_border_width_all(1)
		normal.border_color = Color(0.32, 0.32, 0.34)
		hover.bg_color = Color(0.22, 0.22, 0.24)
		hover.set_border_width_all(1)
		hover.border_color = C_RED
		pressed.bg_color = Color(0.12, 0.12, 0.13)
	btn.add_theme_stylebox_override("normal", normal)
	btn.add_theme_stylebox_override("hover", hover)
	btn.add_theme_stylebox_override("pressed", pressed)
	btn.add_theme_stylebox_override("disabled", normal)
	btn.add_theme_color_override("font_color", C_WHITE)
	btn.add_theme_color_override("font_hover_color", C_WHITE)
	btn.add_theme_color_override("font_disabled_color", C_GREY)
	return btn


func _load_font(path: String) -> FontFile:
	if not FileAccess.file_exists(path):
		return null
	var f := FontFile.new()
	if f.load_dynamic_font(path) != OK:
		return null
	return f
