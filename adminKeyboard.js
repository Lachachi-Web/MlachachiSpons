// ------------------------------------------------------------------
// لوحة الأدمن (Admin Keyboard) — عربي / Français
// ------------------------------------------------------------------

export const adminKeyboard = {
  reply_markup: {
    keyboard: [
      [
        { text: '➕ تسجيل عميل / حملة | Enregistrer un client / campagne' },
        { text: '💰 إضافة إيداع | Ajouter un dépôt' }
      ],
      [
        { text: '👑 قائمة العملاء | Liste des clients' },
        { text: '📊 تقرير الاستخدام | Rapport d’utilisation' }
      ],
      [
        { text: '⚙️ إعدادات النظام | Paramètres du système' },
        { text: '🔙 العودة للقائمة الرئيسية | Retour au menu principal' }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};
