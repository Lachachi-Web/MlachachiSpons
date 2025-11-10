// ------------------------------------------------------------------
// Mettre à jour le taux EUR/DZD (admin seulement)
// Commande: /seteur 280
// ------------------------------------------------------------------
export async function setEurRate(bot, chatId, text, dbClient) {
  const parts = text.split(" ");
  const newRate = parseFloat(parts[1]);

  if (isNaN(newRate)) {
    return bot.sendMessage(chatId, "❌ Format incorrect. Exemple: `/seteur 280`", {
      parse_mode: "Markdown",
    });
  }

  await dbClient.query(`INSERT INTO eur_rate(rate) VALUES($1)`, [newRate]);

  bot.sendMessage(chatId, `✅ Nouveau taux enregistré : 1 € = ${newRate} DZD 🇩🇿`);
}
