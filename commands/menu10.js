// ./commands/menu.js

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════

function formatUptime(ms) {
    if (!ms || ms < 0) return '0s';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h ${m % 60}m ${s % 60}s`;
}

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const BOT = {
    name: '𝙯𝙚𝙣𝙞𝙩𝙨𝙪 ᗰᎥᑎᎥ',
    owner: '50935729494',
    channelUrl: 'https://whatsapp.com/channel/0029Vb8BKWwH5JLxq1ef1R43',
    channelName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
    channelJid: '120363425394543602@newsletter',
    image: 'https://files.catbox.moe/uklx8n.jpg',
    thumbnail: 'https://files.catbox.moe/uklx8n.jpg',
};

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'menu10',
    aliases: ['help', 'allmenu', 'commands'],

    async execute({ sock, msg, args, jid, config, stats, subBots }) {
        try {
            const pushName = msg.pushName || 'User';
            const senderJid = msg.key.participant || msg.key.remoteJid;
            const senderNumber = senderJid.split('@')[0];

            const now = new Date();
            const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
            const date = now.getDate();
            const month = now.toLocaleDateString('en-US', { month: 'long' });
            const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            const uptime = formatUptime(Date.now() - (stats?.startTime || Date.now()));
            const prefix = config?.PREFIX || '.';

            // Load commands
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
                        const cmd = require(filePath);
                        if (cmd?.name) {
                            const cat = cmd.category || 'general';
                            if (!categories[cat]) categories[cat] = [];
                            categories[cat].push(cmd.name);
                            totalLoaded++;
                        }
                    } catch (_) {}
                }
            }

            const sortedCats = Object.keys(categories).sort();
            let cmdList = '';

            for (const cat of sortedCats) {
                const cmds = categories[cat].sort();
                if (!cmds.length) continue;
                cmdList += `\n⚡ *${cat.toUpperCase()}*\n`;
                cmds.forEach(c => { cmdList += `  ▸ ${prefix}${c}\n`; });
            }

            if (!cmdList) cmdList = '\n⚡ *COMMANDS*\n  ▸ No commands loaded\n';

            const caption =
                `╭━━〔 ⚡${BOT.name}⚡ 〕━━╮\n` +
                `┃\n` +
                `┃ 👤 ${pushName}\n` +
                `┃ 📱 ${senderNumber}\n` +
                `┃ 🟢 Online\n` +
                `┃ ⏳ ${uptime}\n` +
                `┃ 🔰 Prefix: ${prefix}\n` +
                `┃ 🤖 SubBots: ${subBots?.size || 0}\n` +
                `┃ 📦 Commands: ${totalLoaded}\n` +
                `┃\n` +
                `┃ ${dayName}\n` +
                `┃ ${date} ${month} ${now.getFullYear()}\n` +
                `┃ ${time}\n` +
                `┃\n` +
                `╰━━━━━━━━━━━━━━━━╯` +
                `${cmdList}\n` +
                `📢 ${BOT.channelUrl}`;

            // ═══════════════════════════════════════
            // ENVOI DIRECT — Sans fakeVerified
            // ═══════════════════════════════════════

            let sent = false;

            // Méthode 1 : Image + caption + externalAdReply
            try {
                await sock.sendMessage(jid, {
                    image: { url: BOT.image },
                    caption: caption,
                    contextInfo: {
                        mentionedJid: [senderJid],
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: BOT.channelJid,
                            newsletterName: BOT.channelName,
                            serverMessageId: 202,
                        },
                        externalAdReply: {
                            title: `⚡ ${BOT.name}`,
                            body: 'Official Channel',
                            thumbnailUrl: BOT.thumbnail,
                            sourceUrl: BOT.channelUrl,
                            mediaType: 1,
                            renderLargerThumbnail: true,
                        },
                    },
                }, { quoted: msg });
                sent = true;
            } catch (e1) {
                console.log('⚠️ Method 1 failed:', e1.message);
            }

            // Méthode 2 : Image sans externalAdReply
            if (!sent) {
                try {
                    await sock.sendMessage(jid, {
                        image: { url: BOT.image },
                        caption: caption,
                        contextInfo: {
                            mentionedJid: [senderJid],
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: BOT.channelJid,
                                newsletterName: BOT.channelName,
                                serverMessageId: 202,
                            },
                        },
                    }, { quoted: msg });
                    sent = true;
                } catch (e2) {
                    console.log('⚠️ Method 2 failed:', e2.message);
                }
            }

            // Méthode 3 : Texte uniquement
            if (!sent) {
                try {
                    await sock.sendMessage(jid, {
                        text: caption,
                        contextInfo: {
                            mentionedJid: [senderJid],
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: BOT.channelJid,
                                newsletterName: BOT.channelName,
                                serverMessageId: 202,
                            },
                        },
                    }, { quoted: msg });
                    sent = true;
                } catch (e3) {
                    console.log('⚠️ Method 3 failed:', e3.message);
                }
            }

            // Méthode 4 : Ultra minimal
            if (!sent) {
                try {
                    await sock.sendMessage(jid, {
                        text: `⚡ *${BOT.name}*\n\nStatus: Active\nPrefix: ${prefix}\nCommands: ${totalLoaded}\n\nChannel: ${BOT.channelUrl}`,
                    });
                } catch (_) {}
            }

        } catch (e) {
            console.log('❌ menu fatal:', e.message);
        }
    },
};
