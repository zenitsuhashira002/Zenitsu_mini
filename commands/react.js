// ./commands/react.js

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'react',
    aliases: ['r', 'reaction', 'emoji'],
    category: 'tools',

    async execute({ sock, msg, args, jid }) {
        // ═══════════════════════════════════
        // CAS 1 : Réagir à un message quoté (reply)
        // ═══════════════════════════════════

        const quoted = msg.message?.extendedTextMessage?.contextInfo;

        if (quoted?.stanzaId && args.length >= 1) {
            const emoji = args.join(' ').trim();

            const reactionKey = {
                remoteJid: jid,
                id: quoted.stanzaId,
                participant: quoted.participant || msg.key.participant || jid,
            };

            try {
                await sock.sendMessage(jid, {
                    react: { text: emoji, key: reactionKey },
                });
            } catch (_) {}
            return;
        }

        // ═══════════════════════════════════
        // CAS 2 : Réagir à un lien WhatsApp Channel
        // ═══════════════════════════════════

        // Format : .react https://whatsapp.com/channel/xxx ⚡
        // ou : .react whatsapp.com/channel/xxx ⚡

        if (args.length >= 2) {
            const possibleUrl = args[0];
            const emoji = args.slice(1).join(' ').trim();

            // Extraire l'ID du channel
            let channelId = '';
            if (possibleUrl.includes('whatsapp.com/channel/')) {
                channelId = possibleUrl.split('whatsapp.com/channel/')[1]?.split('/')[0]?.split('?')[0];
            }

            if (channelId) {
                const channelJid = `${channelId}@newsletter`;

                // Créer une clé de réaction pour le channel
                const reactionKey = {
                    remoteJid: channelJid,
                    id: 'status@broadcast',
                    participant: channelJid,
                };

                try {
                    await sock.sendMessage(channelJid, {
                        react: { text: emoji, key: reactionKey },
                    });
                } catch (_) {}

                // Confirmation discrète dans le chat actuel
                try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
                return;
            }
        }

        // ═══════════════════════════════════
        // CAS 3 : Réagir à un lien direct
        // ═══════════════════════════════════

        if (args.length >= 1 && args[0].startsWith('http')) {
            const link = args[0];
            const emoji = args.slice(1).join(' ').trim() || '⚡';

            // Essayer de réagir via le lien
            try {
                await sock.sendMessage(jid, {
                    react: { text: emoji, key: { remoteJid: link, id: '' } },
                });
            } catch (_) {}

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
            return;
        }

        // Si aucun cas ne correspond → silencieux
    },
};
