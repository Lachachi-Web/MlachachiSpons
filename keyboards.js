// ------------------------------------------------------------------
// 5. لوحات المفاتيح (الأزرار)
// ------------------------------------------------------------------

export const clientKeyboard = {
  reply_markup: {
    keyboard: [
      [
        { text: "📢 الحملات النشطة | Campagnes actives" },
        { text: "📊 إحصائيات متقدمة | Statistiques Pro" }
      ],
      [
        { text: "💰 الرصيد والمصروفات | Solde et dépenses" },
        { text: "🧾 سجل الإيداعات | Les versements" }
      ],
      [
        { text: "💱 سعر اليورو | EUR / DZD" },
        { text: "📞 اتصل مباشرة | Contact direct" }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

export const adminKeyboard = {
  reply_markup: {
    keyboard: [
      [
        { text: "➕ تسجيل عميل/حملة" },
        { text: "💰 إضافة إيداع" }
      ],
      [
        { text: "👑 قائمة العملاء" },
        { text: "📊 تقرير الاستخدام" }
      ],
      [
        { text: "العودة للقائمة الرئيسية" }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};