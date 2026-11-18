extends Control
## Bottom strip + contextual tips (airport roll, weather, etc.).

@onready var strip: Label = $Strip
@onready var sound_btn: Button = $SoundBtn

var _tip: Label
var _tip_pulse: float = 0.0
var _shown_airport_tip: bool = false


func _ready() -> void:
	sound_btn.text = "SOUND: OFF"
	sound_btn.pressed.connect(_on_sound)
	var mono := FontFile.new()
	if FileAccess.file_exists("res://fonts/RobotoMono-Regular.ttf"):
		if mono.load_dynamic_font("res://fonts/RobotoMono-Regular.ttf") == OK:
			strip.add_theme_font_override("font", mono)
			sound_btn.add_theme_font_override("font", mono)

	_tip = Label.new()
	_tip.name = "Tip"
	_tip.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_tip.add_theme_color_override("font_color", Color(0.95, 0.95, 0.96, 0.95))
	var tip_font := FontFile.new()
	if FileAccess.file_exists("res://fonts/Barlow-SemiBold.ttf") and tip_font.load_dynamic_font("res://fonts/Barlow-SemiBold.ttf") == OK:
		_tip.add_theme_font_override("font", tip_font)
		_tip.add_theme_font_size_override("font_size", 15)
	elif mono:
		_tip.add_theme_font_override("font", mono)
		_tip.add_theme_font_size_override("font_size", 13)
	_tip.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_tip.offset_top = -52.0
	_tip.offset_bottom = -28.0
	_tip.offset_left = 40.0
	_tip.offset_right = -40.0
	_tip.modulate.a = 0.0
	add_child(_tip)

	Game.missile_count_changed.connect(_refresh)
	Game.sound_toggled.connect(func(on): sound_btn.text = "SOUND: ON" if on else "SOUND: OFF")
	Game.tip_changed.connect(_on_tip)
	_refresh(Game.missiles_ready)
	set_process(true)


func _refresh(_n: int = 0) -> void:
	strip.text = "WASD fly  ·  LMB fire  ·  RMB AB  ·  F roll  ·  SPACE cam  ·  F12 photo  ·  Esc pause  ·  MSL %d/%d" % [
		Game.missiles_ready, Game.MISSILE_MAX
	]


func _on_sound() -> void:
	Game.toggle_sound()


func _on_tip(text: String) -> void:
	_tip.text = text
	_tip_pulse = 0.0
	if text == "":
		_tip.modulate.a = 0.0
	else:
		_tip.modulate.a = 1.0


func _process(dt: float) -> void:
	visible = Game.title_dismissed and not Game.generating and not Game.paused and not Game.screenshot_mode
	if Game.camera_mode == Game.Cam.FREE:
		visible = false
		return
	if not visible:
		return
	_update_contextual_tips()
	if Game.tip_text != "":
		_tip_pulse += dt
		_tip.modulate.a = 0.55 + 0.45 * (0.5 + 0.5 * sin(_tip_pulse * 3.0))


func _update_contextual_tips() -> void:
	var tip := ""
	if Game.near_airport and not _shown_airport_tip:
		tip = "NEAR AIRPORT — press F for a barrel roll"
	elif Game.raining and Game.rain_intensity > 0.3:
		tip = "LIGHT RAIN — watch your altitude"
	elif Game.fog_boost > 0.55:
		tip = "MORNING HAZE — visibility reduced"
	elif not Game.player_engaged:
		tip = "WASD to fly  ·  mouse for light trim"
	# Dismiss airport tip after a few seconds of display
	if tip.begins_with("NEAR AIRPORT") and Game.tip_text.begins_with("NEAR AIRPORT") and _tip_pulse > 7.5:
		_shown_airport_tip = true
		tip = ""
	Game.set_tip(tip)
