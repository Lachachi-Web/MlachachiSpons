import TelegramBot from "node-telegram-bot-api";
import express from "express";
import pkg from "pg";
const { Client } = pkg;

// 🟢 استيراد الملفات الخارجية
import { clientKeyboard } from "./clientKeyboard.js";
import { adminKeyboard } from "./adminKeyboard.js";
import {
  contactFeature,
  activeCampaigns,
  statisticsFeature,
  paymentsFeature,
  versementsFeature,
  eurDzdFeature
} from "./customFeatures.js";
import { setEurRate } from "./adminFeatures.js";

// ------------------------------------------------------------------
// 1️⃣ إعداد المتغيرات العامة
// ------------------------------------------------------------------
const token = process.env.TELEGRAM_TOKEN;
const accessToken = process.env.FB_ADS_TOKEN;
const graphUrl = process.env.FB_GRAPH_URL || "https://graph.facebook.com/v20.0";
const adAccountId = process.env.FB_AD_ACCOUNT_ID;

// ✅ المنفذ الصحيح المتوافق مع Railway
const port = process.env.PORT || 3000;

// ✅ عنوان التطبيق في Railway
const externalUrl = process.env.RAILWAY_STATIC_URL;
const DEFAULT_CURRENCY = "DZD";
const ADMIN_ID = "1621781485";

const bot = new TelegramBot(token);
const app = express();
app.use(express.json());

// ------------------------------------------------------------------
// 2️⃣ إعداد قاعدة البيانات PostgreSQL
// ------------------------------------------------------------------
const dbClient = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT || 5432,
  ssl: { rejectUnauthorized: false },
});

let isDbConnected = false;

async function initializeDatabase() {
  try {
    await dbClient.connect();
    isDbConnected = true;

    // 🧱 إنشاء الجداول الأساسية
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS clients (
        telegram_id TEXT NOT NULL,
        campaign_id TEXT NOT NULL,
        campaign_alias TEXT,
        PRIMARY KEY (telegram_id, campaign_id)
      );
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS deposits (
        id SERIAL PRIMARY KEY,
        telegram_id TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        deposit_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        currency TEXT DEFAULT '${DEFAULT_CURRENCY}'
      );
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        telegram_id TEXT NOT NULL,
        command_used TEXT NOT NULL,
        log_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS eur_rate (
        id SERIAL PRIMARY KEY,
        rate NUMERIC NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Base de données initialisée avec succès.");
  } catch (error) {
    console.error("❌ Erreur base de données:", error.message);
    isDbConnected = false;
  }
}
initializeDatabase();

// ------------------------------------------------------------------
// 3️⃣ دوال مساعدة
// ------------------------------------------------------------------
async function logActivity(telegramId, command) {
  if (isDbConnected) {
    try {
      await dbClient.query(
        `INSERT INTO activity_log (telegram_id, command_used) VALUES ($1, $2)`,
        [telegramId, command]
      );
    } catch (error) {
      console.error("❌ Erreur logActivity:", error.message);
    }
  }
}

function matchBtn(text, label) {
  return text?.trim().toLowerCase() === label.trim().toLowerCase();
}

// ------------------------------------------------------------------
// 4️⃣ أوامر البداية /start
// ------------------------------------------------------------------
bot.onText(/\/start|Retour au menu principal/, (msg) => {
  const chatId = msg.chat.id.toString();
  logActivity(chatId, "/start");

  if (chatId === ADMIN_ID) {
    bot.sendMessage(chatId, "👑 Bonjour admin, voici votre panneau de contrôle :", adminKeyboard);
  } else {
    bot.sendMessage(chatId, "👋 Bienvenue ! Veuillez choisir une option :", clientKeyboard);
  }
});

// ------------------------------------------------------------------
// 5️⃣ أوامر الأدمن
// ------------------------------------------------------------------
bot.onText(/\/seteur (.+)/, (msg) => {
  const chatId = msg.chat.id.toString();
  if (chatId !== ADMIN_ID) {
    return bot.sendMessage(chatId, "❌ Commande réservée à l'administrateur.");
  }
  setEurRate(bot, chatId, msg.text, dbClient);
});

// ------------------------------------------------------------------
// 6️⃣ وظائف العميل
// ------------------------------------------------------------------
bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text || "";

  if (matchBtn(text, "📢 Active Compa")) activeCampaigns(bot, chatId, dbClient);
  if (matchBtn(text, "📊 Statistiques")) statisticsFeature(bot, chatId, dbClient, DEFAULT_CURRENCY);
  if (matchBtn(text, "💰 Paiements")) paymentsFeature(bot, chatId, dbClient, DEFAULT_CURRENCY);
  if (matchBtn(text, "🧾 Versements")) versementsFeature(bot, chatId, dbClient, DEFAULT_CURRENCY);
  if (matchBtn(text, "💱 EUR / DZD")) eurDzdFeature(bot, chatId, dbClient);
  if (matchBtn(text, "📞 Contact")) contactFeature(bot, chatId);
});

// ------------------------------------------------------------------
// 7️⃣ Webhook الخاص بـ Railway
// ------------------------------------------------------------------
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(port, () => {
  if (externalUrl) {
    // ✅ تأكد من وجود https:// في الرابط
    const cleanUrl = externalUrl.startsWith("https://")
      ? externalUrl
      : `https://${externalUrl}`;

    bot
      .setWebHook(`${cleanUrl}/bot${token}`)
      .then(() =>
        console.log(`✅ Webhook configuré avec succès: ${cleanUrl}/bot${token}`)
      )
      .catch((err) => console.error("❌ Erreur Webhook:", err.message));
  }

  console.log(`✅ Bot actif sur le port ${port}`);
});
