// ./commands/join.js

function getRawNumber(jid) {
    if (!jid) return '';
    let num = jid.split('@')[0];
    num = num.split(':')[0];
    return num.trim();
}

function isOwnerOrBot(sock, senderJid) {
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
    if (global.subBots && global.subBots instanceof Map) {
        for (const [subNumber, subData] of global.subBots) {
            if (getRawNumber(subNumber) === senderRaw && subData.sock === sock) {
                return true;
            }
        }
    }

    return false;
}

// Style CyberNova
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
    name: 'join',
    aliases: ['joinGroup', 'enter'],
    category: 'owner',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;

        // Vérifier si l'expéditeur est autorisé
        if (!isOwnerOrBot(sock, senderJid)) {
            return; // Silencieux
        }

        const link = args[0];

        // Vérifier si le lien est valide
        if (!link || !link.includes('chat.whatsapp.com')) {
            await sock.sendMessage(jid, {
                text: '❌ Please provide a valid WhatsApp group invite link.\n\nExample: `.join https://chat.whatsapp.com/XXXXXXX`',
                contextInfo: STYLE,
            }, { quoted: msg });
            return;
        }

        // Extraire le code d'invitation
        const code = link.split('chat.whatsapp.com/')[1]?.split(/[/?#]/)[0];

        if (!code) {
            await sock.sendMessage(jid, {
                text: '❌ Invalid invite link. Could not extract the code.',
                contextInfo: STYLE,
            }, { quoted: msg });
            return;
        }

        try {
            // Tenter de rejoindre le groupe
            const result = await sock.groupAcceptInvite(code);
            
            // Confirmation silencieuse
            await sock.sendMessage(jid, {
                text: '✅ Successfully joined the group!',
                contextInfo: STYLE,
            }, { quoted: msg });

        } catch (error) {
            console.error('❌ join error:', error.message);
            
            // Message d'erreur en cas d'échec
            await sock.sendMessage(jid, {
                text: `❌ Failed to join the group:\n${error.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
