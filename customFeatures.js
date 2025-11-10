export async function contactFeature(bot, chatId) {
  const phone = '+213552444977';
  const whatsappLink = `https://wa.me/${phone.replace('+', '')}`;
  const callLink = `tel:${phone}`;

  const message = `
📞 **Contactez-nous :**

Choisissez une option ci-dessous 👇
`;

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📱 Appel Direct', url: callLink },
          { text: '💬 WhatsApp', url: whatsappLink }
        ]
      ]
    }
  });
}
