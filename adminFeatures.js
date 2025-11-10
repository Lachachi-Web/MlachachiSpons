// ------------------------------------------------------------------
// 👑 Fonctions administrateur (Admin Features)
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 💱 Définir le taux de l'euro
// Commande : /seteur 280
// ------------------------------------------------------------------
export async function setEurRate(bot, chatId, msgText, dbClient) {
  try {
    const parts = msgText.split(" ");
    const newRate = parseFloat(parts[1]);

    if (isNaN(newRate)) {
      return bot.sendMessage(
        chatId,
        "⚠️ Veuillez entrer un taux valide.\n\nExemple : `/seteur 280`",
        { parse_mode: "Markdown" }
      );
    }

    // Sauvegarder le taux dans la base
    await dbClient.query(`INSERT INTO eur_rate (rate) VALUES ($1)`, [newRate]);

    bot.sendMessage(
      chatId,
      `✅ *Taux mis à jour avec succès !*\n\n1 € = ${newRate} DZD 🇩🇿`,
      { parse_mode: "Markdown" }
    );

    console.log(`✅ Nouveau taux enregistré: ${newRate}`);
  } catch (error) {
    console.error("❌ Erreur dans setEurRate:", error);
    bot.sendMessage(
      chatId,
      "❌ Une erreur s'est produite lors de la mise à jour du taux."
    );
  }
}

// ------------------------------------------------------------------
// 🧾 Liste des clients (optionnelle)
// ------------------------------------------------------------------
export async function listClients(bot, chatId, dbClient) {
  try {
    const res = await dbClient.query(
      `SELECT DISTINCT telegram_id FROM clients ORDER BY telegram_id ASC`
    );
    if (res.rows.length === 0) {
      return bot.sendMessage(chatId, "⚠️ Aucun client enregistré.");
    }

    const message = res.rows.map((r, i) => `${i + 1}. ID: ${r.telegram_id}`).join("\n");
    bot.sendMessage(chatId, `👥 *Clients enregistrés :*\n\n${message}`, {
      parse_mode: "Markdown",
    });
  } catch (error) {
    console.error("Erreur listClients:", error);
    bot.sendMessage(chatId, "❌ Erreur lors de la récupération des clients.");
  }
}
