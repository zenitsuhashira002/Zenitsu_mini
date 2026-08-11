// ./commands/menu.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ═══════════════════════════════════════
// RUNTIME UTILITIES
// ═══════════════════════════════════════

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h ${m % 60}m ${s % 60}s`;
}

function getNumber(jid) {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0];
}

// ═══════════════════════════════════════
// DÉTECTION DE L'HEURE (GMT)
// ═══════════════════════════════════════

function getGreeting() {
    const now = new Date();
    // Obtenir l'heure en GMT (UTC)
    const hours = now.getUTCHours();
    
    if (hours >= 5 && hours < 12) {
        return {
            emoji: '🌅',
            text: 'ɢᴏᴏᴅ ᴍᴏʀɴɪɴɢ',
            color: '🌤️',
            icon: '☀️'
        };
    } else if (hours >= 12 && hours < 17) {
        return {
            emoji: '🌤️',
            text: '𝐺𝑜𝑜𝑑 𝐴𝑓𝑡𝑒𝑟𝑛𝑜𝑜𝑛',
            color: '☀️',
            icon: '🌤️'
        };
    } else if (hours >= 17 && hours < 21) {
        return {
            emoji: '🌅',
            text: '𝙶𝚘𝚘𝚍 𝙴𝚟𝚎𝚗𝚒𝚗𝚐',
            color: '🌆',
            icon: '🌅'
        };
    } else {
        return {
            emoji: '🌙',
            text: 'Ⓖⓞⓞⓓ Ⓝⓘⓖⓗⓣ',
            color: '🌙',
            icon: '💤'
        };
    }
}

// ═══════════════════════════════════════
// IMAGES ALÉATOIRES
// ═══════════════════════════════════════

const MENU_IMAGES = [
    'https://d.uguu.se/rVsbUaML.jpg',
    'https://d.uguu.se/nYQrSPbo.jpg',
    'https://h.uguu.se/GNCzLOyr.jpg',
    'https://h.uguu.se/yNzuFgco.jpg',
    'https://n.uguu.se/lYjCGaZy.jpg',
    'https://n.uguu.se/ACZrzhhc.jpg',
    'https://iili.io/CUixyMJ.jpg',
    'https://iili.io/CUizcMb.jpg',
    'https://iili.io/CUinQKQ.jpg',
    'https://iili.io/CUinNVf.jpg',
    'https://iili.io/CUiuwx9.jpg',
    'https://iili.io/Cgvv50u.jpg',
    'https://iili.io/CUiuZ0J.jpg'
];

const FALLBACK_IMAGE = 'https://iili.io/CMfZxsI.jpg';

function getRandomImage() {
    return MENU_IMAGES[Math.floor(Math.random() * MENU_IMAGES.length)];
}

async function getWorkingImage() {
    // Essayer d'abord une image aléatoire
    const randomImage = getRandomImage();
    try {
        const response = await axios.head(randomImage, { timeout: 5000 });
        if (response.status === 200) {
            return randomImage;
        }
    } catch (_) {
        // Si l'image aléatoire échoue, essayer les autres
        for (const img of MENU_IMAGES) {
            if (img === randomImage) continue;
            try {
                const response = await axios.head(img, { timeout: 5000 });
                if (response.status === 200) {
                    return img;
                }
            } catch (_) {}
        }
    }
    // Fallback
    return FALLBACK_IMAGE;
}

// ═══════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════

const BOT_INFO = {
    name: '𝐙𝐞𝐧𝐢𝐭𝐬𝐮 𝐌𝐢𝐧𝐢',
    owner: '50935729494',
    menuAudio: 'https://files.catbox.moe/scouh5.mp3',
    channelName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
    channelJid: '120363425394543602@newsletter',
    description: 'ᴄʏʙᴇʀɴᴏᴠᴀ 𝐗 𝙈𝙀𝙏Α',
    version: '4.0.2',
};

// ═══════════════════════════════════════
// MAIN COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'menu',
    aliases: ['help', 'allmenu', 'commands', 'menu'],

    async execute({ sock, msg, args, jid, config, stats, subBots }) {
        try {
            // Processing Action Reaction
            try { await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } }); } catch (_) {}

            // Gather context parameters
            const senderJid = msg.key.participant || msg.key.remoteJid;

            // Détection de l'heure et salutation
            const greeting = getGreeting();
            const now = new Date();
            const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
            const date = now.getDate();
            const month = now.toLocaleDateString('en-US', { month: 'long' });
            const year = now.getFullYear();
            const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            // Heure GMT
            const gmtHours = now.getUTCHours();
            const gmtMinutes = now.getUTCMinutes();
            const gmtTime = `${String(gmtHours).padStart(2, '0')}:${String(gmtMinutes).padStart(2, '0')} GMT`;

            const uptime = formatUptime(Date.now() - (stats?.startTime || Date.now()));

            // Dynamic Command Category Mapping
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
                        console.log(`⚠️ Plugin scanning failure: ${file}`);
                    }
                }
            }

            // Build structural Menu list
            const sortedCats = Object.keys(categories).sort();
            let menuText = '';

            for (const cat of sortedCats) {
                const sortedCommands = categories[cat].sort();
                if (!sortedCommands.length) continue;

                menuText += `\n『 ${greeting.icon} *${cat.toUpperCase()}* 』\n`;
                menuText += `╭━━━━━━━━━━━━┈⊷\n`;
                sortedCommands.forEach(cmd => {
                    menuText += `┃ ▸ ${cmd}\n`;
                });
                menuText += `╰━━━━━━━━━━━━┈⊷\n`;
            }

            if (!menuText) {
                menuText = `\n『 ${greeting.icon} *COMMANDS* 』\n`;
                menuText += `╭━━━━━━━━━━━━┈⊷\n`;
                menuText += `┃ ▸ No active commands mapped.\n`;
                menuText += `╰━━━━━━━━━━━━┈⊷\n`;
            }

            // Combine Dashboard metrics avec la salutation
            const caption =
                `╭━〔 ${BOT_INFO.name} 〕━┈⊷\n` +
                `┃\n` +
                `┃  ${greeting.emoji} *${greeting.text}* ${greeting.icon}\n` +
                `┃\n` +
                `┃ 📱 *User*: @${getNumber(senderJid)}\n` +
                `┃ ⚙️  *Mode*: ${config?.MODE || 'public'}\n` +
                `┃ ⏳ *Uptime*: ${uptime}\n` +
                `┃ 🔰 *Prefix*: [ ${config?.PREFIX || '.'} ]\n` +
                `┃ 🤖 *Subbots*: ${subBots?.size || 0}\n` +
                `┃ 📦 *Cmds*: ${totalLoaded}\n` +
                `┃\n` +
                `┃ 📅 *${dayName}*\n` +
                `┃ 📆 *${date} ${month} ${year}*\n` +
                `┃ 🕒 *${time}*\n` +
                `┃ 🕐 *${gmtTime}*\n` +
                `┃\n` +
                `╰━━━━━━━━━━━━━┈⊷` +
                `\n${menuText}\n` +
                `> ⚡ ${BOT_INFO.description}\n` +
                `> 📌 v${BOT_INFO.version}\n`;

            // Prepare Mentions & Context Styling
            const mentionedJid = [senderJid];
            if (config?.OWNER_JID) mentionedJid.push(config.OWNER_JID);

            const contextStyle = {
                mentionedJid: mentionedJid,
                forwardingScore: 350,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: BOT_INFO.channelJid,
                    newsletterName: BOT_INFO.channelName,
                    serverMessageId: 202,
                }
            };

            // ═══════════════════════════════════════
            // IMAGE - Sélection aléatoire avec fallback
            // ═══════════════════════════════════════
            let menuImage = FALLBACK_IMAGE;
            try {
                menuImage = await getWorkingImage();
                console.log(`✅ Menu image selected: ${menuImage}`);
            } catch (err) {
                console.log(`⚠️ Using fallback image: ${FALLBACK_IMAGE}`);
            }

            // ═══════════════════════════════════════
            // DISPATCH
            // ═══════════════════════════════════════
            let sent = false;

            // Try rendering Menu Image with text caption layout
            try {
                await sock.sendMessage(jid, {
                    image: { url: menuImage },
                    caption: caption,
                    contextInfo: contextStyle
                }, { quoted: msg });
                sent = true;
            } catch (imgErr) {
                console.log('⚠️ Menu graphic rendering error, changing execution to text-only...');
            }

            // Send Audio Stream (PTT)
            try {
                await sock.sendMessage(jid, {
                    audio: { url: BOT_INFO.menuAudio },
                    mimetype: 'audio/mp4',
                    ptt: false,
                }, { quoted: msg });
            } catch (audioErr) {
                console.log('⚠️ Menu audio unavailable, bypassing audio delivery.');
            }

            // Dynamic textual dispatch fallback if image fails
            if (!sent) {
                await sock.sendMessage(jid, {
                    text: caption,
                    contextInfo: contextStyle
                }, { quoted: msg });
            }

        } catch (e) {
            console.error('❌ CRITICAL MENU ENGINE ERROR:', e.message || e);

            // Ultimate text-only fallback
            try {
                const greeting = getGreeting();
                await sock.sendMessage(jid, {
                    text:
                        `╭━━〔 ⚡ ${BOT_INFO.name} ⚡ 〕━━┈⊷\n` +
                        `┃\n` +
                        `┃  ${greeting.emoji} *${greeting.text}* ${greeting.icon}\n` +
                        `┃\n` +
                        `┃  📡 *Status* : 🟢 Operational\n` +
                        `┃  🔰 *Prefix* : [ . ]\n` +
                        `┃  ⏳ *Uptime* : Normal\n` +
                        `┃\n` +
                        `╰━━━━━━━━━━━━━━━━━┈⊷\n\n` +
                        `> ⚡ System menu structural build encountered an execution exception.`,
                    contextInfo: {
                        forwardingScore: 350,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: BOT_INFO.channelJid,
                            newsletterName: BOT_INFO.channelName,
                            serverMessageId: 202,
                        },
                    },
                }, { quoted: msg });
            } catch (finalErr) {
                console.error('❌ ULTIMATE MENU FALLBACK ABORTED:', finalErr.message);
            }
        }
    },
};
