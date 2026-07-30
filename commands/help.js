// ./commands/help.js

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const HELP_FILE = path.join(__dirname, 'help.txt');

const DEFAULT_PROMPT = 'You are a helpful assistant for the Zenitsu Mini WhatsApp Bot. Help users with bot commands and features.';

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
// LECTURE DU PROMPT
// ═══════════════════════════════════════

function loadPrompt() {
    try {
        if (fs.existsSync(HELP_FILE)) {
            const content = fs.readFileSync(HELP_FILE, 'utf8').trim();
            return content || DEFAULT_PROMPT;
        }
        fs.writeFileSync(HELP_FILE, DEFAULT_PROMPT, 'utf8');
        return DEFAULT_PROMPT;
    } catch (err) {
        console.error('❌ Error loading help.txt:', err.message);
        return DEFAULT_PROMPT;
    }
}

// ═══════════════════════════════════════
// AI FALLBACKS
// ═══════════════════════════════════════

const AI_APIS = [
    {
        name: 'PrinceTech Chat',
        fn: async (query, system) => {
            const fullQuery = `${system}\n\nUser question: ${query}`;
            const { data } = await axios.get(
                `https://api.princetechn.com/api/ai/chat?apikey=prince&q=${encodeURIComponent(fullQuery)}`,
                { timeout: 45000 }
            );
            return data?.result || data?.reply || data?.response || '';
        },
    },
    {
        name: 'PrinceTech GPT-4',
        fn: async (query, system) => {
            const fullQuery = `${system}\n\nUser question: ${query}`;
            const { data } = await axios.get(
                `https://api.princetechn.com/api/ai/gpt4?apikey=prince&q=${encodeURIComponent(fullQuery)}`,
                { timeout: 45000 }
            );
            return data?.result || data?.reply || data?.response || '';
        },
    },
    {
        name: 'PrinceTech DeepSeek',
        fn: async (query, system) => {
            const fullQuery = `${system}\n\nUser question: ${query}`;
            const { data } = await axios.get(
                `https://api.princetechn.com/api/ai/deepseek-llm?apikey=prince&q=${encodeURIComponent(fullQuery)}`,
                { timeout: 45000 }
            );
            return data?.result || data?.reply || data?.response || '';
        },
    },
    {
        name: 'NexRay Claude',
        fn: async (query, system) => {
            const fullQuery = `${system}\n\nUser question: ${query}`;
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/ai/claude?text=${encodeURIComponent(fullQuery)}`,
                { timeout: 45000 }
            );
            return data?.result || data?.reply || data?.response || data?.text || '';
        },
    },
    {
        name: 'NexRay GPT-3.5',
        fn: async (query, system) => {
            const fullQuery = `${system}\n\nUser question: ${query}`;
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/ai/gpt-3.5-turbo?text=${encodeURIComponent(fullQuery)}`,
                { timeout: 45000 }
            );
            return data?.result || data?.reply || data?.response || data?.text || '';
        },
    },
    {
        name: 'NeoSoft Perplexity',
        fn: async (query, system) => {
            const fullQuery = `${system}\n\nUser question: ${query}`;
            const { data } = await axios.get(
                `https://api.neosoft.best/api/ai/perplexity?text=${encodeURIComponent(fullQuery)}`,
                { timeout: 45000 }
            );
            return data?.result || data?.reply || data?.response || data?.text || '';
        },
    },
];

// ═══════════════════════════════════════
// FALLBACK LOCAL
// ═══════════════════════════════════════

function getLocalResponse(query) {
    const q = query.toLowerCase();

    if (q.includes('owner') || q.includes('who made') || q.includes('creator')) {
        return '👑 Zenitsu Mini is owned by **Zenitsu Hashira** (+50935729494). Powered by CyberNova Team.';
    }
    if (q.includes('channel') || q.includes('newsletter')) {
        return '📢 Join our channel **CyberNova**: https://whatsapp.com/channel/0029Vb8BKWwH5JLxq1ef1R43';
    }
    if (q.includes('command') || q.includes('feature') || q.includes('what can')) {
        return '⚡ Zenitsu Mini has 60+ commands: Downloader, AI, Search, Tools, Group Management, Owner. Type .menu to see all!';
    }
    if (q.includes('sticker') || q.includes('take')) {
        return '🎨 Reply to an image/video with **.sticker** to create. Use **.take a:Name** for author only.';
    }
    if (q.includes('music') || q.includes('song') || q.includes('download')) {
        return '🎵 Use **.play <song>** for YouTube or **.spotify <song>** for Spotify.';
    }
    if (q.includes('prefix')) {
        return '🔰 The prefix is **.** (dot). Example: .menu';
    }
    if (q.includes('menu') || q.includes('all command')) {
        return '📋 Type **.menu** to see all available commands.';
    }

    return '';
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'help',
    aliases: ['assistant', 'support', 'info'],
    category: 'main',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text:
                    '💬 *Help Assistant*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.help <your question>\n\n' +
                    '✨ *Examples:*\n' +
                    '.help How do I download music?\n' +
                    '.help What commands are available?\n' +
                    '.help Who is the owner?\n\n' +
                    '💡 I can help with bot features, commands, and info.\n\n' +
                    '⚡ _Zenitsu Help_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '💬', key: msg.key } }); } catch (_) {}

        // Vérifier d'abord les réponses locales
        const localReply = getLocalResponse(query);
        if (localReply) {
            return sock.sendMessage(jid, {
                text: `💬 *Help Assistant*\n\n${localReply}\n\n⚡ _Zenitsu Help_`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Essayer les APIs AI
        const helpPrompt = loadPrompt();
        let reply = '';

        for (const api of AI_APIS) {
            try {
                console.log(`💬 Help AI: ${api.name}...`);
                reply = await api.fn(query, helpPrompt);
                if (reply && reply.trim().length > 5) {
                    console.log(`✅ ${api.name}`);
                    break;
                }
            } catch (err) {
                console.log(`⚠️ ${api.name}: ${err.message}`);
            }
        }

        if (!reply) {
            return sock.sendMessage(jid, {
                text:
                    '💬 *Help Assistant*\n\n' +
                    '⚡ I couldn\'t process your question right now.\n' +
                    'Type **.menu** to see all commands, or try again.\n\n' +
                    '📢 Channel: https://whatsapp.com/channel/0029Vb8BKWwH5JLxq1ef1R43\n\n' +
                    '⚡ _Zenitsu Help_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        await sock.sendMessage(jid, {
            text:
                '💬 *Help Assistant*\n\n' +
                `❓ *Q:* ${query.length > 200 ? query.slice(0, 200) + '...' : query}\n\n` +
                `💡 *A:* ${reply}\n\n` +
                '⚡ _Zenitsu Help_',
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
