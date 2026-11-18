extends RefCounted
class_name TerrainGenerator
## Large wrapping world: height + painted biomes (city / suburb / farm / forest / water).

enum Region { WATER, RIVER, CITY, SUBURB, FARM, FOREST, MEADOW, ROCK }

const RES := 512
const HEIGHT_SCALE := 180.0

var height_image: Image
var color_image: Image
var height_tex: ImageTexture
var color_tex: ImageTexture
var heights: PackedFloat32Array
var regions: PackedByteArray
## World XZ centers for airports (flat city patches), filled after paint.
var airports: PackedVector2Array = PackedVector2Array()
## Named places for HUD / compass: {name:String, pos:Vector2, kind:String}
var places: Array = []
## Airport entries: {name:String, pos:Vector2}
var airport_pois: Array = []


func generate(progress: Callable) -> void:
	heights = PackedFloat32Array()
	heights.resize(RES * RES)
	regions = PackedByteArray()
	regions.resize(RES * RES)
	height_image = Image.create(RES, RES, false, Image.FORMAT_RF)
	color_image = Image.create(RES, RES, false, Image.FORMAT_RGBA8)

	var n_land := FastNoiseLite.new()
	n_land.seed = 42
	n_land.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n_land.frequency = 0.0038
	n_land.fractal_octaves = 5

	var n_detail := FastNoiseLite.new()
	n_detail.seed = 99
	n_detail.noise_type = FastNoiseLite.TYPE_SIMPLEX
	n_detail.frequency = 0.012

	# Very low frequency → huge city vs countryside provinces.
	var n_region := FastNoiseLite.new()
	n_region.seed = 210
	n_region.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n_region.frequency = 0.0016
	n_region.fractal_octaves = 3

	var n_region2 := FastNoiseLite.new()
	n_region2.seed = 311
	n_region2.frequency = 0.0032

	var n_forest := FastNoiseLite.new()
	n_forest.seed = 7
	n_forest.frequency = 0.022

	var n_river := FastNoiseLite.new()
	n_river.seed = 88
	n_river.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n_river.frequency = 0.0032

	var n_warp := FastNoiseLite.new()
	n_warp.seed = 501
	n_warp.frequency = 0.007

	var n_lake := FastNoiseLite.new()
	n_lake.seed = 77
	n_lake.frequency = 0.0058

	var n_farm := FastNoiseLite.new()
	n_farm.seed = 904
	n_farm.frequency = 0.018

	# Pass 1 — base height + hydrography.
	for y in RES:
		for x in RES:
			var w := _wrap4(x, y)
			var h: float = n_land.get_noise_2d(w.x + w.z, w.y + w.w)
			h += n_detail.get_noise_2d(w.x * 2.0, w.w * 2.0) * 0.30
			h = h * 0.52 - 0.02
			if h > 0.22:
				h += (h - 0.22) * 0.75
			h = clampf(h * 0.5 + 0.34, 0.0, 1.0)

			var lake: float = n_lake.get_noise_2d(w.x * 0.7, w.w * 0.7)
			if lake < -0.40:
				var sink: float = smoothstep(-0.40, -0.70, lake)
				h = lerpf(h, 0.08, sink)

			var warp: float = n_warp.get_noise_2d(w.x, w.w) * 22.0
			var ridge: float = absf(n_river.get_noise_2d(w.x + warp, w.w - warp * 0.6))
			var river_w: float = 0.042 + 0.018 * (0.5 + 0.5 * n_detail.get_noise_2d(w.y, w.z))
			if ridge < river_w and h < 0.72:
				var carve: float = 1.0 - ridge / maxf(river_w, 0.001)
				h = lerpf(h, 0.05, carve * carve * 0.95)

			heights[y * RES + x] = h
		if y % 4 == 0:
			progress.call(float(y) / float(RES) * 0.35)
			await Engine.get_main_loop().process_frame

	# Pass 2 — large provinces + urban flatten.
	for y in RES:
		for x in RES:
			var idx: int = y * RES + x
			var h: float = heights[idx]
			var elev: float = h * HEIGHT_SCALE
			var w := _wrap4(x, y)
			var macro: float = n_region.get_noise_2d(w.x, w.w)
			macro += n_region2.get_noise_2d(w.y * 0.8, w.z * 0.8) * 0.28
			var forest_n: float = n_forest.get_noise_2d(float(x) * 0.35, float(y) * 0.35)

			var region: int = Region.MEADOW
			if h < 0.145:
				region = Region.WATER
			else:
				var warp: float = n_warp.get_noise_2d(w.x, w.w) * 22.0
				var ridge: float = absf(n_river.get_noise_2d(w.x + warp, w.w - warp * 0.6))
				if ridge < 0.052 and h < 0.55:
					region = Region.RIVER
				elif elev > 105.0:
					region = Region.ROCK
				elif macro > 0.18 and elev > 14.0 and elev < 82.0:
					region = Region.CITY
				elif macro > -0.02 and elev > 12.0 and elev < 88.0:
					region = Region.SUBURB
				elif macro < -0.08 and elev > 12.0 and elev < 72.0:
					region = Region.FARM
				elif forest_n > 0.08 and elev > 18.0 and elev < 95.0:
					region = Region.FOREST
				else:
					region = Region.MEADOW

			regions[idx] = region

			if region == Region.CITY:
				heights[idx] = lerpf(h, 0.30, 0.78)
			elif region == Region.SUBURB:
				heights[idx] = lerpf(h, 0.28, 0.48)
			elif region == Region.FARM:
				var step: float = floor(h * 14.0) / 14.0
				heights[idx] = lerpf(h, step, 0.35)
		if y % 6 == 0:
			progress.call(0.35 + float(y) / float(RES) * 0.2)
			await Engine.get_main_loop().process_frame

	# Pass 3 — height image + paint.
	for y in RES:
		for x in RES:
			var idx: int = y * RES + x
			var h: float = heights[idx]
			height_image.set_pixel(x, y, Color(h, h, h, 1.0))
			var elev: float = h * HEIGHT_SCALE
			var forest_n: float = n_forest.get_noise_2d(float(x), float(y))
			var farm_n: float = n_farm.get_noise_2d(float(x) * 0.5, float(y) * 0.5)
			color_image.set_pixel(x, y, _paint(x, y, regions[idx], elev, h, forest_n, farm_n))
		if y % 6 == 0:
			progress.call(0.55 + float(y) / float(RES) * 0.4)
			await Engine.get_main_loop().process_frame

	height_tex = ImageTexture.create_from_image(height_image)
	color_tex = ImageTexture.create_from_image(color_image)
	_find_airports()
	_build_places()
	progress.call(1.0)


static func region_label(region: int) -> String:
	match region:
		Region.WATER:
			return "LAKE"
		Region.RIVER:
			return "RIVER"
		Region.CITY:
			return "CITY"
		Region.SUBURB:
			return "SUBURB"
		Region.FARM:
			return "FARMS"
		Region.FOREST:
			return "WOODS"
		Region.ROCK:
			return "PEAKS"
		_:
			return "FIELDS"


func _find_airports() -> void:
	airports = PackedVector2Array()
	var step: int = 18
	for y in range(0, RES, step):
		for x in range(0, RES, step):
			var idx: int = y * RES + x
			if regions[idx] != Region.CITY:
				continue
			if posmod(x * 97 + y * 53, 11) != 0:
				continue
			# Prefer flatter plateau samples.
			var h: float = heights[idx]
			var flat: bool = true
			for oy in range(-2, 3):
				for ox in range(-2, 3):
					var xx: int = posmod(x + ox, RES)
					var yy: int = posmod(y + oy, RES)
					if absf(heights[yy * RES + xx] - h) > 0.035:
						flat = false
						break
				if not flat:
					break
			if not flat:
				continue
			var wx: float = (float(x) / float(RES) - 0.5) * Game.WORLD_SIZE
			var wz: float = (float(y) / float(RES) - 0.5) * Game.WORLD_SIZE
			airports.append(Vector2(wx, wz))
			if airports.size() >= 6:
				return
	# Ensure at least one if any city exists.
	if airports.is_empty():
		for y in range(0, RES, 24):
			for x in range(0, RES, 24):
				if regions[y * RES + x] == Region.CITY:
					airports.append(Vector2(
						(float(x) / float(RES) - 0.5) * Game.WORLD_SIZE,
						(float(y) / float(RES) - 0.5) * Game.WORLD_SIZE
					))
					return


const _CITY_PRE := ["North", "East", "Port", "New", "Old", "Fort", "Lake", "Ridge", "South", "West"]
const _CITY_SUF := ["haven", "ford", "burg", "ton", "field", "gate", "bay", "point", "mere", "wick"]
const _FARM_PRE := ["Willow", "Red", "Cedar", "Maple", "Stone", "Sunny", "Oak", "Hill", "River", "Gold"]
const _FARM_SUF := ["Farm", "Ranch", "Orchard", "Acres", "Fields", "Homestead", "Pasture", "Grove"]
const _AP_SUF := ["Intl", "Field", "Municipal", "AFB", "Airpark"]


func _build_places() -> void:
	places = []
	airport_pois = []
	var used: Array[Vector2] = []
	var step: int = 22
	for y in range(0, RES, step):
		for x in range(0, RES, step):
			var r: int = int(regions[y * RES + x])
			if r != Region.CITY and r != Region.FARM and r != Region.SUBURB:
				continue
			# Keep only dense cores (avoid fringe labels).
			var same: int = 0
			for oy in range(-2, 3):
				for ox in range(-2, 3):
					var xx: int = posmod(x + ox, RES)
					var yy: int = posmod(y + oy, RES)
					if int(regions[yy * RES + xx]) == r:
						same += 1
			if same < 14:
				continue
			var pos: Vector2 = Vector2(
				(float(x) / float(RES) - 0.5) * Game.WORLD_SIZE,
				(float(y) / float(RES) - 0.5) * Game.WORLD_SIZE
			)
			if _too_close(pos, used, 900.0):
				continue
			used.append(pos)
			var h: int = posmod(x * 73856093 ^ y * 19349663, 100000)
			var kind: String
			var name: String
			if r == Region.CITY:
				kind = "CITY"
				name = "%s%s" % [_CITY_PRE[h % _CITY_PRE.size()], _CITY_SUF[(h / 17) % _CITY_SUF.size()]]
			elif r == Region.SUBURB:
				kind = "TOWN"
				name = "%s%s" % [_CITY_PRE[(h / 3) % _CITY_PRE.size()], _CITY_SUF[(h / 41) % _CITY_SUF.size()]]
			else:
				kind = "FARM"
				name = "%s %s" % [_FARM_PRE[h % _FARM_PRE.size()], _FARM_SUF[(h / 13) % _FARM_SUF.size()]]
			places.append({"name": name, "pos": pos, "kind": kind})
			if places.size() >= 48:
				break
		if places.size() >= 48:
			break

	for i in airports.size():
		var ap: Vector2 = airports[i]
		var nearest_city: String = "Patrol"
		var best_d: float = INF
		for p in places:
			if p["kind"] != "CITY" and p["kind"] != "TOWN":
				continue
			var d: float = _wrap_dist(ap, p["pos"])
			if d < best_d:
				best_d = d
				nearest_city = p["name"]
		var suf: String = _AP_SUF[posmod(i * 17 + int(ap.x), _AP_SUF.size())]
		airport_pois.append({"name": "%s %s" % [nearest_city, suf], "pos": ap})


func _too_close(pos: Vector2, used: Array[Vector2], min_d: float) -> bool:
	for u in used:
		if _wrap_dist(pos, u) < min_d:
			return true
	return false


func _wrap_dist(a: Vector2, b: Vector2) -> float:
	return wrap_delta(a, b).length()


static func wrap_delta(from: Vector2, to: Vector2) -> Vector2:
	var world: float = Game.WORLD_SIZE
	var half: float = world * 0.5
	var dx: float = to.x - from.x
	var dz: float = to.y - from.y
	dx = fposmod(dx + half, world) - half
	dz = fposmod(dz + half, world) - half
	return Vector2(dx, dz)


func nearest_place(wx: float, wz: float) -> Dictionary:
	var origin := Vector2(wx, wz)
	var best: Dictionary = {}
	var best_d: float = INF
	for p in places:
		var d: float = _wrap_dist(origin, p["pos"])
		if d < best_d:
			best_d = d
			best = p.duplicate()
			best["dist"] = d
	return best


func nearest_airport(wx: float, wz: float) -> Dictionary:
	var origin := Vector2(wx, wz)
	var best: Dictionary = {}
	var best_d: float = INF
	for ap in airport_pois:
		var d: float = _wrap_dist(origin, ap["pos"])
		if d < best_d:
			best_d = d
			best = ap.duplicate()
			best["dist"] = d
	if best.is_empty() and not airports.is_empty():
		var ap0: Vector2 = airports[0]
		best = {"name": "Airfield", "pos": ap0, "dist": _wrap_dist(origin, ap0)}
	return best


func nearby_pois(wx: float, wz: float, max_count: int = 8, max_dist: float = 6500.0) -> Array:
	var origin := Vector2(wx, wz)
	var scored: Array = []
	for p in places:
		var d: float = _wrap_dist(origin, p["pos"])
		if d > max_dist:
			continue
		var delta: Vector2 = wrap_delta(origin, p["pos"])
		var brg: float = rad_to_deg(atan2(delta.x, -delta.y))
		if brg < 0.0:
			brg += 360.0
		scored.append({"name": p["name"], "kind": p["kind"], "pos": p["pos"], "dist": d, "brg": brg})
	for ap in airport_pois:
		var d: float = _wrap_dist(origin, ap["pos"])
		# Always keep airports on the tape a bit farther than places.
		if d > max_dist * 1.35:
			continue
		var delta: Vector2 = wrap_delta(origin, ap["pos"])
		var brg: float = rad_to_deg(atan2(delta.x, -delta.y))
		if brg < 0.0:
			brg += 360.0
		scored.append({"name": ap["name"], "kind": "AP", "pos": ap["pos"], "dist": d, "brg": brg})
	# Guarantee nearest place + airport even beyond the band.
	var np: Dictionary = nearest_place(wx, wz)
	if not np.is_empty():
		_ensure_poi(scored, np["name"], np["kind"], np["pos"], origin)
	var na: Dictionary = nearest_airport(wx, wz)
	if not na.is_empty():
		_ensure_poi(scored, na["name"], "AP", na["pos"], origin)
	scored.sort_custom(func(a, b): return a["dist"] < b["dist"])
	if scored.size() > max_count:
		return scored.slice(0, max_count)
	return scored


func _ensure_poi(scored: Array, name: String, kind: String, pos: Vector2, origin: Vector2) -> void:
	for s in scored:
		if str(s.get("name", "")) == name and str(s.get("kind", "")) == kind:
			return
	var delta: Vector2 = wrap_delta(origin, pos)
	var brg: float = rad_to_deg(atan2(delta.x, -delta.y))
	if brg < 0.0:
		brg += 360.0
	scored.append({"name": name, "kind": kind, "pos": pos, "dist": delta.length(), "brg": brg})


func sample_height(wx: float, wz: float) -> float:
	var uv := _world_to_texel(wx, wz)
	var x0: int = posmod(int(floor(uv.x)), RES)
	var y0: int = posmod(int(floor(uv.y)), RES)
	var x1: int = posmod(x0 + 1, RES)
	var y1: int = posmod(y0 + 1, RES)
	var fx: float = uv.x - floor(uv.x)
	var fy: float = uv.y - floor(uv.y)
	var h00: float = heights[y0 * RES + x0]
	var h10: float = heights[y0 * RES + x1]
	var h01: float = heights[y1 * RES + x0]
	var h11: float = heights[y1 * RES + x1]
	return lerpf(lerpf(h00, h10, fx), lerpf(h01, h11, fx), fy) * HEIGHT_SCALE


func sample_region(wx: float, wz: float) -> int:
	if regions.is_empty():
		return Region.MEADOW
	var uv := _world_to_texel(wx, wz)
	var x: int = posmod(int(floor(uv.x)), RES)
	var y: int = posmod(int(floor(uv.y)), RES)
	return int(regions[y * RES + x])


## Road bit flags: EW = runs along +X, NS = along +Z, AVE = major avenue width.
const ROAD_EW := 1
const ROAD_NS := 2
const ROAD_AVE := 4


func is_roadish(wx: float, wz: float) -> bool:
	var region: int = sample_region(wx, wz)
	if region == Region.WATER or region == Region.RIVER:
		return true
	return sample_road(wx, wz) != 0


func sample_road(wx: float, wz: float) -> int:
	var region: int = sample_region(wx, wz)
	if region != Region.CITY and region != Region.SUBURB:
		return 0
	var uv := _world_to_texel(wx, wz)
	var x: int = posmod(int(floor(uv.x)), RES)
	var y: int = posmod(int(floor(uv.y)), RES)
	return road_bits_at(x, y, region == Region.CITY)


func road_bits_at(x: int, y: int, downtown: bool) -> int:
	return _road_bits_at(x, y, downtown)


func texel_world_center(tx: int, ty: int) -> Vector2:
	var half: float = Game.WORLD_SIZE * 0.5
	var wx: float = (float(tx) + 0.5) / float(RES) * Game.WORLD_SIZE - half
	var wz: float = (float(ty) + 0.5) / float(RES) * Game.WORLD_SIZE - half
	return Vector2(wx, wz)


func world_to_texel_i(wx: float, wz: float) -> Vector2i:
	var uv := _world_to_texel(wx, wz)
	return Vector2i(posmod(int(floor(uv.x)), RES), posmod(int(floor(uv.y)), RES))


func _road_bits_at(x: int, y: int, downtown: bool) -> int:
	var block: int = 7 if downtown else 9
	var avenue: int = 14 if downtown else 18
	var lx: int = posmod(x, block)
	var ly: int = posmod(y, block)
	var ax: int = posmod(x, avenue)
	var ay: int = posmod(y, avenue)
	var bits: int = 0
	# ly/ay → street/avenue running east-west (along world X)
	if ly < 1:
		bits |= ROAD_EW
	if ay < 2:
		bits |= ROAD_EW | ROAD_AVE
	# lx/ax → street/avenue running north-south (along world Z)
	if lx < 1:
		bits |= ROAD_NS
	if ax < 2:
		bits |= ROAD_NS | ROAD_AVE
	return bits


func _world_to_texel(wx: float, wz: float) -> Vector2:
	var world := Game.WORLD_SIZE
	var u: float = wx / world + 0.5
	var v: float = wz / world + 0.5
	u = u - floor(u)
	v = v - floor(v)
	return Vector2(u * float(RES), v * float(RES))


func _wrap4(x: int, y: int) -> Vector4:
	var u: float = float(x) / float(RES)
	var v: float = float(y) / float(RES)
	return Vector4(
		cos(u * TAU) * 40.0,
		sin(u * TAU) * 40.0,
		cos(v * TAU) * 40.0,
		sin(v * TAU) * 40.0
	)


func _paint(x: int, y: int, region: int, elev: float, h: float, forest: float, farm_n: float) -> Color:
	match region:
		Region.WATER:
			return Color(0.70, 0.66, 0.48)
		Region.RIVER:
			return Color(0.62, 0.58, 0.42)
		Region.CITY:
			return _paint_city(x, y, true)
		Region.SUBURB:
			return _paint_city(x, y, false)
		Region.FARM:
			return _paint_farm(x, y, farm_n)
		Region.FOREST:
			return _paint_forest(elev, forest)
		Region.ROCK:
			return _paint_rock(elev)
		_:
			return _paint_meadow(elev, forest)


func _paint_city(x: int, y: int, downtown: bool) -> Color:
	var block: int = 7 if downtown else 9
	var road: int = 1
	var avenue: int = 14 if downtown else 18
	var lx: int = posmod(x, block)
	var ly: int = posmod(y, block)
	var ax: int = posmod(x, avenue)
	var ay: int = posmod(y, avenue)

	if ax < 2 or ay < 2:
		if ax == 0 or ay == 0:
			return Color(0.11, 0.10, 0.13)
		return Color(0.14, 0.13, 0.16)
	if lx < road or ly < road:
		return Color(0.18, 0.17, 0.20)

	var cell_x: int = int(floor(float(x) / float(block)))
	var cell_y: int = int(floor(float(y) / float(block)))
	var cell_hash: int = posmod(cell_x * 73856093 ^ cell_y * 19349663, 1000)
	if cell_hash < (50 if downtown else 85):
		return Color(0.28, 0.42, 0.30) if downtown else Color(0.45, 0.58, 0.32)

	var roof_id: int = posmod(cell_hash, 6)
	if downtown:
		match roof_id:
			0: return Color(0.42, 0.40, 0.46)
			1: return Color(0.55, 0.38, 0.32)
			2: return Color(0.34, 0.40, 0.52)
			3: return Color(0.48, 0.45, 0.40)
			4: return Color(0.62, 0.52, 0.38)
			_: return Color(0.30, 0.30, 0.34)
	else:
		match roof_id:
			0: return Color(0.58, 0.36, 0.28)
			1: return Color(0.70, 0.58, 0.42)
			2: return Color(0.46, 0.50, 0.42)
			3: return Color(0.52, 0.42, 0.48)
			4: return Color(0.40, 0.46, 0.38)
			_: return Color(0.62, 0.48, 0.34)


func _paint_farm(x: int, y: int, farm_n: float) -> Color:
	var pw: int = 12 + int(floor((farm_n * 0.5 + 0.5) * 6.0))
	var ph: int = 10 + int(floor((1.0 - (farm_n * 0.5 + 0.5)) * 5.0))
	var lx: int = posmod(x, pw)
	var ly: int = posmod(y, ph)
	if lx == 0 or ly == 0:
		return Color(0.22, 0.28, 0.18)
	if lx == 1 or ly == 1:
		return Color(0.42, 0.34, 0.22)

	var parcel_x: int = int(floor(float(x) / float(pw)))
	var parcel_y: int = int(floor(float(y) / float(ph)))
	var crop: int = posmod(parcel_x * 127 + parcel_y * 311, 5)
	var stripe: int = posmod(lx + (ly if crop == 2 else 0), 3)
	var base: Color
	match crop:
		0: base = Color(0.78, 0.68, 0.28)
		1: base = Color(0.48, 0.62, 0.30)
		2: base = Color(0.72, 0.48, 0.22)
		3: base = Color(0.58, 0.52, 0.28)
		_: base = Color(0.40, 0.48, 0.28)
	if stripe == 0:
		base = base.darkened(0.08)
	elif stripe == 2:
		base = base.lightened(0.06)
	return base


func _paint_forest(elev: float, forest: float) -> Color:
	if elev < 18.0:
		return Color(0.72, 0.78, 0.48)
	if forest > 0.45:
		return Color(0.72, 0.22, 0.18)
	if forest > 0.28:
		return Color(0.85, 0.45, 0.18)
	if forest > 0.10:
		return Color(0.82, 0.68, 0.22)
	if forest < -0.35:
		return Color(0.18, 0.28, 0.22)
	return Color(0.42, 0.48, 0.28)


func _paint_meadow(elev: float, forest: float) -> Color:
	if elev < 4.0:
		return Color(0.76, 0.70, 0.52)
	if elev < 18.0:
		return Color(0.72, 0.78, 0.48)
	if forest > 0.25:
		return Color(0.68, 0.55, 0.28)
	if forest < -0.3:
		return Color(0.32, 0.40, 0.28)
	return Color(0.55, 0.62, 0.38)


func _paint_rock(elev: float) -> Color:
	var snow: float = smoothstep(95.0, 130.0, elev)
	return Color(0.48, 0.45, 0.55).lerp(Color(0.92, 0.93, 0.95), snow)
