import TelegramBot from "node-telegram-bot-api";
import express from "express";
import pkg from "pg";
const { Client } = pkg;

// ===================================================
// 🔹 إعداد المتغيرات الأساسية
// ===================================================
const token = process.env.TELEGRAM_TOKEN;
const port = process.env.PORT || 3000;   // ✅ Railway يمرر المنفذ هنا
const externalUrl = process.env.RAILWAY_STATIC_URL;
const ADMIN_ID = "1621781485";
const DEFAULT_CURRENCY = "DZD";

const bot = new TelegramBot(token);
const app = express();
app.use(express.json());

// ===================================================
// 🔹 قاعدة البيانات (اختبار الاتصال فقط)
// ===================================================
const dbClient = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT || 5432,
  ssl: { rejectUnauthorized: false }
});

dbClient.connect()
  .then(() => console.log("✅ Base de données initialisée avec succès."))
  .catch(err => console.error("❌ Erreur DB:", err.message));

// ===================================================
// 🔹 أوامر بسيطة للتأكد من عمل البوت
// ===================================================
bot.onText(/\/ping/, msg => bot.sendMessage(msg.chat.id, "✅ Le bot fonctionne correctement !"));

bot.onText(/\/start/, msg => {
  const chatId = msg.chat.id.toString();
  if (chatId === ADMIN_ID) bot.sendMessage(chatId, "👑 Bonjour Admin !");
  else bot.sendMessage(chatId, "👋 Bienvenue, le bot est actif !");
});

// ===================================================
// 🔹 Webhook Endpoint (Telegram → Railway)
// ===================================================
app.post(`/bot${token}`, async (req, res) => {
  try {
    console.log("📩 Update reçu:", req.body);
    await bot.processUpdate(req.body);
    res.status(200).send("OK");   // ✅ رد دائم
  } catch (err) {
    console.error("❌ Erreur Webhook:", err);
    res.status(200).send("OK");
  }
});

// ===================================================
// 🔹 Route رئيسي لمنع خطأ Application failed to respond
// ===================================================
app.get("/", (req, res) => {
  res.status(200).send(`✅ Bot is running successfully on Railway! (port = ${port})`);
});

// ===================================================
// 🔹 تشغيل السيرفر وضبط الـ Webhook + اختبار المنفذ
// ===================================================
app.listen(port, async () => {
  console.log(`✅ Bot actif sur le port ${port} (from process.env.PORT)`);

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
});
