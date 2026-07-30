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

// Cache simple pour éviter les appels répétés (5 minutes)
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
    // Nettoyer le cache si trop gros
    if (cache.size > 100) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        cache.delete(oldest[0]);
    }
}

const APIS = [
    {
        name: 'PrinceTech Gemini AI',
        url: (q) => `https://api.princetechn.com/api/ai/geminiai?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 45000,
        extract: (data) => {
            if (!data) return '';
            if (typeof data === 'string') return data;
            // Recherche dans plusieurs champs possibles
            const fields = ['result', 'reply', 'response', 'answer', 'text', 'content', 'message', 'output'];
            for (const field of fields) {
                if (data[field] && typeof data[field] === 'string' && data[field].trim().length > 5) {
                    return data[field];
                }
            }
            // Si c'est un objet avec des propriétés
            if (typeof data === 'object') {
                const values = Object.values(data);
                for (const val of values) {
                    if (typeof val === 'string' && val.trim().length > 10) {
                        return val;
                    }
                }
            }
            return '';
        },
    },
    {
        name: 'PrinceTech Gemini Pro',
        url: (q) => `https://api.princetechn.com/api/ai/geminiaipro?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 45000,
        extract: (data) => {
            if (!data) return '';
            if (typeof data === 'string') return data;
            const fields = ['result', 'reply', 'response', 'answer', 'text', 'content', 'message', 'output'];
            for (const field of fields) {
                if (data[field] && typeof data[field] === 'string' && data[field].trim().length > 5) {
                    return data[field];
                }
            }
            if (typeof data === 'object') {
                const values = Object.values(data);
                for (const val of values) {
                    if (typeof val === 'string' && val.trim().length > 10) {
                        return val;
                    }
                }
            }
            return '';
        },
    },
    {
        name: 'DavidCyril Gemini',
        url: (q) => `https://apis.davidcyriltech.my.id/ai/gemini?text=${encodeURIComponent(q)}`,
        timeout: 45000,
        extract: (data) => {
            if (!data) return '';
            if (typeof data === 'string') return data;
            const fields = ['result', 'reply', 'response', 'answer', 'text', 'content', 'message', 'output'];
            for (const field of fields) {
                if (data[field] && typeof data[field] === 'string' && data[field].trim().length > 5) {
                    return data[field];
                }
            }
            if (typeof data === 'object') {
                const values = Object.values(data);
                for (const val of values) {
                    if (typeof val === 'string' && val.trim().length > 10) {
                        return val;
                    }
                }
            }
            return '';
        },
    },
    {
        name: 'GiftedTech Gemini',
        url: (q) => `https://api.giftedtech.co.ke/api/ai/gemini?apikey=gifted&q=${encodeURIComponent(q)}`,
        timeout: 45000,
        extract: (data) => {
            if (!data) return '';
            if (typeof data === 'string') return data;
            const fields = ['result', 'reply', 'response', 'answer', 'text', 'content', 'message', 'output'];
            for (const field of fields) {
                if (data[field] && typeof data[field] === 'string' && data[field].trim().length > 5) {
                    return data[field];
                }
            }
            if (typeof data === 'object') {
                const values = Object.values(data);
                for (const val of values) {
                    if (typeof val === 'string' && val.trim().length > 10) {
                        return val;
                    }
                }
            }
            return '';
        },
    },
];

// Fallback local pour les requêtes simples
function getLocalFallback(query) {
    const q = query.toLowerCase().trim();
    const responses = {
        'hello': 'Hello! How can I help you today?',
        'hi': 'Hi there! 👋 What can I do for you?',
        'bonjour': 'Bonjour! Comment puis-je vous aider?',
        'salut': 'Salut! 😊',
        'how are you': 'I\'m doing great! Thanks for asking! 😊',
        'comment ça va': 'Je vais très bien! Merci de demander! 😊',
        'who are you': 'I\'m Zenitsu AI, powered by Google Gemini! 🤖',
        'qui es-tu': 'Je suis Zenitsu AI, propulsé par Google Gemini! 🤖',
        'what is your name': 'My name is Zenitsu AI! ⚡',
        'comment tu t\'appelles': 'Je m\'appelle Zenitsu AI! ⚡',
    };
    return responses[q] || null;
}

module.exports = {
    name: 'gemini',
    aliases: ['google', 'bard', 'g'],
    category: 'ai',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');
        
        // Validation de la requête
        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text: '🧠 *Gemini AI*\n\n' +
                      '⚡ *Usage:* .gemini <question>\n\n' +
                      '✨ *Examples:*\n' +
                      '• .gemini What is JavaScript?\n' +
                      '• .gemini Write a poem about nature\n' +
                      '• .gemini Explain quantum physics\n\n' +
                      '🔧 *Powered by Google Gemini Pro*',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Vérifier le cache
        const cached = getCached(query);
        if (cached) {
            await sock.sendMessage(jid, {
                text: `🧠 *Gemini AI*\n\n` +
                      `❓ *Q:* ${query.slice(0, 200)}${query.length > 200 ? '...' : ''}\n\n` +
                      `💬 *A:* ${cached}\n\n` +
                      `⚡ _Zenitsu AI (cached)_`,
                contextInfo: STYLE,
            }, { quoted: msg });
            try { await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } }); } catch (_) {}
            return;
        }

        // Réaction de chargement
        try { await sock.sendMessage(jid, { react: { text: '🧠', key: msg.key } }); } catch (_) {}

        let reply = '';
        let used = '';
        let errors = [];

        // Essayer chaque API avec un délai entre les tentatives
        for (let i = 0; i < APIS.length; i++) {
            const api = APIS[i];
            try {
                console.log(`🧠 Gemini: Trying ${api.name}...`);
                
                // Petite pause entre les appels pour éviter le rate limit
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                const response = await axios.get(api.url(query), {
                    timeout: api.timeout,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
                        'Accept': 'application/json',
                    },
                    validateStatus: (status) => status < 500, // Accepter les erreurs 4xx pour extraction
                });

                console.log(`📊 ${api.name}: Status ${response.status}`);
                
                if (response.status === 200 || response.status === 201) {
                    const extracted = api.extract(response.data);
                    if (extracted && extracted.trim().length > 10) {
                        reply = extracted.trim();
                        used = api.name;
                        console.log(`✅ ${api.name} succeeded`);
                        break;
                    } else {
                        console.log(`⚠️ ${api.name}: Empty or too short response`);
                        errors.push(`${api.name}: Empty response`);
                    }
                } else {
                    console.log(`⚠️ ${api.name}: Status ${response.status}`);
                    errors.push(`${api.name}: HTTP ${response.status}`);
                }
            } catch (err) {
                const errorMsg = err.code === 'ECONNABORTED' ? 'Timeout' : err.message;
                console.log(`❌ ${api.name}: ${errorMsg}`);
                errors.push(`${api.name}: ${errorMsg}`);
                
                // Si c'est une erreur réseau, attendre plus longtemps
                if (err.code === 'ECONNABORTED') {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        // Fallback local si aucune API ne fonctionne
        if (!reply) {
            const fallback = getLocalFallback(query);
            if (fallback) {
                reply = fallback;
                used = 'Local AI (fallback)';
                console.log('✅ Local fallback used');
            }
        }

        // Si toujours pas de réponse, erreur
        if (!reply) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            
            const errorDetail = errors.length > 0 
                ? `\n\n⚠️ *Errors:*\n${errors.slice(0, 3).map(e => `• ${e}`).join('\n')}`
                : '';
            
            return sock.sendMessage(jid, {
                text: `❌ *All Gemini APIs unavailable.*\n\n` +
                      `💡 *Tips:*\n` +
                      `• Try again in a few moments\n` +
                      `• Simplify your question\n` +
                      `• Use .gemini help for examples` +
                      errorDetail,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Mettre en cache la réponse
        setCache(query, reply);

        // Formater la réponse (limiter la longueur si nécessaire)
        const formattedReply = reply.length > 4000 
            ? reply.slice(0, 3900) + '...\n\n📝 *Response truncated*' 
            : reply;

        // Envoyer la réponse
        await sock.sendMessage(jid, {
            text: `🧠 *Gemini AI*\n\n` +
                  `❓ *Q:* ${query.slice(0, 200)}${query.length > 200 ? '...' : ''}\n\n` +
                  `💬 *A:* ${formattedReply}\n\n` +
                  `🔧 *Provider:* ${used}\n` +
                  `⚡ _Powered by Zenitsu AI_`,
            contextInfo: STYLE,
        }, { quoted: msg });

        // Réaction de succès
        try { 
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); 
        } catch (_) {}
    },
};
