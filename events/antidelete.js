// ./events/antidelete.js

const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const CONFIG_FILE = path.join(process.cwd(), 'database', 'antidelete.json');

const dbDir = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, JSON.stringify({ enabled: false }, null, 2));

function getConfig() {
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
    catch (err) { return { enabled: false }; }
}

function saveConfig(data) {
    try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2)); }
    catch (err) { console.error('❌ antidelete save error:', err.message); }
}

// ═══════════════════════════════════════
// STYLE
// ═══════════════════════════════════════

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

/**
 * Vérifie si le sender est le propriétaire OU le bot lui-même
 */
function isOwner(sock, senderJid) {
    if (!senderJid) return false;

    const senderRaw = getRawNumber(senderJid);

    // Récupérer tous les IDs du bot
    const botIds = [];

    // ID principal (ex: 584168698003:27@s.whatsapp.net → 584168698003)
    if (sock.user?.id) {
        botIds.push(getRawNumber(sock.user.id));
    }

    // LID (ex: 82012345678912@lid → 82012345678912)
    if (sock.user?.lid) {
        botIds.push(getRawNumber(sock.user.lid));
    }

    // Owner configuré dans les variables d'environnement
    const ownerNumber = process.env.OWNER_NUMBER || '50935729494';
    botIds.push(ownerNumber);

    // ⭐ Vérifier si le sender correspond à l'un des IDs du bot/owner
    return botIds.includes(senderRaw);
}

// ═══════════════════════════════════════
// GET BOT JID (pour envoyer les alertes)
// ═══════════════════════════════════════

function getBotJid(sock) {
    if (sock.user?.id) return sock.user.id.split(':')[0]; // "584168698003@s.whatsapp.net"
    if (sock.user?.lid) return `${sock.user.lid.split('@')[0]}@s.whatsapp.net`;
    return '';
}

// ═══════════════════════════════════════
// MESSAGE CACHE
// ═══════════════════════════════════════

const messageCache = new Map();
const CACHE_SIZE = 5000;

function cacheMessage(msg) {
    if (!msg.key?.id || !msg.message) return;
    const key = `${msg.key.remoteJid}_${msg.key.id}`;
    messageCache.set(key, {
        message: msg.message,
        key: msg.key,
        timestamp: Date.now(),
    });
    if (messageCache.size > CACHE_SIZE) {
        const firstKey = messageCache.keys().next().value;
        messageCache.delete(firstKey);
    }
}

function getCachedMessage(msgKey) {
    if (!msgKey?.id || !msgKey?.remoteJid) return null;
    const key = `${msgKey.remoteJid}_${msgKey.id}`;
    return messageCache.get(key) || null;
}

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of messageCache) {
        if (now - value.timestamp > 600000) messageCache.delete(key);
    }
}, 120000);

// ═══════════════════════════════════════
// GET MESSAGE TYPE
// ═══════════════════════════════════════

function getMessageType(message) {
    if (!message) return 'Unknown';
    if (message.conversation) return 'Text';
    if (message.extendedTextMessage) return 'Text';
    if (message.imageMessage) return 'Image';
    if (message.videoMessage) return 'Video';
    if (message.stickerMessage) return 'Sticker';
    if (message.audioMessage) return message.audioMessage?.ptt ? 'Voice Note' : 'Audio';
    if (message.documentMessage) return 'Document';
    return 'Other';
}

// ═══════════════════════════════════════
// EVENT 1 : Cache messages (messages.upsert)
// ═══════════════════════════════════════

async function cacheMessagesEvent(sock, update) {
    try {
        if (!update.messages) return;
        for (const msg of update.messages) {
            if (msg.key?.fromMe) continue;
            cacheMessage(msg);
        }
    } catch (err) {
        console.error('❌ antidelete cache error:', err.message);
    }
}

// ═══════════════════════════════════════
// EVENT 2 : Handle deleted messages (messages.delete)
// ═══════════════════════════════════════

async function handleDeleteEvent(sock, update) {
    try {
        const config = getConfig();
        if (!config.enabled) return;

        const botJid = getBotJid(sock);
        if (!botJid) return;

        let deletedKeys = [];
        if (Array.isArray(update)) {
            deletedKeys = update;
        } else if (update?.keys) {
            deletedKeys = update.keys;
        }

        for (const key of deletedKeys) {
            const cached = getCachedMessage(key);
            if (!cached) continue;

            const senderJid = key.participant || key.remoteJid || '';
            const senderNumber = senderJid.split('@')[0].split(':')[0];
            const chatJid = key.remoteJid;
            const isGroup = chatJid?.endsWith('@g.us');
            const msgType = getMessageType(cached.message);

            // Notifier le bot
            await sock.sendMessage(botJid, {
                text:
                    '🗑️ *Anti-Delete Alert*\n\n' +
                    `👤 *From:* @${senderNumber}\n` +
                    (isGroup ? `👥 *Group:* ${chatJid.split('@')[0]}\n` : '📱 *Chat:* Private\n') +
                    `📄 *Type:* ${msgType}\n` +
                    `🕒 *Deleted:* ${new Date().toLocaleTimeString('en-US')}\n\n` +
                    '📌 *Content below ↓*',
                contextInfo: {
                    mentionedJid: [senderJid],
                    ...STYLE,
                },
            });

            // Texte
            const text = cached.message?.conversation
                || cached.message?.extendedTextMessage?.text
                || cached.message?.imageMessage?.caption
                || cached.message?.videoMessage?.caption
                || '';

            if (text) {
                await sock.sendMessage(botJid, {
                    text: `📝 *Deleted Text:*\n${text}`,
                    contextInfo: STYLE,
                });
            }

            // Image
            if (cached.message?.imageMessage) {
                try {
                    const stream = await downloadContentFromMessage(cached.message.imageMessage, 'image');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    if (buffer.length > 100) {
                        await sock.sendMessage(botJid, { image: buffer, caption: '🗑️ *Deleted Image*', contextInfo: STYLE });
                    }
                } catch (_) {}
            }

            // Sticker
            if (cached.message?.stickerMessage) {
                try {
                    const stream = await downloadContentFromMessage(cached.message.stickerMessage, 'sticker');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    if (buffer.length > 100) {
                        await sock.sendMessage(botJid, { sticker: buffer, contextInfo: STYLE });
                    }
                } catch (_) {}
            }
        }

    } catch (err) {
        console.error('❌ antidelete delete error:', err.message);
    }
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

async function antideleteCommand(sock, msg, args, jid) {
    try {
        const senderJid = msg.key.participant || msg.key.remoteJid;

        if (!isOwner(sock, senderJid)) {
            return sock.sendMessage(jid, {
                text: '🚫 *Owner only!*\n\nOnly the bot owner or the bot itself can use this command.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        const config = getConfig();
        const subCommand = args[0]?.toLowerCase();

        if (!subCommand) {
            return sock.sendMessage(jid, {
                text: `🗑️ *Anti-Delete*\n\n📊 *Status:* ${config.enabled ? '✅ ON' : '❌ OFF'}\n\n📌 .antidelete on | .antidelete off`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        if (subCommand === 'on') {
            config.enabled = true;
            saveConfig(config);
            return sock.sendMessage(jid, {
                text: '✅ *Anti-Delete Enabled*\n\n🗑️ Deleted messages will be sent to bot chat.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        if (subCommand === 'off') {
            config.enabled = false;
            saveConfig(config);
            return sock.sendMessage(jid, {
                text: '❌ *Anti-Delete Disabled*',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

    } catch (err) {
        console.error('❌ antidelete command error:', err.message);
    }
}

// ═══════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════

module.exports = {
    cacheEvent: 'messages.upsert',
    cacheExecute: cacheMessagesEvent,
    deleteEvent: 'messages.delete',
    deleteExecute: handleDeleteEvent,
    name: 'antidelete',
    command: antideleteCommand,
};
