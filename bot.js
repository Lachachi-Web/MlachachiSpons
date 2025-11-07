import TelegramBot from "node-telegram-bot-api";

const token = process.env.TELEGRAM_TOKEN; // نجيب التوكن من البيئة
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🚀 البوت شغال بنجاح ✅");
});
