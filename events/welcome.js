// ./events/welcome.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const WELCOME_FILE = path.join(process.cwd(), 'database', 'welcome.json');

const dbDir = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(WELCOME_FILE)) fs.writeFileSync(WELCOME_FILE, '{}');

function getWelcome() {
    try { return JSON.parse(fs.readFileSync(WELCOME_FILE, 'utf8')); }
    catch (err) { return {}; }
}

function saveWelcome(data) {
    try { fs.writeFileSync(WELCOME_FILE, JSON.stringify(data, null, 2)); }
    catch (err) { console.error('❌ Error saving welcome.json:', err); }
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
    'https://files.catbox.moe/jcf2qc.jpg',
    'https://files.catbox.moe/tz07yl.jpg',
    'https://iili.io/BsJvF7R.jpg',
    'https://iili.io/BsJUPjV.jpg',
    'https://iili.io/CE2i0kg.jpg',
    'https://iili.io/BsdTfqJ.jpg',
    'https://iili.io/Bsd7U0u.jpg',
    'https://iili.io/BsdNyMu.jpg',
    'https://iili.io/Bsdk4MF.jpg',
    'https://iili.io/BsdgELN.jpg',
    'https://iili.io/Bsd6h21.jpg',
    'https://iili.io/BsdsRrN.jpg',
    'https://iili.io/BsdGUHF.jpg',
    'https://files.catbox.moe/verxnu.jpg',
    'https://files.catbox.moe/noph7e.jpg',
];

const DEFAULT_AVATAR = 'https://iili.io/CSAJ38v.jpg';

function getRandomFallback() {
    return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
}

// ═══════════════════════════════════════
// STYLE
// ═══════════════════════════════════════

const STYLE = {
    forwardingScore: 550,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 340,
    },
};

// ═══════════════════════════════════════
// ANTI-SPAM
// ═══════════════════════════════════════

const lastWelcomeSent = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of lastWelcomeSent) {
        if (now - timestamp > 300000) lastWelcomeSent.delete(key);
    }
}, 60000);

// ═══════════════════════════════════════
// SEND WELCOME CARD (Popcat API)
// ═══════════════════════════════════════

async function sendWelcomeCard(sock, groupId, userJid, groupName, memberCount) {
    try {
        let avatarUrl = DEFAULT_AVATAR;
        try { avatarUrl = await sock.profilePictureUrl(userJid, 'image'); } catch (_) {}

        const backgrounds = [
            'https://iili.io/CSuZmH7.jpg',
            'https://iili.io/CSuZGcB.jpg',
            'https://iili.io/CSuZqjs.jpg',
            'https://iili.io/CSut9Du.jpg',
            'https://iili.io/CSutBHP.jpg',
            'https://iili.io/CSutoDg.jpg',
            'https://iili.io/CSutTiv.jpg',
            'https://iili.io/CSut5UN.jpg',
        ];
        const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];

        const apiUrl = `https://api.popcat.xyz/v2/welcomecard?` +
            `background=${encodeURIComponent(background)}` +
            `&text1=User&text2=${encodeURIComponent(`Welcome to ${groupName}`)}` +
            `&text3=${encodeURIComponent(`Member ${memberCount}`)}` +
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
                    `✮ *𝗪𝗲𝗹𝗰𝗼𝗺𝗲* ✮\n\n` +
                    `👤 @${userJid.split('@')[0].split(':')[0]}\n` +
                    `📢 ${groupName}\n` +
                    `👥 𝗠𝗲𝗺𝗯𝗲𝗿𝘀: ${memberCount}\n\n` +
                    `𝑼𝒔𝒆 *.𝒘𝒆𝒍𝒄𝒐𝒎𝒆* 𝒐𝒇𝒇 𝒕𝒐 𝒅𝒊𝒔𝒂𝒃𝒍𝒆 𝒕𝒉𝒊𝒔 𝒆𝒗𝒆𝒏𝒕\n` +
                    '⚡ _Powered by Cybernova_',
                contextInfo: { mentionedJid: [userJid], ...STYLE },
            });
            return true;
        }
    } catch (err) {
        console.log('⚠️ Welcome card failed:', err.message);
    }
    return false;
}

// ═══════════════════════════════════════
// SEND FALLBACK WELCOME
// ═══════════════════════════════════════

async function sendFallbackWelcome(sock, groupId, userJid, groupName, memberCount) {
    try {
        const userName = userJid.split('@')[0].split(':')[0];
        const randomImage = getRandomFallback();

        await sock.sendMessage(groupId, {
            image: { url: randomImage },
            caption:
                `╭━━❲ *𝚆𝚎𝚕𝚌𝚘𝚖𝚎* ❳━━╮\n` +
                `┃\n` +
                `┃ ✮ @${userName}\n` +
                `┃ *${groupName}*\n` +
                `┃\n` +
                `┃ 👥 𝗠𝗲𝗺𝗯𝗲𝗿𝘀: ${memberCount}\n` +
                `┃ ⚡ Respect all admins\n` +
                `┃ 𝑼𝒔𝒆 *.𝒘𝒆𝒍𝒄𝒐𝒎𝒆* 𝒐𝒇𝒇 𝒕𝒐 𝒅𝒊𝒔𝒂𝒃𝒍𝒆 𝒕𝒉𝒊𝒔 𝒆𝒗𝒆𝒏𝒕\n` +
                `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
                '© 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 𝙘𝙮𝙗𝙚𝙧𝙣𝙤𝙫𝘼',
            contextInfo: { mentionedJid: [userJid], ...STYLE },
        });
        return true;
    } catch (err) {
        console.log('⚠️ Fallback welcome failed:', err.message);
    }
    return false;
}

// ═══════════════════════════════════════
// SEND TEXT WELCOME
// ═══════════════════════════════════════

async function sendTextWelcome(sock, groupId, userJid, groupName, memberCount) {
    try {
        const userName = userJid.split('@')[0].split(':')[0];

        await sock.sendMessage(groupId, {
            text:
                `✮ *𝗪𝗲𝗹𝗰𝗼𝗺𝗲 @${userName}!* ✮\n` +
                `📢 ${groupName}\n` +
                `👥 𝗠𝗲𝗺𝗯𝗲𝗿𝘀: ${memberCount}\n\n` +
                '⚡ *Rules:*\n' +
                '• Respect all members\n' +
                '• No spam or NSFW\n' +
                '• Follow admins\' instructions\n\n' +
                '© 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 𝙘𝙮𝙗𝙚𝙧𝙣𝙤𝙫𝘼',
            contextInfo: { mentionedJid: [userJid], ...STYLE },
        });
        return true;
    } catch (_) {}
    return false;
}

// ═══════════════════════════════════════
// EVENT
// ═══════════════════════════════════════

async function welcomeEvent(sock, update) {
    try {
        const { id, participants, action } = update;
        if (!id || !participants || action !== 'add') return;

        const db = getWelcome();
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
            const lastTime = lastWelcomeSent.get(cacheKey);
            if (lastTime && Date.now() - lastTime < 10000) continue;
            lastWelcomeSent.set(cacheKey, Date.now());

            let sent = false;

            sent = await sendWelcomeCard(sock, id, jid, groupName, memberCount);
            if (!sent) sent = await sendFallbackWelcome(sock, id, jid, groupName, memberCount);
            if (!sent) await sendTextWelcome(sock, id, jid, groupName, memberCount);

            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (err) {
        console.error('❌ Welcome event error:', err.message);
    }
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

async function welcomeCommand(sock, msg, args, jid) {
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
        const db = getWelcome();

        // ═══════════════════
        // OFF ALL (Owner/Bot only)
        // ═══════════════════

        if (subCommand === 'off' && secondArg === 'all') {
            if (!isOwner(sock, senderJid)) {
                return sock.sendMessage(jid, {
                    text: '🚫 *Owner only!*\n\nOnly the bot owner can disable welcome for ALL groups.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const allChats = await sock.groupFetchAllParticipating();
            let count = 0;
            for (const gid of Object.keys(allChats)) {
                if (db[gid] !== false) {
                    db[gid] = false;
                    count++;
                }
            }
            saveWelcome(db);

            return sock.sendMessage(jid, {
                text:
                    '❌ *Welcome Disabled — All Groups*\n\n' +
                    `📊 *Groups affected:* ${count}\n` +
                    '📢 Welcome messages are now OFF for all groups.\n\n' +
                    '💡 Use *.welcome on* to re-enable per group.\n\n' +
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
                    text: '🚫 *Owner only!*\n\nOnly the bot owner can enable welcome for ALL groups.',
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
            saveWelcome(db);

            return sock.sendMessage(jid, {
                text:
                    '✅ *Welcome Enabled — All Groups*\n\n' +
                    `📊 *Groups affected:* ${count}\n` +
                    '📢 Welcome messages are now ON for all groups.\n\n' +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // ON (single group)
        // ═══════════════════

        if (subCommand === 'on') {
            db[jid] = true;
            saveWelcome(db);
            return sock.sendMessage(jid, {
                text:
                    '✅ *Welcome Enabled*\n\n' +
                    '📢 Welcome messages are now ON for this group.\n\n' +
                    '💡 *Tip:* .welcome off all to disable everywhere.\n\n' +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // OFF (single group)
        // ═══════════════════

        if (subCommand === 'off') {
            db[jid] = false;
            saveWelcome(db);
            return sock.sendMessage(jid, {
                text:
                    '❌ *Welcome Disabled*\n\n' +
                    '📢 Welcome messages are now OFF for this group.\n\n' +
                    '💡 *Tip:* .welcome off all to disable everywhere.\n\n' +
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
                `╭━━━━❲ *WELCOME SYSTEM* ❳━━━━╮\n` +
                `┃\n` +
                `┃  📢 *Group:* ${groupName}\n` +
                `┃  👥 *Members:* ${memberCount}\n` +
                `┃  ⚙️ *Status:* ${status}\n` +
                `┃\n` +
                `┃  📌 *Commands:*\n` +
                `┃  ${prefix}welcome on\n` +
                `┃  ${prefix}welcome off\n` +
                `┃  ${prefix}welcome on all (owner)\n` +
                `┃  ${prefix}welcome off all (owner)\n` +
                `┃\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
                '© 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 𝙘𝙮𝙗𝙚𝙧𝙣𝙤𝙫𝘼',
            contextInfo: STYLE,
        }, { quoted: msg });

    } catch (err) {
        console.error('❌ Welcome command error:', err.message);
    }
}

module.exports = {
    event: 'group-participants.update',
    execute: welcomeEvent,
    name: 'welcome',
    command: welcomeCommand,
};
