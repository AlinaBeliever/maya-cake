/* Maya Cake — конструктор коробки макарон */
(function () {
  'use strict';

  const CFG = MC.cfg;
  // «Класичний набір» — смаки по порядку, поки не заповниться коробка
  const PRESETS = {
    classic: ['classic-salted-caramel', 'classic-pistachio', 'classic-kinder', 'classic-coconut-strawberry', 'classic-lavender-bilberry',
      'classic-mango-passionfruit', 'classic-bounty', 'classic-poppy-raspberry', 'classic-ferrero', 'classic-lemon-cheesecake'],
    premium: ['premium-dubai-chocolate', 'premium-raffaello', 'premium-caramel-popcorn', 'premium-pistachio',
      'premium-bueno', 'premium-lemon-pie', 'premium-twix', 'premium-oreo']
  };
  const GROUP_LABEL = { p100: 'Преміум', p120: 'Преміум+' };

  const state = { type: 'classic', size: 10, cells: [], gift: false, card: '' };

  MC.ready.then(() => MC.data().then((d) => {
    const q = new URLSearchParams(location.search);
    if (q.get('type') === 'premium') { state.type = 'premium'; state.size = 8; }

    const $ = (s) => MC.qs(s);
    const flavorsEl = $('[data-flavors]');
    const cellsEl = $('[data-cells]');
    $('[data-gift-price]').textContent = MC.price(CFG.GIFT_BOX_PRICE);

    const list = () => d.macarons[state.type];
    const priceOf = (id) => MC.cart.macaronPrice(d.macaronById[id]);

    function renderFlavors() {
      const fl = list();
      const groups = state.type === 'classic' ? [['classic', null]] : [['p100', 'Преміум · ' + MC.price(CFG.MACARON_PRICES.p100)], ['p120', 'Преміум+ · ' + MC.price(CFG.MACARON_PRICES.p120)]];
      flavorsEl.innerHTML = groups.map(([g, title]) => {
        const items = fl.filter((m) => (g === 'classic' ? true : m.group === g));
        return (title ? `<h2 class="flavor-group">${title}</h2>` : `<h2 class="flavor-group">22 смаки · ${MC.price(CFG.MACARON_PRICES.classic)} за шт</h2>`) +
          `<div class="flavors">${items.map((m) => `
            <button class="flavor" type="button" data-flavor="${m.id}" aria-label="Додати смак ${MC.esc(m.name)}">
              <img src="assets/img/${m.image}.webp" width="200" height="200" alt="" loading="lazy">
              <span>${MC.esc(m.name)}</span>
              <span class="price">${MC.price(priceOf(m.id))}</span>
            </button>`).join('')}</div>`;
      }).join('');
      // Смак без фото й ціни (є лише в таблиці складу) — показуємо як «скоро»
      const soon = fl.filter((m) => m.unavailable);
      if (soon.length) {
        flavorsEl.insertAdjacentHTML('beforeend', `<p class="soft-note">Скоро: ${soon.map((m) => MC.esc(m.name)).join(', ')} — уточнюйте наявність у <a href="${MC.tgUrl()}" target="_blank" rel="noopener">Telegram</a>.</p>`);
      }
    }

    function renderSizes() {
      $('[data-sizes]').innerHTML = CFG.MACARON_BOXES[state.type].map((n) =>
        `<button class="chip" type="button" data-size="${n}" aria-pressed="${n === state.size}">${n} шт</button>`).join('');
      MC.qsa('[data-type] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.type)));
    }

    function total() {
      if (state.cells.some((c) => !c)) return state.cells.filter(Boolean).reduce((s, id) => s + priceOf(id), 0) + (state.gift ? CFG.GIFT_BOX_PRICE : 0);
      return MC.cart.boxPrice({ flavors: state.cells, gift: state.gift }, d);
    }

    function renderTray(popIndex) {
      cellsEl.className = 'tray__cells' + (state.size % 5 === 0 ? '' : ' cols-4');
      cellsEl.innerHTML = state.cells.map((id, i) => {
        if (!id) return `<span class="cell" aria-label="Порожня комірка ${i + 1}"></span>`;
        const m = d.macaronById[id];
        return `<button class="cell is-filled${i === popIndex ? ' is-pop' : ''}" type="button" data-cell="${i}" aria-label="Прибрати ${MC.esc(m.name)}"><img src="assets/img/${m.image}.webp" width="200" height="200" alt=""></button>`;
      }).join('');
      const filled = state.cells.filter(Boolean).length;
      const full = filled === state.size;
      $('[data-count]').textContent = `${filled} з ${state.size}`;
      // Підсумок смаків: «Фісташка ×2, Кіндер»
      const counts = {};
      state.cells.filter(Boolean).forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
      $('[data-list]').textContent = Object.keys(counts).map((id) => d.macaronById[id].name + (counts[id] > 1 ? ` ×${counts[id]}` : '')).join(', ');
      const sum = MC.price(total());
      $('[data-total]').textContent = sum;
      $('[data-bar-total]').textContent = sum;
      $('[data-bar-count]').textContent = full ? 'Коробка заповнена' : `Заповнено ${filled} з ${state.size}`;
      $('[data-hint]').textContent = full ? 'Коробка готова — можна додавати' : `Додайте ще ${state.size - filled} ${MC.plural(state.size - filled, 'смак', 'смаки', 'смаків')}`;
      MC.qsa('[data-add]').forEach((b) => { b.disabled = !full; });
      // Лічильник на смаках
      MC.qsa('[data-flavor]').forEach((b) => {
        const n = counts[b.dataset.flavor] || 0;
        let badge = b.querySelector('.flavor__n');
        if (n && !badge) { badge = document.createElement('span'); badge.className = 'flavor__n'; b.appendChild(badge); }
        if (badge) { if (n) badge.textContent = n; else badge.remove(); }
      });
    }

    function reset(keep) {
      const old = keep ? state.cells.filter(Boolean) : [];
      state.cells = Array.from({ length: state.size }, (_, i) => old[i] || null);
    }

    function fill(ids) {
      state.cells = Array.from({ length: state.size }, (_, i) => ids[i % ids.length]);
      renderTray();
    }

    // Події
    $('[data-type]').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.dataset.v === state.type) return;
      state.type = b.dataset.v;
      state.size = CFG.MACARON_BOXES[state.type][1];
      reset(false);
      renderSizes(); renderFlavors(); renderTray();
      history.replaceState(null, '', state.type === 'premium' ? '?type=premium' : location.pathname);
    });
    $('[data-sizes]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-size]');
      if (!b) return;
      state.size = Number(b.dataset.size);
      reset(true);
      renderSizes(); renderTray();
    });
    flavorsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-flavor]');
      if (!b) return;
      const i = state.cells.indexOf(null);
      if (i === -1) {
        $('[data-hint]').textContent = 'Коробка вже заповнена — торкніться комірки, щоб замінити смак';
        return;
      }
      state.cells[i] = b.dataset.flavor;
      renderTray(i);
    });
    cellsEl.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cell]');
      if (!c) return;
      state.cells[Number(c.dataset.cell)] = null;
      renderTray();
    });
    MC.qsa('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.preset;
      if (v === 'clear') { reset(false); renderTray(); return; }
      if (v === 'set') { fill(PRESETS[state.type]); return; }
      const pool = list().filter((m) => !m.unavailable).map((m) => m.id);
      fill(Array.from({ length: state.size }, () => pool[Math.floor(Math.random() * pool.length)]));
    }));
    $('[data-gift]').addEventListener('change', (e) => { state.gift = e.target.checked; renderTray(); });
    const card = $('[data-card]');
    card.addEventListener('input', () => {
      state.card = card.value;
      const left = 150 - card.value.length;
      $('[data-card-left]').textContent = `${left} ${MC.plural(left, 'символ', 'символи', 'символів')}`;
    });
    MC.qsa('[data-add]').forEach((btn) => btn.addEventListener('click', () => {
      if (state.cells.some((c) => !c)) return;
      const product = d.byId[state.type === 'classic' ? 'macaron-box-classic' : 'macaron-box-premium'];
      const label = `${state.size} шт` + (state.gift ? ' · подарункова коробка' : '');
      const counts = {};
      state.cells.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
      MC.cart.add(product, {
        box: { type: state.type, size: state.size, flavors: state.cells.slice(), gift: state.gift },
        price: total(),
        variantLabel: label,
        flavorNames: Object.keys(counts).map((id) => d.macaronById[id].name + (state.type === 'premium' ? ` (${GROUP_LABEL[d.macaronById[id].group]})` : '') + (counts[id] > 1 ? ` ×${counts[id]}` : '')),
        card: state.card.trim() || undefined,
        source: btn
      });
      reset(false);
      card.value = ''; state.card = '';
      renderTray();
    }));

    reset(false);
    renderSizes(); renderFlavors(); renderTray();
  }));
})();
