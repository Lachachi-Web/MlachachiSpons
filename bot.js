import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";

// ... (باقي المتغيرات، لا تغيرها)
const token = process.env.TELEGRAM_TOKEN; 
const accountId = process.env.AD_ACCOUNT_ID;
const accessToken = process.env.FB_ADS_TOKEN;
const graphUrl = process.env.FB_GRAPH_URL;

// المتغيرات الجديدة الخاصة بالـ Webhook
const port = process.env.PORT || 3000; // المنفذ الذي سيستمع إليه البوت
const host = '0.0.0.0'; 
const externalUrl = process.env.RENDER_EXTERNAL_URL; // رابط Render.com

// 🛑 التغيير الأهم هنا: Webhook بدلاً من Polling
const bot = new TelegramBot(token); // نحذف { polling: true }

// ... (نترك دالة getAdInsights كما هي)

// أمر مؤقت لاختبار جلب البيانات
bot.onText(/\/stats/, async (msg) => {
    // ... (نترك الكود كما هو لجلب البيانات وتنسيقها وإرسال الرد)
});


// 🚀 إعداد الـ Webhook (يجب أن يتم في نهاية الملف)
if (externalUrl) {
  bot.setWebHook(`${externalUrl}/bot${token}`);
}

bot.listen(port, host, () => {
  console.log(`✅ البوت شغال ويستمع على المنفذ ${port}`);
});
