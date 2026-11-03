/*
 * Maya Cake — кошик.
 * Зберігається в браузері (localStorage), тому не зникає після перезавантаження.
 * На комп'ютері — панель справа, на телефоні — панель знизу.
 */
(function () {
  'use strict';

  const MC = window.MC;
  const CFG = MC.cfg;

  /* ---------- Збереження ---------- */
  function read(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* приватний режим */ }
  }

  let items = read(CFG.CART_KEY, []);
  if (!Array.isArray(items)) items = [];
  let zoneId = read(CFG.ZONE_KEY, null);

  const keyOf = (id, variant, extra) => [id, variant || '', extra || ''].join('|');

  function emit() {
    write(CFG.CART_KEY, items);
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: items.slice() } }));
  }

  /* ---------- Ціни макарон у коробці ---------- */
  function macaronPrice(m) {
    if (!m || m.unavailable) return null;
    return CFG.MACARON_PRICES[m.group];
  }
  // Ціна коробки: сума смаків + подарункова коробка (якщо обрана)
  function boxPrice(box, data) {
    let sum = 0;
    for (const id of box.flavors) {
      const p = macaronPrice(data.macaronById[id]);
      if (p == null) return null;
      sum += p;
    }
    return sum + (box.gift ? CFG.GIFT_BOX_PRICE : 0);
  }

  /* ---------- Публічний інтерфейс кошика ---------- */
  const cart = (MC.cart = {
    items: () => items.slice(),
    count: () => items.reduce((s, i) => s + i.qty, 0),
    subtotal: () => items.reduce((s, i) => s + i.qty * i.price, 0),
    zone: () => zoneId,
    setZone(id) {
      zoneId = id || null;
      write(CFG.ZONE_KEY, zoneId);
      document.dispatchEvent(new CustomEvent('cart:zone', { detail: { zone: zoneId } }));
      render();
    },
    boxPrice,
    macaronPrice,

    /*
     * Додати товар.
     * opts: { variant, qty, box: {type, size, flavors:[ids], gift}, card: 'текст листівки', source: елемент кнопки }
     */
    add(product, opts) {
      opts = opts || {};
      const variant = product.variants ? product.variants.find((v) => v.id === opts.variant) || product.variants[0] : null;
      let price = variant ? variant.price : product.price;
      let extra = '';
      let image = (variant && variant.image) || (product.images && product.images.main) || product.image || null;
      const entry = {
        id: product.id,
        name: product.name,
        variant: variant ? variant.id : null,
        variantLabel: variant ? variant.label : null,
        image,
        imageSingle: !product.images || !product.images.main || !!(variant && variant.image)
      };
      if (opts.box) {
        entry.box = opts.box;
        entry.flavorNames = opts.flavorNames || [];
        if (opts.card) entry.card = opts.card;
        price = opts.price;
        extra = opts.box.flavors.join(',') + (opts.box.gift ? '+gift' : '') + (opts.card ? '+' + opts.card : '');
        entry.variantLabel = opts.variantLabel;
      }
      if (price == null) return;
      entry.price = price;
      const key = keyOf(product.id, entry.variant, extra);
      const found = items.find((i) => i.key === key);
      const qty = opts.qty || 1;
      if (found) {
        found.qty = Math.min(CFG.MAX_QTY, found.qty + qty);
      } else {
        entry.key = key;
        entry.qty = Math.min(CFG.MAX_QTY, qty);
        items.push(entry);
      }
      emit();
      announce(entry, opts.source);
    },
    setQty(key, qty) {
      const it = items.find((i) => i.key === key);
      if (!it) return;
      if (qty <= 0) items = items.filter((i) => i.key !== key);
      else it.qty = Math.min(CFG.MAX_QTY, qty);
      emit();
    },
    remove(key) { items = items.filter((i) => i.key !== key); emit(); },
    clear() { items = []; emit(); },
    open: () => openDrawer(true),
    close: () => closeDrawer()
  });

  // Після завантаження товарів оновлюємо ціни в кошику (раптом власниця їх змінила)
  function refreshPrices(data) {
    let changed = false;
    items = items.filter((it) => {
      const p = data.byId[it.id];
      if (!p) { changed = true; return false; }
      let price;
      if (it.box) price = boxPrice(it.box, data);
      else if (it.variant && p.variants) { const v = p.variants.find((x) => x.id === it.variant); price = v ? v.price : null; }
      else price = p.price;
      if (price == null) { changed = true; return false; }
      if (price !== it.price) { it.price = price; changed = true; }
      return true;
    });
    if (changed) emit();
  }

  /* ---------- Розмітка панелі ---------- */
  let drawer, backdrop, body, foot, toast, lastFocus, autoCloseTimer;

  function build() {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="drawer-backdrop" data-cart-close></div>
      <aside class="drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" tabindex="-1">
        <span class="drawer__grab" aria-hidden="true"></span>
        <div class="drawer__head">
          <h2 id="cart-title">Кошик</h2>
          <button class="icon-btn" type="button" data-cart-close aria-label="Закрити кошик">${MC.icon('close')}</button>
        </div>
        <div class="drawer__body" data-cart-body></div>
        <div class="drawer__foot" data-cart-foot></div>
      </aside>
      <div class="toast" role="status" aria-live="polite" data-toast>
        <p data-toast-text></p>
        <button class="btn btn--light btn--sm" type="button" data-cart-open>Кошик</button>
      </div>`);
    drawer = MC.qs('#cart-drawer');
    backdrop = MC.qs('.drawer-backdrop');
    body = MC.qs('[data-cart-body]');
    foot = MC.qs('[data-cart-foot]');
    toast = MC.qs('[data-toast]');

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-cart-open]')) { e.preventDefault(); hideToast(); openDrawer(true); }
      else if (e.target.closest('[data-cart-close]')) closeDrawer();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
      if (e.key === 'Tab' && drawer.classList.contains('is-open')) trapFocus(e);
    });
    // Якщо людина взаємодіє з кошиком — не закриваємо його автоматично
    ['pointerenter', 'focusin', 'touchstart'].forEach((ev) =>
      drawer.addEventListener(ev, () => clearTimeout(autoCloseTimer), { passive: true }));

    drawer.addEventListener('click', onDrawerClick);
    drawer.addEventListener('change', (e) => {
      if (e.target.matches('[data-zone-select]')) cart.setZone(e.target.value);
    });
  }

  function trapFocus(e) {
    const f = MC.qsa('a[href], button:not([disabled]), select, input', drawer).filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function onDrawerClick(e) {
    const t = e.target.closest('[data-qty], [data-remove], [data-upsell]');
    if (!t) return;
    if (t.dataset.remove) cart.remove(t.dataset.remove);
    else if (t.dataset.qty) {
      const it = items.find((i) => i.key === t.dataset.key);
      if (it) cart.setQty(it.key, it.qty + Number(t.dataset.qty));
    } else if (t.dataset.upsell) {
      MC.data().then((d) => cart.add(d.byId[t.dataset.upsell], { source: t, silent: true }));
    }
  }

  function openDrawer(byUser) {
    clearTimeout(autoCloseTimer);
    lastFocus = document.activeElement;
    render();
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    document.body.classList.add('is-locked');
    if (byUser) setTimeout(() => drawer.focus(), 50);
  }
  function closeDrawer() {
    clearTimeout(autoCloseTimer);
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
  }
  function hideToast() { toast.classList.remove('is-shown'); }

  // Після додавання: на комп'ютері кошик відкривається на кілька секунд, на телефоні — коротке повідомлення
  let toastTimer;
  function announce(entry, source) {
    if (drawer && drawer.classList.contains('is-open')) return;
    if (window.matchMedia('(min-width: 768px)').matches) {
      openDrawer(false);
      autoCloseTimer = setTimeout(closeDrawer, 2600);
    } else {
      MC.qs('[data-toast-text]').innerHTML = `Додано: ${MC.esc(entry.name)}<span>У кошику ${cart.count()} шт · ${MC.price(cart.subtotal())}</span>`;
      toast.classList.add('is-shown');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(hideToast, 3500);
    }
  }

  function itemImage(it) {
    if (!it.image) return '<span class="ph"><span>фото буде</span></span>';
    const src = it.imageSingle ? `assets/img/${it.image}.webp` : MC.img(it.image, 400);
    const style = it.imageSingle ? ' style="object-fit:contain;padding:6px"' : '';
    return `<img src="${src}" width="72" height="90" loading="lazy" alt=""${style}>`;
  }

  function itemHtml(it) {
    const atMax = it.qty >= CFG.MAX_QTY;
    const flavors = it.flavorNames && it.flavorNames.length ? `<div class="cart-item__flavors">${MC.esc(it.flavorNames.join(', '))}</div>` : '';
    const card = it.card ? `<div class="cart-item__flavors">Листівка: «${MC.esc(it.card)}»</div>` : '';
    const url = it.box ? 'box.html' : `product.html?id=${encodeURIComponent(it.id)}`;
    return `<div class="cart-item">
      <div class="cart-item__img">${itemImage(it)}</div>
      <div>
        <a class="cart-item__name" href="${url}">${MC.esc(it.name)}</a>
        ${it.variantLabel ? `<div class="cart-item__variant">${MC.esc(it.variantLabel)}</div>` : ''}
        ${flavors}${card}
        <div class="qty" role="group" aria-label="Кількість">
          <button type="button" data-qty="-1" data-key="${MC.esc(it.key)}" aria-label="Менше">${MC.icon('minus')}</button>
          <output class="num" aria-live="polite">${it.qty}</output>
          <button type="button" data-qty="1" data-key="${MC.esc(it.key)}" aria-label="Більше"${atMax ? ' disabled' : ''}>${MC.icon('plus')}</button>
        </div>
      </div>
      <div class="cart-item__side">
        <span class="cart-item__sum price">${MC.price(it.price * it.qty)}</span>
        <button class="cart-item__remove" type="button" data-remove="${MC.esc(it.key)}">Видалити</button>
      </div>
      ${atMax ? `<div class="cart-item__limit">Потрібно більше ${CFG.MAX_QTY} шт? <a href="${MC.tgUrl()}" target="_blank" rel="noopener">Напишіть нам у Telegram</a> — порахуємо окремо.</div>` : ''}
    </div>`;
  }

  // Блок доставки: вибір міста, прогрес до безкоштовної доставки, найближча дата
  function shippingHtml(subtotal) {
    const zone = MC.zone(zoneId);
    const options = MC.zones.map((z) => `<option value="${z.id}"${z.id === zoneId ? ' selected' : ''}>${z.label}</option>`).join('');
    const select = `<div class="ship__zone"><label for="cart-zone">Доставка в</label>
      <select class="select" id="cart-zone" data-zone-select>${zone ? '' : '<option value="" selected>оберіть місто</option>'}${options}</select></div>`;
    if (!zone) {
      const kyiv = MC.zone('kyiv');
      const reg = MC.zones.find((z) => z.id !== 'kyiv');
      return `<div class="ship">${select}<p class="ship__text">Київ — безкоштовно від <strong>${MC.price(kyiv.freeFrom)}</strong>, область — від <strong>${MC.price(reg.freeFrom)}</strong>.</p></div>`;
    }
    const left = zone.freeFrom - subtotal;
    const pct = Math.min(subtotal / zone.freeFrom, 1) * 100;
    const text = left > 0
      ? `Ще <strong class="num">${MC.price(left)}</strong> — і доставка безкоштовна`
      : `<strong>Доставка безкоштовна</strong> ${MC.icon('check', 'inline-check')}`;
    const date = MC.delivery.earliest(zone.id);
    return `<div class="ship">${select}
      <p class="ship__text">${text}</p>
      <div class="progress${left <= 0 ? ' is-done' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="До безкоштовної доставки"><span style="width:${pct}%"></span></div>
      <p class="ship__date">${MC.icon('clock', 'inline-check')} Найближча доставка: ${MC.delivery.label(date)}, ${CFG.DELIVERY_WINDOW}${zone.unconfirmed ? ' (дні уточнюються)' : ''}</p>
    </div>`;
  }

  // Два товари, ціна яких найближча до суми, якої бракує до безкоштовної доставки
  function upsellHtml(data, subtotal) {
    const zone = MC.zone(zoneId) || MC.zone('kyiv');
    const left = zone.freeFrom - subtotal;
    if (left <= 0 || !items.length) return '';
    const inCart = new Set(items.map((i) => i.id));
    const picks = data.products
      .filter((p) => !inCart.has(p.id) && MC.quickAddable(p) && !p.variants && p.images && p.images.main && p.price <= Math.max(left, 200))
      .sort((a, b) => Math.abs(a.price - left) - Math.abs(b.price - left))
      .slice(0, 2);
    if (!picks.length) return '';
    return `<div class="upsell"><h4>Додайте до замовлення</h4><div class="upsell__list">${picks.map((p) => `
      <div class="upsell__item">
        <img src="${MC.img(p.images.main, 400)}" width="48" height="60" loading="lazy" alt="">
        <div><a href="product.html?id=${p.id}">${MC.esc(p.name)}</a><div class="price">${MC.price(p.price)}</div></div>
        <button class="card__add" type="button" data-upsell="${p.id}" aria-label="Додати: ${MC.esc(p.name)}">${MC.icon('plus')}</button>
      </div>`).join('')}</div></div>`;
  }

  let dataCache = null;
  function render() {
    MC.qsa('[data-cart-count]').forEach((el) => {
      const n = cart.count();
      el.textContent = n;
      el.classList.toggle('has-items', n > 0);
      el.closest('.cart-btn') && el.closest('.cart-btn').setAttribute('aria-label', n ? `Кошик: ${n} ${MC.plural(n, 'товар', 'товари', 'товарів')}` : 'Кошик');
    });
    if (!body) return;
    if (!items.length) {
      body.innerHTML = `<div class="cart-empty">
        <div class="circle">${MC.icon('bag')}</div>
        <h3>Кошик поки порожній</h3>
        <p class="muted">Оберіть десерти до ${CFG.CUTOFF_HOUR}:00 — і ми привеземо їх уже завтра.</p>
        <a class="btn" href="catalog.html">До каталогу</a>
      </div>`;
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    const subtotal = cart.subtotal();
    const zone = MC.zone(zoneId);
    const fee = zone ? MC.delivery.fee(zone, subtotal) : null;
    body.innerHTML = items.map(itemHtml).join('') + shippingHtml(subtotal) + (dataCache ? upsellHtml(dataCache, subtotal) : '');
    foot.innerHTML = `<div class="totals">
        <div><span>Товари</span><span class="price">${MC.price(subtotal)}</span></div>
        <div><span>Доставка</span><span class="price">${fee == null ? 'оберіть місто' : fee === 0 ? 'безкоштовно' : MC.price(fee)}</span></div>
        <div class="grand"><span>Разом</span><span>${MC.price(subtotal + (fee || 0))}</span></div>
      </div>
      <a class="btn btn--block" href="checkout.html">Оформити замовлення ${MC.icon('arrow')}</a>
      <p class="pay-note">Оплата після підтвердження замовлення</p>`;
  }

  document.addEventListener('cart:updated', render);
  // Зміни в іншій вкладці
  window.addEventListener('storage', (e) => {
    if (e.key === CFG.CART_KEY) { items = read(CFG.CART_KEY, []); render(); document.dispatchEvent(new CustomEvent('cart:updated', { detail: { items } })); }
    if (e.key === CFG.ZONE_KEY) { zoneId = read(CFG.ZONE_KEY, null); render(); document.dispatchEvent(new CustomEvent('cart:zone')); }
  });

  MC.ready.then(() => {
    build();
    render();
    MC.data().then((d) => { dataCache = d; refreshPrices(d); render(); }).catch(() => {});
  });
})();
