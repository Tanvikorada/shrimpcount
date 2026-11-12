"""Draws the 1024x500 Play Store feature graphic (tools/android/feature-graphic.png): the logo ring and dot, the name, and the
one-line promise, with a field of ring marks like the ones the app draws on a counted tray. No photo, no accuracy claim.
Run from the repo root:  .venv/Scripts/python.exe tools/android/make_feature_graphic.py
"""
import random
from PIL import Image, ImageDraw, ImageFont

W, H = 1024, 500
BG, INK, SUB, ACCENT, CORAL = (11, 14, 16), (243, 242, 237), (162, 169, 174), (63, 214, 198), (255, 138, 106)
S = 3  # draw at 3x and shrink, for smooth edges

img = Image.new("RGB", (W * S, H * S), BG)
d = ImageDraw.Draw(img)

# a field of marks on the right, fading toward the text
rnd = random.Random(7)
for _ in range(260):
    x, y = rnd.uniform(430, 1010), rnd.uniform(14, 486)
    if x < 640 and y > 215:      # keep the marks off the title and tagline
        continue
    fade = min(1.0, max(0.0, (x - 430) / 260))
    c = tuple(int(BG[i] + (ACCENT[i] - BG[i]) * (0.25 + 0.6 * fade)) for i in range(3))
    r = rnd.uniform(5, 6.5)
    d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], outline=c, width=int(1.6 * S))
    d.ellipse([(x - 1.3) * S, (y - 1.3) * S, (x + 1.3) * S, (y + 1.3) * S], fill=c)

# logo: ring and a coral dot, the same mark as the app
cx, cy, R = 118, 150, 46
d.ellipse([(cx - R) * S, (cy - R) * S, (cx + R) * S, (cy + R) * S], outline=ACCENT, width=int(10 * S))
d.ellipse([(cx + 38 - 17) * S, (cy + 38 - 17) * S, (cx + 38 + 17) * S, (cy + 38 + 17) * S], fill=CORAL)

def font(name, size):
    return ImageFont.truetype(f"C:/Windows/Fonts/{name}", size * S)

d.text((60 * S, 232 * S), "ShrimpCount", font=font("segoeuib.ttf", 84), fill=INK)
d.text((64 * S, 338 * S), "Count postlarvae from a photo.", font=font("segoeui.ttf", 34), fill=SUB)
d.text((64 * S, 392 * S), "English  \u00b7  Telugu  \u00b7  Hindi  \u00b7  Tamil", font=font("segoeui.ttf", 24), fill=(106, 114, 120))

img = img.resize((W, H), Image.LANCZOS)
img.save("tools/android/feature-graphic.png", optimize=True)
print("wrote tools/android/feature-graphic.png", img.size)
