"""Crop F-22 Raptor São Paulo spritesheet into clean frames + refresh title/icon."""
from __future__ import annotations

import os
from PIL import Image

SRC = r"C:\Users\Gabriell\.cursor\projects\c-Users-Gabriell-Documents-AirForceDashi\assets\c__Users_Gabriell_AppData_Roaming_Cursor_User_workspaceStorage_2da8e007a52fbdf7ae152d3b5ce4a060_images_image-9e12d62a-97f5-4704-9bc3-e320384f7a65.png"
OUT_DIR = r"C:\Users\Gabriell\Documents\AirForceDashi\assets\aircraft\f22"
UI_DIR = r"C:\Users\Gabriell\Documents\AirForceDashi\assets\ui"

# Sheet is 1024x576 with a title banner; usable art is a 6-col x 4-row grid below it.
# Empirically: title bar ~48px, then cells.
LABELS = [
	["TOP", "BANK_L1", "BANK_L2", "BANK_R1", "BANK_R2", "BOOST"],
	["SIDE_L", "SIDE_R", "GEAR", "FRONT", "REAR", "BELLY"],
	["ISO_L", "ISO_R", "ISO_BANK", "ISO_CLIMB", "ISO_REAR", "ISO_SPARE"],
	["FIRE_1", "FIRE_2", "AFTERBURNER", "FLARES", "DAMAGE", "DAMAGE_SPARE"],
]


def is_bg(c: tuple) -> bool:
	# Light paper / near-white / soft grey page bg
	return c[0] > 235 and c[1] > 235 and c[2] > 235


def trim_content(cell: Image.Image, pad: int = 2) -> Image.Image | None:
	px = cell.load()
	ww, hh = cell.size
	minx, miny, maxx, maxy = ww, hh, 0, 0
	found = False
	for y in range(hh):
		for x in range(ww):
			if not is_bg(px[x, y]):
				# skip pure black text-ish sparse rows later
				found = True
				minx = min(minx, x)
				miny = min(miny, y)
				maxx = max(maxx, x)
				maxy = max(maxy, y)
	if not found:
		return None

	jet_maxy = maxy
	for y in range(maxy, miny, -1):
		row_non = sum(1 for x in range(minx, maxx + 1) if not is_bg(px[x, y]))
		if row_non < (maxx - minx + 1) * 0.07:
			jet_maxy = y - 1
		else:
			break

	# Drop header-like thin black text at top of cell if present
	jet_miny = miny
	for y in range(miny, jet_maxy):
		row_non = sum(1 for x in range(minx, maxx + 1) if not is_bg(px[x, y]))
		if row_non < (maxx - minx + 1) * 0.06:
			jet_miny = y + 1
		else:
			break

	minx = max(0, minx - pad)
	jet_miny = max(0, jet_miny - pad)
	maxx = min(ww - 1, maxx + pad)
	jet_maxy = min(hh - 1, max(jet_maxy, jet_miny) + pad)
	if jet_maxy <= jet_miny or maxx <= minx:
		return None
	cropped = cell.crop((minx, jet_miny, maxx + 1, jet_maxy + 1)).convert("RGBA")
	p2 = cropped.load()
	for y in range(cropped.size[1]):
		for x in range(cropped.size[0]):
			c = p2[x, y]
			if c[0] > 235 and c[1] > 235 and c[2] > 235:
				p2[x, y] = (255, 255, 255, 0)
			else:
				p2[x, y] = (c[0], c[1], c[2], 255)
	return cropped


def main() -> None:
	os.makedirs(OUT_DIR, exist_ok=True)
	os.makedirs(UI_DIR, exist_ok=True)
	im = Image.open(SRC).convert("RGBA")
	w, h = im.size
	# Skip top title banner (~8% of height)
	banner = int(h * 0.09)
	art = im.crop((0, banner, w, h))
	aw, ah = art.size
	cols, rows = 6, 4
	cw, ch = aw // cols, ah // rows
	print("sheet", w, h, "art", aw, ah, "cell", cw, ch)
	im.save(os.path.join(OUT_DIR, "f22_sheet_src.png"))

	frames: dict[str, Image.Image] = {}
	for r in range(rows):
		for c in range(cols):
			name = LABELS[r][c]
			if name.endswith("SPARE"):
				continue
			cell = art.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
			trimmed = trim_content(cell)
			if trimmed is None:
				print("skip empty", name)
				continue
			path = os.path.join(OUT_DIR, f"f22_{name.lower()}.png")
			trimmed.save(path)
			frames[name] = trimmed
			print(name, trimmed.size)

	top = frames.get("TOP") or frames.get("ISO_L")
	if top is None:
		raise SystemExit("no TOP frame")

	tw, th = 940, 420
	canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
	scale = min((tw * 0.9) / top.size[0], (th * 0.9) / top.size[1])
	nw, nh = max(1, int(top.size[0] * scale)), max(1, int(top.size[1] * scale))
	top_s = top.resize((nw, nh), Image.NEAREST)
	canvas.paste(top_s, ((tw - nw) // 2, (th - nh) // 2), top_s)
	canvas.save(os.path.join(UI_DIR, "f22_title.png"))

	icon = top.copy()
	icon.thumbnail((168, 120), Image.NEAREST)
	icon.save(os.path.join(UI_DIR, "f22_icon.png"))
	icon.save(os.path.join(OUT_DIR, "f22_icon.png"))
	print("title", canvas.size, "icon", icon.size, "frames", len(frames))
	print("done")


if __name__ == "__main__":
	main()
