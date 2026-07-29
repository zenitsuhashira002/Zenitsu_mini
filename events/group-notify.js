
// ./events/group-notify.js

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════
const NOTIFY_FILE = path.join(process.cwd(), 'database', 'group-notify.json');
const GROUP_ICONS_FILE = path.join(process.cwd(), 'database', 'group-icons.json');

// 📁 Créer dossier + fichiers si inexistants
const dbDir = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(NOTIFY_FILE)) fs.writeFileSync(NOTIFY_FILE, '{}');
if (!fs.existsSync(GROUP_ICONS_FILE)) fs.writeFileSync(GROUP_ICONS_FILE, '{}');

// ═══════════════════════════════════════
// DATABASE HELPERS
// ═══════════════════════════════════════

function getNotifyDB() {
    try {
        return JSON.parse(fs.readFileSync(NOTIFY_FILE, 'utf8'));
    } catch (err) {
        console.error('❌ Error reading group-notify.json:', err);
        return {};
    }
}

function saveNotifyDB(data) {
    try {
        fs.writeFileSync(NOTIFY_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('❌ Error saving group-notify.json:', err);
    }
}

function getIconsDB() {
    try {
        return JSON.parse(fs.readFileSync(GROUP_ICONS_FILE, 'utf8'));
    } catch (err) {
        console.error('❌ Error reading group-icons.json:', err);
        return {};
    }
}

function saveIconsDB(data) {
    try {
        fs.writeFileSync(GROUP_ICONS_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('❌ Error saving group-icons.json:', err);
    }
}

// ═══════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════

// Fallback images for group header (catbox hosted)
const DEFAULT_GROUP_ICONS = [
    'https://files.catbox.moe/jcf2qc.jpg',
    'https://files.catbox.moe/tz07yl.jpg',
    'https://files.catbox.moe/8s31s2.jpg',
    'https://files.catbox.moe/48pqbp.jpg',
    'https://files.catbox.moe/ufzn87.jpg',
    'https://files.catbox.moe/718prk.jpg',
    'https://files.catbox.moe/3c33kh.jpg',
    'https://files.catbox.moe/verxnu.jpg',
    'https://files.catbox.moe/noph7e.jpg',
];

// Action icons mapping
const ACTION_ICONS = {
    promote: '⬆️',
    demote: '⬇️',
};

// Action labels mapping
const ACTION_LABELS = {
    promote: 'PROMOTED',
    demote: 'DEMOTED',
};

// Action colors (for visual distinction)
const ACTION_COLORS = {
    promote: '#2196F3',   // Blue
    demote: '#FF9800',    // Orange
};

// ═══════════════════════════════════════
// HELPER: GET GROUP ICON URL
// ═══════════════════════════════════════

/**
 * Get a working group icon URL with fallback chain:
 * 1. Group's actual profile picture
 * 2. Saved custom icon for this group
 * 3. Random default icon
 * @param {object} sock - Baileys socket
 * @param {string} groupJid - Group JID
 * @returns {Promise<string>} Working icon URL
 */
async function getGroupIcon(sock, groupJid) {
    // 1. Try group's actual profile picture
    try {
        const ppUrl = await sock.profilePictureUrl(groupJid, 'image');
        if (ppUrl) return ppUrl;
    } catch (err) {
        // No group picture, continue to fallbacks
    }

    // 2. Try saved custom icon
    const iconsDB = getIconsDB();
    if (iconsDB[groupJid]) {
        try {
            // Quick URL validation by checking if it starts with http
            if (iconsDB[groupJid].startsWith('http')) {
                return iconsDB[groupJid];
            }
        } catch (err) {
            // Invalid saved URL, continue
        }
    }

    // 3. Return random default icon
    return DEFAULT_GROUP_ICONS[Math.floor(Math.random() * DEFAULT_GROUP_ICONS.length)];
}

// ═══════════════════════════════════════
// HELPER: GET PROFILE PICTURE
// ═══════════════════════════════════════

/**
 * Try to get a user's profile picture, with fallback
 * @param {object} sock - Baileys socket
 * @param {string} jid - User JID
 * @returns {Promise<string|null>} Profile picture URL or null
 */
async function getUserProfilePic(sock, jid) {
    try {
        return await sock.profilePictureUrl(jid, 'image');
    } catch (err) {
        return null;
    }
}

// ═══════════════════════════════════════
// ANTI-SPAM CACHE
// ═══════════════════════════════════════

const notificationCache = new Map();

// Clean cache every 2 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of notificationCache) {
        if (now - timestamp > 120000) { // 2 minutes
            notificationCache.delete(key);
        }
    }
}, 60000);

// ═══════════════════════════════════════
// MAIN EVENT HANDLER
// ═══════════════════════════════════════

/**
 * Event handler for group participant updates
 */
async function groupNotifyEvent(sock, update) {
    try {
        const { id, participants, action } = update;

        if (!id || !participants || !action) return;

        // Only handle supported actions
        if (!['promote', 'demote'].includes(action)) return;

        // Check if notifications are enabled for this group
        const notifyDB = getNotifyDB();
        if (notifyDB[id] === false) return;

        // Get group metadata
        let metadata;
        try {
            metadata = await sock.groupMetadata(id);
        } catch (err) {
            console.error('❌ Error fetching group metadata:', err.message);
            return;
        }

        if (!metadata) return;

        const groupName = metadata.subject || 'Group';
        const memberCount = metadata.participants ? metadata.participants.length : 0;
        const groupDesc = metadata.desc || '';

        // Get group icon
        const groupIcon = await getGroupIcon(sock, id);

        // Get the actor (who performed the action)
        const actor = update.author || null;

        // Process each participant
        for (let participant of participants) {
            const targetJid = typeof participant === 'string' ? participant : participant.id;
            if (!targetJid) continue;

            // Anti-spam check
            const cacheKey = `${id}_${targetJid}_${action}`;
            const lastTime = notificationCache.get(cacheKey);
            if (lastTime && Date.now() - lastTime < 10000) { // 10 seconds
                continue;
            }
            notificationCache.set(cacheKey, Date.now());

            const targetNumber = targetJid.split('@')[0];
            const actorNumber = actor ? actor.split('@')[0] : 'Unknown';

            // Build the notification message
            const actionIcon = ACTION_ICONS[action] || '📢';
            const actionLabel = ACTION_LABELS[action] || action.toUpperCase();

            // Header: Group icon as clickable image
            const headerText = `*${groupName}*\n${groupDesc ? `📝 ${groupDesc}\n` : ''}━━━━━━━━━━━━━━━━━━━`;

            // Body: Action description
            let bodyText = '';
            switch (action) {
                case 'promote':
                    bodyText = `${actionIcon} *ADMIN PROMOTED*\n\n` +
                        `👤 @${targetNumber}\n` +
                        `👑 Promoted by: @${actorNumber}\n` +
                        `⭐ Now an admin of ${groupName}`;
                    break;

                case 'demote':
                    bodyText = `${actionIcon} *ADMIN DEMOTED*\n\n` +
                        `👤 @${targetNumber}\n` +
                        `👑 Demoted by: @${actorNumber}\n` +
                        `⬇️ Now a regular member`;
                    break;
            }

            // Footer
            const footerText = `\n\n© 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 𝙘𝙮𝙗𝙚𝙧𝙣𝙤𝙫𝘼`;

            const fullCaption = `${headerText}\n${bodyText}${footerText}`;

            // Build mentioned JIDs list
            const mentionedJid = [targetJid];
            if (actor && actor !== targetJid) {
                mentionedJid.push(actor);
            }

            // CyberNova context
            const contextInfo = {
                mentionedJid: mentionedJid,
                forwardingScore: 540,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363425394543602@newsletter',
                    newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                    serverMessageId: 202
                }
            };

            // Send notification with group icon as clickable header
            let sent = false;

            // Method 1: Send image with caption (clickable header)
            try {
                await sock.sendMessage(id, {
                    image: { url: groupIcon },
                    caption: fullCaption,
                    contextInfo: contextInfo,
                    // Make the image a clickable link to the group icon
                    title: groupName,
                    sourceUrl: groupIcon,
                });
                sent = true;
            } catch (imgErr) {
                console.error('⚠️ Group notify image failed:', imgErr.message);
            }

            // Fallback 1: Try with a default icon
            if (!sent) {
                try {
                    const fallbackIcon = DEFAULT_GROUP_ICONS[0];
                    await sock.sendMessage(id, {
                        image: { url: fallbackIcon },
                        caption: fullCaption,
                        contextInfo: contextInfo,
                        title: groupName,
                        sourceUrl: fallbackIcon,
                    });
                    sent = true;
                } catch (fallbackErr) {
                    console.error('⚠️ Group notify fallback image failed:', fallbackErr.message);
                }
            }

            // Fallback 2: Text only
            if (!sent) {
                try {
                    await sock.sendMessage(id, {
                        text: `*${groupName}*\n\n${fullCaption}`,
                        contextInfo: contextInfo,
                    });
                } catch (textErr) {
                    console.error('❌ Group notify text fallback failed:', textErr.message);
                }
            }

            // Small delay between multiple notifications
            await new Promise(res => setTimeout(res, 1500));
        }

    } catch (err) {
        console.error('❌ Group notify event error:', err.message || err);
    }
}

// ═══════════════════════════════════════
// COMMAND: group-notify on/off/set-icon
// ═══════════════════════════════════════

async function groupNotifyCommand(sock, msg, args, jid) {
    try {
        // Only in groups
        if (!jid.endsWith('@g.us')) return;

        const subCommand = args[0]?.toLowerCase();
        const notifyDB = getNotifyDB();

        // Context
        const contextInfo = {
            forwardingScore: 350,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363425394543602@newsletter',
                newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                serverMessageId: 202
            }
        };

        switch (subCommand) {
            case 'on':
                notifyDB[jid] = true;
                saveNotifyDB(notifyDB);
                return sock.sendMessage(jid, {
                    text: '✅ *Group notifications enabled*',
                    contextInfo: contextInfo
                }, { quoted: msg });

            case 'off':
                notifyDB[jid] = false;
                saveNotifyDB(notifyDB);
                return sock.sendMessage(jid, {
                    text: '❌ *Group notifications disabled*',
                    contextInfo: contextInfo
                }, { quoted: msg });

            case 'status':
                const status = notifyDB[jid] === false ? '❌ OFF' : '✅ ON';
                const prefix = global.PREFIX || '.';
                return sock.sendMessage(jid, {
                    text: `╭━━━━❲ *GROUP NOTIFY STATUS* ❳━━━━╮\n` +
                          `┃\n` +
                          `┃  ⚙️ *Status :* ${status}\n` +
                          `┃\n` +
                          `┃  ${prefix}group-notify on    = Enable\n` +
                          `┃  ${prefix}group-notify off   = Disable\n` +
                          `┃  ${prefix}group-notify set-icon = Set\n` +
                          `┃       custom group icon (reply)\n` +
                          `┃\n` +
                          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
                    contextInfo: contextInfo
                }, { quoted: msg });

            case 'set-icon':
            case 'seticon':
                // Reply to an image to set it as group icon
                if (!msg.quoted || !msg.quoted.message?.imageMessage) {
                    return sock.sendMessage(jid, {
                        text: '❌ Please reply to an image to set it as group icon.',
                        contextInfo: contextInfo
                    }, { quoted: msg });
                }

                try {
                    // Download the quoted image
                    const quotedMsg = {
                        key: {
                            remoteJid: msg.key.remoteJid,
                            id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId,
                            participant: msg.message?.extendedTextMessage?.contextInfo?.participant,
                        },
                        message: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage,
                    };
                    const buffer = await sock.downloadMediaMessage(quotedMsg);

                    // Upload to catbox
                    const FormData = require('form-data');
                    const axios = require('axios');

                    const form = new FormData();
                    form.append('fileToUpload', buffer, 'group-icon.jpg');
                    form.append('reqtype', 'fileupload');

                    const uploadRes = await axios.post('https://catbox.moe/user/api.php', form, {
                        headers: form.getHeaders(),
                    });

                    const iconUrl = uploadRes.data.trim();

                    // Save the icon URL
                    const iconsDB = getIconsDB();
                    iconsDB[jid] = iconUrl;
                    saveIconsDB(iconsDB);

                    return sock.sendMessage(jid, {
                        text: `✅ *Group icon updated!*\n\nNew icon URL: ${iconUrl}`,
                        contextInfo: contextInfo
                    }, { quoted: msg });

                } catch (uploadErr) {
                    console.error('❌ Icon upload error:', uploadErr);
                    return sock.sendMessage(jid, {
                        text: '❌ Failed to upload group icon. Try again.',
                        contextInfo: contextInfo
                    }, { quoted: msg });
                }

            default:
                // Show help
                const defPrefix = global.PREFIX || '.';
                return sock.sendMessage(jid, {
                    text: `╭━━━━❲ *GROUP NOTIFY* ❳━━━━╮\n` +
                          `┃\n` +
                          `┃  Usage:\n` +
                          `┃  ${defPrefix}group-notify on\n` +
                          `┃  ${defPrefix}group-notify off\n` +
                          `┃  ${defPrefix}group-notify status\n` +
                          `┃  ${defPrefix}group-notify set-icon\n` +
                          `┃    (reply to an image)\n` +
                          `┃\n` +
                          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
                    contextInfo: contextInfo
                }, { quoted: msg });
        }

    } catch (err) {
        console.error('❌ Group notify command error:', err.message || err);
    }
}

// ═══════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════

module.exports = {
    // For event loader
    event: 'group-participants.update',
    execute: groupNotifyEvent,

    // For command loader
    name: 'group-notify',
    command: groupNotifyCommand
};
