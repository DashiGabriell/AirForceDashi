from pathlib import Path

from PIL import Image

SRC = Path(
    r"C:\Users\Gabriell\.cursor\projects\c-Users-Gabriell-Documents-AirForceDashi\assets\c__Users_Gabriell_AppData_Roaming_Cursor_User_workspaceStorage_2da8e007a52fbdf7ae152d3b5ce4a060_images_image-0836f65f-cc90-4df7-9970-3edec7e71700.png"
)
OUT_DIR = Path(__file__).resolve().parents[1] / "apps" / "web" / "public" / "ui" / "currency"


def knockout_black(img: Image.Image, thresh: int = 28) -> Image.Image:
    px = img.load()
    ww, hh = img.size
    for y in range(hh):
        for x in range(ww):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r <= thresh and g <= thresh and b <= thresh:
                px[x, y] = (0, 0, 0, 0)
    return img


def trim_alpha(img: Image.Image, pad: int = 16) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(img.width, r + pad)
    b = min(img.height, b + pad)
    return img.crop((l, t, r, b))


def to_square(img: Image.Image) -> Image.Image:
    side = max(img.width, img.height)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - img.width) // 2
    oy = (side - img.height) // 2
    canvas.paste(img, (ox, oy), img)
    return canvas


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    half = w // 2
    crops = {
        "icon_cr.png": im.crop((0, 0, half, h)),
        "icon_dc.png": im.crop((half, 0, w, h)),
    }
    for name, crop in crops.items():
        cleaned = knockout_black(crop.copy())
        trimmed = trim_alpha(cleaned)
        square = to_square(trimmed).resize((256, 256), Image.Resampling.LANCZOS)
        dest = OUT_DIR / name
        square.save(dest, "PNG")
        print(f"{name} -> {dest} {square.size}")


if __name__ == "__main__":
    main()
