import TelegramBot from "node-telegram-bot-api";

// البوت سيقرأ التوكن بشكل آمن من إعدادات Render (Environment Variable)
const token = process.env.TELEGRAM_TOKEN; 
const bot = new TelegramBot(token, { polling: true });

// أمر /start لنتأكد أن البوت يعمل
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🚀 البوت شغال بنجاح ✅");
});

// هذا السطر يمنع توقف البوت في Render (خاص بالـ Node.js)
// يمكننا إزالته لاحقًا عند استخدام Webhooks
console.log("Bot started successfully");
