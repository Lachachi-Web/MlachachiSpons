import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import express from 'express';

// ------------------------------------------------------------------
// 1. قراءة المتغيرات من بيئة Render
// ------------------------------------------------------------------
const token = process.env.TELEGRAM_TOKEN; 
const accountId = process.env.AD_ACCOUNT_ID; // يجب أن يحتوي على act_
const accessToken = process.env.FB_ADS_TOKEN;
const graphUrl = process.env.FB_GRAPH_URL; // https://graph.facebook.com/v20.0

// المتغيرات الخاصة بالـ Webhook والاستماع
const port = process.env.PORT || 3000;
const externalUrl = process.env.RENDER_EXTERNAL_URL;

const app = express();
app.use(express.json()); 

const bot = new TelegramBot(token); 

// ------------------------------------------------------------------
// 2. دالة جلب الإحصائيات من Facebook API (المصححة)
// ------------------------------------------------------------------
async function getAdInsights() {
    const fields = 'spend,impressions,cpc,ctr,actions';
    
    // *****************************************************************
    // التصحيح: استخدام time_range_preset بدلاً من time_range
    // *****************************************************************
    const url = `${graphUrl}/${accountId}/insights?fields=${fields}&access_token=${accessToken}&time_range_preset=yesterday`;

    // ********* DEBUGGING STEP: طبع الرابط في سجلات Render *********
    console.log(`DEBUG: Constructed URL is: ${url}`);
    // *************************************************************

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            // خطأ تم إرجاعه من فيسبوك API
            const errorDetails = data.error.message || 'خطأ غير معروف';
            console.error("Facebook API Error Details:", errorDetails);
            return { 
                error: true, 
                message: `خطأ من فيسبوك: ${errorDetails} (Type: ${data.error.type || 'غير محدد'})`
            };
        }

        // إذا كان الرد ناجحاً لكن مصفوفة البيانات فارغة
        if (!data.data || data.data.length === 0) {
             return { error: true, message: "تم الاتصال بنجاح، لكن لا توجد بيانات إعلانات في النطاق الزمني المحدد (الأمس)." };
        }
        
        return data; 
        
    } catch (networkError) {
        // خطأ في الاتصال بالشبكة أو في تحليل JSON
        console.error("Network or JSON parsing Error:", networkError);
        return { error: true, message: `حدث خطأ شبكة أو تحليل JSON: ${networkError.message}` };
    }
}

// ------------------------------------------------------------------
// 3. أمر /stats
// ------------------------------------------------------------------
bot.onText(/\/stats/, async (msg) => {
    
    await bot.sendMessage(msg.chat.id, "جارٍ جلب إحصائيات حملاتك... 🔄");
    
    const insights = await getAdInsights();

    // التحقق من وجود أي خطأ (شبكة أو فيسبوك)
    if (insights.error) {
        // إظهار رسالة الخطأ الدقيقة للمستخدم
        return bot.sendMessage(msg.chat.id, `❌ فشل جلب البيانات:\n ${insights.message}`);
    }
    
    // ... (من هنا يتم تحليل الرد الناجح)
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
// 4. إعداد الـ Webhook وفتح المنفذ
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

