#!/usr/bin/env python3
"""
Maya Cake — обробка фото зі скрінів Instagram-сторіз.

Що робить:
  1. Вирізає зі скріну саму сторіз (без вікна браузера).
  2. З кожної сторіз бере основне фото десерту (без тексту, цін і інтерфейсу Instagram),
     прибирає тонкі рожеві лінії-«вказівки» і кладе фото на білий кадр 4:5.
  3. Окремо вирізає коло з розрізом і робить його круглим (прозорий фон довкола).
  4. Вирізає кожен макарон із загального меню.
  5. Зберігає все у WebP у assets/img/ з латинськими назвами.

Запуск (з папки maya-cake):
    python3 tools/process_images.py            # обробити все
    python3 tools/process_images.py --sheet    # + зібрати контактний аркуш для перевірки

Ширини: 400 і 800 px. 1200 px не робимо — у скрінах фото має лише ~800 px,
розтягування дало б розмиту картинку.
"""
import argparse
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'materials', 'photos')
LOGO = os.path.join(ROOT, 'materials', 'logo.png')
OUT = os.path.join(ROOT, 'assets', 'img')

# Де сторіз лежить на скріні (скріни зроблені з одного вікна, тому позиція однакова)
STORY_BOX = (1065, 318, 1875, 1748)  # → сторіз 810×1430 px
STORY_W = 804  # корисна ширина: правий край (6 px) — темна рамка вікна

# Нижня межа фото: нижче починаються КБЖВ і рядок «Відповісти»
LIMIT_OLD = 1272  # сторіз «4 тиж.» (№1–46)
LIMIT_NEW = 1226  # сторіз «3 тиж.» (№50–68)

WIDTHS = (400, 800)
CUT_SIZE = 320  # коло з розрізом, рідний розмір у скріні ~310 px

# Усі кола в сторіз однакового розміру (~312 px)
CIRCLE_R = 156

# Колір рожевих кіл у сторіз
PINK = (221, 188, 196)

# ---------------------------------------------------------------------------
# Товари: латинська назва → (номер скріну за порядком, тип кадру, уточнення)
#   piece — порційний десерт, герой по центру
#   cake  — шматок торта, притиснутий праворуч
#   wide  — уся ширина (рулети, стаканчики, банки)
# Уточнення: cx — центр кадру по горизонталі, w — ширина кадру, circle — коло вручну,
#            top — верх фото (якщо автоматика помиляється), cut=False — без кола
# ---------------------------------------------------------------------------
PRODUCTS = {
    'brownie-peanut-caramel':     (1,  'piece', {}),
    'waffle-cake-salted-caramel': (2,  'cake', {}),
    'waffle-cake':                (3,  'cake', {}),
    'whoopie-coffee-nut':         (4,  'piece', {}),
    'whoopie-raspberry':          (5,  'piece', {}),
    'whoopie-pistachio':          (6,  'piece', {}),
    'peach-condensed-milk':       (7,  'piece', {}),
    'nut-dorblu':                 (8,  'piece', {}),
    'nut-condensed-milk':         (9,  'piece', {}),
    'potato-caramel':             (10, 'piece', {}),
    'potato-kinder':              (11, 'piece', {}),
    'potato-almond':              (12, 'piece', {}),
    'trifle-red-velvet':          (13, 'piece', {}),
    'trifle-honey':               (14, 'piece', {}),
    'trifle-chocolate-caramel':   (15, 'piece', {}),
    'trifle-berry':               (16, 'piece', {'circle': (89, 448)}),
    'puff-tubes-meringue':        (17, 'piece', {}),
    'meringue-roll-raspberry':    (18, 'wide', {}),
    'carrot-loaf':                (19, 'wide', {}),
    'murashnyk':                  (20, 'piece', {}),
    'napoleon':                   (21, 'cake', {}),
    'napoleon-chocolate-nut':     (22, 'cake', {}),
    'roll-vanilla':               (23, 'wide', {}),
    'roll-raspberry':             (24, 'wide', {}),
    'roll-chocolate':             (25, 'wide', {}),
    'spartak':                    (26, 'cake', {}),
    'tart-caramel-almond':        (27, 'piece', {}),
    'tart-lemon':                 (28, 'piece', {}),
    'peach-cream':                (29, 'piece', {}),
    'cake-poppy-lemon-blueberry': (30, 'cake', {}),
    'tube-baileys':               (31, 'piece', {}),
    'tube-condensed-milk':        (32, 'piece', {}),
    'red-velvet':                 (33, 'cake', {}),
    'cheesecake-new-york':        (34, 'cake', {}),
    # 35 — стара версія «Ягідного пломбіру», беремо новішу (№60)
    'cake-chocolate-cherry':      (36, 'cake', {}),
    'strawberry-honey-cake':      (37, 'cake', {}),
    'ne-khatyna':                 (38, 'cake', {}),
    # 39–41 — старі чіа-пудинг і Cake Box, замінені на Cake layers
    'caramel-jar':                (42, 'wide', {}),
    'bento':                      (45, 'wide', {'cut': False, 'top': 780, 'w': 600, 'cx': 520}),
    'eclair-condensed-milk':      (50, 'piece', {}),
    'eclair-classic':             (51, 'piece', {}),
    'pavlova-orange-passionfruit': (52, 'piece', {}),
    'tart-plum-orange':           (53, 'piece', {}),
    'cake-raspberry-mango':       (54, 'cake', {}),
    'cake-carrot-caramel':        (55, 'cake', {}),
    'mousse-cherry-profiteroles': (56, 'cake', {}),
    'three-milks-profiteroles':   (57, 'cake', {}),
    'cheesecake-bounty':          (58, 'cake', {}),
    'mousse-chocolate-cherry':    (59, 'cake', {}),
    'berry-plombir':              (60, 'cake', {}),
    'layers-chia':                (61, 'wide', {}),
    'layers-napoleon':            (62, 'wide', {}),
    'layers-oreo-cheesecake':     (63, 'wide', {}),
    'layers-snickers':            (64, 'wide', {'circle': (92, 454)}),
    'layers-tiramisu':            (65, 'wide', {'circle': (92, 454)}),
    'layers-red-velvet':          (66, 'wide', {'circle': (92, 454)}),
    'layers-chocolate-cherry':    (67, 'wide', {'circle': (92, 454)}),
    'honey-cake-caramel':         (68, 'cake', {}),
    'mini-pain-suisse':           (69, 'piece', {'top': 770, 'limit': 1300}),
}

# Макарон: номер скріну, ряди (y0, y1) і колонки (x0, x1) в кожному ряду, назви по порядку
MACARON_GRIDS = [
    ('classic', 43, [
        ((412, 511), [(53, 196), (242, 386), (428, 569), (617, 754)]),
        ((558, 652), [(58, 187), (240, 380), (428, 571), (616, 755)]),
        ((705, 801), [(50, 194), (246, 380), (428, 570), (618, 758)]),
        ((855, 949), [(48, 192), (240, 382), (435, 568), (615, 757)]),
        ((996, 1099), [(54, 188), (241, 382), (429, 572), (612, 757)]),
        ((1152, 1246), [(237, 382), (427, 572)]),
    ], ['kinder', 'lime-coconut', 'plombir-blueberry', 'watermelon',
        'mcflurry', 'pear-dorblu', 'hazelnut-cherry', 'lavender-bilberry',
        'lemon-sorbet', 'currant-cheesecake', 'pistachio', 'poppy-raspberry',
        'lemon-cheesecake', 'mango-passionfruit', 'cheesecake-nutella', 'melon-camembert',
        'coconut-strawberry', 'bounty', 'ferrero', 'chocolate-passionfruit',
        'salted-caramel', 'cherry-tonka']),
    ('premium', 44, [
        ((261, 435), [(50, 207), (241, 404), (439, 593), (628, 788)]),
        ((474, 616), [(139, 291), (337, 489), (526, 682)]),
        ((812, 949), [(53, 211), (245, 411), (441, 596), (630, 789)]),
        ((987, 1122), [(141, 304), (340, 498), (530, 678)]),
    ], ['pear-dorblu', 'caramel-popcorn', 'latte-halva', 'twix',
        'lemon-pie', 'oreo', 'chocolate-currant',
        'matcha-coconut-strawberry', 'bubble-gum', 'bueno', 'pistachio',
        'dubai-chocolate', 'raffaello', 'gorgonzola-walnut']),
]


# ---------------------------------------------------------------------------
def load_stories():
    files = sorted(glob.glob(os.path.join(SRC, '*.png')))
    if len(files) != 69:
        print(f'Увага: знайдено {len(files)} скрінів, очікувалось 69', file=sys.stderr)
    return files


def story(files, n):
    return Image.open(files[n - 1]).convert('RGB').crop(STORY_BOX)


def is_pink(c, tol=22):
    return all(abs(c[i] - PINK[i]) <= tol for i in range(3))


def find_circle(img):
    """Рамка рожевого кола (або кола-фото) в лівій частині сторіз."""
    px = img.load()
    # Ліва частина кола завжди вільна від пілюль з ціною, тому дивимось лише туди
    x0, y0, x1, y1 = 60, 360, 250, 860
    rows = [y for y in range(y0, y1) if sum(1 for x in range(x0, x1, 2) if is_pink(px[x, y])) > 6]
    if len(rows) > 150:
        # найдовша суцільна смуга рядків — це коло (пілюлі й лінії дають короткі смуги)
        best, cur = [], [rows[0]]
        for a, b in zip(rows, rows[1:]):
            if b - a <= 14:
                cur.append(b)
            else:
                best, cur = max(best, cur, key=len), [b]
        best = max(best, cur, key=len)
        ya, yb = best[0], best[-1]
        if yb - ya > 150:
            left = min(x for y in range(ya, yb, 2) for x in range(x0, x1) if is_pink(px[x, y]))
            return left, ya, left + 2 * CIRCLE_R, ya + 2 * CIRCLE_R
    # Коло-фото без рожевого фону: шукаємо його ліву дугу (найлівіші не-білі пікселі)
    edge = {}
    for y in range(y0, 776):  # нижче вже може починатися основне фото
        for x in range(75, x1):
            if min(px[x, y]) < 244:
                edge[y] = x
                break
    if len(edge) < 100:
        return None
    left = min(edge.values())
    mids = [y for y, x in edge.items() if x <= left + 2]
    cy = (min(mids) + max(mids)) // 2
    return left, cy - CIRCLE_R, left + 2 * CIRCLE_R, cy + CIRCLE_R


def remove_lines(img, depth=0.65):
    """Прибирає тонкі рожеві лінії-вказівки.

    Лінія рожево-холодна (синій канал вищий за зелений), а десерти теплі,
    тому піксель лінії «вистрибує» над сусідами ліворуч і праворуч.
    Шукаємо лише у верхній частині кадру — там, де лінії доходять до десерту.
    """
    px = img.load()
    w, h = img.size

    def pinkness(c):
        return (c[0] + c[2]) / 2 - c[1]

    for _ in range(2):
        fixes = []
        for y in range(int(h * depth)):
            for x in range(5, w - 5):
                r, g, b = px[x, y]
                if min(r, g, b) >= 250 or r - g < 4 or g < 120:
                    continue
                left, right = px[x - 5, y], px[x + 5, y]
                avg = tuple((left[i] + right[i]) // 2 for i in range(3))
                on_white = min(left) > 222 and min(right) > 222
                similar = sum(abs(left[i] - right[i]) for i in range(3)) < 45
                cool_bump = (b - g) - max(left[2] - left[1], right[2] - right[1]) >= 5
                pink_bump = pinkness((r, g, b)) - pinkness(avg) >= 6
                if on_white or (similar and r > 140 and (cool_bump or pink_bump)):
                    fixes.append((x, y, avg))
        for x, y, c in fixes:
            # зачищаємо й сусідні пікселі — краї лінії згладжені
            for dx in (-1, 0, 1):
                px[x + dx, y] = c
    return img


def fit_line(pts):
    """Пряма x = a*y + b за точками (y, x) методом найменших квадратів."""
    n = len(pts)
    sy = sum(p[0] for p in pts)
    sx = sum(p[1] for p in pts)
    syy = sum(p[0] * p[0] for p in pts)
    sxy = sum(p[0] * p[1] for p in pts)
    den = n * syy - sy * sy
    if den == 0:
        return None
    a = (n * sxy - sy * sx) / den
    return a, (sx - a * sy) / n


def erase_pointer_lines(img, y_from, y_to):
    """Знаходить дві прямі рожеві лінії-вказівки (у формі «V») на білому фоні,
    продовжує їх до точки перетину і зафарбовує весь відрізок,
    беручи колір з пікселів ліворуч і праворуч від лінії."""
    px = img.load()
    w = img.size[0]
    left_pts, right_pts = [], []
    for y in range(y_from, y_to):
        runs, start = [], None
        for x in range(6, w - 6):
            r, g, b = px[x, y]
            hit = min(r, g, b) < 250 and r - g >= 4 and min(px[x - 6, y]) > 238 and min(px[x + 6, y]) > 238
            if hit and start is None:
                start = x
            elif not hit and start is not None:
                runs.append((start + x - 1) / 2)
                start = None
        if len(runs) == 2:
            left_pts.append((y, runs[0]))
            right_pts.append((y, runs[1]))
    if len(left_pts) < 15:
        return img
    lines = [fit_line(left_pts), fit_line(right_pts)]
    if None in lines:
        return img
    (a1, b1), (a2, b2) = lines
    apex = (b2 - b1) / (a1 - a2) if a1 != a2 else y_to
    y_end = int(min(apex + 3, img.size[1] - 1))
    for a, b in lines:
        for y in range(min(p[0] for p in left_pts) - 40, y_end):
            xc = a * y + b
            x0, x1 = int(xc) - 4, int(xc) + 5
            if x0 < 1 or x1 >= w - 1:
                continue
            c0, c1 = px[x0 - 1, y], px[x1 + 1, y]
            for x in range(x0, x1 + 1):
                t = (x - x0 + 1) / (x1 - x0 + 2)
                px[x, y] = tuple(round(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))
    return img


def content_top(img, y_from, y_to, x0=0, x1=None):
    """Перший рядок, де починається десерт (а не тонка лінія)."""
    px = img.load()
    x1 = x1 or img.size[0]
    for y in range(y_from, y_to):
        cnt = sum(1 for x in range(x0, x1, 2) if min(px[x, y]) < 236)
        if cnt > 25:
            return y
    return y_from


def fade_edges(img, top=40, bottom=60):
    """М'який перехід у білий зверху і знизу, щоб фото злилося з карткою."""
    w, h = img.size
    white = Image.new('RGB', (w, h), (255, 255, 255))
    mask = Image.new('L', (w, h), 255)
    d = ImageDraw.Draw(mask)
    for i in range(top):
        d.line([(0, i), (w, i)], fill=int(255 * i / top))
    for i in range(bottom):
        d.line([(0, h - 1 - i), (w, h - 1 - i)], fill=int(255 * i / bottom))
    return Image.composite(img, white, mask)


def main_photo(img, n, kind, opt):
    limit = opt.get('limit', LIMIT_NEW if n >= 50 and n <= 68 else LIMIT_OLD)
    if 'circle' in opt:  # коло задане вручну: (лівий край, верх)
        cx0, cy0 = opt['circle']
        circ = (cx0, cy0, cx0 + 2 * CIRCLE_R, cy0 + 2 * CIRCLE_R)
    else:
        circ = find_circle(img) if opt.get('cut', True) else None
    start = max(740, (circ[3] + 10) if circ else 740)
    top = opt.get('top') or content_top(img, start, limit - 100)
    img = erase_pointer_lines(img.copy(), (circ[3] + 6) if circ else 600, top)
    top = max(start - 20, top - 30)
    if kind == 'piece':
        w, cx = opt.get('w', 600), opt.get('cx', 405)
    elif kind == 'cake':
        w, cx = opt.get('w', 640), opt.get('cx', 490)
    else:
        w, cx = opt.get('w', STORY_W), opt.get('cx', 402)
    # праворуч сторіз закінчується на 804 px — далі темна рамка Instagram
    x0 = max(0, min(STORY_W - w, cx - w // 2))
    crop = img.crop((x0, top, min(x0 + w, STORY_W), limit)).copy()
    crop = remove_lines(crop)
    crop = fade_edges(crop)
    cw, ch = crop.size
    # Кадр 4:5: ширину зберігаємо, по висоті доповнюємо білим
    target_h = round(cw * 5 / 4)
    if ch > target_h:  # вищий за 4:5 — обрізаємо зверху (там лише фон)
        crop = crop.crop((0, ch - target_h, cw, ch))
        ch = target_h
    canvas = Image.new('RGB', (cw, target_h), (255, 255, 255))
    canvas.paste(crop, (0, (target_h - ch) // 2 + (target_h - ch) // 6))
    return canvas, circ


def circle_photo(img, box):
    x0, y0, x1, y1 = box
    side = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    half = side // 2 - 2  # трохи всередину, щоб не лишилось білої облямівки
    sq = img.crop((cx - half, cy - half, cx + half, cy + half)).resize((CUT_SIZE, CUT_SIZE), Image.LANCZOS)
    big = CUT_SIZE * 4
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
    mask = mask.resize((CUT_SIZE, CUT_SIZE), Image.LANCZOS)
    out = sq.convert('RGBA')
    out.putalpha(mask)
    return out


def save_sizes(im, name):
    paths = []
    for w in WIDTHS:
        h = round(im.size[1] * w / im.size[0])
        p = os.path.join(OUT, f'{name}-{w}.webp')
        im.resize((w, h), Image.LANCZOS).save(p, 'WEBP', quality=82, method=6)
        paths.append(p)
    return paths


def save_one(im, name, quality=85):
    p = os.path.join(OUT, f'{name}.webp')
    im.save(p, 'WEBP', quality=quality, method=6)
    return p


def trim_white(im, pad=8):
    px = im.load()
    w, h = im.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if min(px[x, y]) < 240:
                xs.append(x)
                ys.append(y)
    if not xs:
        return im
    return im.crop((max(0, min(xs) - pad), max(0, min(ys) - pad), min(w, max(xs) + pad), min(h, max(ys) + pad)))


def macarons(files):
    done = []
    for group, n, rows, names in MACARON_GRIDS:
        img = story(files, n)
        i = 0
        for (y0, y1), cols in rows:
            for x0, x1 in cols:
                # знизу не беремо запасу — одразу під макароном підпис
                m = trim_white(img.crop((x0 - 6, y0 - 6, x1 + 6, y1 + 1)))
                side = max(m.size) + 16
                sq = Image.new('RGB', (side, side), (255, 255, 255))
                sq.paste(m, ((side - m.size[0]) // 2, (side - m.size[1]) // 2))
                sq = sq.resize((200, 200), Image.LANCZOS)
                done.append(save_one(sq, f'mac-{group}-{names[i]}'))
                i += 1
    return done


def bento_fillings(files):
    """Шість маленьких кіл з розрізами начинок бенто (скрін №45)."""
    img = story(files, 45)
    names = ['chocolate-cherry', 'spartak', 'strawberry-honey', 'red-velvet', 'poppy-lemon', 'berry-plombir']
    px = img.load()
    y0, y1 = 455, 575
    cols = []
    inside = False
    for x in range(810):
        filled = sum(1 for y in range(y0, y1, 3) if min(px[x, y]) < 235) > 6
        if filled and not inside:
            start, inside = x, True
        elif not filled and inside:
            if x - start > 40:
                cols.append((start, x))
            inside = False
    out = []
    for (x0, x1), name in zip(cols, names):
        cx = (x0 + x1) // 2
        ys = [y for y in range(y0, y1) if min(px[cx, y]) < 235]
        box = (x0, min(ys), x1, max(ys))
        c = circle_photo(img, box).resize((200, 200), Image.LANCZOS)
        out.append(save_one(c, f'bento-filling-{name}'))
    return out


def gift_boxes(files):
    img = story(files, 46)
    out = []
    for name, region in (('gift-box-macarons', (300, 440, 690, 830)), ('gift-box-nuts', (150, 880, 540, 1260))):
        sub = img.crop(region)
        px = sub.load()
        xs, ys = [], []
        for y in range(0, sub.size[1], 2):
            for x in range(0, sub.size[0], 2):
                if min(px[x, y]) < 245:
                    xs.append(x)
                    ys.append(y)
        box = (region[0] + min(xs), region[1] + min(ys), region[0] + max(xs), region[1] + max(ys))
        out.append(save_one(circle_photo(img, box), name))
    return out


def logo():
    """Логотип на прозорому фоні: синій (основний) і білий (для темного футера)."""
    im = Image.open(LOGO).convert('RGB')
    bg = im.getpixel((5, 5))
    w, h = im.size
    alpha = Image.new('L', (w, h))
    src, a = im.load(), alpha.load()
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            # наскільки піксель відрізняється від рожевого фону → прозорість
            d = (abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])) / (abs(16 - bg[0]) + abs(90 - bg[1]) + abs(127 - bg[2]))
            a[x, y] = max(0, min(255, int(d * 255)))
    bbox = alpha.getbbox()
    alpha = alpha.crop(bbox)
    out = []
    for name, color in (('logo', (16, 90, 127)), ('logo-white', (255, 255, 255))):
        solid = Image.new('RGBA', alpha.size, color + (255,))
        solid.putalpha(alpha)
        p = os.path.join(OUT, f'{name}.png')
        solid.save(p, optimize=True)
        out.append(p)
        out.append(save_one(solid, name, quality=90))
    # Іконка для вкладки браузера
    fav = Image.new('RGBA', (64, 64), (220, 194, 193, 255))
    mark = Image.open(os.path.join(OUT, 'logo.png'))
    mark.thumbnail((52, 52), Image.LANCZOS)
    fav.paste(mark, ((64 - mark.size[0]) // 2, (64 - mark.size[1]) // 2), mark)
    p = os.path.join(OUT, 'favicon.png')
    fav.save(p)
    out.append(p)
    return out


def contact_sheet(paths, dest, thumb=200, cols=8):
    ims = []
    for p in paths:
        try:
            im = Image.open(p)
            im.thumbnail((thumb, round(thumb * 1.25)))
            bg = Image.new('RGB', (thumb, round(thumb * 1.25)), (230, 230, 230))
            bg.paste(im, ((thumb - im.size[0]) // 2, 0), im if im.mode == 'RGBA' else None)
            d = ImageDraw.Draw(bg)
            d.text((4, bg.size[1] - 12), os.path.basename(p)[:30], fill=(0, 0, 0))
            ims.append(bg)
        except OSError:
            pass
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * thumb, rows * round(thumb * 1.25)), (255, 255, 255))
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % cols) * thumb, (i // cols) * round(thumb * 1.25)))
    sheet.save(dest, quality=80)
    print('Контактний аркуш:', dest)


def originals(folder):
    """Заміна фото на оригінали від власниці.

    Покладіть у папку файли з назвою товару (як у data/products.json):
        berry-plombir.jpg      → основне фото (обріжеться по центру до 4:5)
        berry-plombir-cut.jpg  → фото розрізу (обріжеться в коло)
    Підходять .jpg, .jpeg, .png, .webp. Старі файли з такою ж назвою замінюються.
    """
    done = 0
    for path in sorted(glob.glob(os.path.join(folder, '*'))):
        name, ext = os.path.splitext(os.path.basename(path))
        if ext.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
            continue
        im = Image.open(path).convert('RGB')
        w, h = im.size
        if name.endswith('-cut'):
            side = min(w, h)
            sq = im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
            sq = sq.resize((640, 640), Image.LANCZOS)
            box = (0, 0, 640, 640)
            c = circle_photo(sq, box)
            save_one(c.resize((CUT_SIZE * 2, CUT_SIZE * 2), Image.LANCZOS), name)
        else:
            # обрізаємо по центру до 4:5
            if w / h > 0.8:
                nw = round(h * 0.8)
                im = im.crop(((w - nw) // 2, 0, (w + nw) // 2, h))
            else:
                nh = round(w / 0.8)
                im = im.crop((0, (h - nh) // 2, w, (h + nh) // 2))
            for tw in (400, 800, 1200):
                if im.size[0] >= tw * 0.9:
                    im.resize((tw, round(tw * 1.25)), Image.LANCZOS).save(
                        os.path.join(OUT, f'{name}-{tw}.webp'), 'WEBP', quality=84, method=6)
        print(f'  ✓ {name}')
        done += 1
    print(f'Замінено фото: {done}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet', metavar='DIR', help='зберегти контактні аркуші для перевірки в цю папку')
    ap.add_argument('--only', help='обробити лише ці товари (через кому)')
    ap.add_argument('--originals', metavar='DIR', help='замінити фото оригіналами з цієї папки (див. README)')
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    if args.originals:
        originals(args.originals)
        return
    files = load_stories()
    mains, cuts = [], []
    only = set(args.only.split(',')) if args.only else None
    for name, (n, kind, opt) in PRODUCTS.items():
        if only and name not in only:
            continue
        img = story(files, n)
        photo, circ = main_photo(img, n, kind, opt)
        mains.append(save_sizes(photo, name)[0])
        if circ and opt.get('cut', True):
            cuts.append(save_one(circle_photo(img, circ), f'{name}-cut'))
        print(f'  ✓ {name}')
    extra = []
    if not only:
        extra += macarons(files)
        extra += bento_fillings(files)
        extra += gift_boxes(files)
        extra += logo()
    print(f'Готово: {len(mains)} основних фото, {len(cuts)} кіл з розрізом, {len(extra)} інших файлів')
    if args.sheet:
        os.makedirs(args.sheet, exist_ok=True)
        contact_sheet(mains, os.path.join(args.sheet, 'sheet-main.jpg'))
        contact_sheet(cuts, os.path.join(args.sheet, 'sheet-cut.jpg'))
        if extra:
            contact_sheet([p for p in extra if p.endswith('.webp')], os.path.join(args.sheet, 'sheet-extra.jpg'), thumb=140, cols=10)


if __name__ == '__main__':
    main()
