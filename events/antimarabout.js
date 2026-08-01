// ./events/antimarabout.js

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════

const CONFIG_FILE = path.join(process.cwd(), 'database', 'antimarabout.json');
const dbDir = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const DEFAULT_CONFIG = {
    enabled: true,
    warnings: {},
    lastWarningReset: Date.now(),
    mutedGroups: [],
};

function getConfig() {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
            return { ...DEFAULT_CONFIG };
        }
        const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        if (!data.warnings) data.warnings = {};
        if (!data.mutedGroups) data.mutedGroups = [];
        if (!data.lastWarningReset) data.lastWarningReset = Date.now();
        return data;
    } catch (err) {
        console.error('❌ Error reading antimarabout.json:', err);
        return { ...DEFAULT_CONFIG };
    }
}

function saveConfig(data) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('❌ Error saving antimarabout.json:', err);
    }
}

// ═══════════════════════════════════════
// FORBIDDEN WORDS (English + French)
// ═══════════════════════════════════════

const FORBIDDEN_WORDS = [
    'marabout',
    'maître',
    'grand maître',
    'vase magique',
    'magic vase',
    'multiplication d\'argent',
    'money multiplication',
    'retour d\'affection',
    'retour affection',
    'love return',
    'bring back lover',
    'maraboutage',
    'maraboutique',
    'gri-gri',
    'fétiche',
    'talisman',
    'amulette',
    'portefeuille magique',
    'magic wallet',
    'argent magique',
    'magic money',
    'doublement argent',
    'triplement argent',
    'rituel amour',
    'love ritual',
    'rituel retour',
    'return ritual',
    'envoûtement',
    'désenvoûtement',
    'sorcellerie',
    'witchcraft',
    'sorcery',
    'occult',
    'occultisme',
    'voodoo',
    'vaudou',
    'spell caster',
    'spell casting',
    'lottery spell',
    'winning spell',
    'court case spell',
    'success spell',
    'protection spell',
    'cure spell',
    'herbalist',
    'spiritual healer',
    'traditional healer',
    'sangoma',
    'fortune teller',
    'psychic reading',
    'tarot reading',
    'palm reading',
    'clairvoyant',
    'mediumship',
];

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

async function isAdmin(sock, groupId, userJid) {
    try {
        const metadata = await sock.groupMetadata(groupId);
        const participant = metadata.participants.find(p => p.id === userJid);
        return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (_) {
        return false;
    }
}

// ═══════════════════════════════════════
// STYLE
// ═══════════════════════════════════════

const STYLE = {
    forwardingScore: 540,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

// ═══════════════════════════════════════
// TEXT DETECTION
// ═══════════════════════════════════════

function containsForbiddenWords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return FORBIDDEN_WORDS.some(word => lowerText.includes(word.toLowerCase()));
}

function extractTextFromMessage(msg) {
    if (!msg?.message) return null;

    const message = msg.message;

    if (message.conversation) return message.conversation;
    if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
    if (message.imageMessage?.caption) return message.imageMessage.caption;
    if (message.videoMessage?.caption) return message.videoMessage.caption;
    if (message.audioMessage?.caption) return message.audioMessage.caption;
    if (message.documentMessage?.caption) return message.documentMessage.caption;
    if (message.contactMessage?.displayName) return message.contactMessage.displayName;
    if (message.contactMessage?.vcard) return message.contactMessage.vcard;
    if (message.catalogMessage?.title) return message.catalogMessage.title;
    if (message.catalogMessage?.description) return message.catalogMessage.description;

    return null;
}

// ═══════════════════════════════════════
// SANCTION SYSTEM
// ═══════════════════════════════════════

async function applySanction(sock, groupId, userJid, groupName) {
    const config = getConfig();

    if (!config.warnings[groupId]) config.warnings[groupId] = {};
    if (!config.warnings[groupId][userJid]) config.warnings[groupId][userJid] = 0;

    config.warnings[groupId][userJid]++;
    const count = config.warnings[groupId][userJid];
    saveConfig(config);

    const userMention = `@${userJid.split('@')[0].split(':')[0]}`;

    // Récupérer les admins pour les mentions
    let adminJids = [];
    try {
        const metadata = await sock.groupMetadata(groupId);
        adminJids = metadata.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => p.id);
    } catch (_) {}

    if (count === 1) {
        // 1st warning
        await sock.sendMessage(groupId, {
            text:
                '⚠️ *First Warning — Anti-Marabout*\n\n' +
                `${userMention} forbidden content detected.\n\n` +
                '📌 *Scam, occult, and fraudulent content is prohibited.*\n\n' +
                '⚠️ *Warning:* 1/3\n' +
                '⏳ *Next:* Immediate deletion\n' +
                '🚫 *3rd:* Expulsion + Group Lock\n\n' +
                (adminJids.length > 0 ? `👑 *Admins:* ${adminJids.map(a => `@${a.split('@')[0].split(':')[0]}`).join(' ')}\n\n` : '') +
                '⚡ _Zenitsu Anti-Marabout_',
            contextInfo: {
                mentionedJid: [userJid, ...adminJids],
                ...STYLE,
            },
        });

    } else if (count === 2) {
        // 2nd warning — silent deletion only, notify admins
        if (adminJids.length > 0) {
            await sock.sendMessage(groupId, {
                text:
                    '⚠️ *Second Warning — Anti-Marabout*\n\n' +
                    `${userMention} sent another forbidden message.\n` +
                    '📌 *Last warning before expulsion.*\n\n' +
                    `👑 ${adminJids.map(a => `@${a.split('@')[0].split(':')[0]}`).join(' ')}`,
                contextInfo: {
                    mentionedJid: [userJid, ...adminJids],
                    ...STYLE,
                },
            });
        }

    } else if (count >= 3) {
        // 3rd — Expel + Lock group
        try {
            await sock.groupParticipantsUpdate(groupId, [userJid], 'remove');
            console.log(`🚫 Expelled ${userJid}`);
        } catch (err) {
            console.error('❌ Failed to expel:', err.message);
        }

        try {
            await sock.groupSettingUpdate(groupId, 'announcement');
            config.mutedGroups.push(groupId);
            saveConfig(config);
            console.log(`🔒 Group locked: ${groupId}`);
        } catch (err) {
            console.error('❌ Failed to lock group:', err.message);
        }

        await sock.sendMessage(groupId, {
            text:
                '🚫 *Group Locked — Anti-Marabout*\n\n' +
                `${userMention} has been expelled after 3 violations.\n` +
                '🔒 *Group is now read-only.*\n\n' +
                '🔓 *Unlock:* .antimarabout unlock (admin/owner)\n\n' +
                '⚡ _Zenitsu Anti-Marabout_',
            contextInfo: {
                mentionedJid: [userJid, ...adminJids],
                ...STYLE,
            },
        });
    }

    // Reset warnings after 15 minutes
    setTimeout(() => {
        const currentConfig = getConfig();
        if (currentConfig.warnings[groupId]?.[userJid] === count) {
            delete currentConfig.warnings[groupId][userJid];
            saveConfig(currentConfig);
        }
    }, 15 * 60 * 1000);
}

// ═══════════════════════════════════════
// EVENT
// ═══════════════════════════════════════

async function antimaraboutEvent(sock, update) {
    try {
        const config = getConfig();
        if (!config.enabled) return;

        const messages = update.messages || [];

        for (const msg of messages) {
            if (!msg.message) continue;

            const groupId = msg.key?.remoteJid;
            if (!groupId?.endsWith('@g.us')) continue;
            if (config.mutedGroups.includes(groupId)) continue;

            const senderJid = msg.key?.participant || msg.key?.remoteJid;
            if (!senderJid || senderJid === sock.user?.id) continue;

            // Skip admins and owner
            const [isAdminUser] = await Promise.all([
                isAdmin(sock, groupId, senderJid),
            ]);
            if (isAdminUser || isOwner(sock, senderJid)) continue;

            const text = extractTextFromMessage(msg);
            if (!text) continue;

            if (containsForbiddenWords(text)) {
                console.log(`🚨 Anti-Marabout: ${senderJid} in ${groupId}`);

                let groupName = 'Group';
                try {
                    const meta = await sock.groupMetadata(groupId);
                    groupName = meta.subject || 'Group';
                } catch (_) {}

                // Delete message
                try {
                    await sock.sendMessage(groupId, { delete: msg.key });
                } catch (_) {}

                // Apply sanction
                await applySanction(sock, groupId, senderJid, groupName);
            }
        }
    } catch (err) {
        console.error('❌ Anti-Marabout event error:', err.message);
    }
}

// Auto-clean warnings
setInterval(() => {
    const config = getConfig();
    const now = Date.now();
    let changed = false;

    for (const gid in config.warnings) {
        for (const uid in config.warnings[gid]) {
            if (now - config.lastWarningReset > 15 * 60 * 1000) {
                delete config.warnings[gid][uid];
                changed = true;
            }
        }
        if (Object.keys(config.warnings[gid]).length === 0) {
            delete config.warnings[gid];
        }
    }

    if (changed) {
        config.lastWarningReset = now;
        saveConfig(config);
    }
}, 15 * 60 * 1000);

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

async function antimaraboutCommand(sock, msg, args, jid) {
    try {
        const senderJid = msg.key?.participant || msg.key?.remoteJid;
        const isGroup = jid.endsWith('@g.us');

        const [isAdminUser] = await Promise.all([
            isAdmin(sock, jid, senderJid),
        ]);

        if (!isAdminUser && !isOwner(sock, senderJid)) {
            return sock.sendMessage(jid, {
                text: '🚫 *Admins & Owner only!*',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        const config = getConfig();
        const subCommand = args[0]?.toLowerCase();

        // STATUS
        if (!subCommand) {
            const status = config.enabled ? '✅ ACTIVE' : '❌ INACTIVE';
            const isMuted = config.mutedGroups.includes(jid);
            const groupWarnings = config.warnings[jid] || {};
            const totalWarnings = Object.values(groupWarnings).reduce((a, b) => a + b, 0);

            return sock.sendMessage(jid, {
                text:
                    '🛡️ *Anti-Marabout System*\n\n' +
                    `⚙️ *Status:* ${status}\n` +
                    `🔒 *Group:* ${isMuted ? '🔒 LOCKED' : '🔓 OPEN'}\n` +
                    `⚠️ *Active Warnings:* ${totalWarnings}\n\n` +
                    '📌 *Commands:*\n' +
                    '.antimarabout on/off\n' +
                    '.antimarabout reset\n' +
                    '.antimarabout unlock\n' +
                    '.antimarabout list\n\n' +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ON
        if (subCommand === 'on' || subCommand === 'enable') {
            config.enabled = true;
            saveConfig(config);
            return sock.sendMessage(jid, {
                text:
                    '✅ *Anti-Marabout Enabled*\n\n' +
                    '🛡️ Scam & occult content will be detected and removed.\n' +
                    '⚠️ 3 violations = expulsion + group lock.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // OFF
        if (subCommand === 'off' || subCommand === 'disable') {
            config.enabled = false;
            saveConfig(config);
            return sock.sendMessage(jid, {
                text: '❌ *Anti-Marabout Disabled*',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // RESET
        if (subCommand === 'reset') {
            if (config.warnings[jid]) {
                delete config.warnings[jid];
                saveConfig(config);
                return sock.sendMessage(jid, {
                    text: '🔄 *All warnings cleared.*',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
            return sock.sendMessage(jid, {
                text: 'ℹ️ No warnings to clear.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // UNLOCK
        if (subCommand === 'unlock') {
            const index = config.mutedGroups.indexOf(jid);
            if (index !== -1) {
                config.mutedGroups.splice(index, 1);
                saveConfig(config);
                try { await sock.groupSettingUpdate(jid, 'not_announcement'); } catch (_) {}
                return sock.sendMessage(jid, {
                    text:
                        '🔓 *Group Unlocked!*\n\n' +
                        '💬 Members can now send messages.\n' +
                        '🛡️ Anti-Marabout remains active.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
            return sock.sendMessage(jid, {
                text: 'ℹ️ Group is not locked.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // LIST
        if (subCommand === 'list') {
            const words = FORBIDDEN_WORDS.filter((w, i) => i < 20).map(w => `• ${w}`).join('\n');
            return sock.sendMessage(jid, {
                text:
                    '📋 *Monitored Content*\n\n' +
                    `${words}\n\n` +
                    `... and ${FORBIDDEN_WORDS.length - 20} more.\n\n` +
                    '📌 *Sanctions:*\n' +
                    '1st: Warning\n' +
                    '2nd: Final warning\n' +
                    '3rd: Expulsion + Group Lock\n\n' +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        return sock.sendMessage(jid, {
            text:
                '❌ *Unknown command*\n\n' +
                '.antimarabout on/off\n' +
                '.antimarabout reset\n' +
                '.antimarabout unlock\n' +
                '.antimarabout list',
            contextInfo: STYLE,
        }, { quoted: msg });

    } catch (err) {
        console.error('❌ Anti-Marabout command error:', err.message);
    }
}

module.exports = {
    event: 'messages.upsert',
    execute: antimaraboutEvent,
    name: 'antimarabout',
    command: antimaraboutCommand,
};
