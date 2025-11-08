import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
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

// 👑 تعريف رقم معرف المدير (تم تأكيده: 1621781485import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
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

// 👑 تعريف رقم معرف المدير (غيّره إلى رقمك الخاص)
const ADMIN_ID = '1621781485'; // ⬅️ **غيّر هذا الرقم إلى رقم Telegram ID الخاص بك (مُحاط بعلامتي اقتباس)**
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
        `);

        console.log('✅ تم تهيئة قاعدة البيانات والجداول بنجاح.');
    } catch (error) {
        console.error('❌ خطأ في تهيئة قاعدة البيانات:', error.message);
        isDbConnected = false;
    }
}

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

// أمر /start لتعيين لوحة المفاتيح (تم التأكد من صحة الدالة)
bot.onText(/\/start|العودة للقائمة الرئيسية/, (msg) => {
    const chatId = msg.chat.id.toString();
    logActivity(chatId, '/start');
    
    if (chatId === ADMIN_ID) {
        return bot.sendMessage(chatId, "👋 مرحباً بك أيها المدير. يمكنك استخدام لوحة التحكم الإدارية أو قائمة العملاء:", adminKeyboard);
    }
    
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
        let totalSpend = 0;
        let totalActions = 0;
        let replyParts = [];

        insightsData.forEach(stats => {
            const spend = parseFloat(stats.spend || '0');
            const impressions = stats.impressions || '0';
            // البحث عن المبيعات (نفرض أن نوع الأكشن هو 'purchase')
            const actions = stats.actions ? (stats.actions.find(a => a.action_type === 'offsite_conversion.fb_pixel_purchase') || { value: 0 }).value : 0;
            const cpc = parseFloat(stats.cpc || '0').toFixed(3);
            const dateStart = stats.date_start;
            // استخدام campaign_alias أو campaign_name
            const campaignName = clientCampaigns.rows.find(r => r.campaign_id === stats.campaign_id)?.campaign_alias || stats.campaign_name || "اسم الحملة غير متوفر";

            totalSpend += spend;
            totalActions += parseInt(actions);
            
            replyParts.push(`
            *#${campaignName}*
            💰 الإنفاق: ${spend.toFixed(2)} ${DEFAULT_CURRENCY}
            👁️ الظهور: ${impressions}
            💸 تكلفة النقرة: ${cpc} ${DEFAULT_CURRENCY}
            🛒 المبيعات: ${actions || '0'}
            `);
        });

        const avgCPA = totalActions > 0 ? (totalSpend / totalActions).toFixed(2) : 'N/A';
        
        let finalReply = `
        📊 **تقرير الأداء الموحد (الأمس: ${insightsData[0]?.date_start || 'N/A'})**
        ---
        **ملخص الأداء:**
        💵 **إجمالي الإنفاق:** ${totalSpend.toFixed(2)} ${DEFAULT_CURRENCY}
        🛍️ **إجمالي المبيعات:** ${totalActions}
        🎯 **متوسط تكلفة المبيعة (CPA):** ${avgCPA} ${DEFAULT_CURRENCY}
        ---
        **إحصائيات الحملات الإعلانية:**
        ${replyParts.join('\n')}
        `;
        
        bot.sendMessage(chatId, finalReply, { parse_mode: "Markdown" });
        
    } catch (error) {
        console.error("Error in /stats:", error);
        bot.sendMessage(chatId, `❌ حدث خطأ غير متوقع أثناء جلب البيانات: ${error.message}`);
    }
});

// ------------------------------------------------------------------
// 6.2. أوامر العميل (الرصيد والإيداعات)
// ------------------------------------------------------------------

// جلب الرصيد والمصروفات (الكود كما هو)
bot.onText(/💰 الرصيد والمصروفات|\/balance/, async (msg) => {
    const chatId = msg.chat.id.toString();
    logActivity(chatId, '/balance');
    
    if (!isDbConnected) {
         return bot.sendMessage(chatId, "❌ نظام قاعدة البيانات غير جاهز حالياً.");
    }
    
    // 1. حساب إجمالي الودائع
    const depositResult = await dbClient.query(
        `SELECT SUM(amount) AS total_deposit FROM deposits WHERE telegram_id = $1`,
        [chatId]
    );
    const totalDeposit = parseFloat(depositResult.rows[0].total_deposit || '0');
    
    // 2. حساب إجمالي الإنفاق (للتجربة، مؤقتًا صفر)
    let totalSpend = 0; // ⬅️ **سيتم تحديث هذا لاحقًا ليصبح تراكميًا**

    const remainingBalance = totalDeposit - totalSpend;
    
    // تحديد الحالة اللونية
    let statusEmoji, statusText;
    const lowThreshold = totalDeposit * 0.20; // 20% كحد أمان
    const criticalThreshold = totalDeposit * 0.05; // 5% كحد حرج

    if (remainingBalance <= criticalThreshold || remainingBalance < 0) {
        statusEmoji = '🔴';
        statusText = ' (خطر! يرجى الإيداع فوراً)';
    } else if (remainingBalance <= lowThreshold) {
        statusEmoji = '🟠';
        statusText = ' (تنبيه: الرصيد بدأ ينفد)';
    } else {
        statusEmoji = '✅';
        statusText = ' (الرصيد آمن)';
    }

    const reply = `
    💳 **تقرير الرصيد:**
    
    💵 **إجمالي الودائع:** ${totalDeposit.toFixed(2)} ${DEFAULT_CURRENCY}
    💸 **إجمالي المصروفات:** ${totalSpend.toFixed(2)} ${DEFAULT_CURRENCY}
    ---
    💰 **الرصيد المتبقي:** ${statusEmoji} ${remainingBalance.toFixed(2)} ${DEFAULT_CURRENCY} ${statusText}
    
    *لمعرفة تفاصيل الإيداعات، اضغط على زر "سجل الإيداعات".*
    `;
    
    bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
});

// سجل الإيداعات (الكود كما هو)
bot.onText(/🧾 سجل الإيداعات|\/deposits_history/, async (msg) => {
    const chatId = msg.chat.id.toString();
    logActivity(chatId, '/deposits_history');
    
    if (!isDbConnected) {
         return bot.sendMessage(chatId, "❌ نظام قاعدة البيانات غير جاهز.");
    }

    const depositResult = await dbClient.query(
        `SELECT amount, deposit_date, currency FROM deposits WHERE telegram_id = $1 ORDER BY deposit_date DESC`,
        [chatId]
    );
    
    if (depositResult.rows.length === 0) {
        return bot.sendMessage(chatId, "⚠️ لا توجد إيداعات مسجلة في نظامك حتى الآن.");
    }
    
    let replyParts = ["🧾 **سجل الإيداعات الخاص بك:**\n"];
    let totalDeposit = 0;
    
    depositResult.rows.forEach(row => {
        const date = new Date(row.deposit_date).toLocaleDateString('ar-DZ'); // تنسيق التاريخ
        replyParts.push(`*بتاريخ ${date}:* 💰 ${parseFloat(row.amount).toFixed(2)} ${row.currency}`);
        totalDeposit += parseFloat(row.amount);
    });

    replyParts.push("---");
    replyParts.push(`**الإجمالي الكلي للودائع:** ${totalDeposit.toFixed(2)} ${DEFAULT_CURRENCY}`);
    
    bot.sendMessage(chatId, replyParts.join('\n'), { parse_mode: "Markdown" });
});


// ------------------------------------------------------------------
// 6.3. أوامر المدير (الإدارة)
// ------------------------------------------------------------------

// الوصول إلى لوحة تحكم المدير (الكود كما هو)
bot.onText(/👑 قائمة العملاء|\/admin_menu/, (msg) => {
    const chatId = msg.chat.id.toString();
    if (chatId !== ADMIN_ID) {
        return bot.sendMessage(chatId, "❌ هذا الأمر مخصص للمدير فقط.");
    }
    logActivity(chatId, '/admin_menu');
    bot.sendMessage(chatId, "لوحة تحكم المدير:", adminKeyboard);
});

// تسجيل عميل وحملة (تم التعديل إلى Campaign ID)
bot.onText(/➕ تسجيل عميل\/حملة|\/register (.+) (.+) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id.toString();
    if (chatId !== ADMIN_ID) return;
    
    // تم تغيير اسم المتغيرات من Ad Set إلى Campaign
    const [targetTelegramId, campaignId, alias] = match ? [match[1], match[2], match[3]] : [];

    if (!match) {
        return bot.sendMessage(chatId, `
        ℹ️ **لتسجيل عميل بحملة (Campaign ID):**
        استخدم الصيغة: \`/register <Telegram ID> <Campaign ID> <Alias>\`
        
        مثال: \`/register 12345678 238541...98 حملة_رمضان\`
        `);
    }

    try {
        // تم تغيير اسم الحقول في الاستعلام
        await dbClient.query(
            `INSERT INTO clients (telegram_id, campaign_id, campaign_alias) VALUES ($1, $2, $3) ON CONFLICT (telegram_id, campaign_id) DO UPDATE SET campaign_alias = $3`,
            [targetTelegramId, campaignId, alias]
        );
        
        bot.sendMessage(chatId, `✅ تم ربط العميل ID (${targetTelegramId}) بـ Campaign ID:\n*${campaignId}*\nباسم مستعار: *${alias}*`, { parse_mode: "Markdown" });
        
    } catch (error) {
        console.error("Error registering client:", error);
        bot.sendMessage(chatId, `❌ فشل في تسجيل الحملة: ${error.message}`);
    }
});

// إضافة إيداع للعميل (الكود كما هو)
bot.onText(/💰 إضافة إيداع|\/deposit (.+) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id.toString();
    if (chatId !== ADMIN_ID) return;

    const [targetTelegramId, amount] = match ? [match[1], match[2]] : [];

    if (!match || isNaN(parseFloat(amount))) {
        return bot.sendMessage(chatId, `
        ℹ️ **لإضافة إيداع لعميل:**
        استخدم الصيغة: \`/deposit <Telegram ID> <المبلغ>\`
        
        مثال: \`/deposit 12345678 60000\`
        `);
    }

    try {
        await dbClient.query(
            `INSERT INTO deposits (telegram_id, amount, currency) VALUES ($1, $2, $3)`,
            [targetTelegramId, parseFloat(amount), DEFAULT_CURRENCY]
        );
        
        bot.sendMessage(chatId, `✅ تم إضافة إيداع ${amount} ${DEFAULT_CURRENCY} بنجاح للعميل ID: *${targetTelegramId}*`, { parse_mode: "Markdown" });
        
    } catch (error) {
        console.error("Error adding deposit:", error);
        bot.sendMessage(chatId, `❌ فشل في تسجيل الإيداع: ${error.message}`);
    }
});


// ------------------------------------------------------------------
// 7. إعداد الـ Webhook وفتح المنفذ
// ------------------------------------------------------------------
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200); 
});

app.listen(port, () => {
    if (externalUrl) {
        // استخدام متغير Railway لضبط الـ Webhook
        bot.setWebHook(`${externalUrl}/bot${token}`);
    }
    console.log(`✅ البوت شغال ويستمع على المنفذ ${port} والـ Webhook مضبوط.`);
});

// ⬅️ هذا القوس يغلق دالة initializeDatabase
// تم وضعه هنا لضمان الاكتمال
}

