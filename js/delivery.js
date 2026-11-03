/* Maya Cake — сторінка доставки: таблиця зон і повний калькулятор */
(function () {
  'use strict';

  MC.ready.then(() => {
    const zones = MC.zones;
    MC.qs('[data-zones]').innerHTML = zones.map((z) => `<tr>
      <td>${z.label}</td><td>${MC.delivery.daysText(z)}${z.unconfirmed ? '*' : ''}</td>
      <td class="num">${MC.price(z.fee)}</td><td class="num">від ${MC.price(z.freeFrom)}</td></tr>`).join('');
    const unc = zones.filter((z) => z.unconfirmed).map((z) => z.label);
    MC.qs('[data-unconfirmed]').textContent = unc.length ? `* ${unc.join(', ')} — дні доставки уточнюються, напишіть нам перед замовленням.` : '';
    MC.qs('[data-pits]').textContent = MC.NOTE_PITS;
    MC.qs('[data-tg]').href = MC.tgUrl();

    const sel = MC.qs('[data-zone]');
    const sum = MC.qs('[data-sum]');
    sel.innerHTML = zones.map((z) => `<option value="${z.id}">${z.label}</option>`).join('');
    sel.value = MC.cart.zone() || 'kyiv';
    sum.value = MC.cart.subtotal() || '';
    MC.qs('[data-sum-hint]').textContent = MC.cart.subtotal() ? 'Підставили суму з вашого кошика' : '';

    function render() {
      const z = MC.zone(sel.value);
      const s = Math.max(0, Number(sum.value) || 0);
      const fee = MC.delivery.fee(z, s);
      const left = z.freeFrom - s;
      MC.qs('[data-result]').innerHTML = `
        <div class="calc__row"><span>Доставка</span><strong class="num">${fee ? MC.price(fee) : 'безкоштовно'}</strong></div>
        <div class="calc__row"><span>До безкоштовної</span><strong class="num">${left > 0 ? 'ще ' + MC.price(left) : 'досягнуто'}</strong></div>
        <div class="progress${left <= 0 ? ' is-done' : ''}" style="margin:-4px 0 14px"><span style="width:${Math.min(s / z.freeFrom, 1) * 100}%"></span></div>
        <div class="calc__row"><span>Дні доставки</span><strong>${MC.delivery.daysText(z)}${z.unconfirmed ? ' (уточнюється)' : ''}</strong></div>`;
      MC.qs('[data-dates]').innerHTML = MC.delivery.dates(z.id, 6).map((d) => {
        const s2 = MC.delivery.short(d);
        return `<li>${s2.wd}, ${s2.day} ${s2.month}</li>`;
      }).join('');
    }
    sel.addEventListener('change', () => { MC.cart.setZone(sel.value); render(); });
    sum.addEventListener('input', render);
    render();
  });
})();
