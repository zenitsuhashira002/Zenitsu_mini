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
        name: 'PrinceTech DeepSeek-V3',
        url: (q) => `https://api.princetechn.com/api/ai/deepseek-v3?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 60000,
        extract: (data) => {
            if (!data) return '';
            if (typeof data === 'string') return data;
            
            // Format spécifique: { status: 200, success: true, creator: "PrinceTech", result: "..." }
            if (data.result && typeof data.result === 'string' && data.result.trim().length > 5) {
                return data.result;
            }
            
            // Recherche dans plusieurs champs possibles
            const fields = ['reply', 'response', 'answer', 'text', 'content', 'message', 'output'];
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
        name: 'PrinceTech DeepSeek-R1',
        url: (q) => `https://api.princetechn.com/api/ai/deepseek-r1?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 60000,
        extract: (data) => {
            if (!data) return '';
            if (typeof data === 'string') return data;
            if (data.result && typeof data.result === 'string' && data.result.trim().length > 5) {
                return data.result;
            }
            const fields = ['reply', 'response', 'answer', 'text', 'content', 'message', 'output'];
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
        name: 'PrinceTech DeepSeek-LLM',
        url: (q) => `https://api.princetechn.com/api/ai/deepseek-llm?apikey=prince&q=${encodeURIComponent(q)}`,
        timeout: 60000,
        extract: (data) => {
            if (!data) return '';
            if (typeof data === 'string') return data;
            if (data.result && typeof data.result === 'string' && data.result.trim().length > 5) {
                return data.result;
            }
            const fields = ['reply', 'response', 'answer', 'text', 'content', 'message', 'output'];
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
        name: 'DavidCyril DeepSeek-V3',
        url: (q) => `https://apis.davidcyriltech.my.id/ai/deepseek-v3?text=${encodeURIComponent(q)}`,
        timeout: 60000,
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
        'hello': 'Hello! I\'m DeepSeek AI. How can I assist you today? 🐋',
        'hi': 'Hi there! 👋 I\'m DeepSeek, ready to help!',
        'bonjour': 'Bonjour! Je suis DeepSeek AI. Comment puis-je vous aider? 🐋',
        'salut': 'Salut! 😊 Je suis DeepSeek, à votre service!',
        'how are you': 'I\'m functioning optimally! Thanks for asking! 🐋',
        'comment ça va': 'Je fonctionne parfaitement! Merci de demander! 🐋',
        'who are you': 'I\'m DeepSeek AI, a powerful language model! 🐋',
        'qui es-tu': 'Je suis DeepSeek AI, un modèle de langage puissant! 🐋',
        'what is your name': 'My name is DeepSeek AI! 🐋',
        'comment tu t\'appelles': 'Je m\'appelle DeepSeek AI! 🐋',
        'deepseek': 'Yes, I\'m DeepSeek AI! How can I help you? 🐋',
    };
    return responses[q] || null;
}

module.exports = {
    name: 'deepseek',
    aliases: ['ds', 'deepseekai', 'deepseek2'],
    category: 'ai',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');
        
        // Validation de la requête
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

        // Vérifier le cache
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

        // Réaction de chargement
        try { await sock.sendMessage(jid, { react: { text: '🐋', key: msg.key } }); } catch (_) {}

        let reply = '';
        let used = '';
        let errors = [];

        // Essayer chaque API avec un délai entre les tentatives
        for (let i = 0; i < APIS.length; i++) {
            const api = APIS[i];
            try {
                console.log(`🐋 DeepSeek: Trying ${api.name}...`);
                
                // Petite pause entre les appels pour éviter le rate limit
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
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
                    // Vérifier si la réponse a le format PrinceTech
                    if (response.data && response.data.success === true && response.data.result) {
                        reply = response.data.result;
                        used = api.name + ' (via PrinceTech)';
                        console.log(`✅ ${api.name} succeeded with PrinceTech format`);
                        break;
                    }
                    
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
                const errorMsg = err.code === 'ECONNABORTED' ? 'Timeout (60s)' : err.message;
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
                text: `❌ *All DeepSeek APIs unavailable.*\n\n` +
                      `💡 *Tips:*\n` +
                      `• Try again in a few moments\n` +
                      `• Simplify your question\n` +
                      `• Use .deepseek help for examples` +
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
            text: `🐋 *DeepSeek AI*\n\n` +
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
