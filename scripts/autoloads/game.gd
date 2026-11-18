extends Node
## Shared runtime state for Air Force Dashi.

signal generation_progress(p: float)
signal generation_done
signal camera_changed(mode: int)
signal missile_count_changed(n: int)
signal sound_toggled(on: bool)
signal pause_toggled(on: bool)
signal tip_changed(text: String)
signal mouse_sens_changed(v: float)
signal play_mode_changed(mode: int)
signal checkpoint_progress_changed(unlocked: int)

enum Cam { TOP, CHASE, COCKPIT, FREE }
enum PlayMode { NONE, FREE_FLIGHT, CHECKPOINT }

const INTERNAL_BASE_H := 340
## 10× previous map; terrain mesh is a local sliding window (not one giant grid).
const WORLD_SIZE := 20480.0
const TERRAIN_VIEW := 5120.0
const TERRAIN_SUBDIV := 127
const BUILDING_RADIUS := 1600.0
const BUILDING_CELL := 280.0
const VEG_RADIUS := 1500.0
const VEG_TREE_CELL := 95.0
const VEG_HEDGE_CELL := 140.0
const SKYLINE_RADIUS := 4200.0
const SKYLINE_CELL := 420.0
const LANDMARK_RADIUS := 2800.0
const BRIDGE_CELL := 320.0
const TOWER_CELL := 900.0
const TRAFFIC_RADIUS := 1300.0
const TRAFFIC_CELL := 110.0
const STREET_RADIUS := 1150.0
const AIRPORT_RADIUS := 3600.0
const STACK_CELL := 380.0
const WATER_LEVEL := 0.0
## ~metres; terrain peaks ~180, cumulus ~1–2 km, lots of sky above
const CRUISE_ALT := 2200.0
const MAX_ALT := 12000.0
const CLOUD_BASE_MIN := 1000.0
const CLOUD_BASE_MAX := 1800.0
const DAY_PHASE_SECONDS := 12.0 * 60.0 ## 12 min day, 12 min night
const MISSILE_MAX := 4
const MISSILE_REARM := 4.5
## Radar AGL below this triggers soft low-alt alert (audio + red vignette).
const SAFE_AGL := 110.0
const CRITICAL_AGL := 36.0

var camera_mode: int = Cam.TOP
var missiles_ready: int = MISSILE_MAX
var sound_on: bool = false
var player_engaged: bool = false
var title_dismissed: bool = false
var generating: bool = true
var gen_progress: float = 0.0
var paused: bool = false
var screenshot_mode: bool = false ## hide HUD / UI for clean photos
var mouse_sens: float = 1.0
var free_cam_speed: float = 120.0
## 0..1 over full day+night (24 min). 0=sunrise start of day, 0.5=sunset start of night
var time_of_day: float = 0.15
var day_factor: float = 1.0 ## 1 bright day → 0 deep night
var sun_dir: Vector3 = Vector3(0.55, 0.45, 0.35).normalized()
var is_night: bool = false
var wind_dir: Vector3 = Vector3(1.0, 0.0, 0.35).normalized()
var wind_speed: float = 12.0
## Weather (driven by world_root)
var fog_boost: float = 0.0
var cloud_density: float = 0.55
var raining: bool = false
var rain_intensity: float = 0.0
## Contextual tips
var near_airport: bool = false
var tip_text: String = ""

## Play modes
var play_mode: int = PlayMode.NONE
## CheckPoint runtime
var cp_active: bool = false
var cp_level: int = 1
var cp_unlocked_level: int = 1 ## highest selectable (1..30, unlocks next on clear)
var cp_ring_index: int = 0
var cp_ring_total: int = 0
var cp_time_left: float = 0.0
var cp_time_limit: float = 0.0
var cp_next_pos: Vector3 = Vector3.ZERO
var cp_status: String = "" ## RUN / WIN / FAIL / ""

## Live flight telemetry (cockpit / HUD)
var airspeed: float = 0.0
var altitude: float = 0.0
var heading_deg: float = 0.0
var pitch_deg: float = 0.0
var roll_deg: float = 0.0
var vspeed: float = 0.0
var g_force: float = 1.0
var radar_height: float = 0.0
var throttle: float = 0.35
var afterburner: bool = false
var turn_rate: float = 0.0
var slip: float = 0.0
var warn_terrain: bool = false
var warn_low_alt: bool = false
## 0..1 how urgent the low-alt warning is (drives vignette + beep rate)
var low_alt_intensity: float = 0.0
var warn_missile: bool = false
## Region under the jet (for HUD)
var over_region: int = 0
var over_region_name: String = "FIELDS"
## Place / airport readability (HUD + compass)
var place_name: String = ""
var place_kind: String = ""
var place_dist: float = 0.0
var nearest_airport_name: String = ""
var nearest_airport_pos: Vector2 = Vector2.ZERO
var nearest_airport_dist: float = 0.0
var nearest_airport_brg: float = 0.0
## Nearby POIs for compass tape: {name, kind, dist, brg}
var compass_pois: Array = []

## F-22-style HUD aim / CCIP
var aim_world: Vector3 = Vector3.ZERO
var aim_screen: Vector2 = Vector2(-1, -1)
var fpm_world: Vector3 = Vector3.ZERO ## flight path / velocity vector
var fpm_screen: Vector2 = Vector2(-1, -1)
var bore_world: Vector3 = Vector3.ZERO ## nose boresight
var bore_screen: Vector2 = Vector2(-1, -1)
var aim_range: float = 0.0
var aim_valid: bool = false
var aim_ready: bool = true
var aim_in_dlz: bool = false ## inside dynamic launch zone
## DLZ band (metres) — arcade missile envelope
const DLZ_RMIN := 90.0
const DLZ_ROPT := 350.0
const DLZ_RPI := 900.0
const DLZ_RAERO := 2200.0

var jet: Node3D
var height_sampler: Callable  # (x, z) -> height
## Building collision: roof height under (x,z), or -INF if clear; solid hit test.
var building_roof_at: Callable  # (x, z) -> float
var building_contains: Callable  # (Vector3) -> bool
var building_segment_hit: Callable  # (from, to) -> Vector3 or null

const SAVE_PATH := "user://airforce_dashi.cfg"


func _ready() -> void:
	load_progress()


func set_progress(p: float) -> void:
	gen_progress = clampf(p, 0.0, 1.0)
	generation_progress.emit(gen_progress)


func finish_generation() -> void:
	generating = false
	gen_progress = 1.0
	generation_done.emit()


func cycle_camera() -> void:
	camera_mode = (camera_mode + 1) % 4
	camera_changed.emit(camera_mode)
	if camera_mode != Cam.FREE and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and not paused:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func toggle_screenshot_mode() -> void:
	if generating or not title_dismissed:
		return
	screenshot_mode = not screenshot_mode
	if screenshot_mode and paused:
		set_paused(false)


func set_missiles(n: int) -> void:
	missiles_ready = clampi(n, 0, MISSILE_MAX)
	missile_count_changed.emit(missiles_ready)


func toggle_sound() -> void:
	sound_on = not sound_on
	sound_toggled.emit(sound_on)


func set_paused(on: bool) -> void:
	if generating or not title_dismissed:
		return
	paused = on
	pause_toggled.emit(paused)


func toggle_pause() -> void:
	set_paused(not paused)


func set_mouse_sens(v: float) -> void:
	mouse_sens = clampf(v, 0.4, 2.0)
	mouse_sens_changed.emit(mouse_sens)


func set_tip(text: String) -> void:
	if tip_text == text:
		return
	tip_text = text
	tip_changed.emit(tip_text)


func set_play_mode(mode: int) -> void:
	play_mode = mode
	play_mode_changed.emit(play_mode)


func unlock_checkpoint_level(next_level: int) -> void:
	var n: int = clampi(next_level, 1, 30)
	if n > cp_unlocked_level:
		cp_unlocked_level = n
		checkpoint_progress_changed.emit(cp_unlocked_level)
		save_progress()


func save_progress() -> void:
	var cfg := ConfigFile.new()
	cfg.load(SAVE_PATH)
	cfg.set_value("checkpoint", "unlocked", cp_unlocked_level)
	cfg.set_value("options", "mouse_sens", mouse_sens)
	cfg.set_value("options", "sound_on", sound_on)
	cfg.save(SAVE_PATH)


func load_progress() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE_PATH) != OK:
		cp_unlocked_level = 1
		return
	cp_unlocked_level = clampi(int(cfg.get_value("checkpoint", "unlocked", 1)), 1, 30)
	mouse_sens = float(cfg.get_value("options", "mouse_sens", mouse_sens))
	sound_on = bool(cfg.get_value("options", "sound_on", sound_on))
