// ./events/autostatus.js

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const CONFIG_FILE = path.join(process.cwd(), 'database', 'autostatus.json');

const dbDir = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({
        enabled: false,
        updatedAt: new Date().toISOString(),
    }, null, 2));
}

// ═══════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════

function getConfig() {
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
    catch (err) { return { enabled: false }; }
}

function saveConfig(data) {
    try {
        data.updatedAt = new Date().toISOString();
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('❌ autostatus save error:', err.message);
    }
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

function isOwner(sock, senderJid) {
    if (!senderJid) return false;
    const senderRaw = getRawNumber(senderJid);
    const botIds = [];

    if (sock.user?.id) botIds.push(getRawNumber(sock.user.id));
    if (sock.user?.lid) botIds.push(getRawNumber(sock.user.lid));

    const ownerNumber = process.env.OWNER_NUMBER || '50935729494';
    botIds.push(ownerNumber);

    return botIds.includes(senderRaw);
}

// ═══════════════════════════════════════
// ANTI-SPAM
// ═══════════════════════════════════════

const viewedStatuses = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of viewedStatuses) {
        if (now - timestamp > 600000) viewedStatuses.delete(key);
    }
}, 300000);

// ═══════════════════════════════════════
// MAIN EVENT — Vue uniquement, délai 5s
// ═══════════════════════════════════════

async function autostatusEvent(sock, update) {
    try {
        const config = getConfig();
        if (!config.enabled) return;

        if (update.messages) {
            for (const msg of update.messages) {
                if (msg.key?.remoteJid !== 'status@broadcast') continue;
                if (msg.key?.fromMe) continue;

                const statusOwner = msg.key.participant || msg.key.remoteJid;
                const cacheKey = `${statusOwner}_${msg.key.id}`;

                if (viewedStatuses.has(cacheKey)) continue;

                // ⭐ Délai de 5 secondes avant de lire le statut
                await new Promise(r => setTimeout(r, 5000));

                // Lire le statut (vue uniquement)
                try {
                    await sock.readMessages([msg.key]);
                    viewedStatuses.set(cacheKey, Date.now());
                } catch (err) {
                    if (err.message?.includes('rate-overlimit')) {
                        await new Promise(r => setTimeout(r, 2000));
                        try { await sock.readMessages([msg.key]); } catch (_) {}
                    }
                }
            }
        }

    } catch (err) {
        console.error('❌ autostatus event error:', err.message);
    }
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

async function autostatusCommand(sock, msg, args, jid) {
    try {
        const senderJid = msg.key.participant || msg.key.remoteJid;

        if (!isOwner(sock, senderJid)) {
            return sock.sendMessage(jid, {
                text: '🚫 *Owner only!*',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        const config = getConfig();
        const subCommand = args[0]?.toLowerCase();

        // STATUS
        if (!subCommand) {
            return sock.sendMessage(jid, {
                text:
                    '🔄 *Auto Status View*\n\n' +
                    `📱 *Status:* ${config.enabled ? '✅ ON' : '❌ OFF'}\n\n` +
                    '📌 *Commands:*\n' +
                    '.autostatus on\n' +
                    '.autostatus off\n' +
                    '.autostatus status\n\n' +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ON
        if (subCommand === 'on') {
            config.enabled = true;
            saveConfig(config);
            return sock.sendMessage(jid, {
                text:
                    '✅ *Auto Status View Enabled*\n\n' +
                    '👁️ Bot will automatically view all statuses.\n' +
                    '⏱ 5 second delay before each view.\n\n' +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // OFF
        if (subCommand === 'off') {
            config.enabled = false;
            saveConfig(config);
            return sock.sendMessage(jid, {
                text: '❌ *Auto Status View Disabled*',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // UNKNOWN
        return sock.sendMessage(jid, {
            text: '⚠️ Use .autostatus on or .autostatus off',
            contextInfo: STYLE,
        }, { quoted: msg });

    } catch (err) {
        console.error('❌ autostatus command error:', err.message);
    }
}

module.exports = {
    event: 'messages.upsert',
    execute: autostatusEvent,
    name: 'autostatus',
    command: autostatusCommand,
};
