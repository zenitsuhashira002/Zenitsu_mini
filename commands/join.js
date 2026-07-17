// ./commands/join.js

function getRawNumber(jid) {
    if (!jid) return '';
    let num = jid.split('@')[0];
    num = num.split(':')[0];
    return num.trim();
}

function isOwnerOrBot(sock, senderJid) {
    const senderRaw = getRawNumber(senderJid);
    const botIds = [];
    if (sock.user?.id) botIds.push(getRawNumber(sock.user.id));
    if (sock.user?.lid) botIds.push(getRawNumber(sock.user.lid));
    botIds.push(process.env.OWNER_NUMBER || '50935729494');
    return botIds.includes(senderRaw);
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
