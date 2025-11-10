// ------------------------------------------------------------------
// Fonctions dédiées aux clients (Client Features)
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
// Campagnes actives
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
  bot.sendMessage(chatId, `📢 **Vos campagnes actives :**\n\n${lines.join('\n\n')}`, { parse_mode: 'Markdown' });
}

// ------------------------------------------------------------------
// Statistiques (Simples pour l’instant)
// ------------------------------------------------------------------
export async function statisticsFeature(bot, chatId, dbClient, getCampaignInsights, DEFAULT_CURRENCY) {
  const clientCampaigns = await dbClient.query(
    `SELECT campaign_id FROM clients WHERE telegram_id = $1`,
    [chatId]
  );
  if (clientCampaigns.rows.length === 0) {
    return bot.sendMessage(chatId, "⚠️ Aucune campagne liée à votre compte.");
  }

  const campaignIds = clientCampaigns.rows.map(r => r.campaign_id);
  bot.sendMessage(chatId, "⏳ Récupération des statistiques des 7 derniers jours...");
  const insights = await getCampaignInsights(campaignIds, 'last_7d');

  if (insights.error) {
    return bot.sendMessage(chatId, insights.message);
  }

  let totalSpend = 0;
  insights.forEach(s => (totalSpend += parseFloat(s.spend || 0)));
  bot.sendMessage(chatId, `📊 Dépense totale (7 derniers jours): ${totalSpend.toFixed(2)} ${DEFAULT_CURRENCY}`);
}

// ------------------------------------------------------------------
// Paiements (Solde total)
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
// Versements (Historique)
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
    (r) => `💵 ${r.amount} ${DEFAULT_CURRENCY} - ${new Date(r.deposit_date).toLocaleDateString('fr-FR')}`
  );
  bot.sendMessage(chatId, `🧾 **Historique des versements :**\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
}

// ------------------------------------------------------------------
// Taux de change EUR/DZD
// ------------------------------------------------------------------
export async function eurDzdFeature(bot, chatId) {
  try {
    const res = await fetch('https://api.exchangerate.host/latest?base=EUR&symbols=DZD');
    const data = await res.json();
    const rate = data?.rates?.DZD || null;
    if (!rate) return bot.sendMessage(chatId, "⚠️ Impossible de récupérer le taux pour le moment.");
    bot.sendMessage(chatId, `💱 1 EUR ≈ ${rate.toFixed(2)} DZD`);
  } catch {
    bot.sendMessage(chatId, "❌ Erreur lors de la récupération du taux de change.");
  }
}
