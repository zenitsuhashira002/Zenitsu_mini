// ./commands/menu.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ═══════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════

const BOT_INFO = {
    name: '𝐙𝐞𝐧𝐢𝐭𝐬𝐮 𝐌𝐢𝐧𝐢',
    owner: '50935729494',
    channelName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
    channelJid: '120363425394543602@newsletter',
    description: 'ᴄʏʙᴇʀɴᴏᴠᴀ 𝐗 𝙈𝙀𝙏Α',
    version: '4.1.1',
};

// Fichier de base de données pour les médias
const MEDIA_DB_PATH = path.join(process.cwd(), 'database', 'menu_media.json');

// ═══════════════════════════════════════
// MÉDIAS PAR DÉFAUT (FALLBACK)
// ═══════════════════════════════════════

const DEFAULT_IMAGES = [
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

const DEFAULT_SONGS = [
    'https://files.catbox.moe/scouh5.mp3',
    'https://files.catbox.moe/yt1j7b.mp3',
    'https://files.catbox.moe/8q2x3f.mp3',
];

const FALLBACK_IMAGE = 'https://iili.io/CMfZxsI.jpg';
const FALLBACK_SONG = 'https://files.catbox.moe/scouh5.mp3';

// ═══════════════════════════════════════
// FONCTIONS DE GESTION DES MÉDIAS
// ═══════════════════════════════════════

function ensureMediaDb() {
    const dir = path.dirname(MEDIA_DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(MEDIA_DB_PATH)) {
        fs.writeFileSync(MEDIA_DB_PATH, JSON.stringify({
            images: [],
            songs: []
        }, null, 2));
    }
}

function loadMediaDb() {
    ensureMediaDb();
    try {
        return JSON.parse(fs.readFileSync(MEDIA_DB_PATH, 'utf8'));
    } catch (_) {
        return { images: [], songs: [] };
    }
}

function saveMediaDb(data) {
    ensureMediaDb();
    fs.writeFileSync(MEDIA_DB_PATH, JSON.stringify(data, null, 2));
}

function getAllImages() {
    const db = loadMediaDb();
    const customImages = db.images || [];
    return customImages.length > 0 ? customImages : DEFAULT_IMAGES;
}

function getAllSongs() {
    const db = loadMediaDb();
    const customSongs = db.songs || [];
    return customSongs.length > 0 ? customSongs : DEFAULT_SONGS;
}

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ═══════════════════════════════════════
// VÉRIFICATION DES URLs
// ═══════════════════════════════════════

async function isValidUrl(url, type = 'image') {
    try {
        const response = await axios.head(url, { 
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        if (response.status !== 200) return false;
        
        const contentType = response.headers['content-type'] || '';
        if (type === 'image') {
            return contentType.startsWith('image/');
        } else if (type === 'audio') {
            return contentType.startsWith('audio/') || contentType.includes('mpeg') || contentType.includes('mp4');
        }
        return true;
    } catch (_) {
        return false;
    }
}

// ═══════════════════════════════════════
// FONCTIONS UTILITAIRES
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

function getGreeting() {
    const now = new Date();
    const hours = now.getUTCHours();
    
    if (hours >= 5 && hours < 12) {
        return { emoji: '🌅', text: '𝔾𝕠𝕠𝕕 𝕄𝕠𝕣𝕟𝕚𝕟𝕘', icon: '☀️' };
    } else if (hours >= 12 && hours < 17) {
        return { emoji: '🌤️', text: '𝕲𝖔𝖔𝖉 𝕬𝖋𝖙𝖊𝖗𝖓𝖔𝖔𝖓', icon: '🌤️' };
    } else if (hours >= 17 && hours < 21) {
        return { emoji: '🌅', text: '🄶🄾🄾🄳 🄴🅅🄴🄽🄸🄽🄶', icon: '🌅' };
    } else {
        return { emoji: '🌙', text: 'Ⓖⓞⓞⓓ Ⓝⓘⓖⓗⓣ', icon: '💤' };
    }
}

// ═══════════════════════════════════════
// SOUS-COMMANDES DE GESTION
// ═══════════════════════════════════════

async function handleMediaManagement(sock, msg, args, jid) {
    const subCommand = args[0]?.toLowerCase();
    const mediaType = args[1]?.toLowerCase();
    const url = args[2];

    // LIST command
    if (subCommand === 'list') {
        if (!mediaType || !['img', 'image', 'song', 'audio'].includes(mediaType)) {
            return sock.sendMessage(jid, {
                text: '❌ *Usage:* `.menu list <img|song>`\n\nExample:\n`.menu list img`\n`.menu list song`',
                contextInfo: getStyle()
            }, { quoted: msg });
        }

        const isImage = mediaType === 'img' || mediaType === 'image';
        const items = isImage ? getAllImages() : getAllSongs();
        const db = loadMediaDb();
        const customItems = isImage ? db.images : db.songs;
        const usingDefault = customItems.length === 0;

        let listText = `📋 *${isImage ? 'Images' : 'Songs'} List*\n\n`;
        listText += `Total: ${items.length}\n`;
        listText += `Source: ${usingDefault ? 'Default (fallback)' : 'Custom'}\n\n`;
        
        items.forEach((item, index) => {
            listText += `${index + 1}. ${item.substring(0, 80)}${item.length > 80 ? '...' : ''}\n`;
        });

        listText += `\n━━━━━━━━━━━━━━━\n_©CybernovA_`;

        return sock.sendMessage(jid, {
            text: listText,
            contextInfo: getStyle()
        }, { quoted: msg });
    }

    // ADD command
    if (subCommand === 'add') {
        if (!mediaType || !url) {
            return sock.sendMessage(jid, {
                text: '❌ *Usage:* `.menu add <img|song> <url>`\n\nExample:\n`.menu add img https://example.com/image.jpg`\n`.menu add song https://example.com/music.mp3`',
                contextInfo: getStyle()
            }, { quoted: msg });
        }

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return sock.sendMessage(jid, {
                text: '❌ *Invalid URL*\n\nURL must start with http:// or https://',
                contextInfo: getStyle()
            }, { quoted: msg });
        }

        const isImage = mediaType === 'img' || mediaType === 'image';
        const isSong = mediaType === 'song' || mediaType === 'audio';

        if (!isImage && !isSong) {
            return sock.sendMessage(jid, {
                text: '❌ *Invalid media type*\n\nUse `img` or `song`',
                contextInfo: getStyle()
            }, { quoted: msg });
        }

        // React processing
        try { await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } }); } catch (_) {}

        // Validate URL
        const validType = isImage ? 'image' : 'audio';
        const isValid = await isValidUrl(url, validType);

        if (!isValid) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, {
                text: `❌ *Invalid ${isImage ? 'image' : 'song'} URL*\n\nMake sure the URL is accessible and points to a valid ${isImage ? 'image' : 'audio'} file.`,
                contextInfo: getStyle()
            }, { quoted: msg });
        }

        // Add to database
        const db = loadMediaDb();
        const targetArray = isImage ? db.images : db.songs;
        
        if (targetArray.includes(url)) {
            try { await sock.sendMessage(jid, { react: { text: '⚠️', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, {
                text: `⚠️ *Already exists*\n\nThis ${isImage ? 'image' : 'song'} is already in the database.`,
                contextInfo: getStyle()
            }, { quoted: msg });
        }

        targetArray.push(url);
        saveMediaDb(db);

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
        return sock.sendMessage(jid, {
            text: `✅ *${isImage ? 'Image' : 'Song'} added successfully!*\n\n` +
                  `📁 *Type:* ${isImage ? 'Image' : 'Song'}\n` +
                  `🔗 *URL:* ${url}\n` +
                  `📊 *Total ${isImage ? 'images' : 'songs'}:* ${targetArray.length}`,
            contextInfo: getStyle()
        }, { quoted: msg });
    }

    // REMOVE command
    if (subCommand === 'remove' || subCommand === 'rm') {
        if (!mediaType) {
            return sock.sendMessage(jid, {
                text: '❌ *Usage:* `.menu remove <img|song> <index|all>`\n\nExamples:\n`.menu remove img 2`\n`.menu remove song all`\n`.menu remove img all`',
                contextInfo: getStyle()
            }, { quoted: msg });
        }

        const isImage = mediaType === 'img' || mediaType === 'image';
        const isSong = mediaType === 'song' || mediaType === 'audio';

        if (!isImage && !isSong) {
            return sock.sendMessage(jid, {
                text: '❌ *Invalid media type*\n\nUse `img` or `song`',
                contextInfo: getStyle()
            }, { quoted: msg });
        }

        const db = loadMediaDb();
        const targetArray = isImage ? db.images : db.songs;

        if (targetArray.length === 0) {
            return sock.sendMessage(jid, {
                text: `⚠️ *No custom ${isImage ? 'images' : 'songs'} to remove*\n\nCurrently using default ${isImage ? 'images' : 'songs'}.`,
                contextInfo: getStyle()
            }, { quoted: msg });
        }

        // Remove all
        if (args[2]?.toLowerCase() === 'all') {
            const removedCount = targetArray.length;
            if (isImage) db.images = [];
            else db.songs = [];
            saveMediaDb(db);

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, {
                text: `✅ *All ${isImage ? 'images' : 'songs'} removed!*\n\n` +
                      `🗑️ *Removed:* ${removedCount} ${isImage ? 'images' : 'songs'}\n` +
                      `🔄 *Reverting to default ${isImage ? 'images' : 'songs'}*`,
                contextInfo: getStyle()
            }, { quoted: msg });
        }

        // Remove by index
        const index = parseInt(args[2]) - 1;
        if (isNaN(index) || index < 0 || index >= targetArray.length) {
            return sock.sendMessage(jid, {
                text: `❌ *Invalid index*\n\nUse a number between 1 and ${targetArray.length}.`,
                contextInfo: getStyle()
            }, { quoted: msg });
        }

        const removedUrl = targetArray.splice(index, 1)[0];
        saveMediaDb(db);

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
        return sock.sendMessage(jid, {
            text: `✅ *${isImage ? 'Image' : 'Song'} removed successfully!*\n\n` +
                  `🗑️ *Removed:* ${removedUrl.substring(0, 80)}\n` +
                  `📊 *Remaining:* ${targetArray.length} ${isImage ? 'images' : 'songs'}`,
            contextInfo: getStyle()
        }, { quoted: msg });
    }

    return null; // Not a management command
}

// ═══════════════════════════════════════
// STYLE FUNCTIONS
// ═══════════════════════════════════════

function getStyle() {
    return {
        forwardingScore: 350,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: BOT_INFO.channelJid,
            newsletterName: BOT_INFO.channelName,
            serverMessageId: 202,
        },
    };
}

// ═══════════════════════════════════════
// MAIN COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'menu',
    aliases: ['help', 'allmenu', 'commands'],

    async execute({ sock, msg, args, jid, config, stats, subBots }) {
        try {
            // Check if it's a media management command
            if (args.length > 0 && ['add', 'remove', 'rm', 'list'].includes(args[0]?.toLowerCase())) {
                const result = await handleMediaManagement(sock, msg, args, jid);
                if (result !== null) return; // Management command was handled
            }

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
                ...getStyle()
            };

            // ═══════════════════════════════════
            // SÉLECTION DES MÉDIAS
            // ═══════════════════════════════════
            const allImages = getAllImages();
            const allSongs = getAllSongs();
            
            const menuImage = getRandomItem(allImages) || FALLBACK_IMAGE;
            const menuSong = getRandomItem(allSongs) || FALLBACK_SONG;

            // ═══════════════════════════════════
            // DISPATCH
            // ═══════════════════════════════════
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

            // Send Audio Stream
            try {
                await sock.sendMessage(jid, {
                    audio: { url: menuSong },
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
                    contextInfo: getStyle(),
                }, { quoted: msg });
            } catch (finalErr) {
                console.error('❌ ULTIMATE MENU FALLBACK ABORTED:', finalErr.message);
            }
        }
    },
};
