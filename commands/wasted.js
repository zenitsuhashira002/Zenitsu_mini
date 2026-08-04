// ./commands/wasted.js

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

module.exports = {
    name: 'wasted',
    aliases: ['rip', 'dead'],
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
                text: '💀 *Wasted Overlay*\n\n' +
                      '⚡ *Usage:*\n' +
                      '.wasted (uses your profile pic)\n' +
                      '.wasted @user (uses mentioned user\'s pic)\n' +
                      '.wasted <image_url>\n\n' +
                      '💡 Reply to a message to use that user\'s profile pic.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '💀', key: msg.key } });

            // Générer une cause de mort aléatoire
            const deathCauses = [
                '☠️ Got absolutely destroyed',
                '💀 Died from laughter',
                '😵 Killed by cringe',
                '⚰️ Slain by the truth',
                '🪦 Died of shock',
                '💀 Murdered by the beat',
                '☠️ Ended by the roast',
                '💀 Sent to the shadow realm',
                '😵 Overwhelmed by facts',
                '⚰️ Eliminated by skill issue',
                '💀 Died from embarrassment',
                '☠️ Exposed to pure genius',
                '💀 Wasted by the plot twist',
                '😵 Too much chaos absorbed'
            ];
            const randomCause = deathCauses[Math.floor(Math.random() * deathCauses.length)];

            const url = `https://api.some-random-api.com/canvas/overlay/wasted?avatar=${encodeURIComponent(imageUrl)}`;
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)' },
            });
            const buffer = Buffer.from(response.data);

            // Construction du message avec mention
            const mentionJid = targetJid !== 'user' ? targetJid : null;
            const mentionList = mentionJid ? [mentionJid] : [];

            let caption = `💀 *Wasted Overlay*\n\n`;
            if (mentionJid) {
                caption += `👤 @${getRawNumber(mentionJid)}\n`;
            }
            caption += `🪦 *Cause:* ${randomCause}\n` +
                       `⚰️ *RIP${mentionJid ? ` @${getRawNumber(mentionJid)}` : ''}*\n\n` +
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
            console.error('❌ Wasted error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to generate wasted overlay.*\n\n' +
                      `⚠️ Error: ${err.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
