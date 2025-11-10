import TelegramBot from "node-telegram-bot-api";
import express from 'express';
import pkg from 'pg';
const { Client } = pkg;

// 🟢 استيراد لوحات المفاتيح
import { clientKeyboard } from './clientKeyboard.js';
import { adminKeyboard } from './adminKeyboard.js';

// ------------------------------------------------------------------
// 1. المتغيرات والتهيئة
// ------------------------------------------------------------------
const token = process.env.TELEGRAM_TOKEN; 
const accessToken = process.env.FB_ADS_TOKEN;
const graphUrl = process.env.FB_GRAPH_URL || "https://graph.facebook.com/v20.0";
const adAccountId = process.env.FB_AD_ACCOUNT_ID; 

const port = 3000; 
const externalUrl = process.env.RAILWAY_STATIC_URL;

const bot = new TelegramBot(token);
const app = express();
app.use(express.json()); 

const ADMIN_ID = '1621781485'; 
const DEFAULT_CURRENCY = 'DZD';

// ------------------------------------------------------------------
// 2. قاعدة البيانات
// ------------------------------------------------------------------
const dbClient = new Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT || 5432, 
    ssl: { rejectUnauthorized: false }
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
        console.log('✅ Base de données initialisée avec succès.');
    } catch (error) {
        console.error('❌ Erreur base de données:', error.message);
        isDbConnected = false;
    }
}
initializeDatabase();

// ------------------------------------------------------------------
// 3. Fonctions Utiles
// ------------------------------------------------------------------
async function logActivity(telegramId, command) {
    if (isDbConnected) {
        try {
            await dbClient.query(
                `INSERT INTO activity_log (telegram_id, command_used) VALUES ($1, $2)`,
                [telegramId, command]
            );
        } catch (error) {
            console.error('❌ Erreur lors de l’enregistrement de l’activité:', error.message);
        }
    }
}

function matchBtn(text, label) {
  if (!text) return false;
  return text.trim().toLowerCase() === label.trim().toLowerCase();
}

async function getEurDzdRate() {
  try {
    const res = await fetch('https://api.exchangerate.host/latest?base=EUR&symbols=DZD');
    const data = await res.json();
    return data?.rates?.DZD || null;
  } catch {
    return null;
  }
}

async function getCampaignInsights(campaignIds, datePreset = 'yesterday') {
  const fields = 'campaign_id,campaign_name,spend,impressions,cpc,ctr,actions,date_start,date_stop';
  const idsString = campaignIds.map(id => `"${id}"`).join(',');
  const url = `${graphUrl}/act_${adAccountId}/insights?fields=${fields}&level=campaign&date_preset=${datePreset}&filtering=[{"field":"campaign.id","operator":"IN","value":[${idsString}]}]&access_token=${accessToken}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
      console.error("Facebook API Error:", data.error.message);
      return { error: true, message: `Erreur Facebook: ${data.error.message}` };
    }
    return data.data || [];
  } catch (error) {
    console.error("Erreur réseau:", error);
    return { error: true, message: `Erreur réseau: ${error.message}` };
  }
}

// ------------------------------------------------------------------
// 4. Commandes principales
// ------------------------------------------------------------------
bot.onText(/\/start|Retour au menu principal/, (msg) => {
  const chatId = msg.chat.id.toString();
  logActivity(chatId, '/start');
  
  if (chatId === ADMIN_ID) {
      bot.sendMessage(chatId, "👑 Bonjour admin, voici votre panneau de contrôle :", adminKeyboard);
  } else {
      bot.sendMessage(chatId, "👋 Bienvenue ! Veuillez choisir une option :", clientKeyboard);
  }
});

// ------------------------------------------------------------------
// 5. Commandes du client
// ------------------------------------------------------------------
bot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text || '';

  // 🟢 Active Compa
  if (matchBtn(text, '📢 Active Compa')) {
    const res = await dbClient.query(
      `SELECT campaign_id, campaign_alias FROM clients WHERE telegram_id = $1`,
      [chatId]
    );
    if (res.rows.length === 0)
      return bot.sendMessage(chatId, "⚠️ Aucune campagne trouvée pour votre compte.");
    const lines = res.rows.map((r, i) => `#${i+1} • ${r.campaign_alias ?? 'Sans nom'}\nID: \`${r.campaign_id}\``);
    bot.sendMessage(chatId, `📢 **Vos campagnes actives :**\n\
