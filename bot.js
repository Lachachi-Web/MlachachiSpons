import TelegramBot from "node-telegram-bot-api";
import express from "express";
import pkg from "pg";
const { Client } = pkg;

// ========================
// 1️⃣ إعداد المتغيرات العامة
// ========================
const token = process.env.TELEGRAM_TOKEN;
const port = process.env.PORT || 3000; // ✅ ضروري يكون PORT
const externalUrl = process.env.RAILWAY_STATIC_URL;
const ADMIN_ID = "1621781485";
const DEFAULT_CURRENCY = "DZD";

const bot = new TelegramBot(token);
const app = express();
app.use(express.json());

// ========================
// 2️⃣ قاعدة البيانات
// ========================
const dbClient = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT || 5432,
  ssl: { rejectUnauthorized: false },
});

dbClient.connect()
  .then(() => console.log("✅ Base de données initialisée avec succès."))
  .catch((err) => console.error("❌ Erreur de connexion DB:", err.message));

// ========================
// 3️⃣ أوامر أساسية
// ========================
bot.onText(/\/ping/, (msg) => {
  bot.sendMessage(msg.chat.id, "✅ Le bot fonctionne correctement !");
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id.toString();
  if (chatId === ADMIN_ID) {
    bot.sendMessage(chatId, "👑 Bonjour Admin !");
  } else {
    bot.sendMessage(chatId, "👋 Bienvenue, le bot est actif !");
  }
});

// ========================
// 4️⃣ نقطة استقبال Webhook من Telegram
// ========================
app.post(`/bot${token}`, async (req, res) => {
  try {
    console.log("📩 Update reçu de Telegram:", req.body);
    await bot.processUpdate(req.body);
    res.status(200).send("OK"); // ✅ لازم دايماً يرد OK
  } catch (err) {
    console.error("❌ Erreur Webhook:", err);
    res.status(200).send("OK"); // لتفادي 502 من Telegram
  }
});

// ========================
// 5️⃣ Endpoint أساسي لمنع خطأ Railway
// ========================
app.get("/", (req, res) => {
  res.status(200).send("✅ Bot is running successfully on Railway!");
});

// ========================
// 6️⃣ تشغيل السيرفر وضبط Webhook
// ========================
app.listen(port, async () => {
  const cleanUrl = externalUrl?.startsWith("https://")
    ? externalUrl
    : `https://${externalUrl}`;

  if (cleanUrl) {
    try {
      await bot.setWebHook(`${cleanUrl}/bot${token}`);
      console.log(`✅ Webhook configuré avec succès: ${cleanUrl}/bot${token}`);
    } catch (err) {
      console.error("❌ Erreur Webhook:", err.message);
    }
  }

  console.log(`✅ Bot actif sur le port ${port}`);
});
