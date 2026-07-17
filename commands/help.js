// ./commands/help.js

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const HELP_FILE = path.join(__dirname, 'help.txt');

const DEFAULT_HELP = `You are a helpful assistant for the Zenitsu Mini WhatsApp Bot.

About the bot:
- Name: Zenitsu Mini
- Owner: Zenitsu Hashira (50935729494)
- Channel: CyberNova (https://whatsapp.com/channel/0029Vb8BKWwH5JLxq1ef1R43)
- Prefix: .
- Description: Advanced WhatsApp Multi-Device Bot with 60+ commands for downloading, AI, search, tools, and group management.

Your job:
- Help users understand how to use the bot
- Explain what commands are available
- Guide users to the right command for their needs
- Be friendly and use ⚡ emoji
- Keep responses concise and helpful

If someone asks about a specific command, explain what it does and how to use it.
If someone asks about the owner or channel, provide the information above.
If someone asks what the bot can do, list the main categories: Downloader, AI, Search, Tools, Group Management.`;

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
// LECTURE DU FICHIER HELP
// ═══════════════════════════════════════

function loadHelpPrompt() {
    try {
        if (fs.existsSync(HELP_FILE)) {
            const content = fs.readFileSync(HELP_FILE, 'utf8');
            return content.trim() || DEFAULT_HELP;
        }
        // Créer le fichier par défaut s'il n'existe pas
        fs.writeFileSync(HELP_FILE, DEFAULT_HELP, 'utf8');
        return DEFAULT_HELP;
    } catch (err) {
        console.error('❌ Error loading help.txt:', err.message);
        return DEFAULT_HELP;
    }
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
                    '.help Who is the owner?\n' +
                    '.help How to create a sticker?\n\n' +
                    '💡 I can help you with:\n' +
                    '• Bot features & commands\n' +
                    '• How to use specific commands\n' +
                    '• Owner & channel info\n' +
                    '• Troubleshooting\n\n' +
                    '⚡ _Zenitsu Help Assistant_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '💬', key: msg.key } }); } catch (_) {}

        try {
            const helpPrompt = loadHelpPrompt();
            const encodedQuery = encodeURIComponent(query);
            const encodedSystem = encodeURIComponent(helpPrompt);

            // DavidCyril API
            const { data } = await axios.get(
                `https://apis.davidcyriltech.my.id/ai/writecream?text=${encodedQuery}&system=${encodedSystem}`,
                { timeout: 45000 }
            );

            const reply = data?.response || '';

            if (!reply || reply.trim().length < 2) throw new Error('Empty response');

            const caption =
                '💬 *Help Assistant*\n\n' +
                `❓ *Q:* ${query.length > 200 ? query.slice(0, 200) + '...' : query}\n\n` +
                `💡 *A:* ${reply}\n\n` +
                '⚡ _Zenitsu Help_';

            await sock.sendMessage(jid, {
                text: caption,
                contextInfo: STYLE,
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ help error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            // Fallback : réponses pré-définies
            const lowerQuery = query.toLowerCase();
            let fallbackReply = '';

            if (lowerQuery.includes('owner') || lowerQuery.includes('who made') || lowerQuery.includes('creator')) {
                fallbackReply = '👑 The owner of Zenitsu Mini is **Zenitsu Hashira** (50935729494).\n\n📢 Join our channel: https://whatsapp.com/channel/0029Vb8BKWwH5JLxq1ef1R43';
            } else if (lowerQuery.includes('channel') || lowerQuery.includes('newsletter')) {
                fallbackReply = '📢 Our channel is **CyberNova**: https://whatsapp.com/channel/0029Vb8BKWwH5JLxq1ef1R43\n\n⚡ Stay updated with the latest features!';
            } else if (lowerQuery.includes('command') || lowerQuery.includes('feature') || lowerQuery.includes('what can')) {
                fallbackReply = '⚡ Zenitsu Mini has 60+ commands in these categories:\n\n📥 **Downloader** — YouTube, Spotify, TikTok, Instagram, Facebook, Pinterest\n🧠 **AI** — GPT, Gemini, DeepSeek, Venice\n🔍 **Search** — Google, Lyrics, Shazam, Wikipedia, Anime\n🛠️ **Tools** — Stickers, QR, Translate, Weather, Calculator\n👥 **Group** — Anti-Link, Welcome, Kick, Poll\n\n💡 Type .menu to see all commands!';
            } else if (lowerQuery.includes('sticker') || lowerQuery.includes('take')) {
                fallbackReply = '🎨 To create a sticker, reply to an image/video with **.sticker**\n\nTo rename a sticker pack, reply with **.take a:AuthorName** (author only) or **.take p:PackName** (pack only).';
            } else if (lowerQuery.includes('music') || lowerQuery.includes('song') || lowerQuery.includes('download')) {
                fallbackReply = '🎵 To download music, use **.play <song name>** for YouTube or **.spotify <song name>** for Spotify.\n\nFor videos, use **.aio <url>** or **.dl <url>**.';
            } else {
                fallbackReply = '⚡ I couldn\'t process your question right now. Please try again or type **.menu** to see all available commands.\n\n📢 Join our channel: https://whatsapp.com/channel/0029Vb8BKWwH5JLxq1ef1R43';
            }

            await sock.sendMessage(jid, {
                text: `💬 *Help Assistant*\n\n${fallbackReply}\n\n⚡ _Zenitsu Help_`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
