// ./commands/getppgc.js

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
    name: 'getppgc',
    aliases: ['ppgc', 'grouppp', 'gcpp'],
    category: 'tools',

    async execute({ sock, msg, args, jid }) {
        // Si un lien est fourni
        let groupJid = jid;
        let groupName = '';

        const input = args[0];

        if (input && input.includes('chat.whatsapp.com')) {
            // Extraire le code du lien
            const code = input.split('chat.whatsapp.com/')[1]?.split(/[/?#]/)[0];
            if (code) {
                groupJid = `${code}@g.us`;
            }
        } else if (input && /^\d+$/.test(input.replace(/[^0-9]/g, ''))) {
            // Numéro de groupe direct
            groupJid = `${input.replace(/[^0-9]/g, '')}@g.us`;
        }

        if (!groupJid?.endsWith('@g.us')) {
            return sock.sendMessage(jid, {
                text:
                    '🖼️ *Group Profile Picture*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.getppgc (in a group)\n' +
                    '.getppgc <group_link>\n' +
                    '.getppgc <group_jid>\n\n' +
                    '✨ *Examples:*\n' +
                    '.getppgc\n' +
                    '.getppgc https://chat.whatsapp.com/xxx\n' +
                    '.getppgc 120363410243397177',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🖼️', key: msg.key } }); } catch (_) {}

        try {
            // Récupérer les infos du groupe
            let metadata;
            try {
                metadata = await sock.groupMetadata(groupJid);
                groupName = metadata?.subject || 'Group';
            } catch (_) {
                groupName = 'Group';
            }

            // Récupérer la photo de profil
            let ppUrl;
            try {
                ppUrl = await sock.profilePictureUrl(groupJid, 'image');
            } catch (_) {}

            if (!ppUrl) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: '❌ No profile picture found for this group.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Envoyer la photo
            await sock.sendMessage(jid, {
                image: { url: ppUrl },
                caption:
                    '🖼️ *Group Profile Picture*\n\n' +
                    `📢 *Group:* ${groupName}\n` +
                    `🆔 *JID:* \`${groupJid}\`\n\n` +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ getppgc:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: '❌ Failed to get group profile picture.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
