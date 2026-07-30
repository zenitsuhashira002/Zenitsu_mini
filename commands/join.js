// ./commands/join.js

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
    name: 'join',
    aliases: ['joinGroup', 'enter'],
    category: 'owner',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;

        // Vérifier si l'expéditeur est autorisé
        if (!isOwner(sock, senderJid)) {
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
            await sock.groupAcceptInvite(code);

            // Confirmation
            await sock.sendMessage(jid, {
                text: '✅ Successfully joined the group!',
                contextInfo: STYLE,
            }, { quoted: msg });

        } catch (error) {
            console.error('❌ join error:', error.message);
            await sock.sendMessage(jid, {
                text: `❌ Failed to join the group:\n${error.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
