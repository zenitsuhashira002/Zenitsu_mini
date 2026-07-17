// ./commands/join.js

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
module.exports = {
    name: 'join',
    aliases: ['joinGroup', 'enter'],
    category: 'owner',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;

        if (!isOwnerOrBot(sock, senderJid)) {
            return; // Silencieux
        }

        const link = args[0];

        if (!link || !link.includes('chat.whatsapp.com')) {
            return; // Silencieux
        }

        // Extraire le code d'invitation
        const code = link.split('chat.whatsapp.com/')[1]?.split(/[/?#]/)[0];

        if (!code) return;

        try {
            await sock.groupAcceptInvite(code);
        } catch (_) {}

        // Silencieux — pas de confirmation
    },
};
