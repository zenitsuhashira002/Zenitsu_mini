// ./commands/decode.js
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

module.exports = {
    name: 'decode',
    aliases: ['binarydecode', 'frombinary'],
    category: 'fun',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');
        if (!query || query.trim().length < 8) {
            return sock.sendMessage(jid, {
                text: '🔢 *Binary Decoder*\n\n⚡ *Usage:* .decode <binary>\n\n✨ *Examples:*\n.decode 0110100001100101011011000110110001101111\n.decode 01011010 01100101 01101110 01101001 01110100 01110011 01110101',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '🔢', key: msg.key } });
            
            const url = `https://api.popcat.xyz/v2/decode?binary=${encodeURIComponent(query)}`;
            const response = await axios.get(url, { timeout: 10000 });
            const data = response.data;

            const text = data?.text || data?.result || 'Error decoding';

            await sock.sendMessage(jid, {
                text: `🔢 *Binary Decoder*\n\n📟 *Binary:* ${query}\n\n💬 *Text:* ${text}\n\n⚡ _Zenitsu AI_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.log(`❌ Decode error: ${err.message}`);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to decode binary.*\n\nMake sure it\'s valid binary (0s and 1s).',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    }
};
