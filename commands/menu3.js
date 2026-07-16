
// ./commands/menu.js

const fs = require('fs');
const path = require('path');
const os = require('os');

// ═══════════════════════════════════════
// RUNTIME FUNCTION
// ═══════════════════════════════════════

function runtime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h ${m % 60}m ${s % 60}s`;
}

// ═══════════════════════════════════════
// CONFIG — Vos informations
// ═══════════════════════════════════════

const BOT_INFO = {
    name: '𝙯𝙚𝙣𝙞𝙩𝙨𝙪 ᗰᎥᑎᎥ',
    owner: '50935729494',
    ownerName: '🇿єиιтѕυ  Ⱨ ɪʀᴀ',
    channelName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
    channelJid: '120363425394543602@newsletter',
    channelUrl: 'https://whatsapp.com/channel/0029Vb8BKWwH5JLxq1ef1R43',
    menuImage: 'https://iili.io/CcjxqtR.jpg',
    menuAudio: 'https://files.catbox.moe/1ydyks.mp3',
    thumbnail: 'https://files.catbox.moe/uklx8n.jpg',
    description: 'ᴄʏʙᴇʀɴᴏᴠᴀ 𝐗 𝙈𝙀𝙏𝘼',
};

// ═══════════════════════════════════════
// MAIN COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'menu3',
    aliases: ['help', 'allmenu', 'commands'],

    async execute({ sock, msg, args, jid, config, stats, subBots }) {
        try {
            // ── Fake Verified Contact ──
            const fakeVerified = {
                key: {
                    fromMe: false,
                    participant: '0@s.whatsapp.net',
                    remoteJid: 'status@broadcast',
                },
                message: {
                    contactMessage: {
                        displayName: `⚡ ${BOT_INFO.name} ✔️`,
                        vcard: `BEGIN:VCARD
VERSION:3.0
FN:${BOT_INFO.name}
ORG:Zenitsu Mini Bot;
TITLE:Official WhatsApp Bot — Verified
TEL;type=CELL;type=VOICE;waid=${BOT_INFO.owner}:+${BOT_INFO.owner}
END:VCARD`,
                    },
                },
            };

            // ── Reaction ──
            await sock.sendMessage(jid, {
                react: { text: '⚡', key: msg.key },
            });

            // ── Audio (PTT) ──
            try {
                await sock.sendMessage(jid, {
                    audio: { url: BOT_INFO.menuAudio },
                    mimetype: 'audio/mpeg',
                    ptt: true,
                }, { quoted: fakeVerified });
            } catch (audioErr) {
                // Audio fallback: skip if unavailable
                console.log('⚠️ Menu audio unavailable, continuing without it.');
            }

            // ── Get user info ──
            const senderJid = msg.key.participant || msg.key.remoteJid;
            const senderNumber = senderJid.split('@')[0];

            // ── Date info ──
            const now = new Date();
            const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
            const date = now.getDate();
            const month = now.toLocaleDateString('en-US', { month: 'long' });
            const year = now.getFullYear();
            const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            // ── Stats ──
            const uptime = formatUptime(Date.now() - (stats?.startTime || Date.now()));
            const totalCmds = config?.commandsCount || 0;

            // ── Load commands from directory ──
            const commandsDir = config?.commandsDir || './commands';
            const commandsPath = path.resolve(commandsDir);

            let categories = {};
            let totalLoaded = 0;

            if (fs.existsSync(commandsPath)) {
                const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

                for (const file of files) {
                    try {
                        const filePath = path.join(commandsPath, file);
                        delete require.cache[require.resolve(filePath)];
                        const cmdModule = require(filePath);

                        const cmds = Array.isArray(cmdModule) ? cmdModule : [cmdModule];

                        for (const cmd of cmds) {
                            if (cmd?.name) {
                                const category = cmd.category || 'general';
                                if (!categories[category]) {
                                    categories[category] = [];
                                }
                                categories[category].push(cmd.name);
                                totalLoaded++;
                            }
                        }
                    } catch (err) {
                        console.log(`⚠️ Plugin load error: ${file}`);
                    }
                }
            }

            // Sort categories and commands
            const sortedCats = Object.keys(categories).sort();
            let menuText = '';

            for (const cat of sortedCats) {
                const sortedCommands = categories[cat].sort();
                if (!sortedCommands.length) continue;

                menuText += `\n『 ⚡ *${cat.toUpperCase()}* 』\n`;
                menuText += `╭━━━━━━━━━━━━┈⊷\n`;
                sortedCommands.forEach(cmd => {
                    menuText += `┃ ▸ ${cmd}\n`;
                });
                menuText += `╰━━━━━━━━━━━━┈⊷\n`;
            }

            if (!menuText) {
                menuText = `\n『 ⚡ *COMMANDS* 』\n`;
                menuText += `╭━━━━━━━━━━━━┈⊷\n`;
                menuText += `┃ ▸ No commands loaded yet\n`;
                menuText += `╰━━━━━━━━━━━━┈⊷\n`;
            }

            // ── Build caption ──
            const caption =
                `╭━〔 ${BOT_INFO.name} 〕━┈⊷\n` +
                `┃\n` +
                `┃ 📱 *Number*: @${senderNumber}\n` +
                `┃ ⚙️  *Mode*: ${config?.MODE || 'public'}\n` +
                `┃ ⏳ *Upt*: ${uptime}\n` +
                `┃ 🔰 *Prefix*: [ ${config?.PREFIX || '.'} ]\n` +
                `┃ 🤖 *Subbots*: ${subBots?.size || 0}\n` +
                `┃ 📦 *Cmds*: ${totalLoaded}\n` +
                `┃\n` +
                `┃ 📅 *${dayName}*\n` +
                `┃ 📆 *${date} ${month} ${year}*\n` +
                `┃ 🕒 *${time}*\n` +
                `┃\n` +
                `╰━━━━━━━━━━━━━┈⊷` +
                `\n${menuText}\n` +
                `> ⚡ ${BOT_INFO.description}\n`;

            // ── Mention ──
            const mentionedJid = [senderJid];
            if (config?.OWNER_JID) {
                mentionedJid.push(config.OWNER_JID);
            }

            // ── Send image menu ──
            let sent = false;

            // Method 1: Image with caption
            try {
                await sock.sendMessage(jid, {
                    image: { url: BOT_INFO.menuImage },
                    caption: caption,
                    contextInfo: {
                        mentionedJid: mentionedJid,
                        forwardingScore: 587,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: BOT_INFO.channelJid,
                            newsletterName: BOT_INFO.channelName,
                            serverMessageId: 202,
                        },
                        externalAdReply: {
                            title: `⚡ ${BOT_INFO.name}`,
                            body: BOT_INFO.description,
                            thumbnailUrl: BOT_INFO.thumbnail,
                            sourceUrl: BOT_INFO.channelUrl,
                            mediaType: 1,
                            renderLargerThumbnail: true,
                        },
                    },
                }, { quoted: fakeVerified });
                sent = true;
            } catch (imgErr) {
                console.log('⚠️ Menu image failed, trying fallback...');
            }

            // Fallback: Text only
            if (!sent) {
                await sock.sendMessage(jid, {
                    text: caption,
                    contextInfo: {
                        mentionedJid: mentionedJid,
                        forwardingScore: 145,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: BOT_INFO.channelJid,
                            newsletterName: BOT_INFO.channelName,
                            serverMessageId: 202,
                        },
                        externalAdReply: {
                            title: `⚡ ${BOT_INFO.name}`,
                            body: BOT_INFO.description,
                            thumbnailUrl: BOT_INFO.thumbnail,
                            sourceUrl: BOT_INFO.channelUrl,
                            mediaType: 1,
                            renderLargerThumbnail: true,
                        },
                    },
                }, { quoted: fakeVerified });
            }

        } catch (e) {
            console.log('❌ MENU ERROR:', e.message || e);

            // Ultimate fallback
            try {
                await sock.sendMessage(jid, {
                    text:
                        `╭━━〔 ⚡${BOT_INFO.name}⚡ 〕━━┈⊷\n` +
                        `┃\n` +
                        `┃  📡 *Status* : 🟢 Active\n` +
                        `┃  🔰 *Prefix* : [ . ]\n` +
                        `┃\n` +
                        `┃  📢 *Channel* :\n` +
                        `┃  ${BOT_INFO.channelUrl}\n` +
                        `┃\n` +
                        `╰━━━━━━━━━━━━━━━━━┈⊷\n\n` +
                        `> ⚡ Type .menu to see full menu`,
                    contextInfo: {
                        forwardingScore: 1539,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: BOT_INFO.channelJid,
                            newsletterName: BOT_INFO.channelName,
                            serverMessageId: 202,
                        },
                    },
                });
            } catch (finalErr) {
                console.log('❌ ULTIMATE MENU FALLBACK FAILED:', finalErr.message);
            }
        }
    },
};
