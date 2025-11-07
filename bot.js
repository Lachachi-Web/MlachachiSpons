import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import express from 'express'; // استيراد Express

// ------------------------------------------------------------------
// 1. قراءة المتغيرات من بيئة Render (Environment Variables)
// ------------------------------------------------------------------
const token = process.env.TELEGRAM_TOKEN; 
const accountId = process.env.AD_ACCOUNT_ID;
const accessToken = process.env.FB_ADS_TOKEN;
const graphUrl = process.env.FB_GRAPH_URL;

// المتغيرات الخاصة بالـ Webhook والاستماع
const port = process.env.PORT || 3000;
const externalUrl = process.env.RENDER_EXTERNAL_URL;

const app = express();
app.use(express.json()); 

// البوت بدون Polling، لأنه سيستقبل التحديثات عبر الـ Webhook
const bot = new TelegramBot(token); 

// ------------------------------------------------------------------
// 2. دالة جلب الإحصائيات من Facebook API
// ------------------------------------------------------------------
async function getAdInsights() {
    // نطلب الإحصائيات لآخر يومين
    const timeRange = '{"since":"yesterday","until":"yesterday"}';
    const fields = 'spend,impressions,cpc,ctr,actions';
    
    // بناء رابط الـ API
    const url = `${graphUrl}/act_${accountId}/insights?fields=${fields}&access_token=${accessToken}&time_range=${timeRange}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching Facebook data:", error);
        return { error: true, message: "حدث خطأ في الاتصال بالـ API." };
    }
}

// ------------------------------------------------------------------
// 3. أوامر البوت
// ------------------------------------------------------------------

// أمر /stats ليجلب البيانات ويختبر الربط
bot.onText(/\/stats/, async (msg) => {
    
    await bot.sendMessage(msg.chat.id, "جارٍ جلب إحصائيات حملاتك... 🔄");
    
    const insights = await getAdInsights();

    if (insights.error || !insights.data || insights.data.length === 0) {
        return bot.sendMessage(msg.chat.id, `❌ فشل جلب البيانات: ${insights.message || 'يرجى التأكد من التوكن والمعرف.'}`);
    }
    
    // بيانات أولية من الرد 
    const stats = insights.data[0];
    const spend = parseFloat(stats.spend || '0').toFixed(2);
    const impressions = stats.impressions || '0';
    const cpc = parseFloat(stats.cpc || '0').toFixed(3);
    const dateStart = stats.date_start;

    const reply = `
    📊 **إحصائيات الأمس (${dateStart})**:
    
    💰 **الإنفاق (Spend):** ${spend} €
    👁️ **مرات الظهور (Impressions):** ${impressions}
    💸 **تكلفة النقرة (CPC):** ${cpc} €
    
    **✅ تم جلب البيانات بنجاح من Facebook API**
    `;
    
    bot.sendMessage(msg.chat.id, reply, { parse_mode: "Markdown" });
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "👋 أهلاً محمد، البوت جاهز. جرّب الآن أمر /stats ");
});

// ------------------------------------------------------------------
// 4. إعداد الـ Webhook وفتح المنفذ (لحظة حل المشكلة!)
// ------------------------------------------------------------------

// استقبال تحديثات تيليغرام على الرابط المحدد
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200); // الرد السريع ضروري لتيليغرام
});

// تشغيل الاستماع على المنفذ (يحل مشكلة Port scan timeout)
app.listen(port, () => {
    // إعداد الـ Webhook لتيليغرام ليستخدم الرابط الخارجي لـ Render
    if (externalUrl) {
        bot.setWebHook(`${externalUrl}/bot${token}`);
    }
    console.log(`✅ البوت شغال ويستمع على المنفذ ${port} والـ Webhook مضبوط.`);
});
