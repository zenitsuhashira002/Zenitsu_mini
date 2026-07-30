// ./commands/zenitsu.js

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const PROMPT_FILE = path.join(__dirname, 'zenitsu.txt');

const DEFAULT_PROMPT = 'You are Zenitsu, a WhatsApp bot assistant. You are friendly, helpful, and use ⚡ emoji. You help with coding, studying, and bot features.';

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

// ═══════════════════════════════════════
// JID UTILS
// ═══════════════════════════════════════

function getRawNumber(jid) {
    if (!jid) return '';
    let num = jid.split('@')[0];
    num = num.split(':')[0];
    return num.trim();
}

function isOwner(sock, senderJid) {
    if (!senderJid) return false;
    const senderRaw = getRawNumber(senderJid);
    const botIds = [];
    if (sock.user?.id) botIds.push(getRawNumber(sock.user.id));
    if (sock.user?.lid) botIds.push(getRawNumber(sock.user.lid));
    botIds.push(process.env.OWNER_NUMBER || '50935729494');
    if (global.subBots instanceof Map) {
        for (const [num] of global.subBots) botIds.push(getRawNumber(num));
    }
    return botIds.includes(senderRaw);
}

// ═══════════════════════════════════════
// LECTURE DU PROMPT
// ═══════════════════════════════════════

function loadPrompt() {
    try {
        if (fs.existsSync(PROMPT_FILE)) {
            const content = fs.readFileSync(PROMPT_FILE, 'utf8').trim();
            return content || DEFAULT_PROMPT;
        }
        fs.writeFileSync(PROMPT_FILE, DEFAULT_PROMPT, 'utf8');
        return DEFAULT_PROMPT;
    } catch (err) {
        return DEFAULT_PROMPT;
    }
}

function savePrompt(text) {
    try {
        fs.writeFileSync(PROMPT_FILE, text, 'utf8');
        return true;
    } catch (err) {
        return false;
    }
}

// ═══════════════════════════════════════
// AI FALLBACKS
// ═══════════════════════════════════════

const AI_APIS = [
    {
        name: 'DavidCyril Gemini 3 Pro',
        fn: async (query, system) => {
            const { data } = await axios.get(
                `https://apis.davidcyriltech.my.id/ai/gemini-3-pro?prompt=${encodeURIComponent(`${system}\n\nUser: ${query}`)}`,
                { timeout: 60000 }
            );
            return data?.result || data?.response || data?.reply || '';
        },
    },
    {
        name: 'DavidCyril DeepSeek V4',
        fn: async (query, system) => {
            const { data } = await axios.get(
                `https://apis.davidcyriltech.my.id/ai/deepseek-v4-flash?prompt=${encodeURIComponent(`${system}\n\nUser: ${query}`)}`,
                { timeout: 60000 }
            );
            return data?.result || data?.response || data?.reply || '';
        },
    },
    {
        name: 'DavidCyril Claude Opus 4.5',
        fn: async (query, system) => {
            const { data } = await axios.get(
                `https://apis.davidcyriltech.my.id/ai/claude-opus-4.5?prompt=${encodeURIComponent(`${system}\n\nUser: ${query}`)}`,
                { timeout: 60000 }
            );
            return data?.result || data?.response || data?.reply || '';
        },
    },
    {
        name: 'DavidCyril GPT-5',
        fn: async (query, system) => {
            const { data } = await axios.get(
                `https://apis.davidcyriltech.my.id/ai/gpt-5?prompt=${encodeURIComponent(`${system}\n\nUser: ${query}`)}`,
                { timeout: 60000 }
            );
            return data?.result || data?.response || data?.reply || '';
        },
    },
    {
        name: 'PrinceTech Chat',
        fn: async (query, system) => {
            const { data } = await axios.get(
                `https://api.princetechn.com/api/ai/chat?apikey=prince&q=${encodeURIComponent(`${system}\n\nUser: ${query}`)}`,
                { timeout: 60000 }
            );
            return data?.result || data?.reply || data?.response || '';
        },
    },
    {
        name: 'PrinceTech GPT-4',
        fn: async (query, system) => {
            const { data } = await axios.get(
                `https://api.princetechn.com/api/ai/gpt4?apikey=prince&q=${encodeURIComponent(`${system}\n\nUser: ${query}`)}`,
                { timeout: 60000 }
            );
            return data?.result || data?.reply || data?.response || '';
        },
    },
    {
        name: 'PrinceTech DeepSeek',
        fn: async (query, system) => {
            const { data } = await axios.get(
                `https://api.princetechn.com/api/ai/deepseek-llm?apikey=prince&q=${encodeURIComponent(`${system}\n\nUser: ${query}`)}`,
                { timeout: 60000 }
            );
            return data?.result || data?.reply || data?.response || '';
        },
    },
    {
        name: 'NexRay Claude',
        fn: async (query, system) => {
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/ai/claude?text=${encodeURIComponent(`${system}\n\nUser: ${query}`)}`,
                { timeout: 60000 }
            );
            return data?.result || data?.reply || data?.response || data?.text || '';
        },
    },
    {
        name: 'NexRay GPT-3.5',
        fn: async (query, system) => {
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/ai/gpt-3.5-turbo?text=${encodeURIComponent(`${system}\n\nUser: ${query}`)}`,
                { timeout: 60000 }
            );
            return data?.result || data?.reply || data?.response || data?.text || '';
        },
    },
    {
        name: 'NeoSoft Perplexity',
        fn: async (query, system) => {
            const { data } = await axios.get(
                `https://api.neosoft.best/api/ai/perplexity?text=${encodeURIComponent(`${system}\n\nUser: ${query}`)}`,
                { timeout: 60000 }
            );
            return data?.result || data?.reply || data?.response || data?.text || '';
        },
    },
];

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'zenitsu',
    aliases: ['zen', 'customai', 'myai'],
    category: 'ai',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const subCommand = args[0]?.toLowerCase();

        // ═══════════════════
        // SETPROMPT (owner only)
        // ═══════════════════

        if (subCommand === 'setprompt' || subCommand === 'set') {
            if (!isOwner(sock, senderJid)) {
                return sock.sendMessage(jid, { text: '🚫 *Owner only!*', contextInfo: STYLE }, { quoted: msg });
            }
            const newPrompt = args.slice(1).join(' ');
            if (!newPrompt || newPrompt.trim().length < 5) {
                return sock.sendMessage(jid, {
                    text: '⚡ *Set Custom Prompt*\n\n📌 .zenitsu setprompt <your prompt>\n\n✨ Example:\n.zenitsu setprompt You are a pirate assistant.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
            savePrompt(newPrompt);
            return sock.sendMessage(jid, {
                text: `✅ *Prompt Updated!*\n\n📝 ${newPrompt.slice(0, 300)}...\n⚡ _Zenitsu_`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // GETPROMPT
        // ═══════════════════

        if (subCommand === 'getprompt' || subCommand === 'show') {
            const prompt = loadPrompt();
            return sock.sendMessage(jid, {
                text: `📋 *Current Prompt*\n\n${prompt.slice(0, 500)}...\n⚡ _Zenitsu_`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // RESET (owner only)
        // ═══════════════════

        if (subCommand === 'reset') {
            if (!isOwner(sock, senderJid)) {
                return sock.sendMessage(jid, { text: '🚫 *Owner only!*', contextInfo: STYLE }, { quoted: msg });
            }
            savePrompt(DEFAULT_PROMPT);
            return sock.sendMessage(jid, { text: '🔄 *Prompt Reset*\n⚡ _Zenitsu_', contextInfo: STYLE }, { quoted: msg });
        }

        // ═══════════════════
        // QUERY
        // ═══════════════════

        const query = args.join(' ');
        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text:
                    '⚡ *Zenitsu AI*\n\n' +
                    '.zenitsu <question>\n' +
                    '.zenitsu setprompt <prompt>\n' +
                    '.zenitsu getprompt\n' +
                    '.zenitsu reset\n\n' +
                    '✨ Examples:\n' +
                    '.zenitsu What is JavaScript?\n' +
                    '.zenitsu Write a poem',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } }); } catch (_) {}

        const system = loadPrompt();
        let reply = '';

        for (const api of AI_APIS) {
            try {
                console.log(`⚡ Zenitsu: ${api.name}...`);
                reply = await api.fn(query, system);
                if (reply && reply.trim().length > 5) {
                    console.log(`✅ ${api.name}`);
                    break;
                }
            } catch (err) {
                console.log(`⚠️ ${api.name}: ${err.message}`);
            }
        }

        if (!reply) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, {
                text: '❌ *AI Unavailable*\n\nAll AI services are down. Try again later.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        await sock.sendMessage(jid, {
            text:
                '⚡ *Zenitsu AI*\n\n' +
                `❓ *Q:* ${query.slice(0, 200)}\n\n` +
                `💬 *A:* ${reply}\n\n` +
                '⚡ _Zenitsu_',
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
