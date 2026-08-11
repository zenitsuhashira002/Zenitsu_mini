// ./commands/invert.js

const axios = require('axios');

// ═══════════════════════════════════════
// STYLE CYBERNOVA
// ═══════════════════════════════════════

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
// UTILITAIRES
// ═══════════════════════════════════════

function getMentionedJid(msg) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    return mentioned;
}

function getQuotedSender(msg) {
    try {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMsg) {
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (quotedParticipant) return quotedParticipant;
        }
        return null;
    } catch (_) {
        return null;
    }
}

async function getAvatarUrl(sock, jid) {
    try {
        return await sock.profilePictureUrl(jid, 'image');
    } catch (_) {
        return null;
    }
}

function getRawNumber(jid) {
    if (!jid) return '';
    return jid.split('@')[0];
}

// ═══════════════════════════════════════
// COMMANDE
// ═══════════════════════════════════════

module.exports = {
    name: 'invert',
    aliases: ['negative', 'invertcolor'],
    category: 'fun',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        let imageUrl = null;
        let targetJid = null;

        // 1. Vérifier si une URL est fournie en argument
        if (args.length > 0 && args[0].startsWith('http')) {
            imageUrl = args[0];
            targetJid = 'user';
        }

        // 2. Vérifier si un message est cité (priorité)
        if (!imageUrl) {
            const quotedSender = getQuotedSender(msg);
            if (quotedSender) {
                targetJid = quotedSender;
                imageUrl = await getAvatarUrl(sock, targetJid);
            }
        }

        // 3. Vérifier une mention
        if (!imageUrl) {
            const mentioned = getMentionedJid(msg);
            if (mentioned.length > 0) {
                targetJid = mentioned[0];
                imageUrl = await getAvatarUrl(sock, targetJid);
            }
        }

        // 4. Utiliser l'utilisateur qui commande (seulement si rien d'autre)
        if (!imageUrl) {
            targetJid = senderJid;
            imageUrl = await getAvatarUrl(sock, targetJid);
        }

        if (!imageUrl) {
            return sock.sendMessage(jid, {
                text: '🎨 *Invert Colors*\n\n' +
                      '⚡ *Usage:*\n' +
                      '.invert (uses your profile pic)\n' +
                      '.invert @user (uses mentioned user\'s pic)\n' +
                      '.invert <image_url>\n\n' +
                      '💡 Reply to a message to use that user\'s profile pic.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '🎨', key: msg.key } });

            const url = `https://api.popcat.xyz/v2/invert?image=${encodeURIComponent(imageUrl)}`;
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)' },
            });
            const buffer = Buffer.from(response.data);

            // Construction du message avec mention
            const mentionJid = targetJid !== 'user' ? targetJid : null;
            const mentionList = mentionJid ? [mentionJid] : [];

            let caption = `🎨 *Inverted Colors*\n\n`;
            if (mentionJid) {
                caption += `👤 @${getRawNumber(mentionJid)}\n`;
            }
            caption += `🔄 *Effect:* Color Inversion\n\n` +
                       `⚡ _Powered by Cybernova_`;

            await sock.sendMessage(jid, {
                image: buffer,
                caption: caption,
                contextInfo: {
                    mentionedJid: mentionList,
                    ...STYLE,
                },
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error('❌ Invert error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to invert image.*\n\n' +
                      `⚠️ Error: ${err.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
