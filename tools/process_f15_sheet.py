"""Crop F-15 Eagle spritesheet into clean transparent frames + title/icon assets."""
from __future__ import annotations

import os
from PIL import Image

SRC = r"C:\Users\Gabriell\.cursor\projects\c-Users-Gabriell-Documents-AirForceDashi\assets\c__Users_Gabriell_AppData_Roaming_Cursor_User_workspaceStorage_2da8e007a52fbdf7ae152d3b5ce4a060_images_image-c2833e94-0162-45af-9222-84481e2d7bed.png"
OUT_DIR = r"C:\Users\Gabriell\Documents\AirForceDashi\assets\aircraft\f15"
UI_DIR = r"C:\Users\Gabriell\Documents\AirForceDashi\assets\ui"

LABELS = [
	["TOP", "SIDE_L", "SIDE_R", "FRONT"],
	["REAR", "BANK_L", "BANK_R", "CLIMB"],
	["AFTERBURNER", "MISSILE", "VAPOR", "LANDING"],
]


def is_bg(c: tuple) -> bool:
	return c[0] > 245 and c[1] > 245 and c[2] > 245


def trim_content(cell: Image.Image, pad: int = 2) -> Image.Image:
	px = cell.load()
	ww, hh = cell.size
	minx, miny, maxx, maxy = ww, hh, 0, 0
	found = False
	for y in range(hh):
		for x in range(ww):
			if not is_bg(px[x, y]):
				found = True
				minx = min(minx, x)
				miny = min(miny, y)
				maxx = max(maxx, x)
				maxy = max(maxy, y)
	if not found:
		return cell.convert("RGBA")

	# Drop sparse label rows from the bottom.
	jet_maxy = maxy
	for y in range(maxy, miny, -1):
		row_non = sum(1 for x in range(minx, maxx + 1) if not is_bg(px[x, y]))
		if row_non < (maxx - minx + 1) * 0.08:
			jet_maxy = y - 1
		else:
			break

	minx = max(0, minx - pad)
	miny = max(0, miny - pad)
	maxx = min(ww - 1, maxx + pad)
	jet_maxy = min(hh - 1, max(jet_maxy, miny) + pad)
	cropped = cell.crop((minx, miny, maxx + 1, jet_maxy + 1)).convert("RGBA")
	p2 = cropped.load()
	for y in range(cropped.size[1]):
		for x in range(cropped.size[0]):
			c = p2[x, y]
			if c[0] > 245 and c[1] > 245 and c[2] > 245:
				p2[x, y] = (255, 255, 255, 0)
			else:
				p2[x, y] = (c[0], c[1], c[2], 255)
	return cropped


def main() -> None:
	os.makedirs(OUT_DIR, exist_ok=True)
	os.makedirs(UI_DIR, exist_ok=True)
	im = Image.open(SRC).convert("RGBA")
	w, h = im.size
	cw, ch = w // 4, h // 3
	print("sheet", w, h, "cell", cw, ch)
	im.save(os.path.join(OUT_DIR, "f15_sheet_src.png"))

	frames: dict[str, Image.Image] = {}
	for r in range(3):
		for c in range(4):
			name = LABELS[r][c]
			cell = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
			trimmed = trim_content(cell)
			path = os.path.join(OUT_DIR, f"f15_{name.lower()}.png")
			trimmed.save(path)
			frames[name] = trimmed
			print(name, trimmed.size)

	# Title art from TOP (nearest scale, transparent canvas)
	top = frames["TOP"]
	tw, th = 940, 420
	canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
	scale = min((tw * 0.88) / top.size[0], (th * 0.88) / top.size[1])
	nw, nh = max(1, int(top.size[0] * scale)), max(1, int(top.size[1] * scale))
	top_s = top.resize((nw, nh), Image.NEAREST)
	canvas.paste(top_s, ((tw - nw) // 2, (th - nh) // 2), top_s)
	canvas.save(os.path.join(UI_DIR, "f15_title.png"))

	icon = top.copy()
	icon.thumbnail((168, 120), Image.NEAREST)
	icon.save(os.path.join(OUT_DIR, "f15_icon.png"))
	icon.save(os.path.join(UI_DIR, "f15_icon.png"))

	# F-22 selector icon from existing title
	f22_path = os.path.join(UI_DIR, "f22_title.png")
	if os.path.isfile(f22_path):
		f22 = Image.open(f22_path).convert("RGBA")
		f22i = f22.copy()
		f22i.thumbnail((168, 120), Image.NEAREST)
		f22i.save(os.path.join(UI_DIR, "f22_icon.png"))

	# Compact BANK_L preview for richer selector (optional secondary)
	bank = frames["BANK_L"]
	bank_i = bank.copy()
	bank_i.thumbnail((168, 120), Image.NEAREST)
	bank_i.save(os.path.join(OUT_DIR, "f15_preview.png"))
	print("title", canvas.size, "icon", icon.size)
	print("done")


if __name__ == "__main__":
	main()
