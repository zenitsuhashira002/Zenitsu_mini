// ./commands/tag.js

module.exports = {
    name: 'tag',
    aliases: ['mention', 'everyone', 'all', 'tagall'],
    category: 'group',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');

        if (!isGroup) {
            return sock.sendMessage(jid, {
                text: '❌ This command only works in groups.',
            }, { quoted: msg });
        }

        try {
            const groupMetadata = await sock.groupMetadata(jid);
            const participants = groupMetadata.participants;

            // ⭐ Tous les membres (admins inclus)
            const allMembers = participants.map(p => p.id);

            if (allMembers.length === 0) {
                return sock.sendMessage(jid, {
                    text: '⚠️ No members to tag.',
                }, { quoted: msg });
            }

            // Reaction
            try { await sock.sendMessage(jid, { react: { text: '📢', key: msg.key } }); } catch (_) {}

            // Récupérer le message quoté
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            let textContent = '';

            if (quoted) {
                textContent = quoted.conversation
                    || quoted.extendedTextMessage?.text
                    || quoted.imageMessage?.caption
                    || quoted.videoMessage?.caption
                    || '';
            }

            // Message personnalisé ou texte quoté
            const customMessage = args.length > 0 ? args.join(' ') : '';
            const finalMessage = customMessage || textContent || '📢';

            // Envoyer avec toutes les mentions
            await sock.sendMessage(jid, {
                text: finalMessage,
                contextInfo: {
                    mentionedJid: allMembers,
                    forwardingScore: 350,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202,
                    },
                },
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ tag error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        }
    },
};
