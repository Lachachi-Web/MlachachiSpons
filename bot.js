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
        `);

        console.log('✅ تم تهيئة قاعدة البيانات والجداول بنجاح.');
    } catch (error) {
        console.error('❌ خطأ في تهيئة قاعدة البيانات:', error.message);
        isDbConnected = false;
    }
} // ⬅️ نهاية دالة initializeDatabase

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
        
        if (data.error)
