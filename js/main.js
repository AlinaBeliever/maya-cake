/*
 * Maya Cake — спільний код для всіх сторінок:
 * час Києва і дати доставки, завантаження товарів, картка товару,
 * шапка, смуга дедлайну, мобільне меню, футер.
 */
(function () {
  'use strict';

  const CFG = window.MC_CONFIG;
  const MC = (window.MC = window.MC || {});
  MC.cfg = CFG;

  /* ---------- Дрібні помічники ---------- */
  const nf = new Intl.NumberFormat('uk-UA');
  MC.price = (n) => nf.format(n) + ' грн';
  MC.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  MC.icon = (name, cls) => `<svg class="${cls || ''}" aria-hidden="true" focusable="false"><use href="assets/icons/sprite.svg#${name}"/></svg>`;
  MC.tgUrl = () => 'https://t.me/' + CFG.TELEGRAM_USERNAME;
  MC.igUrl = () => 'https://instagram.com/' + CFG.INSTAGRAM;
  MC.img = (name, w) => `assets/img/${name}-${w}.webp`;
  MC.srcset = (name) => `${MC.img(name, 400)} 400w, ${MC.img(name, 800)} 800w`;
  MC.qs = (sel, root) => (root || document).querySelector(sel);
  MC.qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  MC.plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };

  /* ---------- Час Києва ---------- */
  // Для перевірки сценаріїв можна відкрити сторінку з ?now=2026-11-07T15:30 —
  // сайт «подумає», що зараз саме цей час у Києві (до закриття вкладки).
  const NOW_KEY = 'mc_now_override';
  try {
    const p = new URLSearchParams(location.search).get('now');
    if (p === 'off') sessionStorage.removeItem(NOW_KEY);
    else if (p && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(p)) sessionStorage.setItem(NOW_KEY, p);
  } catch (e) { /* приватний режим — працюємо з реальним часом */ }

  const kyivFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: CFG.TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });

  // Повертає «настінний» час у Києві: {y, m, d, h, min, s}
  MC.kyivNow = function () {
    let override = null;
    try { override = sessionStorage.getItem(NOW_KEY); } catch (e) { /* ignore */ }
    if (override) {
      const [date, time] = override.split('T');
      const [y, m, d] = date.split('-').map(Number);
      const [h, min] = time.split(':').map(Number);
      return { y, m, d, h, min, s: 0, fake: true };
    }
    const parts = {};
    kyivFmt.formatToParts(new Date()).forEach((p) => { parts[p.type] = p.value; });
    return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour, min: +parts.minute, s: +parts.second };
  };

  /* ---------- Календарні дати (без годин, без часових поясів) ---------- */
  const DAY = 86400000;
  const dateOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
  const addDays = (dt, n) => new Date(dt.getTime() + n * DAY);
  const iso = (dt) => dt.toISOString().slice(0, 10);
  const WD = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];
  const WD_ACC = ['у неділю', 'у понеділок', 'у вівторок', 'у середу', 'у четвер', 'у пʼятницю', 'у суботу'];
  const WD_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];

  MC.zones = CFG.ZONES;
  MC.zone = (id) => CFG.ZONES.find((z) => z.id === id) || null;

  MC.delivery = {
    today() { const n = MC.kyivNow(); return dateOf(n.y, n.m, n.d); },
    // Чи ще можна встигнути на завтра (до 14:00 за Києвом)
    beforeCutoff() { return MC.kyivNow().h < CFG.CUTOFF_HOUR; },
    // Скільки хвилин лишилось до 14:00
    minutesLeft() {
      const n = MC.kyivNow();
      return Math.max(0, CFG.CUTOFF_HOUR * 60 - (n.h * 60 + n.min));
    },
    isOpen(dt, zone) {
      const z = zone || MC.zone('kyiv');
      return z.days.includes(dt.getUTCDay()) && !CFG.CLOSED_DATES.includes(iso(dt));
    },
    // Найближча можлива дата доставки для зони
    earliest(zoneId) {
      const z = MC.zone(zoneId) || MC.zone('kyiv');
      let dt = addDays(this.today(), this.beforeCutoff() ? 1 : 2);
      for (let i = 0; i < 60 && !this.isOpen(dt, z); i++) dt = addDays(dt, 1);
      return dt;
    },
    // N найближчих доступних дат (для вибору в оформленні)
    dates(zoneId, n) {
      const z = MC.zone(zoneId) || MC.zone('kyiv');
      const out = [];
      let dt = this.earliest(zoneId);
      for (let i = 0; out.length < (n || 7) && i < 90; i++, dt = addDays(dt, 1)) {
        if (this.isOpen(dt, z)) out.push(dt);
      }
      return out;
    },
    iso,
    fromIso(s) { const [y, m, d] = s.split('-').map(Number); return dateOf(y, m, d); },
    // «завтра, у четвер, 6 листопада» / «у четвер, 6 листопада»
    label(dt, opts) {
      const diff = Math.round((dt - this.today()) / DAY);
      const base = `${WD_ACC[dt.getUTCDay()]}, ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
      if (opts && opts.plain) return base;
      if (diff === 1) return 'завтра, ' + base;
      if (diff === 2) return 'післязавтра, ' + base;
      return base;
    },
    weekday: (dt) => WD[dt.getUTCDay()],
    long: (dt) => `${WD[dt.getUTCDay()]}, ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`,
    short: (dt) => ({ wd: WD_SHORT[dt.getUTCDay()], day: dt.getUTCDate(), month: MONTHS_SHORT[dt.getUTCMonth()] }),
    daysText(zone) {
      if (zone.days.length === 7) return 'щодня';
      const order = [1, 2, 3, 4, 5, 6, 0];
      const days = order.filter((d) => zone.days.includes(d));
      if (days.join() === '1,2,3,4,5') return 'пн–пт';
      if (days.join() === '1,2,3,4,5,6') return 'пн–сб';
      return days.map((d) => WD_SHORT[d].toLowerCase()).join(', ');
    },
    fee(zone, subtotal) { return subtotal >= zone.freeFrom ? 0 : zone.fee; }
  };

  /* ---------- Дані про товари ---------- */
  let dataPromise = null;
  MC.data = function () {
    if (!dataPromise) {
      dataPromise = fetch('data/products.json', { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then((d) => {
          d.byId = {};
          d.products.forEach((p) => { d.byId[p.id] = p; });
          d.macaronById = {};
          d.macarons.classic.concat(d.macarons.premium).forEach((m) => { d.macaronById[m.id] = m; });
          return d;
        });
      dataPromise.catch(() => showDataError());
    }
    return dataPromise;
  };
  function showDataError() {
    const main = MC.qs('main');
    if (!main || MC.qs('.data-error', main)) return;
    const box = document.createElement('div');
    box.className = 'data-error';
    box.innerHTML = location.protocol === 'file:'
      ? 'Сайт відкрито як файл, тому браузер не дає завантажити товари. Запустіть <code>start-site.command</code> (інструкція в README).'
      : 'Не вдалося завантажити товари. Оновіть сторінку.';
    main.prepend(box);
  }

  // Ціна для показу: число, «від N» або null (ціну уточнюйте)
  MC.priceInfo = function (p) {
    if (p.variants && p.variants.length) {
      const prices = p.variants.map((v) => v.price).filter((x) => x != null);
      const min = Math.min.apply(null, prices);
      const same = prices.every((x) => x === min);
      return { value: min, from: !same };
    }
    if (p.priceFrom) return { value: p.priceFrom, from: true };
    if (p.price != null) return { value: p.price, from: false };
    return null;
  };
  // Таблиця на телефоні стає картками: кожна клітинка отримує підпис зі свого заголовка
  MC.labelTable = function (table) {
    const heads = MC.qsa('thead th', table).map((th) => th.textContent.trim());
    MC.qsa('tbody tr', table).forEach((tr) => [...tr.cells].forEach((td, i) => td.setAttribute('data-label', heads[i] || '')));
  };
  MC.priceText = function (p) {
    const pi = MC.priceInfo(p);
    if (!pi) return 'ціну уточнюйте';
    return (pi.from ? 'від ' : '') + MC.price(pi.value);
  };
  // Товар можна додати одним натиском (без вибору начинки чи смаку)
  MC.quickAddable = (p) => !p.link && MC.priceInfo(p) && !(p.variants && ['Начинка', 'Смак'].includes(p.variantTitle));
  MC.productUrl = (p) => p.link || `product.html?id=${encodeURIComponent(p.id)}`;
  MC.mainImage = (p) => (p.images && p.images.main) || null;

  const BADGES = { new: 'Новинка', 'lactose-free': 'Без лактози' };

  MC.ALLERGENS = {
    gluten: 'Глютен (борошно)',
    milk: 'Молоко',
    eggs: 'Яйця',
    nuts: 'Горіхи',
    peanuts: 'Арахіс',
    sesame: 'Кунжут'
  };
  MC.NOTE_PITS = 'Фрукти й горіхи ми очищаємо від кісточок і шкарлупи, але інколи вони все ж можуть траплятися. Десерти зі свіжими ягодами можуть пускати сік — це нормально.';

  // Надсилання форми через Formspree. Якщо ID ще не вставлено — повертає {demo: true}
  MC.formReady = (id) => id && id !== 'ВСТАВ_ID';
  MC.sendForm = function (id, data) {
    if (!MC.formReady(id)) return Promise.resolve({ demo: true });
    return fetch('https://formspree.io/f/' + id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data)
    }).then((r) => {
      if (!r.ok) throw new Error('Formspree ' + r.status);
      return { ok: true };
    });
  };
  // Телефон у форматі +380XXXXXXXXX (приймаємо 0XXXXXXXXX, 380…, з пробілами й дужками)
  MC.normalizePhone = function (v) {
    let d = String(v || '').replace(/\D/g, '');
    if (d.length === 10 && d[0] === '0') d = '38' + d;
    if (d.length === 9) d = '380' + d;
    return /^380\d{9}$/.test(d) ? '+' + d : null;
  };
  MC.copy = function (text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
    return Promise.resolve();
  };
  MC.categoryLabel = (data, id) => (data.categories.find((c) => c.id === id) || {}).label || '';

  const CAN_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  MC.card = function (p, opts) {
    opts = opts || {};
    const url = MC.productUrl(p);
    const main = MC.mainImage(p);
    // коло з розрізом показується лише при наведенні мишкою — на телефоні його не вантажимо
    const cut = CAN_HOVER && p.images && p.images.hover !== false && p.images.cut;
    let media;
    if (main) {
      media = `<img src="${MC.img(main, 400)}" srcset="${MC.srcset(main)}" sizes="(min-width: 1200px) 290px, (min-width: 768px) 31vw, 46vw" width="400" height="500" loading="${opts.eager ? 'eager' : 'lazy'}" decoding="async" alt="${MC.esc(p.name)}">` +
        (cut ? `<span class="card__cut" aria-hidden="true"><img src="assets/img/${cut}.webp" width="320" height="320" loading="lazy" alt=""></span>` : '');
    } else if (p.image) {
      media = `<span class="card__cut" style="opacity:1"><img src="assets/img/${p.image}.webp" width="200" height="200" loading="lazy" alt="${MC.esc(p.name)}" style="border-radius:0;width:62%"></span>`;
    } else {
      media = '<span class="ph"><span>фото буде</span></span>';
    }
    const badges = (p.tags || []).filter((t) => BADGES[t]).slice(0, 1).map((t) => `<span class="badge">${BADGES[t]}</span>`).join('');
    const pi = MC.priceInfo(p);
    let action;
    if (!pi) {
      action = `<a class="card__tg" href="${MC.tgUrl()}" target="_blank" rel="noopener">${MC.icon('telegram')}Запитати в Telegram</a>`;
    } else if (p.link) {
      action = `<a class="card__add" href="${url}" aria-label="Зібрати коробку: ${MC.esc(p.name)}">${MC.icon('arrow')}</a>`;
    } else if (MC.quickAddable(p)) {
      action = `<button class="card__add" type="button" data-add="${p.id}" aria-label="Додати в кошик: ${MC.esc(p.name)}">${MC.icon('plus')}</button>`;
    } else {
      action = `<a class="card__add" href="${url}" aria-label="Обрати ${MC.esc((p.variantTitle || 'варіант').toLowerCase())}: ${MC.esc(p.name)}">${MC.icon('arrow')}</a>`;
    }
    const weight = p.weight ? `<span class="pill pill--line">${MC.esc(p.weight)}</span>` : '';
    // Кнопка «+» / «→» — у кутку фото; «Запитати в Telegram» — під назвою
    return `<article class="card" data-id="${p.id}">
      <div class="card__media">${media}<div class="card__badges">${badges}</div>${pi ? action : ''}</div>
      <div class="card__body">
        <h3 class="card__title"><a href="${url}">${MC.esc(p.name)}</a></h3>
        <div class="card__meta"><span class="pill pill--price">${MC.priceText(p)}</span>${weight}</div>
        ${pi ? '' : `<div class="card__foot">${action}</div>`}
      </div>
    </article>`;
  };

  /* ---------- Шапка, меню, смуга дедлайну, футер ---------- */
  const NAV = [
    ['catalog.html', 'Каталог'],
    ['box.html', 'Коробка макарон'],
    ['b2b.html', 'Для кавʼярень'],
    ['delivery.html', 'Доставка'],
    ['about.html', 'Про нас']
  ];
  const page = (location.pathname.split('/').pop() || 'index.html');

  function headerHtml() {
    // Меню розбите довкола логотипа: 3 пункти ліворуч, 2 праворуч
    const link = ([href, label]) => `<a href="${href}"${page === href ? ' aria-current="page"' : ''}>${label}</a>`;
    const navLeft = NAV.slice(0, 3).map(link).join('');
    const navRight = NAV.slice(3).map(link).join('');
    return `
    <a class="skip-link" href="#main">Перейти до змісту</a>
    <div class="deadline-bar" role="status" aria-live="polite"><div class="container" data-deadline>&nbsp;</div></div>
    <header class="site-header">
      <div class="container">
        <button class="icon-btn menu-toggle" type="button" aria-label="Меню" aria-expanded="false" aria-controls="mobile-menu" data-menu-open>${MC.icon('menu')}</button>
        <nav class="nav nav--left" aria-label="Головне меню">${navLeft}</nav>
        <a class="logo" href="index.html" aria-label="Maya Cake — на головну"><img src="assets/img/logo.webp" width="180" height="120" alt="Maya Cake"></a>
        <div class="header-actions">
          <nav class="nav nav--right" aria-label="Інформація">${navRight}</nav>
          <a class="icon-btn tg-link" href="${MC.tgUrl()}" target="_blank" rel="noopener" aria-label="Написати в Telegram">${MC.icon('telegram')}</a>
          <button class="icon-btn cart-btn" type="button" data-cart-open aria-label="Кошик">${MC.icon('bag')}<span class="cart-count" data-cart-count>0</span></button>
        </div>
      </div>
    </header>
    <div class="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Меню" hidden>
      <div class="mobile-menu__top">
        <img src="assets/img/logo.webp" width="180" height="120" alt="Maya Cake">
        <button class="icon-btn" type="button" aria-label="Закрити меню" data-menu-close>${MC.icon('close')}</button>
      </div>
      <nav aria-label="Меню">
        <a href="index.html">Головна</a>
        ${NAV.map(([href, label]) => `<a href="${href}"${page === href ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
      </nav>
      <div class="mobile-menu__contacts">
        <a href="tel:${CFG.PHONE}">${MC.icon('phone')}${CFG.PHONE_LABEL}</a>
        <a href="${MC.tgUrl()}" target="_blank" rel="noopener">${MC.icon('telegram')}Telegram</a>
        <a href="${MC.igUrl()}" target="_blank" rel="noopener">${MC.icon('instagram')}@${CFG.INSTAGRAM}</a>
      </div>
    </div>`;
  }

  function footerHtml() {
    const kyiv = MC.zone('kyiv');
    const region = CFG.ZONES.find((z) => z.id !== 'kyiv');
    return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-top">
          <div class="footer-brand">
            <img src="assets/img/logo-white.webp" width="180" height="120" alt="Maya Cake" loading="lazy">
            <p>Кондитерська в Києві. Замовлення до ${CFG.CUTOFF_HOUR}:00 — привеземо наступного дня з ${CFG.DELIVERY_WINDOW.replace('–', ' до ')}.</p>
          </div>
          <div class="footer-col">
            <h3>Десерти</h3>
            <ul>
              <li><a href="catalog.html">Увесь каталог</a></li>
              <li><a href="catalog.html?cat=cakes">Торти</a></li>
              <li><a href="box.html">Коробка макарон</a></li>
              <li><a href="catalog.html?cat=bento">Бенто</a></li>
              <li><a href="catalog.html?gift=1">Подарунки</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h3>Покупцям</h3>
            <ul>
              <li><a href="delivery.html">Доставка й оплата</a></li>
              <li><a href="b2b.html">Для кавʼярень</a></li>
              <li><a href="about.html">Про нас</a></li>
              <li>Київ: ${MC.price(kyiv.fee)}, від ${MC.price(kyiv.freeFrom)} — безкоштовно</li>
              <li>Область: ${MC.price(region.fee)}, від ${MC.price(region.freeFrom)} — безкоштовно</li>
            </ul>
          </div>
          <div class="footer-col">
            <h3>Контакти</h3>
            <ul>
              <li><a class="contact" href="tel:${CFG.PHONE}">${MC.icon('phone')}${CFG.PHONE_LABEL}</a></li>
              <li><a class="contact" href="${MC.tgUrl()}" target="_blank" rel="noopener">${MC.icon('telegram')}t.me/${CFG.TELEGRAM_USERNAME}</a></li>
              <li><a class="contact" href="${MC.igUrl()}" target="_blank" rel="noopener">${MC.icon('instagram')}@${CFG.INSTAGRAM}</a></li>
              <li>Оплата після підтвердження замовлення</li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${MC.kyivNow().y} Maya Cake</span>
          <span>Енергетична цінність — на 100 г. Допустима похибка ваги — 3%.</span>
        </div>
      </div>
    </footer>`;
  }

  // Текст смуги дедлайну
  MC.deadlineText = function () {
    const zoneId = (window.MC.cart && MC.cart.zone()) || 'kyiv';
    const zone = MC.zone(zoneId) || MC.zone('kyiv');
    const d = MC.delivery;
    const e = d.earliest(zone.id);
    const tomorrow = Math.round((e - d.today()) / DAY) === 1;
    // Назву міста ставимо на початок («Буча: …»), щоб не відмінювати її
    const where = zone.id === 'kyiv' ? '' : `${zone.label}: `;
    const cutoff = `${String(CFG.CUTOFF_HOUR).padStart(2, '0')}:00`;
    // Коротко, одним рядком; дата — лише на ширших екранах
    if (tomorrow && d.beforeCutoff()) return `${where}Замовте до ${cutoff} — привеземо завтра`;
    if (!d.beforeCutoff() && Math.round((e - d.today()) / DAY) === 2) {
      return `${where}Приймаємо на післязавтра<span class="wide"> — ${d.long(e)}</span>`;
    }
    return `${where}Найближча доставка<span class="wide"> — ${d.long(e)}</span>`;
  };

  function renderDeadline() {
    const el = MC.qs('[data-deadline]');
    if (el) el.innerHTML = MC.deadlineText();
  }

  function initMenu() {
    const menu = MC.qs('#mobile-menu');
    const openBtn = MC.qs('[data-menu-open]');
    const close = () => {
      menu.classList.remove('is-open');
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-locked');
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 300);
      openBtn.focus();
    };
    openBtn.addEventListener('click', () => {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('is-locked');
      MC.qs('[data-menu-close]', menu).focus();
    });
    MC.qs('[data-menu-close]', menu).addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) close(); });
  }

  function initHeaderScroll() {
    const header = MC.qs('.site-header');
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Кнопки «+» на картках (працює для карток, доданих будь-коли)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    e.preventDefault();
    MC.data().then((d) => {
      const p = d.byId[btn.dataset.add];
      if (p && MC.cart) MC.cart.add(p, { variant: p.variants ? p.variants[0].id : null, source: btn });
    });
  });

  /* ---------- Анімації (етап 4) ---------- */
  // Якщо людина в налаштуваннях системи попросила «зменшити рух» — анімацій немає
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  MC.motionOn = () => !reduce.matches;
  if (MC.motionOn()) document.documentElement.classList.add('motion');

  MC.motion = {
    // 2. Мініатюра товару летить до іконки кошика, лічильник підстрибує
    fly(source) {
      const target = MC.qs('.cart-btn');
      if (!target) return;
      const bump = () => MC.qsa('[data-cart-count]').forEach((c) => {
        c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
      });
      const holder = source && (source.closest('.card, .upsell__item, .product, .flavor, .tray-wrap, .builder') || null);
      const img = holder && (holder.querySelector('.card__media > img, .gallery__slide img, img'));
      if (!MC.motionOn() || !img || !target.getClientRects().length) { bump(); return; }
      const a = img.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const size = Math.min(a.width, a.height, 120);
      const clone = img.cloneNode();
      clone.removeAttribute('srcset');
      clone.removeAttribute('loading');
      clone.className = 'fly-thumb';
      Object.assign(clone.style, { width: size + 'px', height: size + 'px', left: (a.left + a.width / 2 - size / 2) + 'px', top: (a.top + a.height / 2 - size / 2) + 'px' });
      document.body.appendChild(clone);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const anim = clone.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(.18)`, opacity: .6 }
      ], { duration: 400, easing: 'cubic-bezier(.22,.61,.36,1)' });
      anim.onfinish = () => { clone.remove(); bump(); };
    },

    // 4. Конфетті з 12 рожевих кіл від точки (елемента)
    confetti(from) {
      if (!MC.motionOn() || !from || !from.getClientRects().length) return;
      const r = from.getBoundingClientRect();
      const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
      const colors = ['#DDBCC4', '#C796A2', '#F3E4E6', '#DDBCC4'];
      for (let i = 0; i < 12; i++) {
        const dot = document.createElement('span');
        dot.className = 'confetti';
        const s = 6 + Math.random() * 8;
        Object.assign(dot.style, { left: (x0 - s / 2) + 'px', top: (y0 - s / 2) + 'px', width: s + 'px', height: s + 'px', background: colors[i % 4] });
        document.body.appendChild(dot);
        const ang = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
        const dist = 50 + Math.random() * 60;
        dot.animate([
          { transform: 'translate(0,0) scale(.4)', opacity: 1 },
          { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist - 20}px) scale(1)`, opacity: 0 }
        ], { duration: 400 + Math.random() * 200, easing: 'cubic-bezier(.22,.61,.36,1)' }).onfinish = () => dot.remove();
      }
    },

    // 5. Секції проявляються при прокручуванні (лише ті, що нижче першого екрана)
    reveal() {
      if (!MC.motionOn() || !('IntersectionObserver' in window)) return;
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }), { rootMargin: '0px 0px -8% 0px' });
      MC.qsa('main > section, main .section').forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) return;
        el.classList.add('reveal');
        io.observe(el);
      });
    }
  };

  MC.ready = new Promise((resolve) => {
    const start = () => {
      document.body.insertAdjacentHTML('afterbegin', headerHtml());
      document.body.insertAdjacentHTML('beforeend', footerHtml());
      initMenu();
      initHeaderScroll();
      renderDeadline();
      setInterval(renderDeadline, 30000);
      document.addEventListener('cart:zone', renderDeadline);
      MC.motion.reveal();
      resolve();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  });
})();
