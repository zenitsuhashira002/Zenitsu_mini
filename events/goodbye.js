// ./events/goodbye.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const GOODBYE_FILE = path.join(process.cwd(), 'database', 'goodbye.json');

const dbDir = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(GOODBYE_FILE)) fs.writeFileSync(GOODBYE_FILE, '{}');

function getGoodbye() {
    try { return JSON.parse(fs.readFileSync(GOODBYE_FILE, 'utf8')); }
    catch (err) { return {}; }
}

function saveGoodbye(data) {
    try { fs.writeFileSync(GOODBYE_FILE, JSON.stringify(data, null, 2)); }
    catch (err) { console.error('❌ Error saving goodbye.json:', err); }
}

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
// ASSETS
// ═══════════════════════════════════════

const FALLBACK_IMAGES = [
    'https://iili.io/BQeNq0b.jpg',
    'https://files.catbox.moe/tz07yl.jpg',
    'https://files.catbox.moe/jcf2qc.jpg',
    'https://iili.io/CY3iYba.jpg',
    'https://iili.io/CY3igd7.jpg',
    'https://iili.io/CY3sB2I.jpg',
    'https://iili.io/CY3s542.jpg',
    'https://iili.io/CY3sNv1.jpg',
    'https://iili.io/CY3sgGR.jpg',
    'https://files.catbox.moe/verxnu.jpg',
    'https://files.catbox.moe/noph7e.jpg',
    'https://iili.io/CE2i0kg.jpg',
];

const DEFAULT_AVATAR = 'https://iili.io/CSAJ38v.jpg';

function getRandomFallback() {
    return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
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
// ANTI-SPAM
// ═══════════════════════════════════════

const lastGoodbyeSent = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of lastGoodbyeSent) {
        if (now - timestamp > 300000) lastGoodbyeSent.delete(key);
    }
}, 60000);

// ═══════════════════════════════════════
// SEND GOODBYE CARD (Some-Random-API)
// ═══════════════════════════════════════

async function sendGoodbyeCard(sock, groupId, userJid, groupName, memberCount) {
    try {
        let avatarUrl = DEFAULT_AVATAR;
        try { avatarUrl = await sock.profilePictureUrl(userJid, 'image'); } catch (_) {}

        const styles = ['gaming1', 'gaming2', 'gaming3', 'gaming4', 'space', 'stars', 'sunset'];
        const style = styles[Math.floor(Math.random() * styles.length)];

        const apiUrl = `https://api.some-random-api.com/welcome/img/2/${style}?` +
            `type=leave&textcolor=yellow&username=User` +
            `&guildName=${encodeURIComponent(groupName)}` +
            `&memberCount=${memberCount}` +
            `&avatar=${encodeURIComponent(avatarUrl)}`;

        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        const buffer = Buffer.from(response.data);
        if (buffer.length > 500) {
            await sock.sendMessage(groupId, {
                image: buffer,
                caption:
                    `🫂 *Goodbye!*\n\n` +
                    `👤 @${userJid.split('@')[0].split(':')[0]}\n` +
                    `📢 ${groupName}\n` +
                    `👥 ${memberCount} members now.\n\n` +
                    '🥀 Your presence was useful!\n\n' +
                    '⚡ _Powered by Cybernova_',
                contextInfo: { mentionedJid: [userJid], ...STYLE },
            });
            return true;
        }
    } catch (err) {
        console.log('⚠️ Goodbye card failed:', err.message);
    }
    return false;
}

// ═══════════════════════════════════════
// SEND FALLBACK GOODBYE
// ═══════════════════════════════════════

async function sendFallbackGoodbye(sock, groupId, userJid, groupName, memberCount) {
    try {
        const userName = userJid.split('@')[0].split(':')[0];
        const randomImage = getRandomFallback();

        await sock.sendMessage(groupId, {
            image: { url: randomImage },
            caption:
                `╭━━━━❲ *GOODBYE* ❳━━━━╮\n` +
                `┃\n` +
                `┃  🫂 @${userName}\n` +
                `┃  Has left *${groupName}*\n` +
                `┃\n` +
                `┃  👥 Members: ${memberCount}\n` +
                `┃\n` +
                `┃  🥀 We'll miss you!\n` +
                `┃\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
                '© 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 𝙘𝙮𝙗𝙚𝙧𝙣𝙤𝙫𝘼',
            contextInfo: { mentionedJid: [userJid], ...STYLE },
        });
        return true;
    } catch (err) {
        console.log('⚠️ Fallback goodbye failed:', err.message);
    }
    return false;
}

// ═══════════════════════════════════════
// SEND TEXT GOODBYE
// ═══════════════════════════════════════

async function sendTextGoodbye(sock, groupId, userJid, groupName, memberCount) {
    try {
        const userName = userJid.split('@')[0].split(':')[0];

        await sock.sendMessage(groupId, {
            text:
                `🫂 *Goodbye @${userName}*\n` +
                `📢 ${groupName}\n` +
                `👥 ${memberCount} members now.\n\n` +
                '🥀 We wish you all the best!\n\n' +
                '⚡ _Powered by Cybernova_',
            contextInfo: { mentionedJid: [userJid], ...STYLE },
        });
        return true;
    } catch (_) {}
    return false;
}

// ═══════════════════════════════════════
// EVENT
// ═══════════════════════════════════════

async function goodbyeEvent(sock, update) {
    try {
        const { id, participants, action } = update;
        if (!id || !participants || action !== 'remove') return;

        const db = getGoodbye();
        if (db[id] === false) return;

        let metadata;
        try { metadata = await sock.groupMetadata(id); } catch (_) { return; }
        if (!metadata) return;

        const groupName = metadata.subject || 'Group';
        const memberCount = metadata.participants?.length || 0;

        for (let user of participants) {
            const jid = typeof user === 'string' ? user : user.id;
            if (!jid) continue;

            const cacheKey = `${id}_${jid}`;
            const lastTime = lastGoodbyeSent.get(cacheKey);
            if (lastTime && Date.now() - lastTime < 10000) continue;
            lastGoodbyeSent.set(cacheKey, Date.now());

            let sent = false;

            sent = await sendGoodbyeCard(sock, id, jid, groupName, memberCount);
            if (!sent) sent = await sendFallbackGoodbye(sock, id, jid, groupName, memberCount);
            if (!sent) await sendTextGoodbye(sock, id, jid, groupName, memberCount);

            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (err) {
        console.error('❌ Goodbye event error:', err.message);
    }
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

async function goodbyeCommand(sock, msg, args, jid) {
    try {
        const senderJid = msg.key?.participant || msg.key?.remoteJid;
        const isGroup = jid.endsWith('@g.us');

        if (!isGroup) {
            return sock.sendMessage(jid, {
                text: '❌ This command only works in groups.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        const subCommand = args[0]?.toLowerCase();
        const secondArg = args[1]?.toLowerCase();
        const db = getGoodbye();

        // ═══════════════════
        // OFF ALL (Owner/Bot only)
        // ═══════════════════

        if (subCommand === 'off' && secondArg === 'all') {
            if (!isOwner(sock, senderJid)) {
                return sock.sendMessage(jid, {
                    text: '🚫 *Owner only!*\n\nOnly the bot owner can disable goodbye for ALL groups.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Désactiver pour tous les groupes
            const allChats = await sock.groupFetchAllParticipating();
            let count = 0;
            for (const gid of Object.keys(allChats)) {
                if (db[gid] !== false) {
                    db[gid] = false;
                    count++;
                }
            }
            saveGoodbye(db);

            return sock.sendMessage(jid, {
                text:
                    '❌ *Goodbye Disabled — All Groups*\n\n' +
                    `📊 *Groups affected:* ${count}\n` +
                    '📢 Goodbye messages are now OFF for all groups.\n\n' +
                    '💡 Use *.goodbye on* to re-enable per group.\n\n' +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // ON ALL (Owner/Bot only)
        // ═══════════════════

        if (subCommand === 'on' && secondArg === 'all') {
            if (!isOwner(sock, senderJid)) {
                return sock.sendMessage(jid, {
                    text: '🚫 *Owner only!*\n\nOnly the bot owner can enable goodbye for ALL groups.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const allChats = await sock.groupFetchAllParticipating();
            let count = 0;
            for (const gid of Object.keys(allChats)) {
                if (db[gid] !== true) {
                    db[gid] = true;
                    count++;
                }
            }
            saveGoodbye(db);

            return sock.sendMessage(jid, {
                text:
                    '✅ *Goodbye Enabled — All Groups*\n\n' +
                    `📊 *Groups affected:* ${count}\n` +
                    '📢 Goodbye messages are now ON for all groups.\n\n' +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // ON (single group)
        // ═══════════════════

        if (subCommand === 'on') {
            db[jid] = true;
            saveGoodbye(db);
            return sock.sendMessage(jid, {
                text:
                    '✅ *Goodbye Enabled*\n\n' +
                    '📢 Goodbye messages are now ON for this group.\n\n' +
                    '💡 *Tip:* .goodbye off all to disable everywhere.\n\n' +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // OFF (single group)
        // ═══════════════════

        if (subCommand === 'off') {
            db[jid] = false;
            saveGoodbye(db);
            return sock.sendMessage(jid, {
                text:
                    '❌ *Goodbye Disabled*\n\n' +
                    '📢 Goodbye messages are now OFF for this group.\n\n' +
                    '💡 *Tip:* .goodbye off all to disable everywhere.\n\n' +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // STATUS
        // ═══════════════════

        const status = db[jid] === false ? '❌ OFF' : '✅ ON';
        const prefix = global.PREFIX || '.';

        let metadata;
        try { metadata = await sock.groupMetadata(jid); } catch (_) {}
        const groupName = metadata?.subject || 'Unknown';
        const memberCount = metadata?.participants?.length || '?';

        return sock.sendMessage(jid, {
            text:
                `╭━━━━❲ *GOODBYE SYSTEM* ❳━━━━╮\n` +
                `┃\n` +
                `┃  📢 *Group:* ${groupName}\n` +
                `┃  👥 *Members:* ${memberCount}\n` +
                `┃  ⚙️ *Status:* ${status}\n` +
                `┃\n` +
                `┃  📌 *Commands:*\n` +
                `┃  ${prefix}goodbye on\n` +
                `┃  ${prefix}goodbye off\n` +
                `┃  ${prefix}goodbye on all (owner)\n` +
                `┃  ${prefix}goodbye off all (owner)\n` +
                `┃\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
                '© 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 𝙘𝙮𝙗𝙚𝙧𝙣𝙤𝙫𝘼',
            contextInfo: STYLE,
        }, { quoted: msg });

    } catch (err) {
        console.error('❌ Goodbye command error:', err.message);
    }
}

module.exports = {
    event: 'group-participants.update',
    execute: goodbyeEvent,
    name: 'goodbye',
    command: goodbyeCommand,
};
