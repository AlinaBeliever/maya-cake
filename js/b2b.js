/* Maya Cake — сторінка «Для кав'ярень»: таблиця цін, калькулятор маржі, заявка */
(function () {
  'use strict';

  MC.ready.then(() => {
    const B2B = MC.cfg.B2B;
    const items = B2B.items;
    const pct = (it) => Math.round(((it.rrp - it.opt) / it.rrp) * 100);

    // Таблиця
    MC.qs('[data-b2b-table] tbody').innerHTML = items.map((it) => `<tr>
      <td>${MC.esc(it.label)}<small>${MC.esc(it.weight)}${it.minNote ? ' · ' + MC.esc(it.minNote) : ''}</small></td>
      <td class="num">${MC.price(it.opt)}</td>
      <td class="num">${MC.price(it.rrp)}</td>
      <td class="num">${MC.price(it.rrp - it.opt)} · ${pct(it)}%</td>
      <td>${MC.esc(it.shelfLife)}</td></tr>`).join('');
    MC.labelTable(MC.qs('[data-b2b-table]'));

    // Дні доставки по містах
    const groups = {};
    MC.zones.forEach((z) => {
      const t = MC.delivery.daysText(z);
      (groups[t] = groups[t] || []).push(z.label);
    });
    // кожна група днів — з нового рядка
    MC.qs('[data-b2b-days]').innerHTML = Object.keys(groups).map((t) => `${MC.esc(groups[t].join(', '))} — ${t}.`).join('<br>');

    // Калькулятор
    const range = MC.qs('[data-range]');
    const days = MC.qs('[data-days]');
    const itemsEl = MC.qs('[data-items]');
    itemsEl.innerHTML = items.map((it, i) => `<label class="radio-card"><input type="radio" name="calc-item" value="${i}"${i ? '' : ' checked'}>
      <span>${MC.esc(it.label)}<small>${MC.price(it.opt)} → ${MC.price(it.rrp)}</small></span></label>`).join('');
    function calc() {
      const it = items[Number(MC.qs('input[name="calc-item"]:checked').value)];
      const n = Number(range.value), dn = Number(days.value);
      const unit = it.rrp - it.opt;
      MC.qs('[data-per-day]').textContent = `${n} шт`;
      MC.qs('[data-income]').textContent = MC.price(unit * n * dn);
      MC.qs('[data-per-unit]').textContent = MC.price(unit);
      MC.qs('[data-percent]').textContent = pct(it) + '%';
      MC.qs('[data-cost]').textContent = MC.price(it.opt * n * dn);
      MC.qs('[data-revenue]').textContent = MC.price(it.rrp * n * dn);
    }
    [range, days, itemsEl].forEach((el) => el.addEventListener('input', calc));
    itemsEl.addEventListener('change', calc);
    calc();

    // Форма заявки
    const form = MC.qs('[data-b2b-form]');
    const alertEl = MC.qs('[data-b2b-alert]');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      alertEl.hidden = true;
      let ok = true;
      ['venue', 'city', 'contact_name'].forEach((n) => {
        const el = form.elements[n];
        const bad = !el.value.trim();
        el.setAttribute('aria-invalid', String(bad));
        if (bad) ok = false;
      });
      const phone = MC.normalizePhone(form.elements.phone.value);
      form.elements.phone.setAttribute('aria-invalid', String(!phone));
      MC.qs('[data-err="phone"]').hidden = !!phone;
      if (!phone) ok = false;
      if (!ok) {
        alertEl.textContent = 'Заповніть, будь ласка, поля з позначкою *';
        alertEl.className = 'form-alert';
        alertEl.hidden = false;
        form.querySelector('[aria-invalid="true"]').focus();
        return;
      }
      const data = {
        _subject: `Заявка B2B: ${form.elements.venue.value.trim()}`,
        venue: form.elements.venue.value.trim(),
        city: form.elements.city.value.trim(),
        contact_name: form.elements.contact_name.value.trim(),
        phone,
        message: form.elements.message.value.trim(),
        _gotcha: form.elements._gotcha.value
      };
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Надсилаємо…';
      MC.sendForm(MC.cfg.FORMSPREE_B2B_ID, data).then((r) => {
        form.hidden = true;
        MC.qs('[data-b2b-success]').hidden = false;
        if (r.demo) {
          MC.qs('[data-b2b-success-text]').innerHTML = `Сайт працює в демо-режимі: форму ще не підключено, тому заявка нікуди не надіслана. Напишіть нам у <a href="${MC.tgUrl()}" target="_blank" rel="noopener">Telegram</a> — і ми надішлемо прайс.`;
        }
      }).catch(() => {
        btn.disabled = false;
        btn.textContent = 'Надіслати заявку';
        alertEl.innerHTML = `Не вдалося надіслати заявку. Спробуйте ще раз або напишіть нам у <a href="${MC.tgUrl()}" target="_blank" rel="noopener">Telegram</a>.`;
        alertEl.className = 'form-alert';
        alertEl.hidden = false;
      });
    });
  });
})();
