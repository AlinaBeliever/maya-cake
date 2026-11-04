/* Maya Cake — головна сторінка: «Радимо спробувати», коробка макарон, міні-калькулятор доставки */
(function () {
  'use strict';

  // Добірка на головній. Порядок можна змінити — це id з data/products.json
  const FEATURED = [
    'red-velvet', 'napoleon', 'tube-condensed-milk', 'tart-lemon',
    'tart-caramel-almond', 'peach-condensed-milk', 'potato-caramel', 'trifle-honey'
  ];

  // Instagram: автогортання кожні 2 с, пауза, коли людина гортає сама або наводить мишку
  function initInsta() {
    const root = MC.qs('[data-insta]');
    if (!root) return;
    const track = MC.qs('[data-insta-track]', root);
    const step = () => track.querySelector('.insta__slide').getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
    const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    const go = (dir) => {
      if (dir > 0 && atEnd()) track.scrollTo({ left: 0, behavior: 'smooth' });
      else if (dir < 0 && track.scrollLeft <= 4) track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' });
      else track.scrollBy({ left: dir * step(), behavior: 'smooth' });
    };
    let paused = 0;
    const pause = (ms) => { paused = Date.now() + ms; };
    MC.qs('[data-insta-prev]', root).addEventListener('click', () => { pause(6000); go(-1); });
    MC.qs('[data-insta-next]', root).addEventListener('click', () => { pause(6000); go(1); });
    ['pointerdown', 'touchstart', 'wheel'].forEach((ev) => track.addEventListener(ev, () => pause(6000), { passive: true }));
    root.addEventListener('mouseenter', () => { paused = Infinity; });
    root.addEventListener('mouseleave', () => { paused = 0; });
    if (!MC.motionOn()) return;   // «зменшити рух» — без автогортання
    let visible = false;
    if ('IntersectionObserver' in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(root);
    setInterval(() => { if (visible && Date.now() > paused && !document.hidden) go(1); }, 2000);
  }

  MC.ready.then(() => {
    initInsta();
    MC.data().then((d) => {
      const grid = MC.qs('[data-featured]');
      grid.innerHTML = FEATURED.map((id) => d.byId[id]).filter(Boolean).map((p) => MC.card(p, { noBadges: true })).join('');

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
