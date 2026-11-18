extends Node
## Jet loops + combat SFX + biome ambients. Engine tied to attitude / G / AB.

const ENGINE_PATH := "res://assets/audio/engine_loop.wav"
const AB_PATH := "res://assets/audio/afterburner_loop.wav"
const MISSILE_PATH := "res://assets/audio/missile.wav"
const BOOM_PATH := "res://assets/audio/boom.wav"
const BOOM_WATER_PATH := "res://assets/audio/boom_water.wav"
const ROLL_PATH := "res://assets/audio/roll.wav"
const AMB_CITY := "res://assets/audio/ambient_city.wav"
const AMB_WIND := "res://assets/audio/ambient_wind.wav"
const AMB_FOREST := "res://assets/audio/ambient_forest.wav"
const AMB_WATER := "res://assets/audio/ambient_water.wav"
const ALT_WARN_PATH := "res://assets/audio/alt_warn.wav"
const SFX_VOICES := 4

var _engine: AudioStreamPlayer
var _ab: AudioStreamPlayer
var _alt_warn: AudioStreamPlayer
var _sfx: Array[AudioStreamPlayer] = []
var _sfx_i: int = 0

var _amb_city: AudioStreamPlayer
var _amb_wind: AudioStreamPlayer
var _amb_forest: AudioStreamPlayer
var _amb_water: AudioStreamPlayer

var _stream_engine: AudioStream
var _stream_ab: AudioStream
var _stream_missile: AudioStream
var _stream_boom: AudioStream
var _stream_boom_water: AudioStream
var _stream_roll: AudioStream
var _stream_alt_warn: AudioStream

var _ab_target_db: float = -80.0
var _ab_current_db: float = -80.0
var _want_ab: bool = false

var _city_db: float = -80.0
var _wind_db: float = -80.0
var _forest_db: float = -80.0
var _water_db: float = -80.0

var _alt_warn_cd: float = 0.0


func _ready() -> void:
	_stream_engine = _load_loop(ENGINE_PATH)
	_stream_ab = _load_loop(AB_PATH)
	_stream_missile = load(MISSILE_PATH) as AudioStream
	_stream_boom = load(BOOM_PATH) as AudioStream
	_stream_boom_water = load(BOOM_WATER_PATH) as AudioStream
	_stream_roll = load(ROLL_PATH) as AudioStream
	_stream_alt_warn = load(ALT_WARN_PATH) as AudioStream

	_engine = _make_player(_stream_engine, -18.0)
	_ab = _make_player(_stream_ab, -80.0)
	_alt_warn = _make_player(_stream_alt_warn, -18.0)
	_amb_city = _make_player(_load_loop(AMB_CITY), -80.0)
	_amb_wind = _make_player(_load_loop(AMB_WIND), -80.0)
	_amb_forest = _make_player(_load_loop(AMB_FOREST), -80.0)
	_amb_water = _make_player(_load_loop(AMB_WATER), -80.0)

	for i in SFX_VOICES:
		var p := AudioStreamPlayer.new()
		p.bus = &"Master"
		p.volume_db = -6.0
		add_child(p)
		_sfx.append(p)

	Game.sound_toggled.connect(_on_sound)
	set_process(false)


func _make_player(stream: AudioStream, vol: float) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.stream = stream
	p.bus = &"Master"
	p.volume_db = vol
	add_child(p)
	return p


func _load_loop(path: String) -> AudioStream:
	var stream := load(path)
	if stream == null:
		push_warning("PatrolAudio: missing sample %s" % path)
		return null
	stream = stream.duplicate()
	if stream is AudioStreamWAV:
		var wav := stream as AudioStreamWAV
		wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
		wav.loop_begin = 0
		wav.loop_end = maxi(1, int(round(wav.get_length() * float(wav.mix_rate))))
	return stream


func _on_sound(on: bool) -> void:
	if on:
		if _stream_engine:
			_engine.play()
		_ab_current_db = -80.0
		_ab.volume_db = -80.0
		_want_ab = false
		_start_ambients()
		set_process(true)
	else:
		_engine.stop()
		_ab.stop()
		if _alt_warn:
			_alt_warn.stop()
		_stop_ambients()
		for p in _sfx:
			p.stop()
		_want_ab = false
		_alt_warn_cd = 0.0
		set_process(false)


func _start_ambients() -> void:
	for p in [_amb_city, _amb_wind, _amb_forest, _amb_water]:
		if p and p.stream and not p.playing:
			p.volume_db = -80.0
			p.play()


func _stop_ambients() -> void:
	for p in [_amb_city, _amb_wind, _amb_forest, _amb_water]:
		if p:
			p.stop()
			p.volume_db = -80.0
	_city_db = -80.0
	_wind_db = -80.0
	_forest_db = -80.0
	_water_db = -80.0


func _process(dt: float) -> void:
	if not Game.sound_on:
		return
	_update_engine(dt)
	_update_biome_ambients(dt)
	_update_alt_warn(dt)


func _update_alt_warn(dt: float) -> void:
	_alt_warn_cd = maxf(0.0, _alt_warn_cd - dt)
	if not Game.warn_low_alt or Game.paused or Game.generating or not Game.title_dismissed:
		return
	if _stream_alt_warn == null or _alt_warn == null:
		return
	# Soft, spaced beeps — faster when critically low, never loud.
	var inten: float = clampf(Game.low_alt_intensity, 0.0, 1.0)
	var interval: float = lerpf(1.35, 0.55, inten)
	if _alt_warn_cd > 0.0:
		return
	if _alt_warn.playing:
		return
	_alt_warn.volume_db = lerpf(-20.0, -12.0, inten)
	_alt_warn.pitch_scale = lerpf(0.92, 1.08, inten)
	_alt_warn.play()
	_alt_warn_cd = interval


func _update_engine(dt: float) -> void:
	if _engine == null or _engine.stream == null:
		return
	var throttle: float = clampf(Game.throttle, 0.0, 1.0)
	var speed_n: float = clampf(Game.airspeed / 240.0, 0.0, 1.3)
	var pitch_n: float = clampf(absf(Game.pitch_deg) / 45.0, 0.0, 1.0)
	var g_n: float = clampf(absf(Game.g_force - 1.0) / 3.0, 0.0, 1.0)
	var dive: float = clampf(-Game.pitch_deg / 40.0, 0.0, 1.0)

	# Attitude-linked engine: climb loads pitch up, dive + speed opens it, G adds growl.
	var pitch_scale: float = lerpf(0.78, 1.18, throttle)
	pitch_scale += speed_n * 0.12
	pitch_scale += pitch_n * 0.06
	pitch_scale += g_n * 0.08
	pitch_scale -= dive * 0.03
	if Game.afterburner:
		pitch_scale += 0.1
	_engine.pitch_scale = lerpf(_engine.pitch_scale, clampf(pitch_scale, 0.7, 1.45), 1.0 - exp(-6.0 * dt))

	var vol: float = lerpf(-22.0, -8.0, throttle)
	vol += speed_n * 2.5
	vol += g_n * 1.5
	vol += dive * 1.2
	_engine.volume_db = lerpf(_engine.volume_db, vol, 1.0 - exp(-5.0 * dt))

	_want_ab = Game.afterburner
	if _want_ab:
		_ab_target_db = lerpf(-9.0, -2.5, throttle) + g_n * 1.5
		_ab.pitch_scale = lerpf(0.92, 1.18, throttle) + speed_n * 0.05
		if not _ab.playing and _stream_ab:
			_ab.play()
	else:
		_ab_target_db = -80.0

	var speed_ab: float = 10.0 if _want_ab else 6.0
	_ab_current_db = move_toward(_ab_current_db, _ab_target_db, speed_ab * 12.0 * dt)
	_ab.volume_db = _ab_current_db
	if not _want_ab and _ab_current_db <= -70.0 and _ab.playing:
		_ab.stop()
		_ab_current_db = -80.0
		_ab.volume_db = -80.0


func _update_biome_ambients(dt: float) -> void:
	var r: int = Game.over_region
	# Target mixes by region (dB)
	var t_city := -80.0
	var t_wind := -28.0
	var t_forest := -80.0
	var t_water := -80.0

	match r:
		TerrainGenerator.Region.CITY, TerrainGenerator.Region.SUBURB:
			t_city = -16.0
			t_wind = -34.0
		TerrainGenerator.Region.FARM, TerrainGenerator.Region.MEADOW:
			t_wind = -18.0
			t_forest = -36.0
		TerrainGenerator.Region.FOREST:
			t_forest = -14.0
			t_wind = -30.0
		TerrainGenerator.Region.WATER, TerrainGenerator.Region.RIVER:
			t_water = -15.0
			t_wind = -26.0
		TerrainGenerator.Region.ROCK:
			t_wind = -16.0
		_:
			t_wind = -22.0

	# Altitude opens wind, mutes ground ambients
	var alt_n: float = clampf(Game.altitude / 3500.0, 0.0, 1.0)
	t_wind = lerpf(t_wind, -12.0, alt_n * 0.65)
	t_city = lerpf(t_city, -80.0, alt_n * 0.85)
	t_forest = lerpf(t_forest, -80.0, alt_n * 0.75)
	t_water = lerpf(t_water, -55.0, alt_n * 0.5)

	# Speed wind roar
	var spd: float = clampf(Game.airspeed / 220.0, 0.0, 1.2)
	t_wind += lerpf(0.0, 6.0, spd)

	var k: float = 1.0 - exp(-2.8 * dt)
	_city_db = lerpf(_city_db, t_city, k)
	_wind_db = lerpf(_wind_db, t_wind, k)
	_forest_db = lerpf(_forest_db, t_forest, k)
	_water_db = lerpf(_water_db, t_water, k)

	if _amb_city:
		_amb_city.volume_db = _city_db
		_amb_city.pitch_scale = lerpf(0.95, 1.05, spd * 0.5)
	if _amb_wind:
		_amb_wind.volume_db = _wind_db
		_amb_wind.pitch_scale = lerpf(0.9, 1.15, spd)
	if _amb_forest:
		_amb_forest.volume_db = _forest_db
	if _amb_water:
		_amb_water.volume_db = _water_db


func play_missile() -> void:
	_play_sfx(_stream_missile, -4.0, randf_range(0.94, 1.06))


func play_boom(on_water: bool = false) -> void:
	var stream: AudioStream = _stream_boom_water if on_water and _stream_boom_water else _stream_boom
	_play_sfx(stream, -2.0, randf_range(0.92, 1.05))


func play_roll() -> void:
	_play_sfx(_stream_roll, -8.0, randf_range(0.98, 1.08))


func _play_sfx(stream: AudioStream, volume_db: float, pitch: float) -> void:
	if not Game.sound_on or stream == null:
		return
	var p: AudioStreamPlayer = _sfx[_sfx_i]
	_sfx_i = (_sfx_i + 1) % _sfx.size()
	p.stop()
	p.stream = stream
	p.volume_db = volume_db
	p.pitch_scale = pitch
	p.play()
