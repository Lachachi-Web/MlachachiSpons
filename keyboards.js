// ------------------------------------------------------------------
// 5. لوحات المفاتيح (الأزرار)
// ------------------------------------------------------------------

export const clientKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '📊 إحصائيات الحملات' }, { text: '💰 الرصيد والمصروفات' }],
            [{ text: '🧾 سجل الإيداعات' }, { text: '⚙️ تحكم بالإعلانات' }] 
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

export const adminKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '➕ تسجيل عميل/حملة' }, { text: '💰 إضافة إيداع' }],
            [{ text: '👑 قائمة العملاء' }, { text: '📊 تقرير الاستخدام' }],
            [{ text: 'العودة للقائمة الرئيسية' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};
