// ./commands/leave.js

const { isOwner } = require('../utils/owner');

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
    name: 'leave',
    aliases: ['quit', 'exit', 'bye'],
    category: 'owner',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');

        // Vérifier si l'expéditeur est autorisé
        if (!isOwner(sock, senderJid)) {
            return; // Silencieux
        }

        // Si ce n'est pas un groupe
        if (!isGroup) {
            await sock.sendMessage(jid, {
                text: '❌ This command only works in groups.',
                contextInfo: STYLE,
            }, { quoted: msg });
            return;
        }

        const subCommand = args[0]?.toLowerCase();

        // ═══════════════════
        // PAS DE "force" → AVERTISSEMENT
        // ═══════════════════

        if (subCommand !== 'force') {
            await sock.sendMessage(jid, {
                text:
                    '⚠️ *Leave Warning*\n\n' +
                    'This group will be abandoned by the bot.\n\n' +
                    '📌 Type *.leave force* to confirm.\n' +
                    '⏳ This will expire in 30 seconds.',
                contextInfo: STYLE,
            }, { quoted: msg });

            if (!global._pendingLeave) global._pendingLeave = new Map();
            global._pendingLeave.set(jid, Date.now() + 30000);

            setTimeout(() => {
                if (global._pendingLeave?.get(jid) < Date.now()) {
                    global._pendingLeave.delete(jid);
                }
            }, 30000);
            return;
        }

        // ═══════════════════
        // "force" → EXÉCUTER
        // ═══════════════════

        const pending = global._pendingLeave?.get(jid);
        if (!pending || Date.now() > pending) {
            return sock.sendMessage(jid, {
                text: '⚠️ *Expired!*\n\nType .leave force again.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
        global._pendingLeave.delete(jid);

        try {
            let metadata;
            try {
                metadata = await sock.groupMetadata(jid);
            } catch (_) {}

            if (metadata?.participants) {
                const allMembers = metadata.participants.map(p => p.id);
                const groupName = metadata.subject || 'Group';

                await sock.sendMessage(jid, {
                    text:
                        '👋 *Goodbye!*\n\n' +
                        `📢 *${groupName}*\n` +
                        'I leave this trash.\n\n' +
                        '⚡ _Zenitsu_',
                    contextInfo: {
                        mentionedJid: allMembers,
                        ...STYLE,
                    },
                });
            }

            await sock.groupLeave(jid);

        } catch (err) {
            console.error('❌ leave error:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error leaving group:\n${err.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
