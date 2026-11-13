#!/usr/bin/env python3
"""Build the 1200x630 Open Graph card for opengamenode.com.

Run from the repo root after `pip install pillow` if it is not already present:
    python3 scripts/build-og.py

The card uses the supplied dark-mode lockup unchanged and the brand palette
from the Linear "Brand kit" document. Re-run it if the logo files change.
"""

from pathlib import Path
from urllib.request import urlretrieve

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "public" / "brand"
LOGO = BRAND / "opengamenode-dark.png"
OUT = BRAND / "og-default.png"
FONT_CACHE = ROOT / "scripts" / ".cache" / "Manrope.ttf"
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/manrope/Manrope%5Bwght%5D.ttf"

WIDTH, HEIGHT = 1200, 630
PRIMARY = (92, 203, 139)
TEXT = (240, 245, 241)
MUTED = (167, 184, 172)


def load_font(size: int, weight: int) -> ImageFont.FreeTypeFont:
    FONT_CACHE.parent.mkdir(parents=True, exist_ok=True)
    if not FONT_CACHE.exists():
        try:
            urlretrieve(FONT_URL, FONT_CACHE)
        except Exception as error:  # network is best effort; card still renders
            print(f"font download failed, using default: {error}")
            return ImageFont.load_default()
    font = ImageFont.truetype(str(FONT_CACHE), size)
    try:
        font.set_variation_by_axes([weight])
    except Exception:
        pass
    return font


def centered(draw: ImageDraw.ImageDraw, text: str, font, y: int, fill) -> None:
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    draw.text(((WIDTH - (right - left)) / 2, y), text, font=font, fill=fill)


def main() -> None:
    logo = Image.open(LOGO).convert("RGB")
    background = logo.getpixel((2, 2))

    card = Image.new("RGB", (WIDTH, HEIGHT), background)
    draw = ImageDraw.Draw(card)

    logo_width = 720
    logo_height = round(logo.height * logo_width / logo.width)
    resized = logo.resize((logo_width, logo_height), Image.LANCZOS)
    card.paste(resized, ((WIDTH - logo_width) // 2, 150))

    rule_y = 150 + logo_height + 44
    draw.rectangle(
        [(WIDTH - 64) // 2, rule_y, (WIDTH + 64) // 2, rule_y + 4],
        fill=PRIMARY,
    )

    headline = load_font(46, 800)
    centered(draw, "Free Minecraft server hosting", headline, rule_y + 36, TEXT)

    url_font = load_font(28, 600)
    centered(draw, "opengamenode.com", url_font, rule_y + 104, MUTED)

    card.save(OUT, optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
