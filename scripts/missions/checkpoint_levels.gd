extends RefCounted
class_name CheckpointLevels
## 30 progressive CheckPoint courses — deterministic from level index.


const LEVEL_COUNT := 30
const WATER_LEVEL := 0.0


static func def(level: int) -> Dictionary:
	var lv: int = clampi(level, 1, LEVEL_COUNT)
	var t: float = float(lv - 1) / float(LEVEL_COUNT - 1) # 0..1
	var rings: int = mini(3 + int(floor(t * 9.0)), 12) # 3 → 12
	var radius: float = lerpf(55.0, 22.0, t)
	var spacing: float = lerpf(380.0, 220.0, t)
	var time_limit: float = lerpf(75.0, 95.0, t) + float(rings) * lerpf(9.0, 6.5, t)
	var turn_amp: float = lerpf(40.0, 220.0, t)
	var alt_amp: float = lerpf(0.0, 180.0, t)
	var start_alt: float = lerpf(240.0, 520.0, t)
	var bank_twist: float = lerpf(0.0, 0.55, t)
	return {
		"level": lv,
		"name": _name(lv),
		"rings": rings,
		"radius": radius,
		"spacing": spacing,
		"time_limit": time_limit,
		"turn_amp": turn_amp,
		"alt_amp": alt_amp,
		"start_alt": start_alt,
		"bank_twist": bank_twist,
	}


static func build_points(level: int, origin: Vector3, heading: float, height_fn: Callable = Callable()) -> Array:
	## Returns array of {pos: Vector3, normal: Vector3, radius: float}
	var d: Dictionary = def(level)
	var rings: int = int(d.rings)
	var spacing: float = float(d.spacing)
	var turn_amp: float = float(d.turn_amp)
	var alt_amp: float = float(d.alt_amp)
	var radius: float = float(d.radius)
	var twist: float = float(d.bank_twist)
	var fwd := Vector3(-sin(heading), 0.0, -cos(heading))
	var right := Vector3(cos(heading), 0.0, -sin(heading))
	var out: Array = []
	var seed_h: int = level * 2654435761
	for i in rings:
		var along: float = spacing * float(i + 1)
		var phase: float = float(i) * 0.85 + float(seed_h % 7) * 0.15
		var side: float = sin(phase) * turn_amp
		if i % 3 == 2:
			side *= -0.65
		var up: float = sin(phase * 0.7 + 0.4) * alt_amp
		var pos: Vector3 = origin + fwd * along + right * side + Vector3(0, up, 0)
		pos.y = maxf(pos.y, WATER_LEVEL + 60.0)
		if height_fn.is_valid():
			var gh: float = float(height_fn.call(pos.x, pos.z))
			pos.y = maxf(pos.y, gh + 80.0)
		var yaw_off: float = sin(phase * 1.1) * twist
		var n := Vector3(-sin(heading + yaw_off), 0.0, -cos(heading + yaw_off)).normalized()
		out.append({"pos": pos, "normal": n, "radius": radius})
	return out


static func _name(lv: int) -> String:
	match lv:
		1: return "FIRST GATES"
		2: return "LAKE LANE"
		3: return "EASY SWEEP"
		4: return "SHORE HOPS"
		5: return "GENTLE S"
		6: return "VALLEY RUN"
		7: return "LOW STRAFE"
		8: return "RIDGE LINE"
		9: return "CITY EDGE"
		10: return "TEN GATES"
		11: return "TIGHT TURN"
		12: return "ALTITUDE WAVE"
		13: return "NEEDLE PASS"
		14: return "STEEP ENTRY"
		15: return "MID RANGE"
		16: return "ZIPPER"
		17: return "CROSSWIND S"
		18: return "SKY LADDER"
		19: return "NARROW GATES"
		20: return "TWENTY"
		21: return "HARD BANK"
		22: return "SPLIT PATH"
		23: return "PRESSURE"
		24: return "THIN AIR"
		25: return "RAPID GATES"
		26: return "FINAL APPROACH"
		27: return "ACE RUN"
		28: return "BLACK DIAMOND"
		29: return "LAST LIGHT"
		_: return "CHECKMATE"
