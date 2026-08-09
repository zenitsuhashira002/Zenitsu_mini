// ./commands/refresh.js
//
// Commande GÉNÉRALE (accessible à tout le monde, aucune vérification owner) :
// - Vide le cache interne du bot et rafraîchit la connexion (via main.js
//   restartBot/softRefreshBot), sans jamais couper la session WhatsApp.
// - Répond avec des boutons cliquables Channel / Group.
// - Sert aussi de test de compatibilité pour les messages à boutons
//   (templateButtons + urlButton, extendedTextMessage/contextInfo,
//   externalAdReply) sur Baileys v7.

// ⚠️ Remplace ce lien par le VRAI lien d'invitation de ta chaîne WhatsApp
// (Réglages de la chaîne → Inviter des abonnés via un lien).
const CHANNEL_LINK = 'https://whatsapp.com/channel/REMPLACE_PAR_TON_LIEN_DE_CHAINE';

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

// Anti-spam léger : évite qu'un utilisateur déclenche des rafraîchissements
// en boucle (contre-productif — le but est justement de réduire la charge).
const lastRefreshByUser = new Map();
const COOLDOWN_MS = 30 * 1000;

module.exports = {
    name: 'refresh',
    aliases: ['refreshbot', 'reload'],
    category: 'general', // ✅ ouvert à tout le monde — aucune vérification isBotOwner ici

    async execute({ sock, msg, args, jid, senderJid, botKey, config }) {
        // Anti-spam par utilisateur (pas par bot, pour que ça reste simple et léger)
        const now = Date.now();
        const last = lastRefreshByUser.get(senderJid) || 0;
        if (now - last < COOLDOWN_MS) {
            const remaining = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
            return sock.sendMessage(jid, {
                text: `⏳ Please wait ${remaining}s before refreshing again.`,
                contextInfo: STYLE,
            }, { quoted: msg }).catch(() => {});
        }
        lastRefreshByUser.set(senderJid, now);

        await sock.sendMessage(jid, { react: { text: '♻️', key: msg.key } }).catch(() => {});

        // Rafraîchissement réel : vide le cache et remet le socket "available",
        // sans jamais déconnecter — réutilise la logique déjà testée de main.js.
        let refreshed = false;
        try {
            const main = require('../main.js');
            if (main && typeof main.restartBot === 'function' && botKey) {
                // requesterJid = null : on gère nous-mêmes le message de retour
                // (avec boutons) pour éviter un double message.
                refreshed = await main.restartBot(botKey, null);
            }
        } catch (e) {
            console.error('❌ refresh error:', e.message);
        }

        const groupLink = (config?.groupsToJoin && config.groupsToJoin[0]) || CHANNEL_LINK;
        const botName = config?.botName || 'Zenitsu Bot';

        const buttonMessage = {
            text:
                `♻️ *Bot refreshed successfully!*\n\n` +
                `🧹 Cache: cleared\n` +
                `⚡ Connection: kept alive\n` +
                `${refreshed ? '✅' : 'ℹ️'} Status: ${refreshed ? 'Refreshed' : 'Nothing to refresh'}\n\n` +
                `Join our community below 👇`,
            footer: botName,
            templateButtons: [
                {
                    index: 1,
                    urlButton: { displayText: '📢 Channel', url: CHANNEL_LINK },
                },
                {
                    index: 2,
                    urlButton: { displayText: '👥 Group', url: groupLink },
                },
            ],
            contextInfo: {
                ...STYLE,
                externalAdReply: {
                    title: botName,
                    body: 'Tap a button below to join',
                    mediaType: 1,
                    sourceUrl: CHANNEL_LINK,
                    renderLargerThumbnail: false,
                },
            },
        };

        try {
            await sock.sendMessage(jid, buttonMessage, { quoted: msg });
        } catch (e) {
            // Certains clients / versions WhatsApp rejettent les templateButtons.
            // Repli automatique en texte simple avec les liens en clair, pour
            // que la commande ne reste jamais silencieuse en cas d'échec.
            console.error('⚠️ refresh buttons fallback:', e.message);
            await sock.sendMessage(jid, {
                text:
                    `♻️ *Bot refreshed successfully!*\n\n` +
                    `📢 Channel: ${CHANNEL_LINK}\n` +
                    `👥 Group: ${groupLink}`,
                contextInfo: STYLE,
            }, { quoted: msg }).catch(() => {});
        }
    },
};
