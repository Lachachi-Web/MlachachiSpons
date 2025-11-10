import TelegramBot from "node-telegram-bot-api";
import express from "express";
import pkg from "pg";
const { Client } = pkg;

// استيراد الملفات الأخرى
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
// الإعداد العام
// ------------------------------------------------------------------
const token = process.env.TELEGRAM_TOKEN;
const port = process.env.PORT || 3000;
const externalUrl = process.env.RAILWAY_STATIC_URL;
const ADMIN_ID = "1621781485";
const DEFAULT_CURRENCY = "DZD";

// ------------------------------------------------------------------
// إعداد Express
// ------------------------------------------------------------------
const app = express();
app.use(express.json());

// نقطة اختبار لتأكيد أن السيرفر حي
app.get("/", (req, res) => {
  res.status(200).send("✅ Bot is running and reachable");
});

// ------------------------------------------------------------------
// إعداد البوت وقاعدة البيانات
// ------------------------------------------------------------------
const bot = new TelegramBot(token);
const dbClient = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT || 5432,
  ssl: { rejectUnauthorized: false }
});

let isDbConnected = false;

async function initDatabase() {
  try {
    await dbClient.connect();
    isDbConnected = true;
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS eur_rate (
        id SERIAL PRIMARY KEY,
        rate NUMERIC NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Database ready");
  } catch (err) {
    console.error("❌ Database error:", err.message);
  }
}
initDatabase();

// ------------------------------------------------------------------
// Webhook Handler
// ------------------------------------------------------------------
app.post(`/bot${token}`, async (req, res) => {
  try {
    console.log("📩 Update reçu de Telegram:", req.body);
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook handler error:", err.message);
    res.sendStatus(500);
  }
});

// ------------------------------------------------------------------
// تفعيل Webhook عند تشغيل السيرفر
// ------------------------------------------------------------------
app.listen(port, async () => {
  try {
    const webhookUrl = `https://${externalUrl}/bot${token}`;
    await bot.setWebHook(webhookUrl);
    console.log(`✅ Webhook configuré: ${webhookUrl}`);
  } catch (err) {
    console.error("❌ Webhook setup failed:", err.message);
  }
  console.log(`✅ Bot listening on port ${port}`);
});

// ------------------------------------------------------------------
// أوامر البوت
// ------------------------------------------------------------------
bot.onText(/\/ping/, (msg) => {
  bot.sendMessage(msg.chat.id, "✅ Le bot fonctionne correctement !");
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id.toString();
  if (chatId === ADMIN_ID) {
    bot.sendMessage(chatId, "👑 Bonjour Admin", adminKeyboard);
  } else {
    bot.sendMessage(chatId, "👋 Bienvenue !", clientKeyboard);
  }
});

// ------------------------------------------------------------------
// وظائف المستخدمين
// ------------------------------------------------------------------
bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = (msg.text || "").trim();

  switch (text) {
    case "📢 Active Compa":
      return activeCampaigns(bot, chatId, dbClient);
    case "📊 Statistiques":
      return statisticsFeature(bot, chatId, dbClient, DEFAULT_CURRENCY);
    case "💰 Paiements":
      return paymentsFeature(bot, chatId, dbClient, DEFAULT_CURRENCY);
    case "🧾 Versements":
      return versementsFeature(bot, chatId, dbClient, DEFAULT_CURRENCY);
    case "💱 EUR / DZD":
      return eurDzdFeature(bot, chatId, dbClient);
    case "📞 Contact":
      return contactFeature(bot, chatId);
  }
});
