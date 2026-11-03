/* Maya Cake — сторінка товару: product.html?id=… */
(function () {
  'use strict';

  function gallery(p, variant) {
    const slides = [];
    if (p.images.main) {
      slides.push({ src: MC.img(p.images.main, 800), srcset: MC.srcset(p.images.main), alt: p.name });
    }
    if (p.images.extra) slides.push({ src: MC.img(p.images.extra, 800), srcset: MC.srcset(p.images.extra), alt: p.name });
    if (p.images.cut) slides.push({ cut: true, src: `assets/img/${p.images.cut}.webp`, alt: `${p.name} — розріз` });
    // Начинка на вибір (бенто) — окремий кадр, що змінюється разом із вибором
    if (variant && variant.photo) slides.push({ filling: true, src: MC.img(variant.photo, 800), srcset: MC.srcset(variant.photo), alt: `${p.name} — ${variant.label}` });
    if (!slides.length) {
      return '<div class="gallery"><div class="gallery__track"><div class="gallery__slide"><span class="ph"><span>фото буде</span></span></div></div></div>';
    }
    const slideHtml = slides.map((s, i) => `<div class="gallery__slide${s.cut ? ' is-cut' : ''}" id="slide-${i}">
        <img${s.filling ? ' data-filling' : ''} src="${s.src}"${s.srcset ? ` srcset="${s.srcset}" sizes="(min-width: 900px) 600px, 100vw"` : ''} width="${s.cut ? 320 : 800}" height="${s.cut ? 320 : 1000}" alt="${MC.esc(s.alt)}"${i ? ' loading="lazy"' : ' fetchpriority="high"'}>
      </div>`).join('');
    const multi = slides.length > 1;
    return `<div class="gallery${multi ? '' : ' gallery--single'}">
      <div class="gallery__track" data-track tabindex="0" aria-label="Фото товару">${slideHtml}</div>
      ${multi ? `<div class="gallery__thumbs">${slides.map((s, i) => `<button type="button" class="${s.cut ? 'is-cut' : ''}" data-go="${i}" aria-label="Фото ${i + 1}"${i ? '' : ' aria-current="true"'}><img${s.filling ? ' data-filling' : ''} src="${s.cut ? s.src : s.src.replace('-800.', '-400.')}" alt="" loading="lazy"></button>`).join('')}</div>
      <div class="gallery__dots">${slides.map((s, i) => `<button type="button" data-go="${i}" aria-label="Фото ${i + 1}"${i ? '' : ' aria-current="true"'}></button>`).join('')}</div>` : ''}
    </div>`;
  }

  function details(p) {
    const blocks = [];
    if (p.contains || (p.allergens && p.allergens.length)) {
      const icons = (p.allergens || []).map((a) => `<li>${MC.icon(a)}${MC.ALLERGENS[a]}</li>`).join('');
      blocks.push(`<details open><summary>Склад і алергени${MC.icon('chevron')}</summary><div>
        ${icons ? `<ul class="allergens" aria-label="Алергени">${icons}</ul>` : ''}
        ${p.contains ? `<p><strong>Містить:</strong> ${MC.esc(p.contains)}.</p>` : '<p class="muted">Повний склад уточнюйте в нас.</p>'}
        <p class="soft-note">${MC.NOTE_PITS}</p>
      </div></details>`);
    } else {
      blocks.push(`<details open><summary>Склад і алергени${MC.icon('chevron')}</summary><div>
        <p class="muted">Склад і алергени уточнюйте — напишіть нам у <a href="${MC.tgUrl()}" target="_blank" rel="noopener">Telegram</a>.</p>
        <p class="soft-note">${MC.NOTE_PITS}</p></div></details>`);
    }
    const k = p.kbzhv;
    // Цифри — рядками, точно як у сторіз (без округлення)
    const extra = k ? [['з них насичені жири', k.saturated, ' г'], ['з них цукри', k.sugars, ' г'], ['сіль', k.salt, ' г'], ['енергетична цінність', k.kj, ' кДж']]
      .filter((r) => r[1]).map((r) => `<li><span>${r[0]}</span><b>${MC.esc(r[1])}${r[2]}</b></li>`).join('') : '';
    blocks.push(`<details><summary>Харчова цінність на 100 г${MC.icon('chevron')}</summary><div>
      ${k ? `<table class="kbzhv"><thead><tr><th>Білки, г</th><th>Жири, г</th><th>Вуглеводи, г</th><th>ккал</th></tr></thead>
        <tbody><tr><td>${MC.esc(k.protein)}</td><td>${MC.esc(k.fat)}</td><td>${MC.esc(k.carbs)}</td><td>${MC.esc(k.kcal)}</td></tr></tbody></table>
        ${extra ? `<ul class="kbzhv-more">${extra}</ul>` : ''}`
        : '<p class="muted">Харчову цінність уточнюйте.</p>'}
      <p class="soft-note">Вага ручних десертів може відрізнятися в межах 3%.</p>
    </div></details>`);
    blocks.push(`<details><summary>Термін придатності й зберігання${MC.icon('chevron')}</summary><div>
      <p>${p.shelfLife ? `Термін придатності — <strong>${MC.esc(p.shelfLife)}</strong>.` : 'Термін придатності уточнюйте.'} Зберігайте в холодильнику та смакуйте якомога швидше — так десерт найсмачніший.</p>
      ${p.note ? `<p class="muted">${MC.esc(p.note)}</p>` : ''}
    </div></details>`);
    blocks.push(`<details><summary>Доставка й оплата${MC.icon('chevron')}</summary><div>
      <p>Замовлення до ${MC.cfg.CUTOFF_HOUR}:00 — доставка наступного дня з ${MC.cfg.DELIVERY_WINDOW}. Київ — ${MC.price(MC.zone('kyiv').fee)}, від ${MC.price(MC.zone('kyiv').freeFrom)} безкоштовно. Оплата після підтвердження замовлення.</p>
      <a class="link-arrow" href="delivery.html">Зони й дні доставки ${MC.icon('arrow')}</a>
    </div></details>`);
    return `<div class="acc">${blocks.join('')}</div>`;
  }

  function render(d, p) {
    const root = MC.qs('[data-product]');
    const cat = d.categories.find((c) => c.id === p.category);
    let variant = p.variants ? p.variants[0] : null;
    let qty = 1;
    const pi = MC.priceInfo(p);

    document.title = `${p.name} — Maya Cake`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', `${p.name}${p.weight ? ', ' + p.weight : ''}. ${p.description || ''}`.slice(0, 160));

    const variantsHtml = p.variants ? `<fieldset class="variants"><legend>${MC.esc(p.variantTitle || 'Варіант')}</legend><div class="variants__list">
      ${p.variants.map((v, i) => `<label class="variant"><input type="radio" name="variant" value="${v.id}"${i ? '' : ' checked'}>
        <span class="${v.image ? '' : 'no-img'}">${v.image ? `<img src="assets/img/${v.image}.webp" alt="" width="36" height="36">` : ''}${MC.esc(v.label)}</span></label>`).join('')}
      </div></fieldset>` : '';

    const zoneOptions = MC.zones.map((z) => `<option value="${z.id}">${z.label}</option>`).join('');
    const buy = pi ? `<div class="buy">
        <div class="qty" role="group" aria-label="Кількість">
          <button type="button" data-q="-1" aria-label="Менше">${MC.icon('minus')}</button>
          <output class="num" data-qty>1</output>
          <button type="button" data-q="1" aria-label="Більше">${MC.icon('plus')}</button>
        </div>
        <button class="btn" type="button" data-buy><span>У кошик</span><span aria-hidden="true">·</span><span class="price" data-buy-price></span></button>
      </div>
      <div class="ship-line">${MC.icon('truck')}<span data-ship></span></div>`
      : `<div class="buy"><a class="btn" href="${MC.tgUrl()}" target="_blank" rel="noopener">${MC.icon('telegram')}Запитати в Telegram</a></div>
         <p class="muted" style="font-size:14px;margin-bottom:28px">Ціну цієї позиції уточнюйте — відповімо швидко.</p>`;

    root.innerHTML = `
      <nav class="breadcrumbs" aria-label="Навігація" style="padding-top:20px">
        <a href="index.html">Головна</a><span aria-hidden="true">/</span><a href="catalog.html?cat=${p.category}">${cat ? cat.label : 'Каталог'}</a>
      </nav>
      <div class="product">
        <div data-gallery>${gallery(p, variant)}</div>
        <div class="product__info">
          ${(p.tags || []).includes('new') ? '<span class="eyebrow">Новинка</span>' : ''}
          <h1>${MC.esc(p.name)}</h1>
          <div class="product__pills">
            <span class="pill pill--price" data-price>${pi ? MC.price(variant ? variant.price : p.price) : 'ціну уточнюйте'}</span>
            ${p.weight ? `<span class="pill">${MC.esc(p.weight)}</span>` : '<span class="pill pill--line">вагу уточнюйте</span>'}
            ${p.unitPrice ? `<span class="pill pill--line">${MC.price(p.unitPrice)} / шт</span>` : ''}
          </div>
          <p class="product__desc">${p.description ? MC.esc(p.description) : '<span class="muted">Опис зʼявиться згодом.</span>'}</p>
          ${variantsHtml}
          ${buy}
          ${details(p)}
        </div>
      </div>`;

    if (!pi) return;
    const priceNow = () => (variant ? variant.price : p.price);
    const update = () => {
      MC.qs('[data-qty]', root).textContent = qty;
      MC.qs('[data-price]', root).textContent = MC.price(priceNow());
      MC.qs('[data-buy-price]', root).textContent = MC.price(priceNow() * qty);
      MC.qs('[data-q="-1"]', root).disabled = qty <= 1;
      MC.qs('[data-q="1"]', root).disabled = qty >= MC.cfg.MAX_QTY;
    };
    const renderShip = () => {
      const zid = MC.cart.zone() || 'kyiv';
      const z = MC.zone(zid);
      const date = MC.delivery.earliest(zid);
      MC.qs('[data-ship]', root).innerHTML = `Привеземо ${MC.delivery.label(date)}, ${MC.cfg.DELIVERY_WINDOW} — <select aria-label="Місто доставки" data-ship-zone>${zoneOptions}</select>${z.unconfirmed ? ' (дні уточнюються)' : ''}`;
      MC.qs('[data-ship-zone]', root).value = zid;
    };
    root.addEventListener('click', (e) => {
      const q = e.target.closest('[data-q]');
      if (q) { qty = Math.max(1, Math.min(MC.cfg.MAX_QTY, qty + Number(q.dataset.q))); update(); }
      if (e.target.closest('[data-buy]')) MC.cart.add(p, { variant: variant && variant.id, qty, source: e.target.closest('[data-buy]') });
    });
    root.addEventListener('change', (e) => {
      if (e.target.name === 'variant') {
        variant = p.variants.find((v) => v.id === e.target.value);
        update();
        showFilling(root, p, variant);
      }
      if (e.target.matches('[data-ship-zone]')) MC.cart.setZone(e.target.value);
    });
    document.addEventListener('cart:zone', renderShip);
    update();
    renderShip();
  }

  // Обрали начинку — показуємо її розріз у галереї
  function showFilling(root, p, v) {
    const imgs = MC.qsa('img[data-filling]', root);
    if (!v.photo || !imgs.length) return;
    imgs.forEach((im) => {
      const thumb = !!im.closest('[data-go]');
      im.src = MC.img(v.photo, thumb ? 400 : 800);
      if (!thumb) { im.srcset = MC.srcset(v.photo); im.alt = `${p.name} — ${v.label}`; }
    });
    const slide = imgs[0].closest('.gallery__slide');
    const btn = MC.qs(`[data-go="${slide.id.replace('slide-', '')}"]`, root);
    if (btn) btn.click();
  }

  // Галерея: гортання пальцем на телефоні, мініатюри на комп'ютері
  function initGallery() {
    const track = MC.qs('[data-track]');
    if (!track) return;
    const buttons = MC.qsa('[data-go]');
    const mark = (i) => buttons.forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.go) === i)));
    buttons.forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.go);
      track.scrollTo({ left: track.clientWidth * i, behavior: 'smooth' });
      mark(i);
    }));
    let t;
    track.addEventListener('scroll', () => {
      clearTimeout(t);
      t = setTimeout(() => mark(Math.round(track.scrollLeft / track.clientWidth)), 60);
    }, { passive: true });
  }

  // «Смакує разом з»: 3 товари з інших категорій
  function related(d, p) {
    const pairs = { cakes: ['tarts', 'pastries', 'caramel'], tarts: ['eclairs', 'cups', 'pastries'], eclairs: ['tarts', 'pastries', 'cups'],
      pastries: ['tarts', 'eclairs', 'cups'], cups: ['tarts', 'pastries', 'eclairs'], rolls: ['tarts', 'eclairs', 'caramel'],
      bento: ['tarts', 'eclairs', 'pastries'], caramel: ['cakes', 'rolls', 'pastries'], bakery: ['tarts', 'eclairs', 'cups'] };
    const want = pairs[p.category] || ['tarts', 'eclairs', 'pastries'];
    const seed = p.id.length;
    const out = want.map((c, i) => {
      const list = d.products.filter((x) => x.category === c && x.id !== p.id && x.images.main && MC.priceInfo(x));
      return list.length ? list[(seed + i) % list.length] : null;
    }).filter(Boolean);
    if (!out.length) return;
    MC.qs('[data-related]').innerHTML = out.map((x) => MC.card(x)).join('');
    MC.qs('[data-related-wrap]').hidden = false;
  }

  MC.ready.then(() => MC.data().then((d) => {
    const id = new URLSearchParams(location.search).get('id');
    const p = d.byId[id];
    if (!p) {
      MC.qs('[data-product]').innerHTML = `<div class="empty-state"><div class="ph-circle"><span>ой</span></div>
        <h1>Такого десерту не знайшли</h1><p class="muted">Можливо, посилання застаріло.</p><a class="btn" href="catalog.html">До каталогу</a></div>`;
      return;
    }
    if (p.link) { location.replace(p.link); return; }
    render(d, p);
    initGallery();
    related(d, p);
  }));
})();
