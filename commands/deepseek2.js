// ./commands/deepseek.js

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
        name: 'PrinceTech DeepSeek-V3',
        url: (q) => `https://api.princetechn.com/api/ai/deepseek-v3?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 60000,
        extract: (data) => data?.result || data?.reply || data?.response || data?.answer || '',
    },
    {
        name: 'PrinceTech DeepSeek-R1',
        url: (q) => `https://api.princetechn.com/api/ai/deepseek-r1?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 60000,
        extract: (data) => data?.result || data?.reply || data?.response || data?.answer || '',
    },
    {
        name: 'PrinceTech DeepSeek-LLM',
        url: (q) => `https://api.princetechn.com/api/ai/deepseek-llm?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 60000,
        extract: (data) => data?.result || data?.reply || data?.response || data?.answer || '',
    },
    {
        name: 'DavidCyril DeepSeek-V3',
        url: (q) => `https://apis.davidcyriltech.my.id/ai/deepseek-v3?text=${encodeURIComponent(q)}`,
        timeout: 60000,
        extract: (data) => data?.result || data?.reply || data?.response || data?.answer || '',
    },
];

module.exports = {
    name: 'deepseek2',
    aliases: ['ds', 'deepseekai'],
    category: 'ai',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');
        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text: '🐋 *DeepSeek AI*\n\n⚡ .deepseek2 <question>\n\n✨ Examples:\n.deepseek2 Explain quantum physics\n.deepseek2 Write code',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🐋', key: msg.key } }); } catch (_) {}

        let reply = '';
        let used = '';

        for (const api of APIS) {
            try {
                console.log(`🐋 DeepSeek: ${api.name}...`);
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
            return sock.sendMessage(jid, { text: '❌ *All DeepSeek APIs unavailable.*', contextInfo: STYLE }, { quoted: msg });
        }

        await sock.sendMessage(jid, {
            text: `🐋 *DeepSeek AI*\n\n❓ *Q:* ${query.slice(0, 200)}\n\n💬 *A:* ${reply}\n\n🔧 ${used}\n⚡ _Zenitsu_`,
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
