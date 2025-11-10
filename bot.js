import TelegramBot from "node-telegram-bot-api";
import express from "express";
import pkg from "pg";
const { Client } = pkg;

// keyboards
import { clientKeyboard } from "./clientKeyboard.js";
import { adminKeyboard } from "./adminKeyboard.js";

// features
import {
  contactFeature,
  activeCampaigns,
  statisticsFeature,
  paymentsFeature,
  versementsFeature,
  eurDzdFeature
} from "./customFeatures.js";
import { setEurRate } from "./adminFeatures.js";

// ======================================================
// 🔹 الإعدادات الأساسية
// ======================================================
const token = process.env.TELEGRAM_TOKEN;
const port = process.env.PORT || 3000;
const externalUrl = process.env.RAILWAY_STATIC_URL;

const ADMIN_ID = "1621781485";
const DEFAULT_CURRENCY = "DZD";

const bot = new TelegramBot(token);
const app = express();
app.use(express.json());

// ======================================================
// 🔹 إعداد قاعدة البيانات
// ======================================================
const dbClient = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT || 5432,
  ssl: { rejectUnauthorized: false },
});

let isDbConnected = false;
async function initDB() {
  try {
    await dbClient.connect();
    isDbConnected = true;
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS eur_rate (
        id SERIAL PRIMARY KEY,
        rate NUMERIC NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Base de données initialisée avec succès.");
  } catch (err) {
    console.error("❌ Erreur connexion DB:", err.message);
  }
}
initDB();

// ======================================================
// 🔹 اختبار بسيط للتأكد من عمل البوت
// ======================================================
bot.onText(/\/ping/, (msg) => {
  bot.sendMessage(msg.chat.id, "✅ Le bot fonctionne correctement !");
});

// ======================================================
// 🔹 أوامر البدء
// ======================================================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id.toString();
  if (chatId === ADMIN_ID) {
    bot.sendMessage(chatId, "👑 Bonjour admin :", adminKeyboard);
  } else {
    bot.sendMessage(chatId, "👋 Bienvenue :", clientKeyboard);
  }
});

// ======================================================
// 🔹 أوامر الأدمن
// ======================================================
bot.onText(/\/seteur (.+)/, (msg) => {
  const chatId = msg.chat.id.toString();
  if (chatId !== ADMIN_ID)
    return bot.sendMessage(chatId, "❌ Accès refusé.");
  setEurRate(bot, chatId, msg.text, dbClient);
});

// ======================================================
// 🔹 أوامر العميل
// ======================================================
function matchBtn(text, label) {
  return text?.trim().toLowerCase() === label.trim().toLowerCase();
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text || "";

  if (matchBtn(text, "📢 Active Compa")) activeCampaigns(bot, chatId, dbClient);
  else if (matchBtn(text, "📊 Statistiques"))
    statisticsFeature(bot, chatId, dbClient, DEFAULT_CURRENCY);
  else if (matchBtn(text, "💰 Paiements"))
    paymentsFeature(bot, chatId, dbClient, DEFAULT_CURRENCY);
  else if (matchBtn(text, "🧾 Versements"))
    versementsFeature(bot, chatId, dbClient, DEFAULT_CURRENCY);
  else if (matchBtn(text, "💱 EUR / DZD"))
    eurDzdFeature(bot, chatId, dbClient);
  else if (matchBtn(text, "📞 Contact"))
    contactFeature(bot, chatId);
});

// ======================================================
// 🔹 إعداد Webhook لـ Railway
// ======================================================
app.post(`/bot${token}`, (req, res) => {
  console.log("📩 Update reçu de Telegram:", req.body);
  bot.processUpdate(req.body);
  res.status(200).send("OK");
});

// 🔹 Endpoint رئيسي لتأكيد التشغيل
app.get("/", (req, res) => {
  res.status(200).send("✅ Bot is running");
});

// ======================================================
// 🔹 بدء التطبيق
// ======================================================
app.listen(port, () => {
  const cleanUrl = externalUrl?.startsWith("https://")
    ? externalUrl
    : `https://${externalUrl}`;

  if (cleanUrl) {
    bot
      .setWebHook(`${cleanUrl}/bot${token}`)
      .then(() =>
        console.log(`✅ Webhook configuré avec succès: ${cleanUrl}/bot${token}`)
      )
      .catch((err) => console.error("❌ Erreur Webhook:", err.message));
  }
  console.log(`✅ Bot actif sur le port ${port}`);
});
