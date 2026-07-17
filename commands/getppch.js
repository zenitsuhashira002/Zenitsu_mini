// ./commands/getppch.js

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

module.exports = {
    name: 'getppch',
    aliases: ['ppch', 'channelpp', 'chpp', 'channelinfo'],
    category: 'tools',

    async execute({ sock, msg, args, jid }) {
        const input = args[0];

        if (!input || (!input.includes('whatsapp.com/channel/') && !input.includes('@newsletter'))) {
            return sock.sendMessage(jid, {
                text:
                    '📢 *Channel Info & Profile Picture*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.getppch <channel_link>\n' +
                    '.getppch <channel_jid>\n\n' +
                    '✨ *Examples:*\n' +
                    '.getppch https://whatsapp.com/channel/0029Vb8BKWwH5JLxq1ef1R43\n' +
                    '.getppch 120363425394543602@newsletter',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '📢', key: msg.key } }); } catch (_) {}

        try {
            // Extraire l'ID du channel
            let channelJid = input;
            if (input.includes('whatsapp.com/channel/')) {
                const id = input.split('whatsapp.com/channel/')[1]?.split(/[/?#]/)[0];
                if (id) channelJid = `${id}@newsletter`;
            }

            if (!channelJid.endsWith('@newsletter')) {
                throw new Error('Invalid channel ID');
            }

            // Récupérer les métadonnées du channel
            let metadata;
            try {
                metadata = await sock.newsletterMetadata('invite', channelJid.split('@')[0]);
            } catch (_) {}

            // Récupérer la photo de profil
            let ppUrl;
            try {
                ppUrl = await sock.profilePictureUrl(channelJid, 'image');
            } catch (_) {}

            if (!ppUrl && !metadata) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: '❌ Channel not found or inaccessible.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Construire les infos (ignorer si null/undefined)
            let infoText = '📢 *Channel Info*\n\n';

            if (metadata?.name) {
                infoText += `📌 *Name:* ${metadata.name}\n`;
            }
            if (metadata?.subscribers !== undefined) {
                infoText += `👥 *Subscribers:* ${metadata.subscribers?.toLocaleString() || 'N/A'}\n`;
            }
            if (metadata?.description) {
                infoText += `📝 *Description:* ${metadata.description}\n`;
            }
            if (metadata?.state) {
                infoText += `📊 *Status:* ${metadata.state}\n`;
            }
            if (metadata?.verification) {
                infoText += `✅ *Verified:* ${metadata.verification}\n`;
            }

            infoText += `🆔 *JID:* \`${channelJid}\`\n\n`;
            infoText += '⚡ _Zenitsu_';

            // Envoyer la photo + infos
            if (ppUrl) {
                await sock.sendMessage(jid, {
                    image: { url: ppUrl },
                    caption: infoText,
                    contextInfo: STYLE,
                }, { quoted: msg });
            } else {
                await sock.sendMessage(jid, {
                    text: infoText,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ getppch:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: '❌ Failed to get channel info.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
