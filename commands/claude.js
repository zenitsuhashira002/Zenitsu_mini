// ./commands/claude

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
    
    // Priority fields
    const fields = ['result', 'reply', 'response', 'answer', 'text', 'content', 'message', 'output', 'data'];
    for (const field of fields) {
        if (data[field] && typeof data[field] === 'string' && data[field].trim().length > 5) {
            return data[field].trim();
        }
    }
    
    // Last chance: any string > 10 chars
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

const APIS = [
    {
        name: 'DavidCyril Claude-Sonnet',
        url: (q) => `https://apis.davidcyriltech.my.id/ai/claude-sonnet-4.6?prompt=${encodeURIComponent(q)}`,
        timeout: 50000,
    },
    {
        name: 'DavidCyril GPT-3',
        url: (q) => `https://apis.davidcyriltech.my.id/ai/gpt3?text=${encodeURIComponent(q)}`,
        timeout: 40000,
    },
    {
        name: 'PrinceTech GPT-4o',
        url: (q) => `https://api.princetechn.com/api/ai/gpt4o?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 35000,
    },
    {
        name: 'PrinceTech GPT-4',
        url: (q) => `https://api.princetechn.com/api/ai/gpt?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 35000,
    },
    {
        name: 'Yupra GPT-5',
        url: (q) => `https://api.yupra.my.id/api/ai/gpt5?text=${encodeURIComponent(q)}`,
        timeout: 40000,
    },
];

function getLocalFallback(query) {
    const q = query.toLowerCase().trim();
    const responses = {
        'hello': 'Hello! I\'m Claude. How can I assist you today? 🧠',
        'hi': 'Hi there! 👋 I\'m Claude AI, ready to help!',
        'bonjour': 'Bonjour! Je suis Claude AI. Comment puis-je vous aider? 🧠',
        'salut': 'Salut! 😊 Je suis Claude AI, à votre service!',
        'who are you': 'I\'m Claude AI, an advanced language model! 🧠',
        'qui es-tu': 'Je suis Claude AI, un modèle de langage avancé! 🧠',
        'what is your name': 'My name is Venice AI! ⚡',
        'comment tu t\'appelles': 'Je m\'appelle Venice AI! ⚡',
    };
    return responses[q] || null;
}

module.exports = {
    name: 'claude',
    aliases: ['veniceai', 'vai'],
    category: 'ai',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text: '🧠 *Claude AI*\n\n' +
                      '⚡ *Usage:* .claude <your question>\n\n' +
                      '✨ *Examples:*\n' +
                      '• .Claude What is your model?\n' +
                      '• .claude Write a poem\n' +
                      '• .claude Explain machine learning\n\n' +
                      '💬 *Powered by Zenitsu(Claude + GPT)*',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Cache check
        const cached = getCached(query);
        if (cached) {
            await sock.sendMessage(jid, {
                text: `🧠 *Claude AI*\n\n` +
                      `❓ *Q:* ${query.slice(0, 200)}${query.length > 200 ? '...' : ''}\n\n` +
                      `💬 *A:* ${cached}\n\n` +
                      `⚡ _Cached Response_`,
                contextInfo: STYLE,
            }, { quoted: msg });
            try { await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } }); } catch (_) {}
            return;
        }

        try { await sock.sendMessage(jid, { react: { text: '🧠', key: msg.key } }); } catch (_) {}

        let reply = '';
        let used = '';
        let errors = [];

        for (let i = 0; i < APIS.length; i++) {
            const api = APIS[i];
            try {
                console.log(`🧠 Claude: Trying ${api.name}...`);

                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
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
                const msg = err.code === 'ECONNABORTED' ? 'Timeout' : err.message;
                console.log(`❌ ${api.name}: ${msg}`);
                errors.push(`${api.name}: ${msg.slice(0, 20)}`);

                if (err.code === 'ECONNABORTED') {
                    await new Promise(resolve => setTimeout(resolve, 1500));
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
                text: `❌ *Claude AI Unavailable*\n\n` +
                      `💡 *Tips:*\n` +
                      `• Try again in a few moments\n` +
                      `• Simplify your question\n\n` +
                      `⚠️ *Failed APIs:*\n${errorList}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        setCache(query, reply);

        // Limiter la longueur
        const formatted = reply.length > 3900
            ? reply.slice(0, 3850) + '...\n\n📝 *Response truncated*'
            : reply;

        await sock.sendMessage(jid, {
            text: `🧠 *Claude AI*\n\n` +
                  `❓ *Q:* ${query.slice(0, 200)}${query.length > 200 ? '...' : ''}\n\n` +
                  `💬 *A:* ${formatted}\n\n` +
                  `🔧 *Provider:* ${used}\n` +
                  `⚡ _Powered by Zenitsu_`,
                contextInfo: STYLE,
            }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
