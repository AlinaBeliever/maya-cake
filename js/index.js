/* Maya Cake — головна сторінка: «Радимо спробувати», коробка макарон, міні-калькулятор доставки */
(function () {
  'use strict';

  // Добірка на головній. Порядок можна змінити — це id з data/products.json
  const FEATURED = [
    'cake-raspberry-mango', 'mousse-cherry-profiteroles', 'roll-raspberry', 'tart-plum-orange',
    'eclair-classic', 'honey-cake-caramel', 'layers-snickers', 'pavlova-orange-passionfruit'
  ];

  MC.ready.then(() => {
    MC.data().then((d) => {
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
