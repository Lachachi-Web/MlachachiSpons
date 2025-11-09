// ------------------------------------------------------------------
// 5. لوحات المفاتيح (الأزرار)
// ------------------------------------------------------------------

// 🎯 لوحة العميل (Client Keyboard)
export const clientKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '📢 Campagnes actives' }, { text: '📊 Statistiques Pro' }],
            [{ text: '💰 Solde et dépenses' }, { text: '🧾 Les versements' }],
            [{ text: '💱 EUR / DZD' }, { text: '📞 Contact direct' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

// 👑 لوحة المدير (Admin Keyboard)
export const adminKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '➕ Enregistrer client/campagne' }, { text: '💰 Ajouter dépôt' }],
            [{ text: '👑 Liste des clients' }, { text: '📊 Journal d’activité' }],
            [{ text: '⬅️ Retour au menu principal' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};