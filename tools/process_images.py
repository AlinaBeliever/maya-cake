#!/usr/bin/env python3
"""
Maya Cake — обробка фото з макетів сторіз (materials/photos, 1206×2144 px).

Що робить:
  1. З кожної сторіз бере основне фото десерту — без назви, цін, ваги, КБЖВ і тексту,
     прибирає тонкі рожеві лінії-«вказівки» і кадрує в 4:5 так, щоб десерт був по центру.
  2. Окремо вирізає коло з розрізом (кругле, з прозорим фоном довкола).
  3. Вирізає кожен макарон із загального меню, начинки бенто, подарункові коробки.
  4. Фото власників і сертифікат.
  5. Зберігає все у WebP у assets/img/ з латинськими назвами (400 і 800 px — цього
     достатньо для будь-якого екрана, а сайт лишається легким).

Запуск (з папки maya-cake; потрібні Pillow, numpy, scipy):
    python3 tools/process_images.py                 # обробити все
    python3 tools/process_images.py --only napoleon # лише вказані товари (через кому)
    python3 tools/process_images.py --sheet DIR     # + контактні аркуші для перевірки
    python3 tools/process_images.py --originals DIR # замінити фото окремими оригіналами (див. README)

Сторіз беруться за порядком назв файлів у materials/photos (*_n.jpg) — номер у таблиці нижче.
"""
import argparse
import glob
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'materials', 'photos')
LOGO = os.path.join(ROOT, 'materials', 'logo.png')
OUT = os.path.join(ROOT, 'assets', 'img')

WIDTHS = (400, 800)
CUT_SIZE = 480      # коло з розрізом
MAC_SIZE = 280      # окремий макарон
PINK = np.array([226, 187, 195])

# Нижня межа фото (нижче — КБЖВ, склад, умови зберігання) для трьох стилів сторіз
def limit_for(n):
    if 2 <= n <= 17:
        return 2005     # випічка на бежевому фоні
    if n >= 65:
        return 1858     # нові сторіз з розширеним КБЖВ
    return 1962

# ---------------------------------------------------------------------------
# Товари: латинська назва → (номер сторіз, уточнення)
# Уточнення: zoom — наскільки щільно кадрувати (1 — за замовчуванням, більше — ближче),
#            cx — зсув центру кадру по горизонталі (частка ширини), cut=False — без кола
# ---------------------------------------------------------------------------
PRODUCTS = {
    # Випічка (нова)
    'twist-raspberry': (2, {}),
    'twist-mocaccino': (3, {}),
    'cookie-chocolate-chunk': (4, {}),
    'cookie-chocolate': (5, {}),
    'donut-three-milks': (6, {}),
    'blueberry-puff': (7, {}),
    'donut-chocolate': (8, {}),
    'donut-classic': (10, {}),
    'brioche-raspberry': (11, {}),
    'donut-currant': (12, {}),
    'mini-pain-suisse': (13, {}),
    'donut-raspberry': (14, {}),
    'cookie-oat': (15, {}),
    'brioche-blueberry': (16, {}),
    'cookie-oat-almond': (17, {}),
    # Десерти
    'roll-chocolate': (18, {}),
    'cake-poppy-lemon-blueberry': (19, {}),
    'tart-lemon': (20, {}),
    'ne-khatyna': (21, {}),
    'potato-almond': (22, {}),
    'cheesecake-new-york': (23, {}),
    'waffle-cake': (24, {}),
    'potato-kinder': (25, {}),
    'brownie-peanut-caramel': (26, {}),
    'trifle-red-velvet': (27, {'circle': (128, 667, 601, 1140)}),  # коло зливається з фото
    'roll-raspberry': (28, {}),
    'whoopie-coffee-nut': (29, {}),
    'peach-condensed-milk': (30, {}),
    'napoleon-chocolate-nut': (32, {}),
    'bento': (34, {'cut': False}),
    'tart-caramel-almond': (35, {}),
    'tube-baileys': (36, {}),
    'puff-tubes-meringue': (37, {}),
    'cake-chocolate-cherry': (38, {}),
    'red-velvet': (39, {}),
    'trifle-berry': (43, {}),
    'strawberry-honey-cake': (44, {}),
    'trifle-honey': (45, {}),
    'potato-caramel': (46, {}),
    'murashnyk': (48, {}),
    'napoleon': (49, {}),
    'whoopie-raspberry': (50, {}),
    'tube-condensed-milk': (51, {}),
    'nut-dorblu': (52, {}),
    'carrot-loaf': (53, {}),
    'waffle-cake-salted-caramel': (55, {}),
    'roll-vanilla': (56, {}),
    'trifle-chocolate-caramel': (57, {}),
    'meringue-roll-raspberry': (58, {}),
    'spartak': (59, {}),
    'nut-condensed-milk': (60, {}),
    'whoopie-pistachio': (63, {}),
    'caramel-jar': (64, {}),
    'peach-cream': (65, {}),
    'eclair-condensed-milk': (66, {}),
    'layers-oreo-cheesecake': (67, {}),
    'layers-tiramisu': (68, {}),
    'layers-red-velvet': (69, {}),
    'honey-cake-caramel': (70, {}),
    'mousse-chocolate-cherry': (71, {}),
    'cheesecake-bounty': (72, {}),
    'cake-raspberry-mango': (73, {}),
    'layers-chocolate-cherry': (74, {}),
    'eclair-classic': (75, {}),
    'berry-plombir': (76, {}),
    'three-milks-profiteroles': (77, {}),
    'layers-chia': (78, {}),
    'tart-plum-orange': (79, {}),
    'cake-carrot-caramel': (80, {}),
    'layers-napoleon': (81, {}),
    'pavlova-orange-passionfruit': (82, {}),
    'layers-snickers': (83, {}),
    'mousse-cherry-profiteroles': (84, {}),
}
# Не використовуємо: 9 (умови зберігання — лише текст), 31 і 61 (таблиці складу макарон),
# 33, 41, 47, 54 (старі версії чіа-пудингу, Cake Box і ягідного пломбіру)

CLASSIC = ['kinder', 'lime-coconut', 'plombir-blueberry', 'watermelon',
           'mcflurry', 'pear-dorblu', 'hazelnut-cherry', 'lavender-bilberry',
           'lemon-sorbet', 'currant-cheesecake', 'pistachio', 'poppy-raspberry',
           'lemon-cheesecake', 'mango-passionfruit', 'cheesecake-nutella', 'melon-camembert',
           'coconut-strawberry', 'bounty', 'ferrero', 'chocolate-passionfruit',
           'salted-caramel', 'cherry-tonka']
PREMIUM = ['pear-dorblu', 'caramel-popcorn', 'latte-halva', 'twix',
           'lemon-pie', 'oreo', 'chocolate-currant',
           'matcha-coconut-strawberry', 'bubble-gum', 'bueno', 'pistachio',
           'dubai-chocolate', 'raffaello', 'gorgonzola-walnut']
BENTO = ['chocolate-cherry', 'spartak', 'strawberry-honey', 'red-velvet', 'poppy-lemon', 'berry-plombir']


# ---------------------------------------------------------------------------
def stories():
    files = sorted(glob.glob(os.path.join(SRC, '*_n.jpg')))
    if len(files) != 84:
        print(f'Увага: знайдено {len(files)} сторіз, очікувалось 84', file=sys.stderr)
    return files


def load(files, n):
    return np.asarray(Image.open(files[n - 1]).convert('RGB')).astype(np.int16)


def bg_color(A):
    """Колір фону — з кутка під логотипом."""
    return np.median(A[150:260, 20:120].reshape(-1, 3), axis=0)


def is_pink(A):
    """Фірмовий рожевий кіл і пілюль (у дереві й випічці синій канал нижчий за зелений)."""
    return (np.abs(A - PINK).sum(-1) < 36) & ((A[..., 2] - A[..., 1]) > 2)


def find_pills(A, y0=480, y1=1400):
    """Рожеві «пілюлі» з ціною чи вагою: суцільні заокруглені прямокутники."""
    S = A[y0:y1]
    light = (np.abs(S - PINK).sum(-1) < 70) & ((S[..., 2] - S[..., 1]) > 3) & ((S[..., 0] - S[..., 1]) > 18)
    m = ndimage.binary_closing(light, structure=np.ones((5, 5)))
    m = ndimage.binary_fill_holes(m)
    lab, k = ndimage.label(m)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        if 50 < h < 120 and 1.5 * h < w < 4.5 * h and (lab[sl] == i).mean() > 0.8:
            out.append((sl[1].start, sl[0].start + y0, sl[1].stop, sl[0].stop + y0))
    return out


def thin_line_mask(A, bg, y0, y1):
    """Тонкі рожеві лінії-вказівки: рожевуваті пікселі, з обох боків яких (±7 px) фон
    або вміст тієї ж яскравості — тобто смужка шириною до ~6 px."""
    S = A[y0:y1]
    r, g, b = S[..., 0], S[..., 1], S[..., 2]
    pinkish = ((r - g) > 6) & ((b - g) > 2) & (r > 150)
    near_bg = np.abs(S - bg).sum(-1) < 30
    left = np.roll(near_bg, 7, axis=1)
    right = np.roll(near_bg, -7, axis=1)
    m = pinkish & left & right
    # розширюємо на 3 px, щоб зачепити згладжені краї
    m = ndimage.binary_dilation(m, iterations=3)
    full = np.zeros(A.shape[:2], bool)
    full[y0:y1] = m
    return full


def erase(A, mask, bg):
    """Зафарбовує маску: кожен піксель — середнім кольором найближчих непомічених сусідів у рядку."""
    B = A.copy()
    ys, xs = np.nonzero(mask)
    W = A.shape[1]
    for y in np.unique(ys):
        row = mask[y]
        x = 0
        while x < W:
            if row[x]:
                s = x
                while x < W and row[x]:
                    x += 1
                l = A[y, s - 1] if s > 0 else bg
                r = A[y, x] if x < W else bg
                n = x - s
                for i in range(n):
                    t = (i + 1) / (n + 1)
                    B[y, s + i] = l * (1 - t) + r * t
            else:
                x += 1
    return B


def erase_pointer_lines(A, bg, y0, limit):
    """Лінії-вказівки заходять на сам десерт і сходяться в точку («V»).
    Знаходимо їх там, де вони йдуть по фону, продовжуємо до точки перетину
    і зафарбовуємо смугу вздовж лінії кольором пікселів ліворуч і праворуч."""
    m = thin_line_mask(A, bg, y0, limit)
    lab, k = ndimage.label(m)
    lines = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl[0].stop - sl[0].start < 60:
            continue
        ys, xs = np.nonzero(lab[sl] == i)
        ys = ys + sl[0].start
        xs = xs + sl[1].start
        if np.ptp(xs) > 3 * np.ptp(ys):      # майже горизонтальне — не лінія-вказівка
            continue
        a, b = np.polyfit(ys, xs, 1)
        lines.append((a, b, ys.min(), ys.max()))
    if not lines:
        return A
    B = A.copy()
    W = A.shape[1]
    for j, (a, b, ya, yb) in enumerate(lines):
        end = min(limit - 1, yb + 220)
        for a2, b2, ya2, yb2 in lines[:j] + lines[j + 1:]:   # точка перетину з іншою лінією
            if abs(a - a2) > 0.05:
                yc = (b2 - b) / (a - a2)
                if yb - 40 < yc < end:
                    end = int(yc) + 4
        for y in range(int(ya), int(end)):
            xc = a * y + b
            x0, x1 = int(xc) - 6, int(xc) + 7
            if x0 < 1 or x1 >= W - 1:
                continue
            l, r = B[y, x0 - 1].copy(), B[y, x1 + 1].copy()
            for x in range(x0, x1 + 1):
                t = (x - x0 + 1) / (x1 - x0 + 2)
                B[y, x] = l * (1 - t) + r * t
    return B


def find_circle(A, bg, n):
    """Коло з розрізом у лівій половині сторіз.
    1) рожеве коло: суцільна рожева пляма (з «дірою» під десерт, яку заповнюємо);
    2) коло-фото: ліва й верхня межа плями, діаметр — стандартний для цього стилю сторіз."""
    d_std = 421 if 2 <= n <= 17 else 473
    y0, y1, x0, x1 = 480, 1300, 20, 780
    sub = A[y0:y1, x0:x1]
    pink = ndimage.binary_closing(is_pink(sub), structure=np.ones((9, 9)))
    pink = ndimage.binary_fill_holes(pink)
    lab, k = ndimage.label(pink)
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        if 0.85 * d_std < w < 1.15 * d_std and 0.85 * d_std < h < 1.15 * d_std \
                and (lab[sl] == i).sum() / (w * h * np.pi / 4) > 0.85:
            left, top = sl[1].start + x0, sl[0].start + y0
            return (left, top, left + d_std, top + d_std)
    diff = np.abs(sub - bg).sum(-1) > 8
    diff = ndimage.binary_opening(diff, structure=np.ones((15, 15)))
    lab, k = ndimage.label(diff)
    cands = [sl for sl in ndimage.find_objects(lab) if sl[1].stop - sl[1].start > 0.8 * d_std]
    if not cands:
        return None
    sl = min(cands, key=lambda sl: sl[0].start)
    left, top = sl[1].start + x0, sl[0].start + y0
    if left < 100:      # пляма злилася з фото ліворуч — коло завжди починається на ~130 px
        left = 130 if n >= 65 else 128
    if left > 200:
        return None
    return (left, top, left + d_std, top + d_std)


def find_dessert(A, bg, y_from, limit):
    """Рамка основного фото десерту: найбільша пляма між y_from і limit."""
    sub = A[y_from:limit]
    diff = np.abs(sub - bg).sum(-1) > 30
    diff = ndimage.binary_opening(diff, structure=np.ones((9, 9)))
    lab, k = ndimage.label(diff)
    if not k:
        return None
    sizes = ndimage.sum(diff, lab, range(1, k + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 0.15 * sizes.max()])
    ys, xs = np.nonzero(keep)
    return xs.min(), ys.min() + y_from, xs.max(), ys.max() + y_from


def clear_overlays(A, bg, circ):
    """Зафарбовує фоном коло з розрізом і рожеві «пілюлі» з вагою — вони лежать поверх фото."""
    B = A.copy()
    H, W = A.shape[:2]
    if circ:
        x0, y0, x1, y1 = circ
        cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 8
        yy, xx = np.ogrid[:H, :W]
        B[(xx - cx) ** 2 + (yy - cy) ** 2 <= r * r] = bg
    for x0, y0, x1, y1 in find_pills(A):
        B[y0 - 5:y1 + 5, x0 - 5:x1 + 5] = bg
    return B


def main_photo(A, n, opt, circ):
    bg = bg_color(A)
    limit = opt.get('limit', limit_for(n))
    H, W = A.shape[:2]
    A = erase_pointer_lines(A, bg, 560, limit)            # лінії-вказівки, включно з кінчиками на десерті
    A = erase(A, thin_line_mask(A, bg, 560, limit), bg)
    A = clear_overlays(A, bg, circ)                       # коло й пілюля з вагою
    top = opt.get('top', 640)                             # вище — назва, опис, ціна
    box = find_dessert(A, bg, top, limit)
    if box is None:
        return None
    dx0, dy0, dx1, dy1 = box
    bw, bh = dx1 - dx0, dy1 - dy0
    zoom = opt.get('zoom', 1.0)
    # Кадр 4:5: десерт займає ~65% висоти; ширина не менша за 820 px, щоб не розтягувати
    fw = int(min(W, max(820, bh * 1.25 / zoom, min(bw * 1.04, 820) )))
    fh = int(fw * 1.25)
    cx = (dx0 + dx1) / 2 + opt.get('cx', 0) * W
    x0 = int(min(max(0, cx - fw / 2), W - fw))
    cy = (dy0 + dy1) / 2 + opt.get('cy', 0) * H
    y0 = int(cy - fh * 0.5)
    canvas = np.empty((fh, fw, 3), np.int16)
    canvas[:] = bg
    # усе, що вище десерту (пілюлі з вагою, кінчики ліній), — замінюємо фоном
    cut = dy0 - 70
    band = A[max(top, cut):dy0 + 10, x0:x0 + fw]
    pinkrows = np.nonzero((np.abs(band - PINK).sum(-1) < 70).sum(1) > 6)[0]
    if len(pinkrows):
        cut = max(top, cut) + pinkrows.max() + 6
    sy0, sy1 = max(y0, top, min(cut, dy0 - 4)), min(y0 + fh, limit)
    canvas[sy0 - y0:sy1 - y0] = A[sy0:sy1, x0:x0 + fw]
    img = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))
    return soften(img, sy0 - y0, sy1 - y0, bg)


def soften(img, top, bottom, bg):
    """М'який перехід у фон там, де фото обрізане зверху чи знизу посеред кадру."""
    w, h = img.size
    mask = Image.new('L', (w, h), 255)
    d = ImageDraw.Draw(mask)
    if top > 0:
        for i in range(36):
            d.line([(0, top + i), (w, top + i)], fill=int(255 * i / 36))
    if bottom < h:
        for i in range(48):
            d.line([(0, bottom - 1 - i), (w, bottom - 1 - i)], fill=int(255 * i / 48))
    base = Image.new('RGB', (w, h), tuple(int(c) for c in bg))
    return Image.composite(img, base, mask)


def circle_img(A, box, size=CUT_SIZE, inset=0.035):
    x0, y0, x1, y1 = box
    d = x1 - x0
    pad = int(d * inset)  # трохи всередину, щоб не лишилось світлої облямівки
    sq = Image.fromarray(np.clip(A[y0 + pad:y0 + d - pad, x0 + pad:x1 - pad], 0, 255).astype(np.uint8))
    sq = sq.resize((size, size), Image.LANCZOS)
    big = size * 4
    m = Image.new('L', (big, big), 0)
    ImageDraw.Draw(m).ellipse((0, 0, big - 1, big - 1), fill=255)
    out = sq.convert('RGBA')
    out.putalpha(m.resize((size, size), Image.LANCZOS))
    return out


def save_sizes(im, name):
    paths = []
    for w in WIDTHS:
        tw = min(w, im.size[0])  # не розтягуємо, якщо кадр вужчий
        p = os.path.join(OUT, f'{name}-{w}.webp')
        im.resize((tw, round(im.size[1] * tw / im.size[0])), Image.LANCZOS).save(p, 'WEBP', quality=80, method=6)
        paths.append(p)
    return paths


def save_one(im, name, quality=82):
    p = os.path.join(OUT, f'{name}.webp')
    im.save(p, 'WEBP', quality=quality, method=6)
    return p


# ---------------------------------------------------------------------------
def blobs(A, y0, y1, x0=0, x1=None, open_px=7, min_area=4000, thr=40):
    """Окремі предмети на білому фоні (макарони, начинки) — рамки зліва направо, згори вниз."""
    x1 = x1 or A.shape[1]
    bg = np.array([255, 255, 255])
    sub = A[y0:y1, x0:x1]
    m = np.abs(sub - bg).sum(-1) > thr
    m = ndimage.binary_opening(m, structure=np.ones((open_px, open_px)))
    m = ndimage.binary_fill_holes(m)
    lab, k = ndimage.label(m)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if (lab[sl] == i).sum() >= min_area:
            out.append((sl[1].start + x0, sl[0].start + y0, sl[1].stop + x0, sl[0].stop + y0))
    rows = []
    mid = lambda b: (b[1] + b[3]) / 2   # за серединою: попкорн згори не робить окремий ряд
    for b in sorted(out, key=mid):
        for r in rows:
            if abs(mid(r[0]) - mid(b)) < 60:
                r.append(b)
                break
        else:
            rows.append([b])
    return [b for r in rows for b in sorted(r, key=lambda b: b[0])]


def macaron_tile(A, box):
    # запас довкола, щоб не зрізати світлі краї (кришечки, шоколад)
    p = 3
    x0, y0, x1, y1 = max(0, box[0] - p), max(0, box[1] - p), min(A.shape[1], box[2] + p), min(A.shape[0], box[3] + p)
    m = Image.fromarray(np.clip(A[y0:y1, x0:x1], 0, 255).astype(np.uint8))
    side = int(max(m.size) * 1.08)
    sq = Image.new('RGB', (side, side), (255, 255, 255))
    sq.paste(m, ((side - m.size[0]) // 2, (side - m.size[1]) // 2))
    return sq.resize((MAC_SIZE, MAC_SIZE), Image.LANCZOS)


def macarons(files):
    done = []
    # Класичні — сторіз 42, макарони між рядками назв; премiум — 62 (дві групи)
    for group, n, names, regions in (('classic', 42, CLASSIC, [(600, 1900)]),
                                      ('premium', 62, PREMIUM, [(330, 960), (1190, 1800)])):
        A = load(files, n)
        boxes = []
        for y0, y1 in regions:
            boxes += [b for b in blobs(A, y0, y1, min_area=9000, thr=22) if (b[3] - b[1]) > 60 and (b[2] - b[0]) > 120]
        if len(boxes) != len(names):
            print(f'  ! {group}: знайдено {len(boxes)} макарон, очікувалось {len(names)}', file=sys.stderr)
        for b, name in zip(boxes, names):
            done.append(save_one(macaron_tile(A, b), f'mac-{group}-{name}'))
    return done


def bento_fillings(files):
    A = load(files, 34)
    boxes = [b for b in blobs(A, 680, 880, open_px=5, min_area=3000) if (b[2] - b[0]) > 80]
    out = []
    for b, name in zip(boxes, BENTO):
        d = max(b[2] - b[0], b[3] - b[1])
        out.append(save_one(circle_img(A, (b[0], b[1], b[0] + d, b[1] + d), min(d, 320), 0.02), f'bento-filling-{name}'))
    return out


def gift_boxes(files):
    A = load(files, 40)
    out = []
    # коло з коробкою макарон (праворуч угорі) і з горішками (ліворуч унизу)
    for name, (x0, y0, x1, y1) in (('gift-box-macarons', (560, 880, 1206, 1400)), ('gift-box-nuts', (300, 1450, 900, 2000))):
        bs = blobs(A, y0, y1, x0, x1, open_px=11, min_area=40000)
        if not bs:
            continue
        b = max(bs, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
        d = min(b[2] - b[0], b[3] - b[1])
        out.append(save_one(circle_img(A, (b[0], b[1], b[0] + d, b[1] + d)), name))
    return out


def hero(files, name='napoleon'):
    """Фото для першого екрана головної — основне фото торта без зменшення (права половина екрана)."""
    n, opt = PRODUCTS[name]
    A = load(files, n)
    photo = main_photo(A, n, opt, find_circle(A, bg_color(A), n))
    out = []
    for w in (600, photo.size[0]):
        p = os.path.join(OUT, f'hero-{name}-{w}.webp')
        photo.resize((w, round(photo.size[1] * w / photo.size[0])), Image.LANCZOS).save(p, 'WEBP', quality=84, method=6)
        out.append(p)
    return out


def owners(files):
    """Фото Славіка й Майї (сторіз 1) — без тексту, 4:5."""
    im = Image.open(files[0]).convert('RGB')
    w = im.size[0]
    crop = im.crop((0, 110, w, 110 + int(w * 1.25)))
    return save_sizes(crop, 'owners')


def certificate():
    p = os.path.join(SRC, 'certificate.jpg')
    if not os.path.exists(p):
        return []
    im = Image.open(p).convert('RGB')
    crop = im.crop((40, 1225, 1166, 2000))
    crop.thumbnail((1000, 1000), Image.LANCZOS)
    return [save_one(crop, 'certificate', 84)]


def logo():
    im = Image.open(LOGO).convert('RGB')
    bg = im.getpixel((5, 5))
    A = np.asarray(im).astype(float)
    ref = np.abs(np.array([16, 90, 127]) - bg).sum()
    alpha = np.clip(np.abs(A - bg).sum(-1) / ref * 255, 0, 255).astype(np.uint8)
    a = Image.fromarray(alpha)
    a = a.crop(a.getbbox())
    out = []
    for name, color in (('logo', (16, 90, 127)), ('logo-white', (255, 255, 255))):
        solid = Image.new('RGBA', a.size, color + (255,))
        solid.putalpha(a)
        solid.save(os.path.join(OUT, f'{name}.png'), optimize=True)
        out.append(save_one(solid, name, 90))
    fav = Image.new('RGBA', (64, 64), (220, 194, 193, 255))
    mark = Image.open(os.path.join(OUT, 'logo.png'))
    mark.thumbnail((52, 52), Image.LANCZOS)
    fav.paste(mark, ((64 - mark.size[0]) // 2, (64 - mark.size[1]) // 2), mark)
    fav.save(os.path.join(OUT, 'favicon.png'))
    return out


# ---------------------------------------------------------------------------
def originals(folder):
    """Заміна фото окремими оригіналами: berry-plombir.jpg (основне), berry-plombir-cut.jpg (розріз)."""
    done = 0
    for path in sorted(glob.glob(os.path.join(folder, '*'))):
        name, ext = os.path.splitext(os.path.basename(path))
        if ext.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
            continue
        im = Image.open(path).convert('RGB')
        w, h = im.size
        if name.endswith('-cut'):
            side = min(w, h)
            A = np.asarray(im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))).astype(np.int16)
            save_one(circle_img(A, (0, 0, side, side), CUT_SIZE, 0), name)
        else:
            if w / h > 0.8:
                nw = round(h * 0.8)
                im = im.crop(((w - nw) // 2, 0, (w + nw) // 2, h))
            else:
                nh = round(w / 0.8)
                im = im.crop((0, (h - nh) // 2, w, (h + nh) // 2))
            save_sizes(im, name)
        print(f'  ✓ {name}')
        done += 1
    print(f'Замінено фото: {done}')


def contact_sheet(paths, dest, thumb=200, cols=8):
    ims = []
    for p in paths:
        im = Image.open(p)
        im.thumbnail((thumb, round(thumb * 1.25)))
        bg = Image.new('RGB', (thumb, round(thumb * 1.25) + 14), (200, 200, 200))
        bg.paste(im, ((thumb - im.size[0]) // 2, 0), im if im.mode == 'RGBA' else None)
        ImageDraw.Draw(bg).text((3, bg.size[1] - 13), os.path.basename(p)[:32], fill=(0, 0, 0))
        ims.append(bg)
    if not ims:
        return
    tw, th = ims[0].size
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * tw, rows * th), (255, 255, 255))
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
    sheet.save(dest, quality=82)
    print('Контактний аркуш:', dest)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet', metavar='DIR')
    ap.add_argument('--only')
    ap.add_argument('--originals', metavar='DIR')
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    if args.originals:
        originals(args.originals)
        return
    files = stories()
    only = set(args.only.split(',')) if args.only else None
    mains, cuts = [], []
    for name, (n, opt) in PRODUCTS.items():
        if only and name not in only:
            continue
        A = load(files, n)
        circ = (opt['circle'] if 'circle' in opt else find_circle(A, bg_color(A), n)) if opt.get('cut', True) else None
        if opt.get('cut', True) and not circ:
            print(f'  ! {name}: коло не знайдено', file=sys.stderr)
        photo = main_photo(A, n, opt, circ)
        if photo is None:
            print(f'  ! {name}: фото не знайдено', file=sys.stderr)
            continue
        mains.append(save_sizes(photo, name)[0])
        if circ:
            cuts.append(save_one(circle_img(A, circ), f'{name}-cut'))
        print(f'  ✓ {name}')
    extra = []
    if not only:
        extra += macarons(files)
        extra += bento_fillings(files)
        extra += gift_boxes(files)
        extra += hero(files)
        extra += owners(files)
        extra += certificate()
        extra += logo()
    print(f'Готово: {len(mains)} основних фото, {len(cuts)} кіл з розрізом, {len(extra)} інших файлів')
    if args.sheet:
        os.makedirs(args.sheet, exist_ok=True)
        contact_sheet(mains, os.path.join(args.sheet, 'sheet-main.jpg'))
        contact_sheet(cuts, os.path.join(args.sheet, 'sheet-cut.jpg'))
        contact_sheet([p for p in extra if p.endswith('.webp')], os.path.join(args.sheet, 'sheet-extra.jpg'), 140, 10)


if __name__ == '__main__':
    main()
