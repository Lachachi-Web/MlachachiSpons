import TelegramBot from "node-telegram-bot-api";

// نبدلو هذا بالتوكن الحقيقي تاع البوت ديالك
const token = 8573042484:AAFvkKY-Um5yFeCgK_cpzXRRrZTVktPw6yw;
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🚀 البوت شغال بنجاح ✅");
});
