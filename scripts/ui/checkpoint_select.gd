extends Control
## Level picker for CheckPoint — centered panel, 30 levels.


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
var _center: CenterContainer
var _panel: PanelContainer


func _ready() -> void:
	visible = false
	mouse_filter = Control.MOUSE_FILTER_STOP
	z_index = 20
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
	dim.name = "Dim"
	dim.color = Color(0.02, 0.02, 0.025, 0.88)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(dim)

	_center = CenterContainer.new()
	_center.name = "Center"
	_center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_center)

	_panel = PanelContainer.new()
	_panel.name = "Panel"
	_panel.custom_minimum_size = Vector2(540, 460)
	var sb := StyleBoxFlat.new()
	sb.bg_color = C_PANEL
	sb.set_border_width_all(1)
	sb.border_color = Color(0.28, 0.28, 0.3)
	sb.set_corner_radius_all(2)
	sb.content_margin_left = 20
	sb.content_margin_right = 20
	sb.content_margin_top = 16
	sb.content_margin_bottom = 16
	_panel.add_theme_stylebox_override("panel", sb)
	_center.add_child(_panel)

	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	_panel.add_child(v)

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
		_title.add_theme_font_size_override("font_size", 36)
	v.add_child(_title)

	var sub := Label.new()
	sub.text = "Escolha um nível · 30 gates progressivos"
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_color_override("font_color", C_GREY)
	if _ui:
		sub.add_theme_font_override("font", _ui)
		sub.add_theme_font_size_override("font_size", 14)
	v.add_child(sub)

	_grid = GridContainer.new()
	_grid.columns = 6
	_grid.add_theme_constant_override("h_separation", 8)
	_grid.add_theme_constant_override("v_separation", 8)
	_grid.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	v.add_child(_grid)

	_back = _make_btn("BACK", false)
	_back.custom_minimum_size = Vector2(200, 44)
	_back.pressed.connect(_on_back)
	v.add_child(_back)


func open_select() -> void:
	# Ensure we cover the full window and sit above other UI.
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	if get_parent():
		get_parent().move_child(self, get_parent().get_child_count() - 1)
	_rebuild()
	visible = true
	modulate = Color(1, 1, 1, 1)
	mouse_filter = Control.MOUSE_FILTER_STOP


func _on_back() -> void:
	visible = false
	cancelled.emit()


func _rebuild() -> void:
	# Free immediately so we don't stack duplicate buttons.
	var old: Array = _grid.get_children()
	for c in old:
		_grid.remove_child(c)
		c.free()

	var unlocked: int = clampi(Game.cp_unlocked_level, 1, CheckpointLevels.LEVEL_COUNT)
	for i in CheckpointLevels.LEVEL_COUNT:
		var lv: int = i + 1
		var locked: bool = lv > unlocked
		var primary: bool = (lv == unlocked)
		var btn := _make_btn("%d" % lv, primary)
		btn.disabled = locked
		btn.custom_minimum_size = Vector2(72, 44)
		if locked:
			btn.modulate = Color(0.5, 0.5, 0.52, 0.75)
		else:
			btn.modulate = Color(1, 1, 1, 1)
		var capture_lv := lv
		btn.pressed.connect(func(): _pick(capture_lv))
		_grid.add_child(btn)


func _pick(lv: int) -> void:
	if lv < 1 or lv > Game.cp_unlocked_level:
		return
	visible = false
	level_chosen.emit(lv)


func _make_btn(text: String, primary: bool) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.focus_mode = Control.FOCUS_NONE
	btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	if _display:
		btn.add_theme_font_override("font", _display)
		btn.add_theme_font_size_override("font_size", 20)
	var normal := StyleBoxFlat.new()
	normal.set_corner_radius_all(2)
	normal.content_margin_left = 10
	normal.content_margin_right = 10
	normal.content_margin_top = 10
	normal.content_margin_bottom = 10
	var hover := normal.duplicate() as StyleBoxFlat
	var pressed := normal.duplicate() as StyleBoxFlat
	var disabled := normal.duplicate() as StyleBoxFlat
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
	disabled.bg_color = Color(0.12, 0.12, 0.13)
	disabled.set_border_width_all(1)
	disabled.border_color = Color(0.22, 0.22, 0.24)
	btn.add_theme_stylebox_override("normal", normal)
	btn.add_theme_stylebox_override("hover", hover)
	btn.add_theme_stylebox_override("pressed", pressed)
	btn.add_theme_stylebox_override("disabled", disabled)
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
