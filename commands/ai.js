// ./commands/ai.js

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
        name: 'PrinceTech GPT-4o',
        url: (q) => `https://api.princetechn.com/api/ai/gpt4?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 45000,
        extract: (data) => data?.result || data?.reply || data?.response || data?.answer || '',
    },
    {
        name: 'PrinceTech GPT-4',
        url: (q) => `https://api.princetechn.com/api/ai/gpt?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 45000,
        extract: (data) => data?.result || data?.reply || data?.response || data?.answer || '',
    },
    {
        name: 'PrinceTech Mistral',
        url: (q) => `https://api.princetechn.com/api/ai/mistral?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 45000,
        extract: (data) => data?.result || data?.reply || data?.response || data?.answer || '',
    },
    {
        name: 'Yupra GPT-5',
        url: (q) => `https://api.yupra.my.id/api/ai/gpt5?text=${encodeURIComponent(q)}`,
        timeout: 45000,
        extract: (data) => data?.result || data?.reply || data?.response || data?.answer || '',
    },
    {
        name: 'DavidCyril GPT-3',
        url: (q) => `https://apis.davidcyriltech.my.id/ai/gpt3?text=${encodeURIComponent(q)}`,
        timeout: 45000,
        extract: (data) => data?.result || data?.reply || data?.response || data?.answer || '',
    },
];

module.exports = {
    name: 'ai',
    aliases: ['gpt', 'chatgpt', 'openai'],
    category: 'ai',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');
        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text: '🤖 *AI Chat*\n\n⚡ .ai <question>\n\n✨ Examples:\n.ai What is AI?\n.ai Write a story',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🤖', key: msg.key } }); } catch (_) {}

        let reply = '';
        let used = '';

        for (const api of APIS) {
            try {
                console.log(`🤖 AI: ${api.name}...`);
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
            return sock.sendMessage(jid, { text: '❌ *All AI APIs unavailable.*', contextInfo: STYLE }, { quoted: msg });
        }

        await sock.sendMessage(jid, {
            text: `🤖 *AI Chat*\n\n❓ *Q:* ${query.slice(0, 200)}\n\n💬 *A:* ${reply}\n\n🔧 ${used}\n⚡ _Zenitsu_`,
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
