/*
 * Maya Cake — налаштування сайту.
 * Тут змінюються контакти, зони доставки, дедлайн, ціни коробок макарон і оптові ціни.
 * Позначка «УТОЧНИТИ» — дані, які треба підтвердити у власниці.
 * Дні тижня: 0 — неділя, 1 — понеділок, … 6 — субота.
 */
window.MC_CONFIG = {
  // --- Контакти ---
  PHONE: '+380634102625',
  PHONE_LABEL: '+380 63 410 26 25',
  INSTAGRAM: 'maya.cake.kyiv',
  TELEGRAM_USERNAME: 'Maya_Cake_Kyiv',
  INSTAGRAM_FOLLOWERS: '13 тис.',

  // --- Formspree (див. README, розділ «Як підключити Formspree») ---
  FORMSPREE_ID: 'ВСТАВ_ID',       // форма замовлень
  FORMSPREE_B2B_ID: 'ВСТАВ_ID',   // форма заявок від кав'ярень (можна ту саму)

  // --- Дедлайн і доставка ---
  CUTOFF_HOUR: 14,                // замовлення до 14:00 → доставка наступного дня
  DELIVERY_WINDOW: '10:00–18:00',
  TIMEZONE: 'Europe/Kyiv',
  // Свята й вихідні цеху у форматі 'РРРР-ММ-ДД'. УТОЧНИТИ у власниці
  CLOSED_DATES: [],

  ZONES: [
    { id: 'kyiv',          label: 'Київ',          fee: 150, freeFrom: 800,  days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'irpin',         label: 'Ірпінь',        fee: 200, freeFrom: 1500, days: [1, 2, 3, 4, 5] },
    { id: 'bucha',         label: 'Буча',          fee: 200, freeFrom: 1500, days: [1, 2, 3, 4, 5] },
    { id: 'pushcha',       label: 'Пуща-Водиця',   fee: 200, freeFrom: 1500, days: [1, 2, 3, 4, 5] },
    { id: 'hostomel',      label: 'Гостомель',     fee: 200, freeFrom: 1500, days: [1, 2, 3, 4, 5] },
    { id: 'horenka',       label: 'Горенка',       fee: 200, freeFrom: 1500, days: [1, 2, 3, 4, 5] },
    { id: 'lisnyky',       label: 'Лісники',       fee: 200, freeFrom: 1500, days: [1, 2, 3, 4, 5] },
    { id: 'vyshhorod',     label: 'Вишгород',      fee: 200, freeFrom: 1500, days: [3, 0] },
    { id: 'boryspil',      label: 'Бориспіль',     fee: 200, freeFrom: 1500, days: [2, 4, 6] },
    // УТОЧНИТИ: дні доставки для цих міст у даних не вказані, тимчасово пн–сб
    { id: 'vyshneve',      label: 'Вишневе',       fee: 200, freeFrom: 1500, days: [1, 2, 3, 4, 5, 6], unconfirmed: true },
    { id: 'brovary',       label: 'Бровари',       fee: 200, freeFrom: 1500, days: [1, 2, 3, 4, 5, 6], unconfirmed: true },
    { id: 'kriukivshchyna', label: 'Крюківщина',   fee: 200, freeFrom: 1500, days: [1, 2, 3, 4, 5, 6], unconfirmed: true },
    { id: 'kotsiubynske',  label: 'Коцюбинське',   fee: 200, freeFrom: 1500, days: [1, 2, 3, 4, 5, 6], unconfirmed: true }
  ],

  // --- Коробки макарон ---
  // УТОЧНИТИ — роздрібні ціни макарон можуть бути застарілими
  // (класичні в роздробі 55 грн, а в опті 60 грн)
  MACARON_PRICES: { classic: 55, p100: 100, p120: 120 },
  MACARON_BOXES: {
    classic: [5, 10],
    premium: [4, 8]
  },
  GIFT_BOX_PRICE: 45,             // подарункова коробка (для макарон і горішків)

  // --- Опт для кав'ярень (від 10 шт) ---
  B2B: {
    minQty: 10,
    items: [
      { id: 'mac-classic', label: 'Макарон класичні (22 смаки)', opt: 60, rrp: 80, weight: '50 г', shelfLife: '4 доби' },
      { id: 'mac-p100', label: 'Макарон преміум (7 смаків)', opt: 100, rrp: 110, weight: '40–55 г', shelfLife: '4 доби' },
      { id: 'mac-p120', label: 'Макарон преміум+ (7 смаків)', opt: 120, rrp: 125, weight: '50–55 г', shelfLife: '4 доби' },
      { id: 'peach-cream', label: 'Тістечко персик', opt: 70, rrp: 95, weight: '65–70 г', shelfLife: '72 год', minQty: 3, minNote: 'від 3 шт одного виду' }
    ]
  },

  // --- Кошик ---
  MAX_QTY: 20,                    // більше — пропонуємо написати в Telegram
  CART_KEY: 'mayacake_cart_v1',
  ZONE_KEY: 'mayacake_zone_v1'
};
