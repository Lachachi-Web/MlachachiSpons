import TelegramBot from "node-telegram-bot-api";
import express from "express";
import pkg from "pg";
const { Client } = pkg;

// 🟢 استيراد الملفات الخارجية
import { clientKeyboard } from "./clientKeyboard.js";
import { adminKeyboard } from "./adminKeyboard.js";
import { contactFeature } from "./customFeatures.js"; // 🆕 ميزة الاتصال الجديدة

// ------------------------------------------------------------------
// 1. إعداد المتغيرات العامة
// ------------------------------------------------------------------
const token = process.env.TELEGRAM_TOKEN;
const accessToken = process.env.FB_ADS_TOKEN;
const graphUrl = process.env.FB_GRAPH_URL || "https://graph.facebook.com/v20.0";
const adAccountId = process.env.FB_AD_ACCOUNT_ID;
const port = process.env.PORT || 3000; // ✅ لملاءمة Railway
const externalUrl = process.env.RAILWAY_STATIC_URL;
const DEFAULT_CURRENCY = "DZD";
const ADMIN_ID = "1621781485";

const bot = new TelegramBot(token);
const app = express();
app.use(express.json());

// ------------------------------------------------------------------
// 2. قاعدة البيانات
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

    console.log("✅ Base de données initialisée avec succès.");
  } catch (error) {
    console.error("❌ Erreur base de données:", error.message);
    isDbConnected = false;
  }
}
initializeDatabase();

// ------------------------------------------------------------------
// 3. دوال مساعدة
// ------------------------------------------------------------------
async function logActivity(telegramId, command) {
  if (isDbConnected) {
    try {
      await dbClient.query(
        `INSERT INTO activity_log (telegram_id, command_used) VALUES ($1, $2)`,
        [telegramId, command]
      );
    } catch (error) {
      console.error("❌ Erreur lors de l’enregistrement de l’activité:", error.message);
    }
  }
}

function matchBtn(text, label) {
  return text?.trim().toLowerCase() === label.trim().toLowerCase();
}

async function getEurDzdRate() {
  try {
    const res = await fetch("https://api.exchangerate.host/latest?base=EUR&symbols=DZD");
    const data = await res.json();
    return data?.rates?.DZD || null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// 4. الأوامر الأساسية
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
// 5. تفاعلات لوحة العميل
// ------------------------------------------------------------------
bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text || "";

  // 📢 Active Compa
  if (matchBtn(text, "📢 Active Compa")) {
    const res = await dbClient.query(
      `SELECT campaign_id, campaign_alias FROM clients WHERE telegram_id = $1`,
      [chatId]
    );
    if (res.rows.length === 0)
      return bot.sendMessage(chatId, "⚠️ Aucune campagne trouvée pour votre compte.");
    const lines = res.rows.map(
      (r, i) => `#${i + 1} • ${r.campaign_alias ?? "Sans nom"}\nID: \`${r.campaign_id}\``
    );
    bot.sendMessage(chatId, `📢 **Vos campagnes actives :**\n\n${lines.join("\n\n")}`, {
      parse_mode: "Markdown",
    });
  }

  // 📊 Statistiques
  if (matchBtn(text, "📊 Statistiques")) {
    const clientCampaigns = await dbClient.query(
      `SELECT campaign_id FROM clients WHERE telegram_id = $1`,
      [chatId]
    );
    if (clientCampaigns.rows.length === 0)
      return bot.sendMessage(chatId, "⚠️ Aucune campagne liée à votre compte.");
    const campaignIds = clientCampaigns.rows.map((r) => r.campaign_id);
    bot.sendMessage(chatId, "⏳ Récupération des statistiques des 7 derniers jours...");
    const insights = await getEurDzdRate(campaignIds, "last_7d");
    if (insights.error) return bot.sendMessage(chatId, insights.message);
    let totalSpend = 0;
    insights.forEach((s) => (totalSpend += parseFloat(s.spend || 0)));
    bot.sendMessage(chatId, `📊 Dépense totale (7 derniers jours): ${totalSpend.toFixed(2)} ${DEFAULT_CURRENCY}`);
  }

  // 💰 Paiements
  if (matchBtn(text, "💰 Paiements")) {
    const dep = await dbClient.query(`SELECT SUM(amount) AS total FROM deposits WHERE telegram_id=$1`, [chatId]);
    const totalDeposit = parseFloat(dep.rows[0].total || 0);
    bot.sendMessage(chatId, `💰 Paiement total reçu : ${totalDeposit.toFixed(2)} ${DEFAULT_CURRENCY}`);
  }

  // 🧾 Versements
  if (matchBtn(text, "🧾 Versements")) {
    const res = await dbClient.query(
      `SELECT amount, deposit_date FROM deposits WHERE telegram_id=$1 ORDER BY deposit_date DESC`,
      [chatId]
    );
    if (res.rows.length === 0) return bot.sendMessage(chatId, "⚠️ Aucun versement enregistré.");
    const lines = res.rows.map(
      (r) => `💵 ${r.amount} ${DEFAULT_CURRENCY} - ${new Date(r.deposit_date).toLocaleDateString("fr-FR")}`
    );
    bot.sendMessage(chatId, `🧾 **Historique des versements :**\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
  }

  // 💱 EUR / DZD
  if (matchBtn(text, "💱 EUR / DZD")) {
    const rate = await getEurDzdRate();
    if (!rate) return bot.sendMessage(chatId, "⚠️ Impossible de récupérer le taux pour le moment.");
    bot.sendMessage(chatId, `💱 1 EUR ≈ ${rate.toFixed(2)} DZD`);
  }

  // 📞 Contact (زر جديد من customFeatures.js)
  if (matchBtn(text, "📞 Contact")) {
    contactFeature(bot, chatId);
  }
});

// ------------------------------------------------------------------
// 6. Webhook لتشغيل البوت على Railway
// ------------------------------------------------------------------
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(port, () => {
  if (externalUrl) {
    bot.setWebHook(`${externalUrl}/bot${token}`);
  }
  console.log(`✅ Bot actif sur le port ${port}`);
});
