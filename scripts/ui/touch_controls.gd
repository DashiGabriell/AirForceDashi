extends Control
## On-screen buttons for touch / amenity on desktop.

signal steer_delta(v: Vector2)
signal fire_pressed
signal ab_pressed
signal ab_released
signal roll_pressed
signal cam_pressed

@onready var pad: Control = $Pad
@onready var btn_fire: Button = $BtnFire
@onready var btn_ab: Button = $BtnAB
@onready var btn_roll: Button = $BtnRoll
@onready var btn_cam: Button = $BtnCam

var _pad_active: bool = false
var _pad_center: Vector2


func _ready() -> void:
	btn_fire.pressed.connect(func(): fire_pressed.emit())
	btn_ab.button_down.connect(func(): ab_pressed.emit())
	btn_ab.button_up.connect(func(): ab_released.emit())
	btn_roll.pressed.connect(func(): roll_pressed.emit())
	btn_cam.pressed.connect(func(): cam_pressed.emit())
	# Show on touchscreens or always as small cluster for amenity
	visible = DisplayServer.is_touchscreen_available()


func _process(_dt: float) -> void:
	if not Game.title_dismissed or Game.screenshot_mode or Game.camera_mode == Game.Cam.FREE:
		modulate.a = 0.0
		mouse_filter = Control.MOUSE_FILTER_IGNORE
	else:
		modulate.a = 1.0
		mouse_filter = Control.MOUSE_FILTER_STOP


func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if pad.get_global_rect().has_point(event.position):
			_pad_active = event.pressed
			_pad_center = pad.global_position + pad.size * 0.5
			if not event.pressed:
				steer_delta.emit(Vector2.ZERO)
	elif event is InputEventScreenDrag and _pad_active:
		var d: Vector2 = (event.position - _pad_center) / (pad.size * 0.5)
		steer_delta.emit(d.clamp(Vector2(-1, -1), Vector2(1, 1)))
