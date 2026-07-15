
const fs = require('fs');
const path = require('path');

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
// CONFIGURATION
// ═══════════════════════════════════════

const BOT_INFO = {
    name: '𝙯𝙚𝙣𝙞𝙩𝙨𝙪 ᗰᎥᑎᎥ',
    owner: '50935729494',
    menuImage: 'https://iili.io/CcjxqtR.jpg',
    menuAudio: 'https://n.uguu.se/jYWlvfXC.mpeg', // Updated audio source link
    channelName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
    channelJid: '120363425394543602@newsletter',
    description: 'ᴄʏʙᴇʀɴᴏᴠᴀ 𝐗 𝙈𝙀𝙏Α',
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

            const now = new Date();
            const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
            const date = now.getDate();
            const month = now.toLocaleDateString('en-US', { month: 'long' });
            const year = now.getFullYear();
            const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

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
                menuText += `┃ ▸ No active commands mapped.\n`;
                menuText += `╰━━━━━━━━━━━━┈⊷\n`;
            }

            // Combine Dashboard metrics
            const caption =
                `╭━〔 ${BOT_INFO.name} 〕━┈⊷\n` +
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
                `┃\n` +
                `╰━━━━━━━━━━━━━┈⊷` +
                `\n${menuText}\n` +
                `> ⚡ ${BOT_INFO.description}\n`;

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
            // DISPATCH
            // ═══════════════════════════════════════
            let sent = false;

            // Try rendering Menu Image with text caption layout
            try {
                await sock.sendMessage(jid, {
                    image: { url: BOT_INFO.menuImage },
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

            // Ultimate text-only fallback to avoid runtime freezes
            try {
                await sock.sendMessage(jid, {
                    text:
                        `╭━━〔 ⚡ ${BOT_INFO.name} ⚡ 〕━━┈⊷\n` +
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
