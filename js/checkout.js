/*
 * Maya Cake — оформлення замовлення.
 * Замовлення надсилається через Formspree (ID у js/config.js).
 * Якщо ID ще не вставлено — сайт працює в демо-режимі: замовлення
 * показується на сторінці «Дякуємо», і його можна надіслати в Telegram.
 */
(function () {
  'use strict';

  const CFG = MC.cfg;
  const LAST_KEY = 'mayacake_last_order_v1';
  let selectedDate = null;

  function orderId() {
    const n = MC.kyivNow();
    const dd = String(n.d).padStart(2, '0'), mm = String(n.m).padStart(2, '0');
    return `MC-${dd}${mm}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  MC.ready.then(() => {
    const form = MC.qs('[data-form]');
    const empty = MC.qs('[data-empty]');
    const alertEl = MC.qs('[data-alert]');
    const zoneSel = MC.qs('[data-zone]');
    const datesEl = MC.qs('[data-dates]');

    zoneSel.innerHTML = '<option value="">Оберіть місто</option>' + MC.zones.map((z) => `<option value="${z.id}">${z.label}</option>`).join('');
    zoneSel.value = MC.cart.zone() || '';

    function toggleEmpty() {
      const has = MC.cart.count() > 0;
      form.hidden = !has;
      empty.hidden = has;
    }

    function renderDates() {
      const zid = zoneSel.value;
      if (!zid) {
        datesEl.innerHTML = '<span class="muted" style="font-size:14px">Спершу оберіть місто</span>';
        MC.qs('[data-date-hint]').textContent = '';
        selectedDate = null;
        return;
      }
      const dates = MC.delivery.dates(zid, 7);
      if (!selectedDate || !dates.some((d) => MC.delivery.iso(d) === selectedDate)) selectedDate = MC.delivery.iso(dates[0]);
      datesEl.innerHTML = dates.map((d) => {
        const s = MC.delivery.short(d), v = MC.delivery.iso(d);
        return `<label class="date-chip"><input type="radio" name="date" value="${v}"${v === selectedDate ? ' checked' : ''}>
          <span>${s.wd}<strong>${s.day}</strong>${s.month}</span></label>`;
      }).join('');
      const z = MC.zone(zid);
      MC.qs('[data-date-hint]').textContent = `Доставка в місто ${z.label}: ${MC.delivery.daysText(z)}.` + (z.unconfirmed ? ' Дні для цього міста уточнюються.' : '');
    }

    function renderSummary() {
      const items = MC.cart.items();
      const sub = MC.cart.subtotal();
      const z = MC.zone(zoneSel.value);
      const fee = z ? MC.delivery.fee(z, sub) : null;
      const n = MC.cart.count();
      MC.qs('[data-toggle-label]').textContent = `Ваше замовлення · ${n} ${MC.plural(n, 'товар', 'товари', 'товарів')}`;
      MC.qs('[data-items]').innerHTML = items.map((it) => {
        const img = it.image ? `<img src="${it.imageSingle ? `assets/img/${it.image}.webp` : MC.img(it.image, 400)}" alt="" width="56" height="70"${it.imageSingle ? ' style="object-fit:contain;padding:4px"' : ''}>` : '<span class="ph"><span>фото</span></span>';
        return `<div class="cart-item">
          <div class="cart-item__img">${img}</div>
          <div><span class="cart-item__name">${MC.esc(it.name)}</span>
            ${it.variantLabel ? `<div class="cart-item__variant">${MC.esc(it.variantLabel)}</div>` : ''}
            ${it.flavorNames ? `<div class="cart-item__flavors">${MC.esc(it.flavorNames.join(', '))}</div>` : ''}
            <span class="qty-label">${it.qty} × ${MC.price(it.price)}</span></div>
          <div class="cart-item__side"><span class="cart-item__sum price">${MC.price(it.qty * it.price)}</span></div>
        </div>`;
      }).join('');
      let feeText = 'оберіть місто';
      if (z) feeText = fee ? MC.price(fee) : 'безкоштовно';
      const hint = z && fee ? `<div class="muted" style="font-size:13px">Ще ${MC.price(z.freeFrom - sub)} — і доставка безкоштовна</div>` : '';
      MC.qs('[data-totals]').innerHTML = `
        <div><span>Товари</span><span class="price">${MC.price(sub)}</span></div>
        <div><span>Доставка${z ? ' · ' + z.label : ''}</span><span class="price">${feeText}</span></div>${hint}
        <div class="grand"><span>Разом</span><span>${MC.price(sub + (fee || 0))}</span></div>`;
    }

    // Текст замовлення: для листа і для Telegram
    function orderText(o) {
      const lines = [`Замовлення ${o.id} — Maya Cake`, ''];
      o.items.forEach((it) => {
        lines.push(`• ${it.name}${it.variantLabel ? ' (' + it.variantLabel + ')' : ''} — ${it.qty} × ${it.price} грн = ${it.qty * it.price} грн`);
        if (it.flavorNames) lines.push(`   смаки: ${it.flavorNames.join(', ')}`);
        if (it.card) lines.push(`   листівка в коробці: «${it.card}»`);
      });
      lines.push('', `Товари: ${o.subtotal} грн`, `Доставка: ${o.fee ? o.fee + ' грн' : 'безкоштовно'}`, `Разом: ${o.total} грн`, '');
      lines.push(`Доставка: ${o.zoneLabel}, ${o.address}`, `Дата: ${o.dateLabel}, ${CFG.DELIVERY_WINDOW}`);
      if (o.timeWish) lines.push(`Побажання щодо часу: ${o.timeWish}`);
      lines.push(`Замовник: ${o.name}, ${o.phone}${o.email ? ', ' + o.email : ''}`);
      if (o.gift) {
        lines.push(`Подарунок для: ${o.gift.name}, ${o.gift.phone}`);
        if (o.gift.hidePrice) lines.push('Не показувати ціну в чеку');
        if (o.gift.card) lines.push(`Листівка: «${o.gift.card}»`);
      }
      if (o.comment) lines.push(`Коментар: ${o.comment}`);
      return lines.join('\n');
    }

    function fail(msg, field) {
      alertEl.innerHTML = msg;
      alertEl.className = 'form-alert';
      alertEl.hidden = false;
      (field || alertEl).focus();
      if (!field) alertEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    // Події
    zoneSel.addEventListener('change', () => { MC.cart.setZone(zoneSel.value); renderDates(); renderSummary(); });
    datesEl.addEventListener('change', (e) => { if (e.target.name === 'date') selectedDate = e.target.value; });
    MC.qs('[data-gift]').addEventListener('change', (e) => MC.qs('[data-gift-fields]').classList.toggle('is-open', e.target.checked));
    MC.qs('[data-toggle]').addEventListener('click', (e) => {
      const b = e.currentTarget;
      const open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      MC.qs('[data-items]').hidden = !open;
    });
    document.addEventListener('cart:updated', () => { toggleEmpty(); renderSummary(); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      alertEl.hidden = true;
      const f = form.elements;
      const req = ['name', 'address'];
      req.forEach((n) => f[n].setAttribute('aria-invalid', String(!f[n].value.trim())));
      const phone = MC.normalizePhone(f.phone.value);
      f.phone.setAttribute('aria-invalid', String(!phone));
      MC.qs('[data-err="phone"]').hidden = !!phone;
      zoneSel.setAttribute('aria-invalid', String(!zoneSel.value));
      const isGift = MC.qs('[data-gift]').checked;
      let gPhone = null;
      if (isGift) {
        f.recipient_name.setAttribute('aria-invalid', String(!f.recipient_name.value.trim()));
        gPhone = MC.normalizePhone(f.recipient_phone.value);
        f.recipient_phone.setAttribute('aria-invalid', String(!gPhone));
        MC.qs('[data-err="g-phone"]').hidden = !!gPhone;
      }
      const bad = form.querySelector('[aria-invalid="true"]');
      if (bad) { fail('Заповніть, будь ласка, поля з позначкою *', bad); return; }

      // Перевіряємо дату ще раз: вкладка могла бути відкрита з ранку
      const valid = MC.delivery.dates(zoneSel.value, 7).map(MC.delivery.iso);
      if (!valid.includes(selectedDate)) {
        const old = selectedDate;
        selectedDate = valid[0];
        renderDates();
        fail(`Поки ви оформлювали, минув час прийому замовлень${old ? ' на ' + MC.delivery.long(MC.delivery.fromIso(old)) : ''}. Ми обрали найближчу дату — ${MC.delivery.long(MC.delivery.fromIso(selectedDate))}. Перевірте й підтвердьте ще раз.`);
        return;
      }

      const z = MC.zone(zoneSel.value);
      const sub = MC.cart.subtotal();
      const fee = MC.delivery.fee(z, sub);
      const order = {
        id: orderId(),
        items: MC.cart.items(),
        subtotal: sub, fee, total: sub + fee,
        zone: z.id, zoneLabel: z.label,
        address: f.address.value.trim(),
        date: selectedDate,
        dateLabel: MC.delivery.long(MC.delivery.fromIso(selectedDate)),
        timeWish: f.time_wish.value.trim(),
        name: f.name.value.trim(), phone, email: f.email.value.trim(),
        gift: isGift ? { name: f.recipient_name.value.trim(), phone: gPhone, hidePrice: f.hide_price.checked, card: f.card_text.value.trim() } : null,
        comment: f.comment.value.trim()
      };
      order.text = orderText(order);

      const btn = MC.qs('[data-submit]');
      btn.disabled = true;
      btn.textContent = 'Надсилаємо…';
      MC.sendForm(CFG.FORMSPREE_ID, {
        _subject: `Нове замовлення ${order.id} — ${order.total} грн`,
        _replyto: order.email || undefined,
        email: order.email || undefined,
        order_id: order.id,
        order: order.text,
        total: order.total,
        zone: order.zoneLabel,
        delivery_date: order.date,
        name: order.name,
        phone: order.phone,
        _gotcha: f._gotcha.value
      }).then((r) => {
        order.demo = !!r.demo;
        try { localStorage.setItem(LAST_KEY, JSON.stringify(order)); } catch (err) { /* ignore */ }
        MC.cart.clear();
        location.href = 'thanks.html';
      }).catch(() => {
        btn.disabled = false;
        btn.textContent = 'Підтвердити замовлення';
        fail(`Не вдалося надіслати замовлення — перевірте інтернет і спробуйте ще раз. Або <a href="${MC.tgUrl()}" target="_blank" rel="noopener">напишіть нам у Telegram</a>.`);
      });
    });

    toggleEmpty();
    renderDates();
    renderSummary();
    // Дата могла «застаріти», поки сторінка відкрита
    setInterval(() => { if (!form.hidden) renderDates(); }, 60000);
  });
})();
