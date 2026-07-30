// ./commands/encode.js
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
    name: 'encode',
    aliases: ['binaryencode', 'tobinary'],
    category: 'fun',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');
        if (!query || query.trim().length < 1) {
            return sock.sendMessage(jid, {
                text: '🔢 *Binary Encoder*\n\n⚡ *Usage:* .encode <text>\n\n✨ *Examples:*\n.encode hello\n.encode Zenitsu',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '🔢', key: msg.key } });
            
            const url = `https://api.popcat.xyz/v2/encode?text=${encodeURIComponent(query)}`;
            const response = await axios.get(url, { timeout: 10000 });
            const data = response.data;

            const binary = data?.binary || data?.result || 'Error encoding';

            await sock.sendMessage(jid, {
                text: `🔢 *Binary Encoder*\n\n💬 *Text:* ${query}\n\n📟 *Binary:*\n${binary}\n\n⚡ _Zenitsu AI_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.log(`❌ Encode error: ${err.message}`);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to encode text.*\n\nTry again later.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    }
};
