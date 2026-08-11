// ./commands/vv2.js

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// ═══════════════════════════════════════
// STYLE
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
// JID UTILS
// ═══════════════════════════════════════

function getRawNumber(jid) {
    if (!jid) return '';
    let num = jid.split('@')[0];
    num = num.split(':')[0];
    return num.trim();
}

function getBotJid(sock) {
    if (sock.user?.id) return sock.user.id.split(':')[0];
    if (sock.user?.lid) {
        const num = sock.user.lid.split('@')[0];
        return `${num}@s.whatsapp.net`;
    }
    return '';
}

/**
 * Vérifie si le sender est owner de CE bot (sub-bot ou principal)
 */
function isOwnerOfThisBot(sock, senderJid) {
    if (!senderJid) return false;

    // Le bot lui-même (fromMe)
    // Note: on ne peut pas vérifier msg.key.fromMe ici car on n'a pas msg
    // mais on vérifie via les IDs du bot
    const senderRaw = getRawNumber(senderJid);

    // IDs du bot actuel
    const botIds = [];
    if (sock.user?.id) botIds.push(getRawNumber(sock.user.id));
    if (sock.user?.lid) botIds.push(getRawNumber(sock.user.lid));

    // Si le sender est le bot lui-même
    if (botIds.includes(senderRaw)) return true;

    // Vérifier via le main.js
    try {
        const main = require('../main.js');
        if (main && typeof main.isOwner === 'function') {
            return main.isOwner(sock, senderJid);
        }
    } catch (_) {}

    // Fallback : owner configuré
    const ownerNumber = process.env.OWNER_NUMBER || '50935729494';
    if (senderRaw === ownerNumber) return true;

    return false;
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'vv2',
    aliases: ['viewonce2', 'saveforme', 'vvself'],
    category: 'owner',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;

        // ⭐ SEUL L'OWNER DU BOT PEUT UTILISER CETTE COMMANDE
        if (!isOwnerOfThisBot(sock, senderJid)) {
            return; // Totalement silencieux
        }

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;

        if (!quoted) {
            return; // Silencieux
        }

        let mediaType = null;
        let mediaMessage = null;

        if (quoted.imageMessage?.viewOnce) {
            mediaType = 'image';
            mediaMessage = quoted.imageMessage;
        } else if (quoted.videoMessage?.viewOnce) {
            mediaType = 'video';
            mediaMessage = quoted.videoMessage;
        } else if (quoted.audioMessage?.viewOnce) {
            mediaType = 'audio';
            mediaMessage = quoted.audioMessage;
        } else {
            return; // Silencieux
        }

        try {
            // Télécharger le média view-once
            const stream = await downloadContentFromMessage(mediaMessage, mediaType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            if (!buffer || buffer.length < 100) return; // Silencieux

            // ⭐ ENVOYER VERS LE CHAT DU BOT (comme le message de connexion)
            const botJid = getBotJid(sock);
            if (!botJid) return; // Silencieux

            const caption = mediaMessage.caption || '';
            const senderNumber = senderJid.split('@')[0].split(':')[0];
            const chatName = jid.endsWith('@g.us') ? `Group: ${jid.split('@')[0]}` : 'Private Chat';
            const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
            const savedAt = new Date().toLocaleString('en-US');

            // Message d'info envoyé au bot
            const infoText =
                '👁️ *View-Once Saved*\n\n' +
                `👤 *From:* @${senderNumber}\n` +
                `💬 *Chat:* ${chatName}\n` +
                `📄 *Type:* ${mediaType.toUpperCase()}\n` +
                (caption ? `📝 *Caption:* ${caption}\n` : '') +
                `📦 *Size:* ${sizeMB} MB\n` +
                `🕒 *Saved:* ${savedAt}\n\n` +
                '⚡ _Zenitsu View-Once Saver_';

            // Envoyer le média vers le bot
            if (mediaType === 'image') {
                await sock.sendMessage(botJid, {
                    image: buffer,
                    caption: infoText,
                    contextInfo: {
                        mentionedJid: [senderJid],
                        ...STYLE,
                    },
                });
            } else if (mediaType === 'video') {
                await sock.sendMessage(botJid, {
                    video: buffer,
                    caption: infoText,
                    contextInfo: {
                        mentionedJid: [senderJid],
                        ...STYLE,
                    },
                });
            } else if (mediaType === 'audio') {
                await sock.sendMessage(botJid, {
                    audio: buffer,
                    mimetype: 'audio/mp4',
                    ptt: mediaMessage.ptt || false,
                });
                await sock.sendMessage(botJid, {
                    text: infoText,
                    contextInfo: {
                        mentionedJid: [senderJid],
                        ...STYLE,
                    },
                });
            }

            // ⭐ AUCUNE RÉACTION, AUCUN MESSAGE DANS LE CHAT ORIGINAL
            // Totalement silencieux

        } catch (err) {
            console.error('❌ vv2:', err.message);
            // Silencieux aussi en cas d'erreur
        }
    },
};
