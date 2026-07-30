// ./commands/forward.js

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { isOwner, getRawNumber } = require('../utils/owner');

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

function cleanJid(target) {
    let cleaned = target.trim();

    if (cleaned.includes('@')) return cleaned;

    if (cleaned.includes('chat.whatsapp.com/')) {
        const code = cleaned.split('chat.whatsapp.com/')[1]?.split(/[?#]/)[0];
        if (code) return `${code}@g.us`;
    }

    if (cleaned.includes('whatsapp.com/channel/')) {
        const code = cleaned.split('whatsapp.com/channel/')[1]?.split(/[?#]/)[0];
        if (code) return `${code}@newsletter`;
    }

    if (cleaned.includes('wa.me/')) {
        const num = cleaned.split('wa.me/')[1]?.split(/[/?#]/)[0];
        if (num) return `${num}@s.whatsapp.net`;
    }

    const num = cleaned.replace(/[^0-9]/g, '');
    if (num.length >= 7) return `${num}@s.whatsapp.net`;

    return null;
}

async function downloadMedia(mediaMessage, type) {
    const stream = await downloadContentFromMessage(mediaMessage, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

module.exports = {
    name: 'forward',
    aliases: ['fw', 'send', 'transfer'],
    category: 'owner',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;

        if (!isOwner(sock, senderJid)) {
            return sock.sendMessage(jid, {
                text: '🚫 *Owner only!*',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        const targetInput = args[0];

        if (!targetInput) {
            return sock.sendMessage(jid, {
                text:
                    '📤 *Forward Message*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.forward <jid/number/link>\n\n' +
                    '✨ *Examples:*\n' +
                    '.forward 50912345678\n' +
                    '.forward https://chat.whatsapp.com/xxx\n' +
                    '.forward https://whatsapp.com/channel/xxx\n' +
                    '.forward 120363410243397177@g.us\n\n' +
                    '💡 Reply to a message first.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        const targetJid = cleanJid(targetInput);

        if (!targetJid) {
            return sock.sendMessage(jid, {
                text: '❌ Invalid target. Use a number, JID, or WhatsApp link.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted) {
            return sock.sendMessage(jid, {
                text: '❌ Please reply to a message to forward.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '📤', key: msg.key } }); } catch (_) {}

        try {
            let sent = false;

            if (quoted.imageMessage) {
                const buffer = await downloadMedia(quoted.imageMessage, 'image');
                await sock.sendMessage(targetJid, {
                    image: buffer,
                    caption: quoted.imageMessage.caption || '',
                    contextInfo: STYLE,
                });
                sent = true;
            } else if (quoted.videoMessage) {
                const buffer = await downloadMedia(quoted.videoMessage, 'video');
                await sock.sendMessage(targetJid, {
                    video: buffer,
                    caption: quoted.videoMessage.caption || '',
                    contextInfo: STYLE,
                });
                sent = true;
            } else if (quoted.audioMessage || quoted.voiceMessage) {
                const audioMsg = quoted.audioMessage || quoted.voiceMessage;
                const buffer = await downloadMedia(audioMsg, 'audio');
                await sock.sendMessage(targetJid, {
                    audio: buffer,
                    mimetype: 'audio/mp4',
                    ptt: audioMsg.ptt || false,
                    contextInfo: STYLE,
                });
                sent = true;
            } else if (quoted.stickerMessage) {
                const buffer = await downloadMedia(quoted.stickerMessage, 'sticker');
                await sock.sendMessage(targetJid, {
                    sticker: buffer,
                    contextInfo: STYLE,
                });
                sent = true;
            } else if (quoted.documentMessage) {
                const buffer = await downloadMedia(quoted.documentMessage, 'document');
                await sock.sendMessage(targetJid, {
                    document: buffer,
                    mimetype: quoted.documentMessage.mimetype || 'application/octet-stream',
                    fileName: quoted.documentMessage.fileName || 'document',
                    contextInfo: STYLE,
                });
                sent = true;
            } else if (quoted.conversation || quoted.extendedTextMessage?.text) {
                const txt = quoted.conversation || quoted.extendedTextMessage?.text || '';
                await sock.sendMessage(targetJid, {
                    text: txt,
                    contextInfo: STYLE,
                });
                sent = true;
            }

            if (sent) {
                await sock.sendMessage(jid, {
                    text:
                        '✅ *Forwarded!*\n\n' +
                        `🎯 *Target:* \`${targetJid}\`\n` +
                        `📄 *Type:* ${Object.keys(quoted)[0] || 'message'}\n\n` +
                        '⚡ _Zenitsu_',
                    contextInfo: STYLE,
                }, { quoted: msg });
                try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
            } else {
                throw new Error('Unsupported media type');
            }

        } catch (err) {
            console.error('❌ forward error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: `❌ Failed: ${err.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
