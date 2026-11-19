extends RefCounted
class_name AntiDroneLevels
## 30 progressive Anti-Drone intercept courses.


const LEVEL_COUNT := 30

## Kind ids used by spawners / mesh builder.
const GERAN := 0 ## large slow suicide (Shahed-136 / Geran-2)
const ORLAN := 1 ## recon mid — agile, higher, late dive
const LANCET := 2 ## small fast X-wing loitering munition


static func def(level: int) -> Dictionary:
	var lv: int = clampi(level, 1, LEVEL_COUNT)
	var t: float = float(lv - 1) / float(LEVEL_COUNT - 1)
	var waves: Array = _waves_for(lv, t)
	var total: int = 0
	for w in waves:
		total += int(w.count)
	var max_leaks: int = maxi(1, 3 - int(floor(t * 2.2))) # 3 → 1
	## Drones spawn ahead of the jet; impact is farther ahead → chase from behind.
	var spawn_near: float = lerpf(420.0, 620.0, t)
	var impact_dist: float = lerpf(2200.0, 3200.0, t)
	var start_alt: float = lerpf(380.0, 620.0, t)
	return {
		"level": lv,
		"name": _name(lv),
		"waves": waves,
		"total": total,
		"max_leaks": max_leaks,
		"spawn_near": spawn_near,
		"impact_dist": impact_dist,
		"spawn_radius": spawn_near, # legacy alias
		"start_alt": start_alt,
		"wave_gap": lerpf(5.5, 3.2, t),
	}


static func _waves_for(lv: int, t: float) -> Array:
	## Progressive mix: Geran early → Orlan mid → Lancet late.
	## Speeds ~half of the first pass so chase / lock have room.
	var out: Array = []
	if lv <= 5:
		out.append(_wave(GERAN, 2 + lv, lerpf(22.0, 28.0, t), 0.28))
		if lv >= 4:
			out.append(_wave(GERAN, 2, 30.0, 0.35))
	elif lv <= 10:
		out.append(_wave(GERAN, 4 + (lv - 5), 30.0, 0.35))
		out.append(_wave(ORLAN, 2 + (lv - 6), 36.0, 0.42))
	elif lv <= 16:
		out.append(_wave(GERAN, 5, 32.0, 0.4))
		out.append(_wave(ORLAN, 3 + (lv - 11), 40.0, 0.5))
		out.append(_wave(LANCET, 1 + int((lv - 11) / 2), 48.0, 0.55))
	elif lv <= 22:
		out.append(_wave(GERAN, 4, 34.0, 0.42))
		out.append(_wave(ORLAN, 4, 44.0, 0.55))
		out.append(_wave(LANCET, 3 + (lv - 17), 55.0, 0.65))
		out.append(_wave(LANCET, 2, 60.0, 0.7))
	else:
		out.append(_wave(ORLAN, 3, 48.0, 0.6))
		out.append(_wave(LANCET, 5 + (lv - 23), 62.0, 0.75))
		out.append(_wave(GERAN, 3, 36.0, 0.48))
		out.append(_wave(LANCET, 4, 68.0, 0.8))
		if lv >= 28:
			out.append(_wave(LANCET, 6, 72.0, 0.85))
	return out


static func _wave(kind: int, count: int, speed: float, dive_aggression: float) -> Dictionary:
	return {
		"kind": kind,
		"count": maxi(1, count),
		"speed": speed,
		"dive": clampf(dive_aggression, 0.2, 1.0),
	}


static func kind_name(kind: int) -> String:
	match kind:
		GERAN: return "GERAN-2"
		ORLAN: return "ORLAN-10"
		LANCET: return "LANCET"
		_: return "UAV"


static func hit_radius(kind: int) -> float:
	match kind:
		GERAN: return 7.5
		ORLAN: return 5.5
		LANCET: return 4.2
		_: return 6.0


static func _name(lv: int) -> String:
	match lv:
		1: return "FIRST INTERCEPT"
		2: return "SLOW SWARM"
		3: return "LAKE APPROACH"
		4: return "DOUBLE TRACK"
		5: return "GERAN SCREEN"
		6: return "ORLAN EYES"
		7: return "MIXED CONTACT"
		8: return "HIGH RECON"
		9: return "SPLIT AXIS"
		10: return "TEN THREATS"
		11: return "LANCET PROBE"
		12: return "CROSSFIRE"
		13: return "LOITER PACK"
		14: return "DIVE LANES"
		15: return "MID CHECK"
		16: return "PRESSURE"
		17: return "FAST CUTTERS"
		18: return "SATURATION"
		19: return "LOW CEILING"
		20: return "TWENTY"
		21: return "NEEDLE SWARM"
		22: return "NO LEAKS"
		23: return "LANCET STORM"
		24: return "SCRAMBLE"
		25: return "HARD DECK"
		26: return "BLACKOUT"
		27: return "OVERLOAD"
		28: return "FINAL WAVE"
		29: return "LAST LINE"
		30: return "SKY CLEAR"
		_: return "INTERCEPT %d" % lv
