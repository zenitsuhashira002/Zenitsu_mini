// ./commands/ai.js

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

// Cache simple (5 minutes)
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

// Extraction générique robuste
function extractResponse(data) {
    if (!data) return '';
    if (typeof data === 'string') return data;
    
    // Priorités d'extraction
    const fields = ['result', 'reply', 'response', 'answer', 'text', 'content', 'message', 'output', 'data'];
    for (const field of fields) {
        if (data[field] && typeof data[field] === 'string' && data[field].trim().length > 5) {
            return data[field].trim();
        }
    }
    
    // Dernière chance: toute string > 10 chars
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

// ⭐ APIs TESTÉS ET VRAIMENT FONCTIONNELS
const APIS = [
    // DavidCyril (très fiable)
    {
        name: 'DavidCyril Claude-Sonnet-4.6',
        url: (q) => `https://apis.davidcyriltech.my.id/ai/claude-sonnet-4.6?prompt=${encodeURIComponent(q)}`,
        timeout: 50000,
    },
    {
        name: 'DavidCyril GPT-3',
        url: (q) => `https://apis.davidcyriltech.my.id/ai/gpt3?text=${encodeURIComponent(q)}`,
        timeout: 40000,
    },
    // PrinceTech (fiable)
    {
        name: 'PrinceTech Mistral',
        url: (q) => `https://api.princetechn.com/api/ai/mistral?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 40000,
    },
    {
        name: 'PrinceTech DeepSeek-V3',
        url: (q) => `https://api.princetechn.com/api/ai/deepseek-v3?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 50000,
    },
    {
        name: 'PrinceTech DeepSeek-R1',
        url: (q) => `https://api.princetechn.com/api/ai/deepseek-r1?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 50000,
    },
    // Yupra (fiable)
    {
        name: 'Yupra GPT-5',
        url: (q) => `https://api.yupra.my.id/api/ai/gpt5?text=${encodeURIComponent(q)}`,
        timeout: 40000,
    },
];

// Fallback local
function getLocalFallback(query) {
    const q = query.toLowerCase().trim();
    const responses = {
        'hello': 'Hello! I\'m Zenitsu AI. How can I assist you today? 🤖',
        'hi': 'Hi there! 👋 I\'m Zenitsu AI, ready to help!',
        'bonjour': 'Bonjour! Je suis Zenitsu AI. Comment puis-je vous aider? 🤖',
        'salut': 'Salut! 😊 Je suis Zenitsu AI, à votre service!',
        'who are you': 'I\'m Zenitsu AI, an advanced language model! 🤖',
        'qui es-tu': 'Je suis Zenitsu AI, un modèle de langage avancé! 🤖',
        'what is your name': 'My name is Zenitsu AI! ⚡',
        'comment tu t\'appelles': 'Je m\'appelle Zenitsu AI! ⚡',
    };
    return responses[q] || null;
}

module.exports = {
    name: 'ai',
    aliases: ['gpt', 'chatgpt', 'openai'],
    category: 'ai',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text: '🤖 *Zenitsu AI*\n\n' +
                      '⚡ *Usage:* .ai <your question>\n\n' +
                      '✨ *Examples:*\n' +
                      '• .ai What is AI?\n' +
                      '• .ai Write a poem\n' +
                      '• .ai Explain machine learning\n\n' +
                      '💬 *Models:* Claude, DeepSeek, Mistral, GPT & more',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Vérifier le cache
        const cached = getCached(query);
        if (cached) {
            await sock.sendMessage(jid, {
                text: `🤖 *Zenitsu AI*\n\n` +
                      `❓ *Q:* ${query.slice(0, 200)}${query.length > 200 ? '...' : ''}\n\n` +
                      `💬 *A:* ${cached}\n\n` +
                      `⚡ _Cached Response_`,
                contextInfo: STYLE,
            }, { quoted: msg });
            try { await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } }); } catch (_) {}
            return;
        }

        try { await sock.sendMessage(jid, { react: { text: '🤖', key: msg.key } }); } catch (_) {}

        let reply = '';
        let used = '';
        let errors = [];

        // Boucler à travers tous les APIs
        for (let i = 0; i < APIS.length; i++) {
            const api = APIS[i];
            try {
                console.log(`🤖 AI: Trying ${api.name}...`);

                // Délai entre tentatives (évite rate limiting)
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }

                const response = await axios.get(api.url(query), {
                    timeout: api.timeout,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
                        'Accept': 'application/json',
                    },
                    validateStatus: (status) => status < 500,
                });

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

        // Fallback local
        if (!reply) {
            const fallback = getLocalFallback(query);
            if (fallback) {
                reply = fallback;
                used = 'Local AI (fallback)';
                console.log('✅ Local fallback used');
            }
        }

        // Erreur ultime
        if (!reply) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            const errorList = errors.slice(0, 4).map(e => `• ${e}`).join('\n');
            return sock.sendMessage(jid, {
                text: `❌ *All AI APIs unavailable.*\n\n` +
                      `💡 *Tips:*\n` +
                      `• Try again in a few moments\n` +
                      `• Simplify your question\n\n` +
                      `⚠️ *Failed APIs:*\n${errorList}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Cache la réponse
        setCache(query, reply);

        // Limiter la longueur
        const formatted = reply.length > 3900
            ? reply.slice(0, 3850) + '...\n\n📝 *Response truncated*'
            : reply;

        // Envoyer la réponse
        await sock.sendMessage(jid, {
            text: `🤖 *Zenitsu AI*\n\n` +
                  `❓ *Q:* ${query.slice(0, 200)}${query.length > 200 ? '...' : ''}\n\n` +
                  `💬 *A:* ${formatted}\n\n` +
                  `🔧 *Provider:* ${used}\n` +
                  `⚡ _Powered by Zenitsu AI_`,
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
