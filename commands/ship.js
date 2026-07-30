// ./commands/ship.js

const axios = require('axios');

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

// ═══════════════════════════════════════
// Récupération des mentions
// ═══════════════════════════════════════

function getMentionedJid(msg) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    return mentioned;
}

// ═══════════════════════════════════════
// COMMANDE
// ═══════════════════════════════════════

module.exports = {
    name: 'ship',
    aliases: ['love', 'match', 'couple'],
    category: 'fun',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const mentioned = getMentionedJid(msg);

        let user1 = senderJid;
        let user2 = null;

        // Détection des deux utilisateurs
        if (mentioned.length >= 2) {
            user1 = mentioned[0];
            user2 = mentioned[1];
        } else if (mentioned.length === 1) {
            // Si un seul mentionné, on ship avec l'utilisateur qui commande
            user2 = mentioned[0];
        } else {
            return sock.sendMessage(jid, {
                text: '❤️ *Ship Command*\n\n' +
                      '⚡ *Usage:* .ship @user1 @user2\n\n' +
                      '✨ *Examples:*\n' +
                      '.ship @user1 @user2\n' +
                      '.ship @user (ships you with the mentioned user)\n\n' +
                      '💡 Mention the users you want to ship!',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Récupération des photos de profil
        let pfp1, pfp2;
        try {
            pfp1 = await sock.profilePictureUrl(user1, 'image');
        } catch (_) { pfp1 = null; }

        try {
            pfp2 = await sock.profilePictureUrl(user2, 'image');
        } catch (_) { pfp2 = null; }

        if (!pfp1 || !pfp2) {
            return sock.sendMessage(jid, {
                text: '❌ *Cannot ship*\n\n' +
                      'One or both users don\'t have a profile picture.\n\n' +
                      '💡 Make sure both users have profile pictures set.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '❤️', key: msg.key } });

            const url = `https://api.popcat.xyz/v2/ship?user1=${encodeURIComponent(pfp1)}&user2=${encodeURIComponent(pfp2)}`;
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 20000,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)' },
            });
            const buffer = Buffer.from(response.data);

            // ⭐ Utiliser les mentions pour afficher les noms
            const mentionList = [user1, user2].filter(j => j);
            
            await sock.sendMessage(jid, {
                image: buffer,
                caption: `❤️ *Ship*\n\n` +
                         `@${user1.split('@')[0]} ❤️ @${user2.split('@')[0]}\n\n` +
                         `⚡ _Zenitsu AI_`,
                contextInfo: {
                    mentionedJid: mentionList,
                    ...STYLE,
                },
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error(`❌ Ship error:`, err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: `❌ *Failed to generate ship image.*\n\nError: ${err.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
