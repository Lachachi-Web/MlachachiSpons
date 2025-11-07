import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import express from 'express';
import Database from 'sqlite-async'; 

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
        db = await Database.open('clients.db'); 
        
        // إنشاء جدول Clients
        await db.run(`CREATE TABLE IF NOT EXISTS clients (
            telegram_id TEXT PRIMARY KEY,
            campaign_id TEXT NOT NULL
        )`);
        console.log('✅ تم تهيئة قاعدة البيانات وجدول العملاء بنجاح.');
    } catch (error) {
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

bot.onText(/\/setcampaign/, (msg) => {
    // رسالة مساعدة للأمر
    bot.sendMessage(msg.chat.id, 
        "ℹ️ **لربط عميل بحملة:**\n" +
        "استخدم الصيغة التالية:\n" +
        "`/setcampaign <Campaign ID> <Telegram User ID>`\n" +
        "مثال: `/setcampaign 2385412497890098 12345678`\n" +
        "*(ه
