// ./commands/jail.js

const axios = require('axios');

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

function getMentionedJid(msg) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    return mentioned;
}

async function getAvatarUrl(sock, jid) {
    try {
        return await sock.profilePictureUrl(jid, 'image');
    } catch (_) {
        return null;
    }
}

async function getContactName(sock, jid) {
    try {
        if (typeof sock.getName === 'function') {
            const name = await sock.getName(jid);
            if (name) return name;
        }
        if (typeof sock.getContact === 'function') {
            const contact = await sock.getContact(jid);
            if (contact && contact.name) return contact.name;
        }
        return jid.split('@')[0];
    } catch (_) {
        return jid.split('@')[0];
    }
}

module.exports = {
    name: 'jail',
    aliases: ['prison'],
    category: 'fun',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        let imageUrl = null;
        let targetJid = null;
        let targetName = 'Unknown';

        // 1. Vérifier si une URL est fournie en argument
        if (args.length > 0 && args[0].startsWith('http')) {
            imageUrl = args[0];
            targetName = 'User';
        }

        // 2. Vérifier une mention
        if (!imageUrl) {
            const mentioned = getMentionedJid(msg);
            if (mentioned.length > 0) {
                targetJid = mentioned[0];
                imageUrl = await getAvatarUrl(sock, targetJid);
                targetName = await getContactName(sock, targetJid);
            }
        }

        // 3. Utiliser l'utilisateur qui commande
        if (!imageUrl) {
            targetJid = senderJid;
            imageUrl = await getAvatarUrl(sock, senderJid);
            targetName = await getContactName(sock, senderJid);
        }

        if (!imageUrl) {
            return sock.sendMessage(jid, {
                text: '⛓️ *Jail Overlay*\n\n' +
                      '⚡ *Usage:*\n' +
                      '.jail (uses your profile pic)\n' +
                      '.jail @user (uses mentioned user\'s pic)\n' +
                      '.jail <image_url>\n\n' +
                      '💡 Make sure the target has a profile picture!',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '⛓️', key: msg.key } });

            // Générer une raison de prison aléatoire
            const reasons = [
                'Crime: Too much swag 🕶️',
                'Crime: Being too fabulous 💅',
                'Crime: Criminal levels of drip 💧',
                'Crime: Stealing hearts ❤️',
                'Crime: Being too iconic 🌟',
                'Crime: Illegal levels of cool 😎',
                'Crime: Breaking the internet 💻',
                'Crime: Being undeniably attractive 😏',
                'Crime: Wearing sunglasses at night 😎🌙',
                'Crime: Walking with too much confidence 🚶',
                'Crime: Exceeding daily limit of swagger 🔥',
                'Crime: Looking too good for this group 🤩'
            ];
            const randomReason = reasons[Math.floor(Math.random() * reasons.length)];

            const url = `https://api.some-random-api.com/canvas/overlay/jail?avatar=${encodeURIComponent(imageUrl)}`;
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)' },
            });
            const buffer = Buffer.from(response.data);

            await sock.sendMessage(jid, {
                image: buffer,
                caption: `⛓️ *Jail Overlay*\n\n` +
                         `👤 *Name:* ${targetName}\n` +
                         `🔒 *Reason:* ${randomReason}\n` +
                         `⏳ *Sentence:* ${Math.floor(Math.random() * 30) + 1} years\n\n` +
                         `⚡ _Powered by Cybernova_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error('❌ Jail error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to generate jail overlay.*\n\n' +
                      `⚠️ Error: ${err.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
