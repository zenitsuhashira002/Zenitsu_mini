// ./commands/blur.js
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

module.exports = {
    name: 'blur',
    aliases: ['flou'],
    category: 'fun',

    async execute({ sock, msg, args, jid }) {
        // Vérifier si une image est attachée ou mentionnée
        let imageUrl = null;
        
        // 1. Vérifier si l'utilisateur a fourni une URL
        if (args.length > 0 && args[0].startsWith('http')) {
            imageUrl = args[0];
        }
        
        // 2. Vérifier si une image est attachée au message
        if (!imageUrl && msg.message?.imageMessage) {
            try {
                const media = await sock.downloadMediaMessage(msg);
                const buffer = Buffer.from(media);
                imageUrl = await uploadToCatbox(buffer);
            } catch (err) {
                console.log(`❌ Upload error: ${err.message}`);
            }
        }
        
        // 3. Utiliser la photo de profil de l'utilisateur
        if (!imageUrl) {
            try {
                const pfp = await sock.profilePictureUrl(msg.key.participant || msg.key.remoteJid, 'image');
                imageUrl = pfp;
            } catch (_) {
                // Pas de photo de profil
            }
        }

        if (!imageUrl) {
            return sock.sendMessage(jid, {
                text: '🌫️ *Blur Image*\n\n⚡ *Usage:*\n.blur <image_url>\n.blur (with attached image)\n.blur (uses your profile picture)\n\n✨ *Examples:*\n.blur https://example.com/image.jpg',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '🌫️', key: msg.key } });
            
            const url = `https://api.popcat.xyz/v2/blur?image=${encodeURIComponent(imageUrl)}`;
            const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
            const buffer = Buffer.from(response.data);

            await sock.sendMessage(jid, {
                image: buffer,
                caption: `🌫️ *Blurred Image*\n\n⚡ _Zenitsu AI_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.log(`❌ Blur error: ${err.message}`);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to blur image.*\n\nTry again with a valid image URL.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    }
};
