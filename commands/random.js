// ./commands/random.js

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

// Types d'images aléatoires disponibles
const TYPES = {
    'ba': 'ba',
    'anime': 'anime',
    'cat': 'cat',
    'dog': 'dog',
    'memes': 'memes',
};

module.exports = {
    name: 'random',
    aliases: ['rand', 'randomimage', 'img'],
    category: 'fun',

    async execute({ sock, msg, args, jid }) {
        const type = args[0]?.toLowerCase() || 'ba';
        
        // Vérifier si le type est supporté
        if (!Object.keys(TYPES).includes(type)) {
            return sock.sendMessage(jid, {
                text: '🖼️ *Random Image Generator*\n\n' +
                      '⚡ *Usage:* .random <type>\n\n' +
                      '📌 *Available types:*\n' +
                      '• ba - Random image\n' +
                      '• anime - Random anime\n' +
                      '• cat - Random cat\n' +
                      '• dog - Random dog\n' +
                      '• memes - Random meme\n\n' +
                      '✨ *Examples:*\n' +
                      '.random ba\n' +
                      '.random cat',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '🔄', key: msg.key } });

            // Utiliser l'API ZellAPI pour les images aléatoires
            const url = `https://zellapi.autos/random/${type}`;
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
            });
            const buffer = Buffer.from(response.data);

            // Vérifier si c'est une image valide
            if (buffer.length < 1000) {
                throw new Error('Invalid image received');
            }

            await sock.sendMessage(jid, {
                image: buffer,
                caption: `🖼️ *Random ${type.charAt(0).toUpperCase() + type.slice(1)}*\n\n` +
                         `⚡ _Powered by Zenitsu AI_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('❌ Random error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to fetch random image*\n\n' +
                      `⚠️ Error: ${err.message}\n\n` +
                      '💡 Try again with a different type.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
