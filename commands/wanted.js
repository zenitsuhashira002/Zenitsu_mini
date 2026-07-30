// ./commands/wanted.js

const axios = require('axios');
const { uploadToCatbox } = require('../utils/uploader');

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

// ═══════════════════════════════════════
// UTILS — Récupération du nom d'un contact
// ═══════════════════════════════════════

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
        if (sock.contacts && sock.contacts instanceof Map) {
            const contact = sock.contacts.get(jid);
            if (contact && contact.name) return contact.name;
        }
        if (jid.endsWith('@g.us')) {
            try {
                const metadata = await sock.groupMetadata(jid);
                const participant = metadata.participants.find(p => p.id === jid);
                if (participant && participant.name) return participant.name;
            } catch (_) {}
        }
        return jid.split('@')[0];
    } catch (_) {
        return jid.split('@')[0];
    }
}

// ═══════════════════════════════════════
// Récupération des mentions
// ═══════════════════════════════════════

function getMentionedJid(msg) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    return mentioned;
}

// ═══════════════════════════════════════
// COMMANDE
// ═══════════════════════════════════════

module.exports = {
    name: 'wanted',
    aliases: ['wantedposter', 'avisrecherche'],
    category: 'fun',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        let imageUrl = null;
        let targetJid = null;

        // 1. Si mention, utiliser la photo de la personne mentionnée
        const mentioned = getMentionedJid(msg);
        if (mentioned.length > 0) {
            targetJid = mentioned[0];
            try {
                imageUrl = await sock.profilePictureUrl(targetJid, 'image');
            } catch (_) {
                imageUrl = null;
            }
        }

        // 2. Sinon, utiliser la photo de l'utilisateur qui commande
        if (!imageUrl) {
            targetJid = senderJid;
            try {
                imageUrl = await sock.profilePictureUrl(senderJid, 'image');
            } catch (_) {
                imageUrl = null;
            }
        }

        // 3. Si l'utilisateur a fourni une URL en argument
        if (!imageUrl && args.length > 0 && args[0].startsWith('http')) {
            imageUrl = args[0];
        }

        if (!imageUrl) {
            return sock.sendMessage(jid, {
                text: '🔍 *Wanted Poster Generator*\n\n' +
                      '⚡ *Usage:*\n' +
                      '.wanted (uses your profile pic)\n' +
                      '.wanted @user (uses mentioned user\'s pic)\n' +
                      '.wanted <image_url>\n\n' +
                      '💡 Make sure the target has a profile picture!',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } });

            // ⭐ Télécharger et réuploader sur Catbox pour une URL stable
            let finalImageUrl = imageUrl;
            try {
                const imgResponse = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 15000,
                });
                const buffer = Buffer.from(imgResponse.data);
                const uploadedUrl = await uploadToCatbox(buffer);
                if (uploadedUrl) {
                    finalImageUrl = uploadedUrl;
                    console.log('✅ Image uploaded to Catbox:', finalImageUrl);
                }
            } catch (uploadErr) {
                console.log('⚠️ Upload fallback failed, using original URL:', uploadErr.message);
                // Garder l'URL originale
            }

            // Appel à l'API Popcat
            const url = `https://api.popcat.xyz/v2/wanted?image=${encodeURIComponent(finalImageUrl)}`;
            console.log('📤 Wanted URL:', url);

            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
                },
            });
            const buffer = Buffer.from(response.data);

            // Récupération du nom via getContactName (sans sock.getName)
            const name = await getContactName(sock, targetJid || senderJid);

            await sock.sendMessage(jid, {
                image: buffer,
                caption: `🔍 *WANTED*\n\n👤 @${name}\n⚡ _Zenitsu AI_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error(`❌ Wanted error:`, err.message);
            if (err.response) {
                console.error('Status:', err.response.status);
                console.error('Data:', err.response.data);
            }
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });

            let errorMsg = '❌ *Failed to generate wanted poster.*\n\n';
            if (err.response?.status === 502) {
                errorMsg += '⚠️ The image service is temporarily unavailable.\n';
                errorMsg += '💡 Try again later or use a different image.\n';
                errorMsg += '🔧 You can also try using the image URL directly: `.wanted <image_url>`';
            } else {
                errorMsg += `⚠️ Error: ${err.message}\n`;
                errorMsg += '💡 Try again with a different image.';
            }

            return sock.sendMessage(jid, {
                text: errorMsg,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
