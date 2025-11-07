import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import express from 'express';

// ------------------------------------------------------------------
// 1. قراءة المتغيرات وإعداد البوت (مع إعداد الحملة يدوياً)
// ------------------------------------------------------------------
const token = process.env.TELEGRAM_TOKEN; 
const accessToken = process.env.FB_ADS_TOKEN;
const graphUrl = process.env.FB_GRAPH_URL;

// 🟢 معلومات العميل الثابتة (للتجربة بدون قاعدة بيانات)
// يرجى التأكد من أن هذا الـ ID هو رقمك في تيليغرام
const FIXED_TELEGRAM_ID = "1621781485"; // تم التأكد من أنه كسلسلة نصية
// يرجى وضع Campaign ID الذي تريد اختباره
const FIXED_CAMPAIGN_ID = "120234222477170687"; 

const port = process.env.PORT || 3000;
const externalUrl = process.env.RENDER_EXTERNAL_URL;

const app = express();
app.use(express.json()); 
const bot = new TelegramBot(token); 

// ❌ تم إزالة: كود تهيئة قاعدة البيانات

// ------------------------------------------------------------------
// 3. دالة جلب الإحصائيات من Facebook API
// ------------------------------------------------------------------
async function getAdInsights(campaignId) {
    const fields = 'spend,impressions,cpc,ctr,actions,campaign_name';
    const url = `${graphUrl}/${campaignId}/insights?fields=${fields}&access_token=${accessToken}&time_range_preset=yesterday`;
    console.log(`DEBUG: Fetching insights for Campaign ID: ${campaignId}`);

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            const errorDetails = data.error.message || 'خطأ غير معروف';
            console.error("Facebook API Error Details:", errorDetails);
            return { 
                error: true, 
                message: `خطأ من فيسبوك: ${errorDetails} (Type: ${data.error.type || 'غير محدد'})`
            };
        }

        if (!data.data || data.data.length === 0) {
             return { error: true, message: "تم الاتصال بنجاح، لكن لا توجد بيانات إعلانات في النطاق الزمني المحدد (الأمس) لهذه الحملة." };
        }
        
        return data; 
        
    } catch (networkError) {
        console.error("Network or JSON parsing Error:", networkError);
        return { error: true, message: `حدث خطأ شبكة أو تحليل JSON: ${networkError.message}` };
    }
}

// ------------------------------------------------------------------
// 4. أوامر البوت (تم تعديلها لتستخدم الثوابت)
// ------------------------------------------------------------------

// أمر إداري لربط العميل بالحملة (تم تبسيطه لعدم وجود DB)
bot.onText(/\/setcampaign/, (msg) => {
    // 🟢 بما أنه لا توجد قاعدة بيانات، فقط نعرض رسالة المساعدة
    bot.sendMessage(msg.chat.id, 
        `
        ℹ️ **وضع الاختبار (Test Mode):**
        
        **لا** توجد قاعدة بيانات متصلة الآن.
        تم تعيين حملة الاختبار التالية تلقائيًا: \`${FIXED_CAMPAIGN_ID}\`
        
        الرجاء استخدام الأمر ** /stats** الآن لاختبار اتصالك بفيسبوك.
        `
        , 
        { parse_mode: "Markdown" }
    );
});


// أمر /stats المعدّل: يجلب الإحصائيات للحملة الثابتة
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    
    // 1. التحقق من تطابق ID العميل مع الـ ID الثابت
    if (chatId.toString() !== FIXED_TELEGRAM_ID) {
        return bot.sendMessage(chatId, "⚠️ أنت غير مُصرح لك في وضع الاختبار. يرجى استخدام حساب الـ ID: " + FIXED_TELEGRAM_ID);
    }
    
    await bot.sendMessage(chatId, "جارٍ جلب إحصائيات حملتك المربوطة... 🔄");
    
    // 2. جلب البيانات باستخدام Campaign ID الثابت
    const insights = await getAdInsights(FIXED_CAMPAIGN_ID);

    if (insights.error) {
        return bot.sendMessage(chatId, `❌ فشل جلب البيانات:\n ${insights.message}`);
    }
    
    // 3. تحليل الرد الناجح
    const stats = insights.data[0];
    const spend = parseFloat(stats.spend || '0').toFixed(2);
    const impressions = stats.impressions || '0';
    const cpc = parseFloat(stats.cpc || '0').toFixed(3);
    const dateStart = stats.date_start;
    const campaignName = stats.campaign_name || "اسم الحملة غير متوفر";


    const reply = `
    📊 **إحصائيات حملتك: ${campaignName}**
    (لليوم السابق: ${dateStart})
    
    💰 **الإنفاق (Spend):** ${spend} €
    👁️ **مرات الظهور (Impressions):** ${impressions}
    💸 **تكلفة النقرة (CPC):** ${cpc} €
    
    **✅ تم تحديث بياناتك بنجاح.**
    `;
    
    bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "👋 أهلاً، هذا هو نظام تحديث إحصائيات حملتك (وضع الاختبار). استخدم الأمر /stats لجلب إحصائيات اليوم السابق.");
});

// ------------------------------------------------------------------
// 5. إعداد الـ Webhook وفتح المنفذ
// ------------------------------------------------------------------
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200); 
});

app.listen(port, () => {
    if (externalUrl) {
        bot.setWebHook(`${externalUrl}/bot${token}`);
    }
    console.log(`✅ البوت شغال ويستمع على المنفذ ${port} والـ Webhook مضبوط.`);
});
