"""Генерация favicon.ico из геометрии логотипа «Призрачный Самолёт».

Pillow не умеет рендерить SVG, поэтому рисуем те же пути в маску и заливаем
диагональным градиентом #2AABEE → #6366F1 с фиолетовым свечением.
"""

import math

from PIL import Image, ImageDraw, ImageFilter

SIZE = 512
SCALE = SIZE / 32
LEGS = [((5.5, 26.6), (16, 5.5)), ((16, 5.5), (26.5, 26.6)), ((10.2, 19.4), (21.8, 19.4))]
WINGS = [
    ([(16, 5.5), (26.6, 14.2), (18.7, 16.6)], 0.36),
    ([(16, 5.5), (5.4, 14.2), (13.3, 16.6)], 0.16),
]
START = (0x2A, 0xAB, 0xEE)  # Telegram Blue
END = (0x63, 0x66, 0xF1)  # Aurogram Indigo


def scale(point: tuple[float, float]) -> tuple[float, float]:
    return (point[0] * SCALE, point[1] * SCALE)


def gradient_layer() -> Image.Image:
    layer = Image.new("RGB", (SIZE, SIZE))
    pixels = layer.load()
    for y in range(SIZE):
        for x in range(SIZE):
            # Диагональ из левого-нижнего в правый-верхний угол.
            t = min(1.0, max(0.0, (x / SIZE) * 0.6 + (1 - y / SIZE) * 0.4))
            pixels[x, y] = tuple(round(START[i] + (END[i] - START[i]) * t) for i in range(3))
    return layer


def main() -> None:
    mask = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(mask)

    for polygon, opacity in WINGS:
        draw.polygon([scale(point) for point in polygon], fill=int(255 * opacity))

    width = round(2.5 * SCALE)
    for start, end in LEGS:
        draw.line([scale(start), scale(end)], fill=255, width=width)
        for point in (start, end):
            cx, cy = scale(point)
            draw.ellipse([cx - width / 2, cy - width / 2, cx + width / 2, cy + width / 2], fill=255)

    glow_mask = mask.filter(ImageFilter.GaussianBlur(radius=SIZE * 0.045))
    gradient = gradient_layer()

    logo = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    glow = Image.new("RGBA", (SIZE, SIZE), (0x8B, 0x5C, 0xF6, 0))
    glow.putalpha(glow_mask.point(lambda value: int(value * 0.55)))
    logo.alpha_composite(glow)
    filled = gradient.convert("RGBA")
    filled.putalpha(mask)
    logo.alpha_composite(filled)

    icon_path = r"C:\Users\vi151\OneDrive\Desktop\Aurogram\web\public\favicon.ico"
    logo.save(icon_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    logo.resize((256, 256), Image.LANCZOS).save(icon_path.replace(".ico", "-256.png"))
    print("saved", icon_path)


if __name__ == "__main__":
    main()
