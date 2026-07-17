// ./commands/leave.js
function getRawNumber(jid) {
    if (!jid) return '';
    let num = jid.split('@')[0];
    num = num.split(':')[0];
    return num.trim();
}

function isOwner(sock, senderJid) {
    if (!senderJid) return false;
    const senderRaw = getRawNumber(senderJid);

    // 1. Vérifier si le sender est le bot LUI-MÊME (sub-bot ou principal)
    const botIds = [];
    if (sock.user?.id) botIds.push(getRawNumber(sock.user.id));
    if (sock.user?.lid) botIds.push(getRawNumber(sock.user.lid));

    // Si le sender est le bot lui-même → OK
    if (botIds.includes(senderRaw)) return true;

    // 2. Vérifier si le sender est l'owner configuré
    const ownerNumber = process.env.OWNER_NUMBER || '50935729494';
    if (senderRaw === ownerNumber) return true;

    // 3. Vérifier si le sender est un sub-bot enregistré
    // (Les sub-bots sont stockés dans une Map globale ou dans le main.js)
    if (global.subBots && global.subBots instanceof Map) {
        for (const [subNumber, subData] of global.subBots) {
            if (getRawNumber(subNumber) === senderRaw && subData.sock === sock) {
                return true; // Ce sub-bot est bien le sender
            }
        }
    }

    return false;
}

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

        if (!isOwnerOrBot(sock, senderJid)) {
            return; // Silencieux
        }

        const subCommand = args[0]?.toLowerCase();

        // ═══════════════════
        // PAS DE "force" → AVERTISSEMENT
        // ═══════════════════

        if (subCommand !== 'force') {
            if (isGroup) {
                // Avertissement dans le groupe
                await sock.sendMessage(jid, {
                    text:
                        '⚠️ *Leave Warning*\n\n' +
                        'This group will be abandoned by the bot.\n\n' +
                        '📌 Type *.leave force* to confirm.\n' +
                        '⏳ This will expire in 30 seconds.',
                    contextInfo: STYLE,
                }, { quoted: msg });

                // Stocker la demande en attente
                if (!global._pendingLeave) global._pendingLeave = new Map();
                global._pendingLeave.set(jid, Date.now() + 30000);

                // Auto-clean
                setTimeout(() => {
                    if (global._pendingLeave?.get(jid) < Date.now()) {
                        global._pendingLeave.delete(jid);
                    }
                }, 30000);
            }
            return;
        }

        // ═══════════════════
        // "force" → EXÉCUTER
        // ═══════════════════

        // Vérifier si la demande est encore valide (si en groupe)
        if (isGroup) {
            const pending = global._pendingLeave?.get(jid);
            if (!pending || Date.now() > pending) {
                return sock.sendMessage(jid, {
                    text: '⚠️ *Expired!*\n\nType .leave force again.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
            global._pendingLeave.delete(jid);
        }

        try {
            // Récupérer les membres avant de quitter (pour le groupe)
            if (isGroup) {
                let metadata;
                try {
                    metadata = await sock.groupMetadata(jid);
                } catch (_) {}

                if (metadata?.participants) {
                    const allMembers = metadata.participants.map(p => p.id);
                    const groupName = metadata.subject || 'Group';

                    // Message d'abandon avec mention invisible de tous les membres
                    await sock.sendMessage(jid, {
                        text:
                            '👋 *Goodbye!*\n\n' +
                            `📢 *${groupName}*\n` +
                            ' I leave this trash.\n\n' +
                            '⚡ _Zenitsu_',
                        contextInfo: {
                            mentionedJid: allMembers,
                            ...STYLE,
                        },
                    });
                }
            }

            // Quitter le groupe
            await sock.groupLeave(jid);

        } catch (err) {
            console.error('❌ leave error:', err.message);
        }
    },
};
