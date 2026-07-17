// ./commands/zenitsu.js

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const PROMPT_FILE = path.join(__dirname, 'Zenitsu.txt');
const DEFAULT_PROMPT = 'You are a WhatsApp assistant named Zenitsu. You are helpful, friendly, and use ⚡ emoji.';

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
    return botIds.includes(senderRaw);
}

// ═══════════════════════════════════════
// LECTURE DU PROMPT
// ═══════════════════════════════════════

function loadPrompt() {
    try {
        if (fs.existsSync(PROMPT_FILE)) {
            const content = fs.readFileSync(PROMPT_FILE, 'utf8');
            return content.trim() || DEFAULT_PROMPT;
        }
        return DEFAULT_PROMPT;
    } catch (err) {
        console.error('❌ Error loading Zenitsu.txt:', err.message);
        return DEFAULT_PROMPT;
    }
}

function savePrompt(text) {
    try {
        fs.writeFileSync(PROMPT_FILE, text, 'utf8');
        return true;
    } catch (err) {
        console.error('❌ Error saving Zenitsu.txt:', err.message);
        return false;
    }
}

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

        // ═══════════════════════════════
        // SETPROMPT (owner only)
        // ═══════════════════════════════

        if (subCommand === 'setprompt' || subCommand === 'set') {
            if (!isOwner(sock, senderJid)) {
                return sock.sendMessage(jid, {
                    text: '🚫 *Owner only!*',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const newPrompt = args.slice(1).join(' ');
            if (!newPrompt || newPrompt.trim().length < 5) {
                return sock.sendMessage(jid, {
                    text:
                        '⚡ *Set Custom Prompt*\n\n' +
                        '📌 *Usage:*\n' +
                        '.zenitsu setprompt <your prompt>\n\n' +
                        '✨ *Example:*\n' +
                        '.zenitsu setprompt You are a helpful assistant named Zenitsu. You speak politely and use emojis.\n\n' +
                        '💡 The prompt defines how the AI behaves.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const saved = savePrompt(newPrompt);
            if (!saved) {
                return sock.sendMessage(jid, {
                    text: '❌ Failed to save prompt.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            return sock.sendMessage(jid, {
                text:
                    '✅ *Prompt Updated!*\n\n' +
                    `📝 *New Prompt:*\n${newPrompt.slice(0, 300)}${newPrompt.length > 300 ? '...' : ''}\n\n` +
                    '⚡ The AI will now use this personality.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════════════════
        // GETPROMPT
        // ═══════════════════════════════

        if (subCommand === 'getprompt' || subCommand === 'show') {
            const currentPrompt = loadPrompt();

            return sock.sendMessage(jid, {
                text:
                    '📋 *Current Prompt*\n\n' +
                    `${currentPrompt.slice(0, 500)}${currentPrompt.length > 500 ? '...' : ''}\n\n` +
                    '⚡ Use .zenitsu setprompt <text> to customize.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════════════════
        // RESET (owner only)
        // ═══════════════════════════════

        if (subCommand === 'reset') {
            if (!isOwner(sock, senderJid)) {
                return sock.sendMessage(jid, {
                    text: '🚫 *Owner only!*',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            savePrompt(DEFAULT_PROMPT);

            return sock.sendMessage(jid, {
                text:
                    '🔄 *Prompt Reset*\n\n' +
                    'The custom prompt has been cleared.\n' +
                    'The AI will now use its default personality.\n\n' +
                    '⚡ Use .zenitsu setprompt <text> to set a new one.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════════════════
        // QUERY (normal)
        // ═══════════════════════════════

        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            const currentPrompt = loadPrompt();
            const isCustom = currentPrompt !== DEFAULT_PROMPT;

            return sock.sendMessage(jid, {
                text:
                    '⚡ *Zenitsu AI — Custom Assistant*\n\n' +
                    '📌 *Usage:*\n' +
                    '.zenitsu <question>\n' +
                    '✨ *Examples:*\n' +
                    '.zenitsu What is JavaScript?\n' +
                    '.zenitsu Write a poem\n\n',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════════════════
        // APPEL API
        // ═══════════════════════════════

        try { await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } }); } catch (_) {}

        try {
            const customPrompt = loadPrompt();
            const encodedQuery = encodeURIComponent(query);
            const encodedSystem = encodeURIComponent(customPrompt);

            // DavidCyril API
            const { data } = await axios.get(
                `https://apis.davidcyriltech.my.id/ai/writecream?text=${encodedQuery}&system=${encodedSystem}`,
                { timeout: 45000 }
            );

            const reply = data?.response || '';

            if (!reply || reply.trim().length < 2) throw new Error('Empty response');

            const caption =
                '⚡ *Zenitsu AI*\n\n' +
                `❓ *Q:* ${query.length > 200 ? query.slice(0, 200) + '...' : query}\n\n` +
                `💬 *A:* ${reply}\n\n` +
                (customPrompt !== DEFAULT_PROMPT ? '🎭 *Custom prompt active*\n' : '') +
                '⚡ _Powered by Zenitsu_';

            await sock.sendMessage(jid, {
                text: caption,
                contextInfo: STYLE,
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ zenitsu error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            await sock.sendMessage(jid, {
                text:
                    '❌ *Zenitsu AI Unavailable*\n\n' +
                    'The AI service is currently overloaded.\n\n' +
                    '⚡ Please try again in a few seconds.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
