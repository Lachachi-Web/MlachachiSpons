// ------------------------------------------------------------------
// لوحة العميل (Client Keyboard) — عربي / Français
// ------------------------------------------------------------------

export const clientKeyboard = {
  reply_markup: {
    keyboard: [
      [
        { text: '📢 الحملات النشطة | Campagnes actives' },
        { text: '📊 إحصائيات متقدمة | Statistiques Pro' }
      ],
      [
        { text: '💰 الرصيد والمصروفات | Solde et dépenses' },
        { text: '🧾 سجل الإيداعات | Les versements' }
      ],
      [
        { text: '💱 سعر اليورو | EUR / DZD' },
        { text: '🔄 تحديث البيانات | Actualiser les données' }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};
