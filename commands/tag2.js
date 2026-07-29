// ./commands/tag2.js
module.exports = {
    name: 'tag2',
    aliases: ['hidetag', 'invisibletag', 'silenttag'],
    category: 'group',

    async execute({ sock, msg, args, jid }) {
        const isGroup = jid.endsWith('@g.us');

        if (!isGroup) {
            return sock.sendMessage(jid, {
                text: '❌ This command only works in groups.',
            }, { quoted: msg });
        }

        try {
            const groupMetadata = await sock.groupMetadata(jid);
            const participants = groupMetadata.participants;

            // ⭐ Membres NON-ADMINS seulement
            const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
            const nonAdmins = participants.filter(p => !admins.includes(p.id)).map(p => p.id);

            if (nonAdmins.length === 0) {
                return sock.sendMessage(jid, {
                    text: '⚠️ No non-admin members to tag.',
                }, { quoted: msg });
            }

            // Reaction
            try { await sock.sendMessage(jid, { react: { text: '👻', key: msg.key } }); } catch (_) {}

            // Message
            const customMessage = args.length > 0 ? args.join(' ') : 'Wait';

            // ⭐ Envoyer SANS style CyberNova
            const sentMsg = await sock.sendMessage(jid, {
                text: customMessage,
                contextInfo: {
                    mentionedJid: nonAdmins,
                },
            });

            // Modifier pour cacher les mentions
            if (sentMsg?.key) {
                await new Promise(r => setTimeout(r, 500));
                try {
                    await sock.sendMessage(jid, {
                        text: customMessage,
                        edit: sentMsg.key,
                    });
                } catch (_) {}
            }

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ tag2 error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        }
    },
};
