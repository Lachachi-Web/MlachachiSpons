// ------------------------------------------------------------------
// 🎯 Fonctions principales du client (Custom Features)
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 📞 Contact - واتساب و اتصال مباشر
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// 📢 Campagnes actives
// ------------------------------------------------------------------
export async function activeCampaigns(bot, chatId, dbClient) {
  const res = await dbClient.query(
    `SELECT campaign_id, campaign_alias FROM clients WHERE telegram_id = $1`,
    [chatId]
  );
  if (res.rows.length === 0) {
    return bot.sendMessage(chatId, "⚠️ Aucune campagne trouvée pour votre compte.");
  }

  const lines = res.rows.map(
    (r, i) => `#${i + 1} • ${r.campaign_alias ?? 'Sans nom'}\nID: \`${r.campaign_id}\``
  );
  bot.sendMessage(chatId, `📢 **Vos campagnes actives :**\n\n${lines.join('\n\n')}`, {
    parse_mode: 'Markdown',
  });
}

// ------------------------------------------------------------------
// 📊 Statistiques - بسيطة
// ------------------------------------------------------------------
export async function statisticsFeature(bot, chatId, dbClient, DEFAULT_CURRENCY) {
  const clientCampaigns = await dbClient.query(
    `SELECT campaign_id FROM clients WHERE telegram_id = $1`,
    [chatId]
  );

  if (clientCampaigns.rows.length === 0) {
    return bot.sendMessage(chatId, "⚠️ Aucune campagne liée à votre compte.");
  }

  const campaignIds = clientCampaigns.rows.map(r => r.campaign_id);
  bot.sendMessage(chatId, "⏳ Récupération des statistiques des 7 derniers jours...");

  // في هذا الإصدار سنكتفي بعرض عدد الحملات وعدد الأيام
  const message = `
📊 Statistiques simplifiées :
- Nombre de campagnes : ${campaignIds.length}
- Période : 7 derniers jours
`;

  bot.sendMessage(chatId, message);
}

// ------------------------------------------------------------------
// 💰 Paiements (إجمالي الودائع)
// ------------------------------------------------------------------
export async function paymentsFeature(bot, chatId, dbClient, DEFAULT_CURRENCY) {
  const dep = await dbClient.query(
    `SELECT SUM(amount) AS total FROM deposits WHERE telegram_id=$1`,
    [chatId]
  );
  const totalDeposit = parseFloat(dep.rows[0].total || 0);
  bot.sendMessage(chatId, `💰 Paiement total reçu : ${totalDeposit.toFixed(2)} ${DEFAULT_CURRENCY}`);
}

// ------------------------------------------------------------------
// 🧾 Versements (سجل الإيداعات)
// ------------------------------------------------------------------
export async function versementsFeature(bot, chatId, dbClient, DEFAULT_CURRENCY) {
  const res = await dbClient.query(
    `SELECT amount, deposit_date FROM deposits WHERE telegram_id=$1 ORDER BY deposit_date DESC`,
    [chatId]
  );

  if (res.rows.length === 0) {
    return bot.sendMessage(chatId, "⚠️ Aucun versement enregistré.");
  }

  const lines = res.rows.map(
    (r) =>
      `💵 ${r.amount} ${DEFAULT_CURRENCY} - ${new Date(r.deposit_date).toLocaleDateString('fr-FR')}`
  );

  bot.sendMessage(chatId, `🧾 **Historique des versements :**\n\n${lines.join('\n')}`, {
    parse_mode: 'Markdown',
  });
}

// ------------------------------------------------------------------
// 💱 EUR / DZD - ديناميكي (يتحدث من قاعدة البيانات)
// ------------------------------------------------------------------
export async function eurDzdFeature(bot, chatId, dbClient) {
  try {
    const res = await dbClient.query(
      `SELECT rate, updated_at FROM eur_rate ORDER BY updated_at DESC LIMIT 1`
    );

    if (res.rows.length === 0) {
      return bot.sendMessage(
        chatId,
        "⚠️ Le taux n'est pas encore défini par l'administrateur."
      );
    }

    const { rate, updated_at } = res.rows[0];
    const date = new Date(updated_at).toLocaleDateString("fr-FR");

    const message = `
💱 *Taux actuel de l'euro :*
1 € = ${rate} DZD 🇩🇿
🗓️ Mis à jour le : ${date}
`;

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Erreur EUR/DZD:", error);
    bot.sendMessage(chatId, "❌ Erreur lors de la récupération du taux.");
  }
}
