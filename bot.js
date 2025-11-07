import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import express from 'express';
// 🟢 التصحيح الأخير: نعود إلى صيغة import Default مع اسم مستعار
import sqlite from 'sqlite-async'; 

// ------------------------------------------------------------------
// 1. قراءة المتغيرات وإعداد البوت
// ------------------------------------------------------------------
const token = process.env.TELEGRAM_TOKEN; 
const accessToken = process.env.FB_ADS_TOKEN;
const graphUrl = process.env.FB_GRAPH_URL;

const port = process.env.PORT || 3000;
const externalUrl = process.env.RENDER_EXTERNAL_URL;

const app = express();
app.use(express.json()); 
const bot = new TelegramBot(token); 

let db; 

// ------------------------------------------------------------------
// 2. تهيئة قاعدة البيانات وإنشاء الجداول
// ------------------------------------------------------------------
async function initializeDatabase() {
    try {
        // 🟢 استخدام الدالة open مباشرة من الكائن المستورد (sqlite)
        db = await sqlite.open('clients.db'); 
        
        // إنشاء جدول Clients
        await db.run(`CREATE TABLE IF NOT EXISTS clients (
            telegram_id TEXT PRIMARY KEY,
            campaign_id TEXT NOT NULL
        )`);
        console.log('✅ تم تهيئة قاعدة البيانات وجدول العملاء بنجاح.');
    } catch (error) {
        // هذا قد يحدث إذا كان هناك خطأ في الاتصال بالقرص الصلب/الذاكرة في Render
        console.error('❌ خطأ في تهيئة قاعدة البيانات:', error.message);
    }
}

// البدء بتهيئة قاعدة البيانات فور تشغيل السيرفر
initializeDatabase();

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
// 4. أوامر البوت
// ------------------------------------------------------------------

// أمر إداري لربط العميل بالحملة
bot.onText(/\/setcampaign (.+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const campaignId = match[1].trim(); 
    const targetTelegramId = match[2]; 

    if (!db) {
         return bot.sendMessage(chatId, "❌ لم يتم إعداد قاعدة البيانات بعد. يرجى الانتظار 30 ثانية والمحاولة.");
    }

    try {
        // تخزين الرابط في قاعدة البيانات
        await db.run(
            `INSERT OR REPLACE INTO clients (telegram_id, campaign_id) VALUES (?, ?)`,
            [targetTelegramId, campaignId]
        );
        
        bot.sendMessage(chatId, `✅ تم ربط حساب تلغرام (${targetTelegramId}) بنجاح مع حملة فيسبوك ID: \n*${campaignId}*`, { parse_mode: "Markdown" });
        
    } catch (error) {
        console.error("Error setting campaign:", error);
        bot.sendMessage(chatId, `❌ فشل في تسجيل الحملة في قاعدة البيانات: ${error.message}`);
    }
});

// الأمر المساعد
bot.onText(/\/setcampaign/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        `
        ℹ️ **لربط عميل بحملة (لك كمدير):**
        
        استخدم الصيغة التالية:
        \` /setcampaign <Campaign ID> <Telegram User ID>\`
        
        مثال: \`/setcampaign 2385412497890098 12345678\`
        `
        , 
        { parse_mode: "Markdown" }
    );
});


// أمر /stats المعدّل: يجلب الإحصائيات للحملة المسجلة للعميل
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!db) {
         return bot.sendMessage(chatId, "❌ نظام العملاء غير جاهز بعد. يرجى الانتظار.");
    }
    
    // 1. البحث عن Campaign ID في قاعدة البيانات
    const client = await db.get(`SELECT campaign_id FROM clients WHERE telegram_id = ?`, [chatId]);

    if (!client) {
        return bot.sendMessage(chatId, "⚠️ لم يتم ربطك بأي حملة إعلانية. الرجاء التواصل مع مدير النظام لتسجيل حملتك أولاً.");
    }
    
    await bot.sendMessage(chatId, "جارٍ جلب إحصائيات حملتك المربوطة... 🔄");
    
    // 2. جلب البيانات باستخدام Campaign ID
    const insights = await getAdInsights(client.campaign_id);

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
  bot.sendMessage(msg.chat.id, "👋 أهلاً، هذا هو نظام تحديث إحصائيات حملتك. استخدم الأمر /stats لجلب إحصائيات اليوم السابق.");
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
