// ./commands/vv2.js

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

function getBotJid(sock) {
    if (sock.user?.id) return sock.user.id.split(':')[0]; // "584168698003@s.whatsapp.net"
    if (sock.user?.lid) {
        const num = sock.user.lid.split('@')[0];
        return `${num}@s.whatsapp.net`;
    }
    return '';
}

module.exports = {
    name: 'vv2',
    aliases: ['viewonce2', 'saveforme', 'vvself'],
    category: 'tools',

    async execute({ sock, msg, args, jid }) {
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;

        if (!quoted) {
            return sock.sendMessage(jid, {
                text: '👁️ *View-Once Saver v2*\n\n⚡ .vv2 (reply to view-once)\n💡 Saves to bot chat.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        let mediaType = null;
        let mediaMessage = null;

        if (quoted.imageMessage?.viewOnce) {
            mediaType = 'image';
            mediaMessage = quoted.imageMessage;
        } else if (quoted.videoMessage?.viewOnce) {
            mediaType = 'video';
            mediaMessage = quoted.videoMessage;
        } else {
            return sock.sendMessage(jid, {
                text: '❌ Reply to a *view-once* image or video.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            // Même téléchargement que la commande vv (downloadContentFromMessage)
            const stream = await downloadContentFromMessage(mediaMessage, mediaType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            if (!buffer || buffer.length < 100) throw new Error('Download failed');

            const botJid = getBotJid(sock);
            if (!botJid) throw new Error('Bot JID not found');

            const caption = mediaMessage.caption || '';
            const senderJid = msg.key.participant || msg.key.remoteJid;
            const senderNumber = senderJid.split('@')[0].split(':')[0];
            const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
            const bot = sock.user.id || senderJid;
            if (mediaType === 'image') {
                await sock.sendMessage(senderJid, {
                    image: buffer,
                    caption: `👁️ *View-Once*\n👤 @${senderNumber}\n💬 ${jid.split('@')[0]}\n📦 ${sizeMB} MB\n⚡ _Zenitsu_`,
                    contextInfo: { mentionedJid: [senderJid], ...STYLE },
                });
            } else {
                await sock.sendMessage(senderJid, {
                    video: buffer,
                    caption: `👁️ *View-Once*\n👤 @${senderNumber}\n💬 ${jid.split('@')[0]}\n📦 ${sizeMB} MB\n⚡ _Zenitsu_`,
                    contextInfo: { mentionedJid: [senderJid], ...STYLE },
                });
            }

        } catch (err) {
            console.error('❌ vv2:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, { text: `❌ ${err.message}`, contextInfo: STYLE }, { quoted: msg });
        }
    },
};
