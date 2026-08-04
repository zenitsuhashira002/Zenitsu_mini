// ./commands/gay.js

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

function getMentionedJid(msg) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    return mentioned;
}

async function getAvatarUrl(sock, jid) {
    try {
        return await sock.profilePictureUrl(jid, 'image');
    } catch (_) {
        return null;
    }
}

async function getContactName(sock, jid) {
    try {
        if (typeof sock.getName === 'function') {
            const name = await sock.getName(jid);
            if (name) return name;
        }
        if (typeof sock.getContact === 'function') {
            const contact = await sock.getContact(jid);
            if (contact && contact.name) return contact.name;
        }
        return jid.split('@')[0];
    } catch (_) {
        return jid.split('@')[0];
    }
}

module.exports = {
    name: 'gay',
    aliases: ['rainbow'],
    category: 'fun',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        let imageUrl = null;
        let targetJid = null;
        let targetName = 'Unknown';

        // 1. Vérifier si une URL est fournie en argument
        if (args.length > 0 && args[0].startsWith('http')) {
            imageUrl = args[0];
            targetName = 'User';
        }

        // 2. Vérifier une mention
        if (!imageUrl) {
            const mentioned = getMentionedJid(msg);
            if (mentioned.length > 0) {
                targetJid = mentioned[0];
                imageUrl = await getAvatarUrl(sock, targetJid);
                targetName = await getContactName(sock, targetJid);
            }
        }

        // 3. Utiliser l'utilisateur qui commande
        if (!imageUrl) {
            targetJid = senderJid;
            imageUrl = await getAvatarUrl(sock, senderJid);
            targetName = await getContactName(sock, senderJid);
        }

        if (!imageUrl) {
            return sock.sendMessage(jid, {
                text: '🌈 *Gay Overlay*\n\n' +
                      '⚡ *Usage:*\n' +
                      '.gay (uses your profile pic)\n' +
                      '.gay @user (uses mentioned user\'s pic)\n' +
                      '.gay <image_url>\n\n' +
                      '💡 Make sure the target has a profile picture!',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '🌈', key: msg.key } });

            // Générer un pourcentage aléatoire
            const gayPercentage = Math.floor(Math.random() * 101);
            const gayLevel = gayPercentage >= 80 ? '🏳️‍🌈 ULTRA GAY' :
                           gayPercentage >= 60 ? '🌈 VERY GAY' :
                           gayPercentage >= 40 ? '🦄 GAY' :
                           gayPercentage >= 20 ? '💅 A LITTLE GAY' :
                           '😇 STRAIGHT';

            const url = `https://api.some-random-api.com/canvas/overlay/gay?avatar=${encodeURIComponent(imageUrl)}`;
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)' },
            });
            const buffer = Buffer.from(response.data);

            await sock.sendMessage(jid, {
                image: buffer,
                caption: `🌈 *Gay Overlay*\n\n` +
                         `👤 *Name:* ${targetName}\n` +
                         `🏳️‍🌈 *Gay Level:* ${gayPercentage}%\n` +
                         `📊 *Status:* ${gayLevel}\n\n` +
                         `⚡ _Powered by Cybernova_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error('❌ Gay error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to generate gay overlay.*\n\n' +
                      `⚠️ Error: ${err.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
