// ------------------------------------------------------------------
// لوحة العميل (Client Keyboard) — Français seulement
// ------------------------------------------------------------------

export const clientKeyboard = {
  reply_markup: {
    keyboard: [
      [
        { text: '📢 Active Compa' },
        { text: '📊 Statistiques' }
      ],
      [
        { text: '💰 Paiements' },
        { text: '🧾 Versements' }
      ],
      [
        { text: '💱 EUR / DZD' },
        { text: '📞 Contact' }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};
