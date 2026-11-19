extends Node
## Root: pixel pipeline, world boot, input, adaptive resolution, aim screen.

@onready var viewport_host: SubViewportContainer = $PixelLayer/SubViewportContainer
@onready var game_viewport: SubViewport = $PixelLayer/SubViewportContainer/GameViewport
@onready var world: Node3D = $PixelLayer/SubViewportContainer/GameViewport/World
@onready var jet: Node3D = $PixelLayer/SubViewportContainer/GameViewport/Jet
@onready var camera_rig: Node3D = $PixelLayer/SubViewportContainer/GameViewport/CameraRig
@onready var missile_root: Node3D = $PixelLayer/SubViewportContainer/GameViewport/Missiles
@onready var dither: ColorRect = $DitherLayer/DitherOverlay
@onready var ui_layer: CanvasLayer = $UI
@onready var title_card: Control = $UI/TitleCard
@onready var hints: Control = $UI/Hints
@onready var hud: Control = $UI/HUD
@onready var cockpit: Control = $UI/Cockpit
@onready var touch: Control = $UI/TouchControls

var _internal_h: int = Game.INTERNAL_BASE_H
var _fps_accum: float = 0.0
var _fps_frames: int = 0
var _aim_marker: Node3D
var _pause_menu: Control
var _cp_course: Node3D
var _cp_hud: Control
var _cp_select: Control
var _cp_spawn_origin: Vector3 = Vector3.ZERO
var _cp_spawn_heading: float = 0.0
var _cp_advance_t: float = -1.0
var _cp_advance_level: int = 0
var _ad_course: Node3D
var _ad_hud: Control
var _ad_select: Control
var _ad_spawn_origin: Vector3 = Vector3.ZERO
var _ad_spawn_heading: float = 0.0
var _ad_advance_t: float = -1.0
var _ad_advance_level: int = 0


func _ready() -> void:
	get_window().title = "Air Force Dashi"
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_apply_internal_resolution(_internal_h)
	_setup_dither()
	_setup_pause_menu()
	_setup_checkpoint()
	_setup_antidrone()
	jet.fired_missile.connect(_on_fire)
	touch.fire_pressed.connect(func(): jet.try_fire())
	touch.ab_pressed.connect(func(): jet.set_afterburner_hold(true))
	touch.ab_released.connect(func(): jet.set_afterburner_hold(false))
	touch.roll_pressed.connect(func(): jet.trigger_barrel_roll())
	touch.cam_pressed.connect(func(): Game.cycle_camera())
	touch.steer_delta.connect(func(v): jet.set_steer(v))
	title_card.mode_selected.connect(_on_mode_selected)
	var aim_script: GDScript = load("res://scripts/fx/aim_marker.gd")
	_aim_marker = aim_script.new()
	game_viewport.add_child(_aim_marker)
	world.begin_generation()


func _setup_pause_menu() -> void:
	var pm_script: GDScript = load("res://scripts/ui/pause_menu.gd")
	_pause_menu = pm_script.new()
	_pause_menu.name = "PauseMenu"
	ui_layer.add_child(_pause_menu)
	if _pause_menu.has_signal("restart_level_pressed"):
		_pause_menu.restart_level_pressed.connect(_on_pause_restart)
	if _pause_menu.has_signal("return_title_pressed"):
		_pause_menu.return_title_pressed.connect(_on_pause_return_title)


func _on_pause_restart() -> void:
	Game.set_paused(false)
	if Game.play_mode == Game.PlayMode.CHECKPOINT:
		_restart_checkpoint()
	elif Game.play_mode == Game.PlayMode.ANTI_DRONE:
		_restart_antidrone()


func _on_pause_return_title() -> void:
	_cp_advance_t = -1.0
	_ad_advance_t = -1.0
	if _cp_course and _cp_course.has_method("clear"):
		_cp_course.clear()
	if _ad_course and _ad_course.has_method("clear"):
		_ad_course.clear()
	if _cp_select:
		_cp_select.visible = false
	if _ad_select:
		_ad_select.visible = false
	Game.clear_antidrone_lock()
	Game.cp_active = false
	Game.ad_active = false
	Game.cp_status = ""
	Game.ad_status = ""
	Game.paused = false
	Game.pause_toggled.emit(false)
	_reveal_title_after_select_cancel()
	Game.set_tip("")
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _setup_checkpoint() -> void:
	var course_script: GDScript = load("res://scripts/missions/checkpoint_course.gd")
	_cp_course = course_script.new()
	_cp_course.name = "CheckpointCourse"
	game_viewport.add_child(_cp_course)
	_cp_course.passed_ring.connect(_on_cp_ring)
	_cp_course.course_won.connect(_on_cp_won)
	_cp_course.course_failed.connect(_on_cp_failed)

	var hud_script: GDScript = load("res://scripts/ui/checkpoint_hud.gd")
	_cp_hud = hud_script.new()
	_cp_hud.name = "CheckpointHUD"
	ui_layer.add_child(_cp_hud)

	var sel_script: GDScript = load("res://scripts/ui/checkpoint_select.gd")
	_cp_select = sel_script.new()
	_cp_select.name = "CheckpointSelect"
	ui_layer.add_child(_cp_select)
	_cp_select.level_chosen.connect(_start_checkpoint_level)
	_cp_select.cancelled.connect(_on_cp_select_cancelled)


func _on_mode_selected(mode: int) -> void:
	if mode == Game.PlayMode.CHECKPOINT:
		_cp_select.open_select()
	elif mode == Game.PlayMode.ANTI_DRONE:
		_ad_select.open_select()
	elif mode == Game.PlayMode.FREE_FLIGHT:
		Game.title_dismissed = true
		Game.set_tip("VÔO LIVRE — explore the lakes")


func _on_cp_select_cancelled() -> void:
	_reveal_title_after_select_cancel()


func _on_ad_select_cancelled() -> void:
	_reveal_title_after_select_cancel()


func _reveal_title_after_select_cancel() -> void:
	if title_card.has_method("reveal_after_mode_cancel"):
		title_card.reveal_after_mode_cancel()
	elif title_card.has_method("reveal_after_checkpoint_cancel"):
		title_card.reveal_after_checkpoint_cancel()
	else:
		title_card.visible = true
		title_card.modulate.a = 1.0
		Game.title_dismissed = false


func _start_checkpoint_level(level: int) -> void:
	_cp_advance_t = -1.0
	_ad_advance_t = -1.0
	if _ad_course and _ad_course.has_method("clear"):
		_ad_course.clear()
	Game.set_play_mode(Game.PlayMode.CHECKPOINT)
	Game.title_dismissed = true
	title_card.visible = false
	if _cp_select:
		_cp_select.visible = false
	# Chase cam reads gates best
	Game.camera_mode = Game.Cam.CHASE
	Game.camera_changed.emit(Game.camera_mode)
	var origin := _checkpoint_origin(level)
	var heading: float = 0.0
	_cp_spawn_origin = origin
	_cp_spawn_heading = heading
	jet.reset_pose(origin, heading, 110.0)
	_cp_course.start_level(level, origin, heading)
	if _cp_hud.has_method("show_banner"):
		var d: Dictionary = CheckpointLevels.def(level)
		_cp_hud.show_banner(str(d.name), 2.4)
	Game.set_tip("CHECKPOINT %d — fly the red gates" % level)


func _checkpoint_origin(level: int) -> Vector3:
	var d: Dictionary = CheckpointLevels.def(level)
	var alt: float = float(d.start_alt)
	var gen = world.get("terrain_gen")
	if gen != null and gen.airports.size() > 0:
		var ap: Vector2 = gen.airports[0]
		var y: float = alt
		if Game.height_sampler.is_valid():
			y = maxf(alt, float(Game.height_sampler.call(ap.x, ap.y)) + 120.0)
		# Spawn slightly before the runway so first gate is ahead
		return Vector3(ap.x, y, ap.y + 200.0)
	return Vector3(0.0, alt, 0.0)


func _on_cp_ring(index: int, total: int) -> void:
	PatrolAudio.play_checkpoint_ok()
	if _cp_hud.has_method("show_banner"):
		_cp_hud.show_banner("GATE %d / %d" % [index, total], 0.9)


func _on_cp_won(level: int, _time_left: float) -> void:
	PatrolAudio.play_level_clear()
	if level >= CheckpointLevels.LEVEL_COUNT:
		if _cp_hud.has_method("show_level_popup"):
			_cp_hud.show_level_popup("CHECKMATE", "ALL 30 LEVELS CLEAR", 4.2)
		elif _cp_hud.has_method("show_banner"):
			_cp_hud.show_banner("CHECKMATE", 4.0)
		_cp_advance_t = -1.0
		return
	var nxt: int = level + 1
	var d: Dictionary = CheckpointLevels.def(nxt)
	if _cp_hud.has_method("show_level_popup"):
		_cp_hud.show_level_popup(
			"LEVEL UP",
			"LV %d CLEAR  →  %s" % [level, str(d.name)],
			2.35
		)
	elif _cp_hud.has_method("show_banner"):
		_cp_hud.show_banner("CLEAR  LV %d" % level, 2.2)
	_cp_advance_level = nxt
	_cp_advance_t = 2.35


func _on_cp_failed(_level: int, reason: String) -> void:
	_cp_advance_t = -1.0
	if _cp_hud.has_method("show_banner"):
		_cp_hud.show_banner("TIME UP" if reason == "TIME" else "FAILED", 3.0)


func _restart_checkpoint() -> void:
	if Game.play_mode != Game.PlayMode.CHECKPOINT:
		return
	_cp_advance_t = -1.0
	jet.reset_pose(_cp_spawn_origin, _cp_spawn_heading)
	_cp_course.restart()
	if _cp_hud.has_method("show_banner"):
		_cp_hud.show_banner("RESTART", 1.2)


func _next_checkpoint() -> void:
	if Game.play_mode != Game.PlayMode.CHECKPOINT:
		return
	if Game.cp_status != "WIN":
		return
	_cp_advance_t = -1.0
	var nxt: int = mini(Game.cp_level + 1, CheckpointLevels.LEVEL_COUNT)
	_start_checkpoint_level(nxt)


func _setup_antidrone() -> void:
	var course_script: GDScript = load("res://scripts/missions/antidrone_course.gd")
	_ad_course = course_script.new()
	_ad_course.name = "AntiDroneCourse"
	game_viewport.add_child(_ad_course)
	_ad_course.drone_killed.connect(_on_ad_kill)
	_ad_course.drone_leaked.connect(_on_ad_leak)
	_ad_course.course_won.connect(_on_ad_won)
	_ad_course.course_failed.connect(_on_ad_failed)

	var hud_script: GDScript = load("res://scripts/ui/antidrone_hud.gd")
	_ad_hud = hud_script.new()
	_ad_hud.name = "AntiDroneHUD"
	ui_layer.add_child(_ad_hud)

	var sel_script: GDScript = load("res://scripts/ui/antidrone_select.gd")
	_ad_select = sel_script.new()
	_ad_select.name = "AntiDroneSelect"
	ui_layer.add_child(_ad_select)
	_ad_select.level_chosen.connect(_start_antidrone_level)
	_ad_select.cancelled.connect(_on_ad_select_cancelled)


func _start_antidrone_level(level: int) -> void:
	_ad_advance_t = -1.0
	_cp_advance_t = -1.0
	if _cp_course and _cp_course.has_method("clear"):
		_cp_course.clear()
	Game.set_play_mode(Game.PlayMode.ANTI_DRONE)
	Game.title_dismissed = true
	title_card.visible = false
	if _ad_select:
		_ad_select.visible = false
	Game.camera_mode = Game.Cam.CHASE
	Game.camera_changed.emit(Game.camera_mode)
	var origin := _antidrone_origin(level)
	var heading: float = 0.0
	_ad_spawn_origin = origin
	_ad_spawn_heading = heading
	jet.reset_pose(origin, heading, 140.0)
	_ad_course.start_level(level, origin, heading)
	if _ad_hud.has_method("show_banner"):
		var d: Dictionary = AntiDroneLevels.def(level)
		_ad_hud.show_banner(str(d.name), 2.4)
	Game.set_tip("ANTI-DRONE %d — intercept before impact" % level)


func _antidrone_origin(level: int) -> Vector3:
	var d: Dictionary = AntiDroneLevels.def(level)
	var alt: float = float(d.start_alt)
	var gen = world.get("terrain_gen")
	if gen != null and gen.airports.size() > 0:
		var ap: Vector2 = gen.airports[0]
		var y: float = alt
		if Game.height_sampler.is_valid():
			y = maxf(alt, float(Game.height_sampler.call(ap.x, ap.y)) + 160.0)
		return Vector3(ap.x, y, ap.y + 80.0)
	return Vector3(0.0, alt, 0.0)


func _on_ad_kill(kind: int, kills: int, total: int) -> void:
	PatrolAudio.play_checkpoint_ok()
	if _ad_hud.has_method("show_banner"):
		_ad_hud.show_banner("%s  DOWN  %d/%d" % [AntiDroneLevels.kind_name(kind), kills, total], 0.85)


func _on_ad_leak(leaks: int, max_leaks: int) -> void:
	if _ad_hud.has_method("show_banner"):
		_ad_hud.show_banner("IMPACT  %d / %d" % [leaks, max_leaks], 1.2)


func _on_ad_won(level: int) -> void:
	PatrolAudio.play_level_clear()
	if level >= AntiDroneLevels.LEVEL_COUNT:
		if _ad_hud.has_method("show_level_popup"):
			_ad_hud.show_level_popup("SKY CLEAR", "ALL 30 INTERCEPTS DONE", 4.2)
		_ad_advance_t = -1.0
		return
	var nxt: int = level + 1
	var d: Dictionary = AntiDroneLevels.def(nxt)
	if _ad_hud.has_method("show_level_popup"):
		_ad_hud.show_level_popup("LEVEL UP", "LV %d CLEAR  →  %s" % [level, str(d.name)], 2.35)
	_ad_advance_level = nxt
	_ad_advance_t = 2.35


func _on_ad_failed(_level: int, reason: String) -> void:
	_ad_advance_t = -1.0
	if _ad_hud.has_method("show_banner"):
		_ad_hud.show_banner("LEAKS CRITICAL" if reason == "LEAK" else "FAILED", 3.0)


func _restart_antidrone() -> void:
	if Game.play_mode != Game.PlayMode.ANTI_DRONE:
		return
	_ad_advance_t = -1.0
	jet.reset_pose(_ad_spawn_origin, _ad_spawn_heading, 140.0)
	_ad_course.restart()
	if _ad_hud.has_method("show_banner"):
		_ad_hud.show_banner("RESTART", 1.2)


func _next_antidrone() -> void:
	if Game.play_mode != Game.PlayMode.ANTI_DRONE:
		return
	if Game.ad_status != "WIN":
		return
	_ad_advance_t = -1.0
	var nxt: int = mini(Game.ad_level + 1, AntiDroneLevels.LEVEL_COUNT)
	_start_antidrone_level(nxt)


func _setup_dither() -> void:
	var mat := ShaderMaterial.new()
	mat.shader = load("res://shaders/dither_post.gdshader")
	dither.material = mat
	dither.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_setup_low_alt_warning()


func _setup_low_alt_warning() -> void:
	var layer := CanvasLayer.new()
	layer.name = "LowAltLayer"
	layer.layer = 6
	add_child(layer)
	var warn_script: GDScript = load("res://scripts/ui/low_alt_warning.gd")
	var warn: ColorRect = warn_script.new()
	warn.name = "LowAltWarning"
	layer.add_child(warn)


func _apply_internal_resolution(h: int) -> void:
	_internal_h = clampi(h, 200, 400)
	var win_h: int = maxi(get_viewport().size.y, 1)
	var shrink: int = maxi(1, int(round(float(win_h) / float(_internal_h))))
	viewport_host.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	viewport_host.stretch = true
	viewport_host.stretch_shrink = shrink


func _process(dt: float) -> void:
	_fps_accum += dt
	_fps_frames += 1
	if _fps_accum >= 1.0:
		var fps: float = float(_fps_frames) / _fps_accum
		_fps_accum = 0.0
		_fps_frames = 0
		if fps < 40.0 and _internal_h > 220:
			_apply_internal_resolution(_internal_h - 20)
		elif fps > 70.0 and _internal_h < Game.INTERNAL_BASE_H:
			_apply_internal_resolution(_internal_h + 10)

	if _cp_advance_t > 0.0 and not Game.paused and not Game.generating:
		_cp_advance_t -= dt
		if _cp_advance_t <= 0.0:
			_cp_advance_t = -1.0
			_start_checkpoint_level(_cp_advance_level)

	if _ad_advance_t > 0.0 and not Game.paused and not Game.generating:
		_ad_advance_t -= dt
		if _ad_advance_t <= 0.0:
			_ad_advance_t = -1.0
			_start_antidrone_level(_ad_advance_level)

	if Game.generating or not Game.title_dismissed or Game.paused:
		return
	if Game.camera_mode != Game.Cam.FREE:
		_update_steer()
	_update_aim_screen()
	_apply_screenshot_presentation()


func _apply_screenshot_presentation() -> void:
	# Clean photo: hide dither grain slightly by leaving overlay; UI handles hide.
	if Game.screenshot_mode and _internal_h < 380:
		_apply_internal_resolution(380)
	dither.visible = not Game.screenshot_mode


func _update_steer() -> void:
	var vp := get_viewport().get_visible_rect().size
	var mouse: Vector2 = get_viewport().get_mouse_position()
	var center := vp * 0.5
	var offset: Vector2 = (mouse - center) / center
	offset = offset.clamp(Vector2(-1, -1), Vector2(1, 1))

	match Game.camera_mode:
		Game.Cam.TOP:
			var cam: Camera3D = camera_rig.get_node("Camera3D")
			var local_mouse: Vector2 = mouse * Vector2(game_viewport.size) / vp
			var from: Vector3 = cam.project_ray_origin(local_mouse)
			var dir: Vector3 = cam.project_ray_normal(local_mouse)
			if absf(dir.y) > 0.001:
				var t: float = (0.5 - from.y) / dir.y
				var hit: Vector3 = from + dir * t
				var aim: Vector3 = hit - jet.global_position
				aim.y = 0.0
				jet.set_top_aim(aim)
		Game.Cam.FREE:
			pass
		_:
			jet.set_steer(offset)


func _update_aim_screen() -> void:
	var cam: Camera3D = camera_rig.get_node("Camera3D")
	var win: Vector2 = get_viewport().get_visible_rect().size
	var scale: Vector2 = win / Vector2(game_viewport.size)
	Game.aim_screen = _project_hud(cam, Game.aim_world, scale) if Game.aim_valid else Vector2(-40, -40)
	Game.fpm_screen = _project_hud(cam, Game.fpm_world, scale)
	Game.bore_screen = _project_hud(cam, Game.bore_world, scale)


func _project_hud(cam: Camera3D, world: Vector3, scale: Vector2) -> Vector2:
	var local: Vector2 = cam.unproject_position(world)
	# If behind camera, push far off-centre so caret still works
	if cam.is_position_behind(world):
		var win: Vector2 = get_viewport().get_visible_rect().size
		var dir: Vector2 = (local * scale - win * 0.5)
		if dir.length_squared() < 1.0:
			dir = Vector2(0, 1)
		return win * 0.5 + dir.normalized() * maxf(win.x, win.y)
	return local * scale


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause_game") and Game.title_dismissed and not Game.generating:
		Game.toggle_pause()
		get_viewport().set_input_as_handled()
		return

	if Game.paused:
		return

	if event.is_action_pressed("cycle_camera") and Game.title_dismissed:
		Game.cycle_camera()
		get_viewport().set_input_as_handled()
	if event.is_action_pressed("toggle_sound"):
		Game.toggle_sound()
		get_viewport().set_input_as_handled()
	if event.is_action_pressed("screenshot_mode") and Game.title_dismissed:
		Game.toggle_screenshot_mode()
		get_viewport().set_input_as_handled()

	if not Game.title_dismissed or title_card.visible:
		return

	# CheckPoint / Anti-Drone: R retry, N next after win
	if Game.play_mode == Game.PlayMode.CHECKPOINT:
		if event.is_action_pressed("restart_course"):
			_restart_checkpoint()
			get_viewport().set_input_as_handled()
			return
		if event.is_action_pressed("next_course"):
			_next_checkpoint()
			get_viewport().set_input_as_handled()
			return
	elif Game.play_mode == Game.PlayMode.ANTI_DRONE:
		if event.is_action_pressed("restart_course"):
			_restart_antidrone()
			get_viewport().set_input_as_handled()
			return
		if event.is_action_pressed("next_course"):
			_next_antidrone()
			get_viewport().set_input_as_handled()
			return

	# Free cam owns WASD / mouse — skip combat binds that steal motion.
	if Game.camera_mode == Game.Cam.FREE:
		return

	# LMB = fire · RMB = accelerator (works together with LMB)
	if event.is_action_pressed("fire_missile"):
		jet.try_fire()
		get_viewport().set_input_as_handled()
	if event.is_action_pressed("throttle"):
		jet.set_afterburner_hold(true)
		get_viewport().set_input_as_handled()
	elif event.is_action_released("throttle"):
		jet.set_afterburner_hold(false)
		get_viewport().set_input_as_handled()

	# F = barrel roll / manobra
	if event.is_action_pressed("barrel_roll"):
		jet.trigger_barrel_roll()
		get_viewport().set_input_as_handled()


func _on_fire(origin: Vector3, direction: Vector3) -> void:
	var m := Missile.new()
	missile_root.add_child(m)
	var guided: bool = false
	var target: Node3D = null
	if Game.play_mode == Game.PlayMode.ANTI_DRONE and Game.ad_locked and is_instance_valid(Game.ad_lock_target):
		guided = true
		target = Game.ad_lock_target
		direction = (target.global_position - origin).normalized()
	m.setup(origin, direction, target, guided)
	m.impacted.connect(_on_impact)
	m.segment_moved.connect(_on_missile_segment)


func _on_missile_segment(from: Vector3, to: Vector3) -> void:
	if Game.play_mode != Game.PlayMode.ANTI_DRONE or _ad_course == null:
		return
	if _ad_course.has_method("notify_missile_segment"):
		_ad_course.notify_missile_segment(from, to)


func _on_impact(pos: Vector3, on_water: bool) -> void:
	ImpactFX.spawn(missile_root, pos, on_water)
	if Game.play_mode == Game.PlayMode.ANTI_DRONE and _ad_course and _ad_course.has_method("notify_missile_blast"):
		_ad_course.notify_missile_blast(pos, 16.0)


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_SIZE_CHANGED:
		_apply_internal_resolution(_internal_h)
