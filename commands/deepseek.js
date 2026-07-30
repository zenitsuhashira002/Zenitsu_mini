// ./commands/deepseek.js

const axios = require('axios');

const STYLE = {
    forwardingScore: 355,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

function getCached(query) {
    const key = query.toLowerCase().trim();
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_DURATION) {
        return entry.data;
    }
    return null;
}

function setCache(query, data) {
    const key = query.toLowerCase().trim();
    cache.set(key, { data, timestamp: Date.now() });
    if (cache.size > 100) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        cache.delete(oldest[0]);
    }
}

function extractResponse(data) {
    if (!data) return '';
    if (typeof data === 'string') return data;
    
    const fields = ['result', 'reply', 'response', 'answer', 'text', 'content', 'message', 'output'];
    for (const field of fields) {
        if (data[field] && typeof data[field] === 'string' && data[field].trim().length > 5) {
            return data[field].trim();
        }
    }
    
    if (typeof data === 'object') {
        const values = Object.values(data);
        for (const val of values) {
            if (typeof val === 'string' && val.trim().length > 10) {
                return val.trim();
            }
        }
    }
    return '';
}

// ⭐ APIs TESTÉS DEEPSEEK
const APIS = [
    {
        name: 'PrinceTech DeepSeek-V3',
        url: (q) => `https://api.princetechn.com/api/ai/deepseek-v3?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 30000,
    },
    {
        name: 'PrinceTech DeepSeek-R1',
        url: (q) => `https://api.princetechn.com/api/ai/deepseek-r1?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 30000,
    },
    {
        name: 'David cyril V3.2 thinking',
        url: (q) => `https://apis.davidcyriltech.my.id/ai/deepseek-v3.2-thinking?prompt=${encodeURIComponent(q)}`,
        timeout: 40000,
    },
    {
        name: 'DavidCyril ',
        url: (q) => `https://apis.davidcyriltech.my.id/ai/deepseek-v4-pro?prompt=${encodeURIComponent(q)}`,
        timeout: 50000,
    },
];

function getLocalFallback(query) {
    const q = query.toLowerCase().trim();
    const responses = {
        'hello': 'Hello! I\'m DeepSeek AI. How can I assist you today? 🐋',
        'hi': 'Hi there! 👋 I\'m DeepSeek, ready to help!',
        'bonjour': 'Bonjour! Je suis DeepSeek AI. Comment puis-je vous aider? 🐋',
        'salut': 'Salut! 😊 Je suis DeepSeek, à votre service!',
        'who are you': 'I\'m DeepSeek AI, a powerful language model! 🐋',
        'qui es-tu': 'Je suis DeepSeek AI, un modèle de langage puissant! 🐋',
        'what is your name': 'My name is DeepSeek AI! 🐋',
        'comment tu t\'appelles': 'Je m\'appelle DeepSeek AI! 🐋',
    };
    return responses[q] || null;
}

module.exports = {
    name: 'deepseek',
    aliases: ['ds', 'deepseekai', 'deepseek2'],
    category: 'ai',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text: '🐋 *DeepSeek AI*\n\n' +
                      '⚡ *Usage:* .deepseek <question>\n\n' +
                      '✨ *Examples:*\n' +
                      '• .deepseek Explain quantum physics\n' +
                      '• .deepseek Write a JavaScript function\n' +
                      '• .deepseek What is AI?\n\n' +
                      '🔧 *Powered by DeepSeek-V3 & R1*',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Cache check
        const cached = getCached(query);
        if (cached) {
            await sock.sendMessage(jid, {
                text: `🐋 *DeepSeek AI*\n\n` +
                      `❓ *Q:* ${query.slice(0, 200)}${query.length > 200 ? '...' : ''}\n\n` +
                      `💬 *A:* ${cached}\n\n` +
                      `⚡ _Zenitsu AI (cached)_`,
                contextInfo: STYLE,
            }, { quoted: msg });
            try { await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } }); } catch (_) {}
            return;
        }

        try { await sock.sendMessage(jid, { react: { text: '🐋', key: msg.key } }); } catch (_) {}

        let reply = '';
        let used = '';
        let errors = [];

        for (let i = 0; i < APIS.length; i++) {
            const api = APIS[i];
            try {
                console.log(`🐋 DeepSeek: Trying ${api.name}...`);

                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1200));
                }

                const response = await axios.get(api.url(query), {
                    timeout: api.timeout,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
                        'Accept': 'application/json',
                    },
                    validateStatus: (status) => status < 500,
                });

                console.log(`📊 ${api.name}: Status ${response.status}`);

                if (response.status === 200 || response.status === 201) {
                    const extracted = extractResponse(response.data);
                    if (extracted && extracted.trim().length > 10) {
                        reply = extracted.trim();
                        used = api.name;
                        console.log(`✅ ${api.name} succeeded`);
                        break;
                    } else {
                        console.log(`⚠️ ${api.name}: Empty response`);
                        errors.push(`${api.name}: Empty`);
                    }
                } else {
                    console.log(`⚠️ ${api.name}: HTTP ${response.status}`);
                    errors.push(`${api.name}: HTTP ${response.status}`);
                }
            } catch (err) {
                const msg = err.code === 'ECONNABORTED' ? 'Timeout (55s)' : err.message;
                console.log(`❌ ${api.name}: ${msg}`);
                errors.push(`${api.name}: ${msg.slice(0, 20)}`);

                if (err.code === 'ECONNABORTED') {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        // Local fallback
        if (!reply) {
            const fallback = getLocalFallback(query);
            if (fallback) {
                reply = fallback;
                used = 'Local AI (fallback)';
                console.log('✅ Local fallback used');
            }
        }

        if (!reply) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            const errorList = errors.slice(0, 3).map(e => `• ${e}`).join('\n');
            return sock.sendMessage(jid, {
                text: `❌ *All DeepSeek APIs unavailable.*\n\n` +
                      `💡 *Tips:*\n` +
                      `• Try again in a few moments\n` +
                      `• Simplify your question\n\n` +
                      `⚠️ *Failed APIs:*\n${errorList}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        setCache(query, reply);

        const formatted = reply.length > 3900
            ? reply.slice(0, 3850) + '...\n\n📝 *Response truncated*'
            : reply;

        await sock.sendMessage(jid, {
            text: `🐋 *DeepSeek AI*\n\n` +
                  `❓ *Q:* ${query.slice(0, 200)}${query.length > 200 ? '...' : ''}\n\n` +
                  `💬 *A:* ${formatted}\n\n` +
                  `🔧 *Provider:* ${used}\n` +
                  `⚡ _Powered by Zenitsu AI_`,
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
