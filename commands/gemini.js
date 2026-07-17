// ./commands/gemini.js

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

const APIS = [
    {
        name: 'PrinceTech Gemini AI',
        url: (q) => `https://api.princetechn.com/api/ai/geminiai?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 30000,
        extract: (data) => data?.result || data?.reply || data?.response || data?.answer || data?.text || '',
    },
    {
        name: 'PrinceTech Gemini Pro',
        url: (q) => `https://api.princetechn.com/api/ai/geminiaipro?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 30000,
        extract: (data) => data?.result || data?.reply || data?.response || data?.answer || data?.text || '',
    },
    {
        name: 'DavidCyril Gemini',
        url: (q) => `https://apis.davidcyriltech.my.id/ai/gemini?text=${encodeURIComponent(q)}`,
        timeout: 30000,
        extract: (data) => data?.result || data?.reply || data?.response || data?.answer || data?.text || '',
    },
    {
        name: 'GiftedTech Gemini',
        url: (q) => `https://api.giftedtech.co.ke/api/ai/gemini?apikey=gifted&q=${encodeURIComponent(q)}`,
        timeout: 30000,
        extract: (data) => {
            if (typeof data === 'string') return data;
            return data?.result || data?.reply || data?.response || data?.answer || '';
        },
    },
];

module.exports = {
    name: 'gemini',
    aliases: ['google', 'bard'],
    category: 'ai',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');
        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text: '🧠 *Gemini AI*\n\n⚡ .gemini <question>\n\n✨ Examples:\n.gemini What is JavaScript?\n.gemini Write a poem',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🧠', key: msg.key } }); } catch (_) {}

        let reply = '';
        let used = '';

        for (const api of APIS) {
            try {
                console.log(`🧠 Gemini: ${api.name}...`);
                const { data } = await axios.get(api.url(query), { timeout: api.timeout });
                const extracted = api.extract(data);
                if (extracted && extracted.trim().length > 5) {
                    reply = extracted;
                    used = api.name;
                    console.log(`✅ ${api.name}`);
                    break;
                }
            } catch (err) {
                console.log(`⚠️ ${api.name}: ${err.message}`);
            }
        }

        if (!reply) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, { text: '❌ *All Gemini APIs unavailable.*\nTry again later.', contextInfo: STYLE }, { quoted: msg });
        }

        await sock.sendMessage(jid, {
            text: `🧠 *Gemini AI*\n\n❓ *Q:* ${query.slice(0, 200)}\n\n💬 *A:* ${reply}\n\n🔧 ${used}\n⚡ _Zenitsu_`,
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
