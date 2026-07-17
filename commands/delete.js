// ./commands/delete.js

// ═══════════════════════════════════════
// JID UTILS
// ═══════════════════════════════════════

function getRawNumber(jid) {
    if (!jid) return '';
    let num = jid.split('@')[0];
    num = num.split(':')[0];
    return num.trim();
}

async function isAdmin(sock, groupJid, userJid) {
    try {
        const metadata = await sock.groupMetadata(groupJid);
        if (!metadata?.participants) return false;
        const participant = metadata.participants.find(p => p.id === userJid);
        return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (_) {
        return false;
    }
}

function isBotSelf(sock, userJid) {
    const userRaw = getRawNumber(userJid);
    const botIds = [];
    if (sock.user?.id) botIds.push(getRawNumber(sock.user.id));
    if (sock.user?.lid) botIds.push(getRawNumber(sock.user.lid));
    return botIds.includes(userRaw);
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'delete',
    aliases: ['del', 'd', 'suppr'],
    category: 'group',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');

        // Vérifier permissions
        if (isGroup) {
            const senderIsAdmin = await isAdmin(sock, jid, senderJid);
            const senderIsBot = isBotSelf(sock, senderJid);
            if (!senderIsAdmin && !senderIsBot) {
                return; // Silencieux : pas de message, pas de réaction
            }
        } else {
            // En privé, seul le bot peut se supprimer lui-même
            if (!isBotSelf(sock, senderJid)) return;
        }

        // Récupérer le message quoté
        const quoted = msg.message?.extendedTextMessage?.contextInfo;

        if (!quoted?.stanzaId) {
            return; // Silencieux : pas de message quoté
        }

        // Construire la clé du message à supprimer
        const deleteKey = {
            remoteJid: jid,
            fromMe: false,
            id: quoted.stanzaId,
            participant: quoted.participant || msg.key.participant,
        };

        // Supprimer
        try {
            await sock.sendMessage(jid, { delete: deleteKey });
        } catch (_) {}
        // Aucune réaction, aucun message — silencieux
    },
};
