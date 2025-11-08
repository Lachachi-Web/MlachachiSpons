import TelegramBot from "node-telegram-bot-api";
import express from 'express';
// 🟢 استيراد مكتبة PostgreSQL
import pkg from 'pg';
const { Client } = pkg;

// ------------------------------------------------------------------
// 1. المتغيرات والتهيئة
// ------------------------------------------------------------------
const token = process.env.TELEGRAM_TOKEN; 
const accessToken = process.env.FB_ADS_TOKEN;
const graphUrl = process.env.FB_GRAPH_URL || "https://graph.facebook.com/v20.0";
const adAccountId = process.env.FB_AD_ACCOUNT_ID;

const port = process.env.PORT || 3000;
const externalUrl = process.env.RAILWAY_STATIC_URL; // استخدام متغير Railway

const bot = new TelegramBot(token); 
const app = express();
app.use(express.json()); 

// 👑 تعريف رقم معرف المدير (تم تأكيده: 1621781485)
const ADMIN_ID = '1621781485'; 
const DEFAULT_CURRENCY = 'دج'; // العملة الافتراضية

// ------------------------------------------------------------------
// 2. إعداد قاعدة بيانات PostgreSQL
// ------------------------------------------------------------------
const dbClient = new Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT || 5432, // استخدام PGPORT إذا كان معرّفاً
    ssl: { rejectUnauthorized: false } // ضروري لبعض بيئات الاستضافة مثل Railway
});

// متغير لحالة الاتصال
let isDbConnected = false; 

async function initializeDatabase() {
    try {
        await dbClient.connect();
        isDbConnected = true;
        
        // 1. جدول العملاء والحملات
        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS clients (
                telegram_id TEXT NOT NULL,
                campaign_id TEXT NOT NULL,
                campaign_alias TEXT,
                PRIMARY KEY (telegram_id, campaign_id)
            );
        `);

        // 2. جدول الإيداعات (لحساب الرصيد)
        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS deposits (
                id SERIAL PRIMARY KEY,
                telegram_id TEXT NOT NULL,
                amount NUMERIC NOT NULL,
                deposit_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                currency TEXT DEFAULT '${DEFAULT_CURRENCY}'
            );
        `);

        // 3. جدول سجل النشاط
        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id SERIAL PRIMARY KEY,
                telegram_id TEXT NOT NULL,
                command_used TEXT NOT NULL,
                log_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `); // ⬅️ قوس إغلاق دالة dbClient.query()

        console.log('✅ تم تهيئة قاعدة البيانات والجداول بنجاح.');
    } catch (error) {
        console.error('❌ خطأ في تهيئة قاعدة البيانات:', error.message);
        isDbConnected = false;
    }
} // ⬅️ قوس إغلاق دالة initializeDatabase

// بدء تهيئة قاعدة البيانات
initializeDatabase();

// ------------------------------------------------------------------
// 3. مسجل النشاط
// ------------------------------------------------------------------
async function logActivity(telegramId, command) {
    if (isDbConnected) {
        try {
            await dbClient.query(
                `INSERT INTO activity_log (telegram_id, command_used) VALUES ($1, $2)`,
                [telegramId, command]
            );
        } catch (error) {
            console.error('❌ خطأ في تسجيل النشاط:', error.message);
        }
    }
}

// ------------------------------------------------------------------
// 4. دالة جلب الإحصائيات من Facebook API (للـ Campaign)
// ------------------------------------------------------------------
async function getCampaignInsights(campaignIds, datePreset = 'yesterday') {
    const fields = 'spend,impressions,cpc,ctr,actions,campaign_name,date_start';
    const idsString = campaignIds.join(',');

    const url = `${graphUrl}/insights?fields=${fields}&level=campaign&time_range_preset=${datePreset}&date_preset=${datePreset}&filtering=[{"field":"campaign.id","operator":"IN","value":[${idsString}]}]&access_token=${accessToken}`;

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

        return data.data || []; 
        
    } catch (networkError) {
        console.error("Network or JSON parsing Error:", networkError);
        return { error: true, message: `حدث خطأ شبكة أو تحليل JSON: ${networkError.message}` };
    }
}

// ------------------------------------------------------------------
// 5. لوحات المفاتيح (الأزرار)
// ------------------------------------------------------------------
const clientKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '📊 إحصائيات الحملات' }, { text: '💰 الرصيد والمصروفات' }],
            [{ text: '🧾 سجل الإيداعات' }, { text: '⚙️ تحكم بالإعلانات' }] 
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

const adminKeyboard = {
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

// ------------------------------------------------------------------
// 6. أوامر البوت
// ------------------------------------------------------------------

// أمر /start لتعيين لوحة المفاتيح
bot.onText(/\/start|العودة للقائمة الرئيسية/, (msg) => {
    const chatId = msg.chat.id.toString();
    logActivity(chatId, '/start');
    
    // 🛑 تم تعطيل شرط المدير مؤقتاً للاختبار
    /* if (chatId === ADMIN_ID) {
        return bot.sendMessage(chatId, "👋 مرحباً بك أيها المدير. يمكنك استخدام لوحة التحكم الإدارية أو قائمة العملاء:", adminKeyboard);
    }
    */
    
    // ⬅️ سيتم إرسال لوحة مفاتيح العميل دائماً الآن
    bot.sendMessage(chatId, "👋 أهلاً بك! يرجى اختيار الإجراء المطلوب من القائمة أدناه:", clientKeyboard);
});

// ------------------------------------------------------------------
// 6.1. أوامر العميل (الإحصائيات المجمعة)
// ------------------------------------------------------------------

bot.onText(/📊 إحصائيات الحملات|\/stats/, async (msg) => {
    const chatId = msg.chat.id.toString();
    logActivity(chatId, '/stats');
    
    if (!isDbConnected) {
         return bot.sendMessage(chatId, "❌ نظام قاعدة البيانات غير جاهز حالياً. يرجى المحاولة لاحقاً.");
    }
    
    await bot.sendMessage(chatId, "جارٍ جلب إحصائيات الأمس لجميع حملاتك الإعلانية... 🔄");

    try {
        // 1. جلب كل الـ Campaigns المرتبطة بالعميل
        const clientCampaigns = await dbClient.query(
            `SELECT campaign_id, campaign_alias FROM clients WHERE telegram_id = $1`,
            [chatId]
        );

        if (clientCampaigns.rows.length === 0) {
            return bot.sendMessage(chatId, "⚠️ لم يتم ربطك بأي حملة إعلانية. الرجاء التواصل مع مدير النظام.");
        }

        const campaignIds = clientCampaigns.rows.map(row => row.campaign_id);
        
        // 2. جلب الإحصائيات من فيسبوك
        const insightsData = await getCampaignInsights(campaignIds, 'yesterday');
        
        if (insightsData.error) {
            return bot.sendMessage(chatId, `❌ فشل جلب البيانات:\n ${insightsData.message}`);
        }
        
        // 3. تحليل وتجميع النتائج
        let total
