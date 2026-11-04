/* Maya Cake — головна сторінка: «Радимо спробувати», коробка макарон, міні-калькулятор доставки */
(function () {
  'use strict';

  // Добірка на головній. Порядок можна змінити — це id з data/products.json
  const FEATURED = [
    'cake-raspberry-mango', 'mousse-cherry-profiteroles', 'roll-raspberry', 'tart-plum-orange',
    'eclair-classic', 'honey-cake-caramel', 'layers-snickers', 'pavlova-orange-passionfruit'
  ];

  // Hero: перемикач 6 десертів (стрілки ← →) і легкий паралакс за мишею
  const PLACEHOLDER = 'assets/img/hero-object-placeholder.webp';
  function initHero(d) {
    const hero = MC.qs('[data-hero]');
    if (!hero || !d.hero) return;
    const items = d.hero.items.map((it) => ({ p: d.byId[it.id], image: it.image })).filter((it) => it.p);
    if (!items.length) return;
    const frame = MC.qs('[data-hero-frame]', hero);
    const ph = MC.qs('[data-hero-ph]', hero);
    const pad = (n) => String(n).padStart(2, '0');
    let i = 0;
    MC.qs('[data-hero-total]', hero).textContent = pad(items.length);

    const show = (next, animate) => {
      i = (next + items.length) % items.length;
      const { p, image } = items[i];
      // TODO: поки image = null — заглушка; справжні фото без фону вписуються в data/products.json → hero.items
      const src = image ? `assets/img/${image}.webp` : PLACEHOLDER;
      const alt = image ? p.name : `${p.name} — фото буде`;
      MC.qs('[data-hero-index]', hero).textContent = pad(i + 1);
      MC.qsa('[data-hero-name]', hero).forEach((el) => { el.textContent = p.name; });
      MC.qsa('[data-hero-price]', hero).forEach((el) => { el.textContent = MC.priceText(p); });
      MC.qsa('[data-hero-link]', hero).forEach((el) => { el.href = MC.productUrl(p); });
      ph.hidden = !!image;
      const old = MC.qs('[data-hero-img]', frame);
      if (!animate || !MC.motionOn()) { old.src = src; old.alt = alt; return; }
      // Перехід: нове фото проявляється поверх старого (400 мс), старе зникає
      const img = old.cloneNode();
      img.src = src; img.alt = alt;
      img.style.cssText = 'position:absolute;inset:0';
      frame.appendChild(img);
      img.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'ease-out' });
      old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: 'ease-out' }).onfinish = () => {
        old.remove();
        img.style.cssText = '';
      };
    };
    show(0, false);
    MC.qs('[data-hero-prev]', hero).addEventListener('click', () => show(i - 1, true));
    MC.qs('[data-hero-next]', hero).addEventListener('click', () => show(i + 1, true));

    // Паралакс: десерт до ±10 px за мишею, слово — до ±4 px у протилежний бік (лише миша, лише від 768 px)
    if (!MC.motionOn() || !window.matchMedia('(pointer: fine) and (min-width: 768px)').matches) return;
    const para = MC.qs('[data-hero-para]', hero);
    const word = MC.qs('[data-hero-word]', hero);
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const tick = () => {
      x += (tx - x) * 0.08; y += (ty - y) * 0.08;
      para.style.transform = `translate3d(${(x * 10).toFixed(2)}px, ${(y * 10).toFixed(2)}px, 0)`;
      word.style.setProperty('--px', `${(-x * 4).toFixed(2)}px`);
      word.style.setProperty('--py', `${(-y * 4).toFixed(2)}px`);
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.001 ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      kick();
    });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  }

  MC.ready.then(() => {
    MC.data().then((d) => {
      initHero(d);
      const grid = MC.qs('[data-featured]');
      grid.innerHTML = FEATURED.map((id) => d.byId[id]).filter(Boolean).map((p) => MC.card(p)).join('');

      // Візуал коробки: 10 класичних макарон
      const pick = ['kinder', 'pistachio', 'coconut-strawberry', 'salted-caramel', 'lavender-bilberry',
        'mango-passionfruit', 'bounty', 'poppy-raspberry', 'melon-camembert', 'hazelnut-cherry'];
      MC.qs('[data-box-visual]').innerHTML = pick.map((n) =>
        `<span><img src="assets/img/mac-classic-${n}.webp" width="200" height="200" alt="" loading="lazy"></span>`).join('');
    });

    // Міні-калькулятор доставки
    const select = MC.qs('[data-mini-zone]');
    const out = MC.qs('[data-mini-result]');
    select.innerHTML = MC.zones.map((z) => `<option value="${z.id}">${z.label}</option>`).join('');
    select.value = MC.cart.zone() || 'kyiv';
    const render = () => {
      const z = MC.zone(select.value);
      const date = MC.delivery.earliest(z.id);
      out.innerHTML = `
        <div class="calc__row"><span>Вартість доставки</span><strong class="num">${MC.price(z.fee)}</strong></div>
        <div class="calc__row"><span>Безкоштовно</span><strong class="num">від ${MC.price(z.freeFrom)}</strong></div>
        <div class="calc__row"><span>Дні доставки</span><strong>${MC.delivery.daysText(z)}${z.unconfirmed ? ' (уточнюється)' : ''}</strong></div>
        <div class="calc__row"><span>Найближча доставка</span><strong>${MC.delivery.label(date)}, ${MC.cfg.DELIVERY_WINDOW}</strong></div>`;
    };
    select.addEventListener('change', () => { MC.cart.setZone(select.value); render(); });
    render();
  });
})();
