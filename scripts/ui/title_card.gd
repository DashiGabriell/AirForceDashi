extends Control
## Title / boot — black · red · white · grey.
## Centered mode buttons: CheckPoint · Vôo Livre.

signal mode_selected(mode: int)

@onready var bg: ColorRect = $BG
@onready var title: Label = $Title
@onready var subtitle: Label = $Subtitle
@onready var prompt: Label = $Prompt
@onready var bar: ProgressBar = $Progress
@onready var bar_label: Label = $ProgressLabel

var _ready_to_start: bool = false
var _pulse: float = 0.0
var _brand: Label
var _bg_art: TextureRect
var _sil: TextureRect
var _controls: Label
var _accent: ColorRect
var _btn_free: Button
var _btn_cp: Button
var _mode_box: VBoxContainer
var _name_box: VBoxContainer
var _name_label: Label
var _name_edit: LineEdit
var _ac_box: VBoxContainer
var _ac_label: Label
var _btn_f22: Button
var _btn_f15: Button
var _load_p: float = 0.0
var _phrase_i: int = 0
var _phrase_t: float = 0.0
var _display: FontFile
var _ui: FontFile

## Scrim over title art — dark enough for UI, light enough to show landscape.
const C_BLACK_SOFT := Color(0.05, 0.05, 0.06, 0.48)
const C_GREY := Color(0.55, 0.55, 0.58, 1.0)
const C_GREY_DIM := Color(0.38, 0.38, 0.40, 1.0)
const C_WHITE := Color(0.96, 0.96, 0.97, 1.0)
const C_RED := Color(0.82, 0.12, 0.14, 1.0)
const C_RED_HOT := Color(0.95, 0.18, 0.16, 1.0)

const PHRASES := [
	"charting the lakes…",
	"mapping shorelines…",
	"tuning radar…",
	"arming rails…",
	"warming nozzles…",
]


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	bg.color = C_BLACK_SOFT
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE

	bar.visible = false
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar_label.visible = false
	prompt.visible = false

	_display = _load_font("res://fonts/BebasNeue-Regular.ttf")
	_ui = _load_font("res://fonts/Barlow-Regular.ttf")
	if _display == null:
		_display = _load_font("res://fonts/RobotoMono-Regular.ttf")
	if _ui == null:
		_ui = _load_font("res://fonts/RobotoMono-Regular.ttf")

	# Landscape art behind scrim + jet
	_bg_art = TextureRect.new()
	_bg_art.name = "BgArt"
	_bg_art.texture = _load_title_bg()
	_bg_art.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	_bg_art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_bg_art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_bg_art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bg_art.set_anchors_preset(Control.PRESET_FULL_RECT)
	_bg_art.offset_left = 0.0
	_bg_art.offset_top = 0.0
	_bg_art.offset_right = 0.0
	_bg_art.offset_bottom = 0.0
	add_child(_bg_art)
	move_child(_bg_art, 0)
	move_child(bg, 1)

	# Jet hero — upper mid so center buttons stay clear
	_sil = TextureRect.new()
	_sil.name = "Silhouette"
	_sil.texture = _load_title_jet()
	_sil.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_sil.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_sil.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_sil.modulate = Color(1, 1, 1, 0.0)
	_sil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_sil.set_anchors_preset(Control.PRESET_CENTER)
	_sil.offset_left = -300.0
	_sil.offset_right = 300.0
	_sil.offset_top = -70.0
	_sil.offset_bottom = 110.0
	add_child(_sil)
	move_child(_sil, bg.get_index() + 1)

	_accent = ColorRect.new()
	_accent.name = "Accent"
	_accent.color = C_RED
	_accent.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_accent.set_anchors_preset(Control.PRESET_CENTER)
	_accent.offset_left = -72.0
	_accent.offset_right = 72.0
	_accent.offset_top = -168.0
	_accent.offset_bottom = -164.0
	add_child(_accent)

	_brand = Label.new()
	_brand.name = "Brand"
	_brand.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_brand.text = "AIR FORCE"
	_brand.add_theme_color_override("font_color", C_WHITE)
	_brand.set_anchors_preset(Control.PRESET_CENTER)
	_brand.offset_left = -320.0
	_brand.offset_right = 320.0
	_brand.offset_top = -268.0
	_brand.offset_bottom = -228.0
	add_child(_brand)

	title.text = "DASHI"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_color_override("font_color", C_WHITE)
	title.offset_top = -232.0
	title.offset_bottom = -172.0
	title.offset_left = -320.0
	title.offset_right = 320.0

	subtitle.text = "lake country · last light"
	subtitle.add_theme_color_override("font_color", C_GREY)
	subtitle.offset_top = -160.0
	subtitle.offset_bottom = -138.0
	subtitle.offset_left = -280.0
	subtitle.offset_right = 280.0

	# Pilot name
	_name_box = VBoxContainer.new()
	_name_box.name = "NameBox"
	_name_box.alignment = BoxContainer.ALIGNMENT_CENTER
	_name_box.add_theme_constant_override("separation", 6)
	_name_box.set_anchors_preset(Control.PRESET_CENTER)
	_name_box.offset_left = -160.0
	_name_box.offset_right = 160.0
	_name_box.offset_top = -128.0
	_name_box.offset_bottom = -68.0
	_name_box.visible = false
	_name_box.modulate.a = 0.0
	add_child(_name_box)

	_name_label = Label.new()
	_name_label.text = "PILOT CALLSIGN"
	_name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_name_label.add_theme_color_override("font_color", C_GREY)
	_name_box.add_child(_name_label)

	_name_edit = LineEdit.new()
	_name_edit.placeholder_text = "seu nome"
	_name_edit.max_length = 16
	_name_edit.alignment = HORIZONTAL_ALIGNMENT_CENTER
	_name_edit.text = Game.player_name
	_name_edit.custom_minimum_size = Vector2(300, 36)
	_name_edit.focus_mode = Control.FOCUS_ALL
	_style_name_edit(_name_edit)
	_name_edit.text_changed.connect(_on_name_changed)
	_name_edit.text_submitted.connect(func(_t): _commit_name())
	_name_edit.focus_exited.connect(_commit_name)
	_name_box.add_child(_name_edit)

	# Aircraft select — below callsign
	_ac_box = VBoxContainer.new()
	_ac_box.name = "AircraftBox"
	_ac_box.alignment = BoxContainer.ALIGNMENT_CENTER
	_ac_box.add_theme_constant_override("separation", 6)
	_ac_box.set_anchors_preset(Control.PRESET_CENTER)
	_ac_box.offset_left = -210.0
	_ac_box.offset_right = 210.0
	_ac_box.offset_top = -58.0
	_ac_box.offset_bottom = 36.0
	_ac_box.visible = false
	_ac_box.modulate.a = 0.0
	add_child(_ac_box)

	_ac_label = Label.new()
	_ac_label.text = "SELECT AIRCRAFT"
	_ac_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_ac_label.add_theme_color_override("font_color", C_GREY)
	_ac_box.add_child(_ac_label)

	var ac_row := HBoxContainer.new()
	ac_row.alignment = BoxContainer.ALIGNMENT_CENTER
	ac_row.add_theme_constant_override("separation", 10)
	_ac_box.add_child(ac_row)

	_btn_f22 = _make_aircraft_btn("F-22 RAPTOR", "res://assets/ui/f22_icon.png")
	_btn_f22.pressed.connect(func(): _select_aircraft(Game.Aircraft.F22_RAPTOR))
	ac_row.add_child(_btn_f22)

	_btn_f15 = _make_aircraft_btn("F-15 EAGLE", "res://assets/ui/f15_icon.png")
	_btn_f15.pressed.connect(func(): _select_aircraft(Game.Aircraft.F15_EAGLE))
	ac_row.add_child(_btn_f15)
	_refresh_aircraft_buttons()

	# Centered mode select
	_mode_box = VBoxContainer.new()
	_mode_box.name = "ModeBox"
	_mode_box.alignment = BoxContainer.ALIGNMENT_CENTER
	_mode_box.add_theme_constant_override("separation", 10)
	_mode_box.set_anchors_preset(Control.PRESET_CENTER)
	_mode_box.offset_left = -150.0
	_mode_box.offset_right = 150.0
	_mode_box.offset_top = 48.0
	_mode_box.offset_bottom = 210.0
	_mode_box.visible = false
	_mode_box.modulate.a = 0.0
	add_child(_mode_box)

	_btn_cp = _make_mode_btn("CHECKPOINT", true)
	_btn_cp.pressed.connect(func(): _choose(Game.PlayMode.CHECKPOINT))
	_mode_box.add_child(_btn_cp)

	var btn_ad := _make_mode_btn("ANTI-DRONE", false)
	btn_ad.pressed.connect(func(): _choose(Game.PlayMode.ANTI_DRONE))
	_mode_box.add_child(btn_ad)

	_btn_free = _make_mode_btn("VÔO LIVRE", false)
	_btn_free.pressed.connect(func(): _choose(Game.PlayMode.FREE_FLIGHT))
	_mode_box.add_child(_btn_free)

	_controls = Label.new()
	_controls.name = "Controls"
	_controls.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_controls.text = "WASD  ·  LMB fire  ·  RMB throttle  ·  F roll  ·  M sound  ·  Esc pause"
	_controls.add_theme_color_override("font_color", C_GREY_DIM)
	_controls.set_anchors_preset(Control.PRESET_CENTER)
	_controls.offset_left = -360.0
	_controls.offset_right = 360.0
	_controls.offset_top = 220.0
	_controls.offset_bottom = 244.0
	_controls.visible = false
	_controls.modulate.a = 0.0
	add_child(_controls)

	_refresh_title_silhouette()

	bar_label.text = PHRASES[0]
	bar_label.set_anchors_preset(Control.PRESET_CENTER)
	bar_label.offset_left = -220.0
	bar_label.offset_right = 220.0
	bar_label.offset_top = 170.0
	bar_label.offset_bottom = 194.0
	bar_label.add_theme_color_override("font_color", C_GREY)
	bar_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bar_label.visible = true

	_apply_fonts()
	_raise_ui_stack()

	_brand.modulate.a = 0.0
	title.modulate.a = 0.0
	subtitle.modulate.a = 0.0
	_accent.modulate.a = 0.0
	_sil.modulate.a = 0.0
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(_brand, "modulate:a", 1.0, 0.55).set_delay(0.1)
	tw.tween_property(title, "modulate:a", 1.0, 0.7).set_delay(0.25)
	tw.tween_property(_accent, "modulate:a", 1.0, 0.5).set_delay(0.4)
	tw.tween_property(subtitle, "modulate:a", 1.0, 0.55).set_delay(0.5)
	tw.tween_property(_sil, "modulate:a", 0.85, 0.9).set_delay(0.2)

	Game.generation_progress.connect(_on_prog)
	Game.generation_done.connect(_on_done)
	set_process(true)


func _style_name_edit(edit: LineEdit) -> void:
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.12, 0.12, 0.13, 0.95)
	normal.set_border_width_all(1)
	normal.border_color = Color(0.4, 0.4, 0.42, 1.0)
	normal.set_corner_radius_all(2)
	normal.content_margin_left = 12
	normal.content_margin_right = 12
	normal.content_margin_top = 8
	normal.content_margin_bottom = 8
	var focus := normal.duplicate() as StyleBoxFlat
	focus.border_color = C_RED
	edit.add_theme_stylebox_override("normal", normal)
	edit.add_theme_stylebox_override("focus", focus)
	edit.add_theme_stylebox_override("read_only", normal)
	edit.add_theme_color_override("font_color", C_WHITE)
	edit.add_theme_color_override("font_placeholder_color", C_GREY_DIM)
	edit.add_theme_color_override("caret_color", C_RED_HOT)
	edit.add_theme_color_override("selection_color", Color(0.82, 0.12, 0.14, 0.45))


func _on_name_changed(text: String) -> void:
	# Live clamp length / strip invalid chars; persist on submit/exit.
	var caret: int = _name_edit.caret_column
	var cleaned: String = _filter_name(text)
	if cleaned != text:
		_name_edit.text = cleaned
		_name_edit.caret_column = mini(caret, cleaned.length())


func _filter_name(raw: String) -> String:
	var s: String = raw
	var out := ""
	for i in s.length():
		var ch: String = s.substr(i, 1)
		var code: int = ch.unicode_at(0)
		var ok: bool = (
			(code >= 65 and code <= 90)
			or (code >= 97 and code <= 122)
			or (code >= 48 and code <= 57)
			or ch == " "
			or ch == "_"
			or ch == "-"
			or (code >= 192 and code <= 255)
		)
		if ok:
			out += ch
		if out.length() >= 16:
			break
	return out


func _commit_name() -> void:
	if _name_edit == null:
		return
	Game.set_player_name(_name_edit.text)
	_name_edit.text = Game.player_name


func _make_aircraft_btn(label: String, icon_path: String) -> Button:
	var btn := Button.new()
	btn.text = label
	btn.focus_mode = Control.FOCUS_NONE
	btn.custom_minimum_size = Vector2(196, 78)
	btn.clip_text = true
	btn.expand_icon = true
	btn.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	btn.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
	var tex: Texture2D = _load_tex(icon_path)
	if tex:
		btn.icon = tex
	if _ui:
		btn.add_theme_font_override("font", _ui)
		btn.add_theme_font_size_override("font_size", 12)
	btn.add_theme_constant_override("icon_max_width", 120)
	btn.add_theme_color_override("font_color", C_WHITE)
	btn.add_theme_color_override("font_hover_color", C_WHITE)
	btn.add_theme_color_override("font_pressed_color", C_WHITE)
	return btn


func _select_aircraft(kind: int) -> void:
	Game.set_aircraft(kind)
	_refresh_aircraft_buttons()
	_refresh_title_silhouette()


func _refresh_aircraft_buttons() -> void:
	if _btn_f22 == null or _btn_f15 == null:
		return
	_style_aircraft_btn(_btn_f22, Game.aircraft == Game.Aircraft.F22_RAPTOR)
	_style_aircraft_btn(_btn_f15, Game.aircraft == Game.Aircraft.F15_EAGLE)


func _style_aircraft_btn(btn: Button, selected: bool) -> void:
	var normal := StyleBoxFlat.new()
	normal.set_corner_radius_all(2)
	normal.content_margin_left = 10
	normal.content_margin_right = 10
	normal.content_margin_top = 8
	normal.content_margin_bottom = 8
	var hover := normal.duplicate() as StyleBoxFlat
	var pressed := normal.duplicate() as StyleBoxFlat
	if selected:
		normal.bg_color = Color(0.18, 0.12, 0.12, 0.98)
		normal.set_border_width_all(2)
		normal.border_color = C_RED
		hover.bg_color = Color(0.24, 0.14, 0.14, 1.0)
		hover.set_border_width_all(2)
		hover.border_color = C_RED_HOT
		pressed.bg_color = Color(0.14, 0.08, 0.08, 1.0)
		pressed.set_border_width_all(2)
		pressed.border_color = C_RED
	else:
		normal.bg_color = Color(0.12, 0.12, 0.13, 0.95)
		normal.set_border_width_all(1)
		normal.border_color = Color(0.4, 0.4, 0.42, 1.0)
		hover.bg_color = Color(0.18, 0.18, 0.2, 1.0)
		hover.set_border_width_all(1)
		hover.border_color = C_RED
		pressed.bg_color = Color(0.1, 0.1, 0.11, 1.0)
		pressed.set_border_width_all(1)
		pressed.border_color = C_GREY_DIM
	btn.add_theme_stylebox_override("normal", normal)
	btn.add_theme_stylebox_override("hover", hover)
	btn.add_theme_stylebox_override("pressed", pressed)
	btn.add_theme_stylebox_override("focus", normal)


func _refresh_title_silhouette() -> void:
	if _sil == null:
		return
	_sil.texture = _load_title_jet()


func _make_mode_btn(text: String, primary: bool) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.focus_mode = Control.FOCUS_NONE
	btn.custom_minimum_size = Vector2(280, 42)
	if _display:
		btn.add_theme_font_override("font", _display)
		btn.add_theme_font_size_override("font_size", 26)
	var normal := StyleBoxFlat.new()
	normal.set_corner_radius_all(2)
	normal.content_margin_left = 18
	normal.content_margin_right = 18
	normal.content_margin_top = 12
	normal.content_margin_bottom = 12
	var hover := normal.duplicate() as StyleBoxFlat
	var pressed := normal.duplicate() as StyleBoxFlat
	if primary:
		normal.bg_color = C_RED
		hover.bg_color = C_RED_HOT
		pressed.bg_color = Color(0.55, 0.08, 0.1, 1.0)
	else:
		normal.bg_color = Color(0.14, 0.14, 0.15, 0.95)
		normal.set_border_width_all(1)
		normal.border_color = Color(0.4, 0.4, 0.42, 1.0)
		hover.bg_color = Color(0.2, 0.2, 0.22, 1.0)
		hover.set_border_width_all(1)
		hover.border_color = C_RED
		pressed.bg_color = Color(0.1, 0.1, 0.11, 1.0)
	btn.add_theme_stylebox_override("normal", normal)
	btn.add_theme_stylebox_override("hover", hover)
	btn.add_theme_stylebox_override("pressed", pressed)
	btn.add_theme_stylebox_override("focus", normal)
	btn.add_theme_color_override("font_color", C_WHITE)
	btn.add_theme_color_override("font_hover_color", C_WHITE)
	btn.add_theme_color_override("font_pressed_color", C_WHITE)
	return btn


func _apply_fonts() -> void:
	if _display:
		_brand.add_theme_font_override("font", _display)
		_brand.add_theme_font_size_override("font_size", 28)
		title.add_theme_font_override("font", _display)
		title.add_theme_font_size_override("font_size", 84)
	if _ui:
		subtitle.add_theme_font_override("font", _ui)
		subtitle.add_theme_font_size_override("font_size", 16)
		_controls.add_theme_font_override("font", _ui)
		_controls.add_theme_font_size_override("font_size", 13)
		bar_label.add_theme_font_override("font", _ui)
		bar_label.add_theme_font_size_override("font_size", 13)
		_name_label.add_theme_font_override("font", _ui)
		_name_label.add_theme_font_size_override("font_size", 12)
		_name_edit.add_theme_font_override("font", _ui)
		_name_edit.add_theme_font_size_override("font_size", 16)
		_ac_label.add_theme_font_override("font", _ui)
		_ac_label.add_theme_font_size_override("font_size", 12)
		if _btn_f22:
			_btn_f22.add_theme_font_override("font", _ui)
			_btn_f22.add_theme_font_size_override("font_size", 12)
		if _btn_f15:
			_btn_f15.add_theme_font_override("font", _ui)
			_btn_f15.add_theme_font_size_override("font_size", 12)


func _raise_ui_stack() -> void:
	if _bg_art:
		move_child(_bg_art, 0)
	move_child(bg, 1)
	move_child(_sil, bg.get_index() + 1)
	move_child(_brand, get_child_count() - 1)
	move_child(title, get_child_count() - 1)
	move_child(_accent, get_child_count() - 1)
	move_child(subtitle, get_child_count() - 1)
	move_child(_name_box, get_child_count() - 1)
	move_child(_ac_box, get_child_count() - 1)
	move_child(_mode_box, get_child_count() - 1)
	move_child(_controls, get_child_count() - 1)
	move_child(bar_label, get_child_count() - 1)


func _process(dt: float) -> void:
	_pulse += dt
	queue_redraw()
	if not _ready_to_start:
		_phrase_t += dt
		if _phrase_t > 2.2:
			_phrase_t = 0.0
			_phrase_i = (_phrase_i + 1) % PHRASES.size()
			bar_label.text = "%s  %d%%" % [PHRASES[_phrase_i], int(_load_p * 100.0)]


func _draw() -> void:
	var s := size
	var edge := Color(0.02, 0.02, 0.025, 0.88)
	draw_rect(Rect2(0, 0, s.x, s.y * 0.14), edge)
	draw_rect(Rect2(0, 0, s.x * 0.08, s.y), Color(edge.r, edge.g, edge.b, 0.5))
	draw_rect(Rect2(s.x * 0.92, 0, s.x * 0.08, s.y), Color(edge.r, edge.g, edge.b, 0.5))
	draw_rect(Rect2(0, 0, s.x, 3.0), C_RED)
	if not _ready_to_start:
		_draw_load_bar(s)


func _draw_load_bar(s: Vector2) -> void:
	var w := 300.0
	var h := 6.0
	var x := (s.x - w) * 0.5
	var y := s.y * 0.5 + 210.0
	draw_rect(Rect2(x, y, w, h), Color(0.18, 0.18, 0.2, 1.0))
	var filled_w: float = w * _load_p
	draw_rect(Rect2(x, y, filled_w, h), C_RED)
	if _load_p > 0.02:
		draw_rect(Rect2(x + filled_w - 2.0, y - 2.0, 2.0, h + 4.0), C_WHITE)


func _on_prog(p: float) -> void:
	_load_p = clampf(p, 0.0, 1.0)
	bar_label.text = "%s  %d%%" % [PHRASES[_phrase_i], int(_load_p * 100.0)]


func _on_done() -> void:
	_load_p = 1.0
	bar_label.visible = false
	_ready_to_start = true
	_name_box.visible = true
	_ac_box.visible = true
	_mode_box.visible = true
	_controls.visible = true
	_name_edit.text = Game.player_name
	_refresh_aircraft_buttons()
	_refresh_title_silhouette()
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(_name_box, "modulate:a", 1.0, 0.35)
	tw.tween_property(_ac_box, "modulate:a", 1.0, 0.38)
	tw.tween_property(_mode_box, "modulate:a", 1.0, 0.42)
	tw.tween_property(_controls, "modulate:a", 1.0, 0.48)
	# Focus name if empty so the player notices the field.
	if Game.player_name == "":
		_name_edit.grab_focus()


func _choose(mode: int) -> void:
	if not _ready_to_start:
		return
	_commit_name()
	_ready_to_start = false
	Game.set_play_mode(mode)
	# Hide title immediately so it can't block CheckPoint select clicks.
	if mode == Game.PlayMode.FREE_FLIGHT:
		mode_selected.emit(mode)
		_dismiss_title()
	else:
		visible = false
		set_process(false)
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		mode_selected.emit(mode)


func _dismiss_title() -> void:
	Game.title_dismissed = true
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 0.0, 0.55)
	tw.tween_callback(func(): visible = false; set_process(false))


func reveal_after_checkpoint_cancel() -> void:
	reveal_after_mode_cancel()


func reveal_after_mode_cancel() -> void:
	## Called when player backs out of level select.
	visible = true
	modulate.a = 1.0
	mouse_filter = Control.MOUSE_FILTER_STOP
	_ready_to_start = true
	_name_box.visible = true
	_ac_box.visible = true
	_mode_box.visible = true
	_controls.visible = true
	_name_box.modulate.a = 1.0
	_ac_box.modulate.a = 1.0
	_mode_box.modulate.a = 1.0
	_controls.modulate.a = 1.0
	_name_edit.text = Game.player_name
	_refresh_aircraft_buttons()
	_refresh_title_silhouette()
	Game.title_dismissed = false
	Game.set_play_mode(Game.PlayMode.NONE)
	set_process(true)


func _load_title_bg() -> Texture2D:
	var path := "res://assets/ui/title_bg.jpg"
	var tex: Texture2D = _load_tex(path)
	if tex:
		return tex
	push_warning("title_card: missing %s" % path)
	return ImageTexture.new()


func _load_title_jet() -> Texture2D:
	var path := "res://assets/ui/f22_title.png"
	if Game.aircraft == Game.Aircraft.F15_EAGLE:
		path = "res://assets/ui/f15_title.png"
	var tex: Texture2D = _load_tex(path)
	if tex:
		return tex
	push_warning("title_card: missing %s" % path)
	return ImageTexture.new()


func _load_tex(path: String) -> Texture2D:
	if ResourceLoader.exists(path):
		var tex: Texture2D = load(path)
		if tex:
			return tex
	if FileAccess.file_exists(path):
		var img := Image.load_from_file(path)
		if img:
			return ImageTexture.create_from_image(img)
	return null


func _load_font(path: String) -> FontFile:
	if not FileAccess.file_exists(path):
		return null
	var f := FontFile.new()
	if f.load_dynamic_font(path) != OK:
		return null
	return f
