/*
 * Maya Cake — каталог: категорії, фільтри, сортування.
 * Стан фільтрів зберігається в адресі сторінки (?cat=cakes&nonuts=1),
 * тож посиланням на добірку можна поділитися.
 */
(function () {
  'use strict';

  const FILTERS = [
    { key: 'nonuts', label: 'Без горіхів', test: (p) => p.allergens && p.allergens.length && !p.allergens.includes('nuts') && !p.allergens.includes('peanuts') },
    { key: 'nogluten', label: 'Без пшеничного борошна', test: (p) => p.allergens && p.allergens.length && !p.allergens.includes('gluten') },
    { key: 'gift', label: 'Подарунок', test: (p) => (p.tags || []).includes('gift') },
    { key: 'new', label: 'Новинки', test: (p) => (p.tags || []).includes('new') },
    { key: 'p500', label: 'До 500 грн', test: (p) => { const pi = MC.priceInfo(p); return pi && pi.value <= 500; } },
    { key: 'p1000', label: '500–1000 грн', test: (p) => { const pi = MC.priceInfo(p); return pi && pi.value > 500 && pi.value <= 1000; } },
    { key: 'p1000plus', label: 'Від 1000 грн', test: (p) => { const pi = MC.priceInfo(p); return pi && pi.value > 1000; } }
  ];
  const PRICE_KEYS = ['p500', 'p1000', 'p1000plus'];

  const state = { cat: '', sort: 'popular', on: new Set() };

  function readUrl() {
    const q = new URLSearchParams(location.search);
    state.cat = q.get('cat') || '';
    state.sort = q.get('sort') || 'popular';
    state.on = new Set(FILTERS.filter((f) => q.get(f.key) === '1').map((f) => f.key));
  }
  function writeUrl() {
    const q = new URLSearchParams();
    if (state.cat) q.set('cat', state.cat);
    state.on.forEach((k) => q.set(k, '1'));
    if (state.sort !== 'popular') q.set('sort', state.sort);
    const s = q.toString();
    history.replaceState(null, '', s ? '?' + s : location.pathname);
  }

  MC.ready.then(() => MC.data().then((d) => {
    readUrl();
    const chips = MC.qs('[data-chips]');
    const filters = MC.qs('[data-filters]');
    const grid = MC.qs('[data-grid]');
    const sort = MC.qs('[data-sort]');
    const count = MC.qs('[data-count]');
    const empty = MC.qs('[data-empty]');

    const countIn = (id) => d.products.filter((p) => !id || p.category === id).length;
    chips.innerHTML = [{ id: '', label: 'Усе' }].concat(d.categories).map((c) =>
      `<button class="chip" type="button" data-cat="${c.id}">${c.label} <small>${countIn(c.id)}</small></button>`).join('');
    filters.innerHTML = FILTERS.map((f) => `<button class="chip" type="button" data-filter="${f.key}" aria-pressed="false">${f.label}</button>`).join('');

    function render() {
      chips.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.cat)));
      filters.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(state.on.has(b.dataset.filter))));
      sort.value = state.sort;

      const cat = d.categories.find((c) => c.id === state.cat);
      MC.qs('[data-cat-title]').textContent = cat ? cat.label : 'Каталог';
      document.title = (cat ? cat.label + ' — ' : 'Каталог десертів — ') + 'Maya Cake';

      let list = d.products.filter((p) => !state.cat || p.category === state.cat);
      FILTERS.forEach((f) => { if (state.on.has(f.key)) list = list.filter(f.test); });
      if (state.sort !== 'popular') {
        const val = (p) => { const pi = MC.priceInfo(p); return pi ? pi.value : null; };
        list = list.slice().sort((a, b) => {
          const va = val(a), vb = val(b);
          if (va == null) return 1;   // «ціну уточнюйте» — у кінці
          if (vb == null) return -1;
          return state.sort === 'asc' ? va - vb : vb - va;
        });
      }
      grid.innerHTML = list.map((p, i) => MC.card(p, { eager: i < 4 })).join('');
      grid.hidden = !list.length;
      empty.hidden = !!list.length;
      count.textContent = list.length
        ? `${list.length} ${MC.plural(list.length, 'позиція', 'позиції', 'позицій')}`
        : '';
      writeUrl();
    }

    chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      state.cat = b.dataset.cat;
      render();
    });
    filters.addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      const k = b.dataset.filter;
      if (state.on.has(k)) state.on.delete(k);
      else {
        // ціновий діапазон — лише один одночасно
        if (PRICE_KEYS.includes(k)) PRICE_KEYS.forEach((x) => state.on.delete(x));
        state.on.add(k);
      }
      render();
    });
    sort.addEventListener('change', () => { state.sort = sort.value; render(); });
    MC.qs('[data-reset]').addEventListener('click', () => { state.on.clear(); state.cat = ''; state.sort = 'popular'; render(); });

    render();
    const active = chips.querySelector('[aria-pressed="true"]');
    if (active && state.cat) active.scrollIntoView({ inline: 'center', block: 'nearest' });
  }));
})();
