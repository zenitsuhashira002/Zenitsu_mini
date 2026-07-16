
// ./commands/stickget.js

const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const webp = require('node-webpmux');

const execFileAsync = promisify(execFile);

const MAX_STICKERS = 30;
const DEFAULT_COUNT = 10;
const DEFAULT_PACK = 'Zenitsu Mini';
const DEFAULT_AUTHOR = 'Stickerly';
const MIN_FILE_SIZE = 500;

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
// UTILS
// ═══════════════════════════════════════

function isAnimatedWebp(buffer) {
    if (buffer.length < 20) return false;
    const anim = Buffer.from('ANIM');
    for (let i = 12; i < buffer.length - 4; i++) {
        if (buffer[i]===anim[0] && buffer[i+1]===anim[1] && buffer[i+2]===anim[2] && buffer[i+3]===anim[3]) return true;
    }
    return false;
}

async function extractPngFromSticker(stickerBuffer) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-'));
    const inputPath = path.join(tmpDir, 'sticker.webp');
    const outputPath = path.join(tmpDir, 'extracted.png');
    fs.writeFileSync(inputPath, stickerBuffer);
    try {
        await execFileAsync('ffmpeg', ['-i', inputPath, '-vframes', '1', '-y', outputPath], { timeout: 10000 });
        return fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : null;
    } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
}

async function convertPngToSticker(pngBuffer, packname, author) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-'));
    const inputPath = path.join(tmpDir, 'input.png');
    const outputPath = path.join(tmpDir, 'output.webp');
    fs.writeFileSync(inputPath, pngBuffer);

    try {
        await execFileAsync('ffmpeg', [
            '-i', inputPath,
            '-vcodec', 'libwebp',
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=white@0.0',
            '-lossless', '0', '-quality', '85', '-q:v', '80', '-y', outputPath,
        ], { timeout: 30000 });

        if (!fs.existsSync(outputPath)) return null;
        const webpBuffer = fs.readFileSync(outputPath);
        return await addExif(webpBuffer, packname, author);
    } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
}

async function addExif(webpBuffer, packname, author) {
    try {
        const img = new webp.Image();
        await img.load(webpBuffer);
        const metadata = {
            'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
            'sticker-pack-name': packname || '',
            'sticker-pack-publisher': author || '',
            'emojis': ['⚡'],
        };
        const exifAttr = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00]);
        const jsonBuffer = Buffer.from(JSON.stringify(metadata), 'utf8');
        const exif = Buffer.concat([exifAttr, jsonBuffer]);
        exif.writeUIntLE(jsonBuffer.length, 14, 4);
        img.exif = exif;
        return await img.save(null);
    } catch (_) { return webpBuffer; }
}

// ═══════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════

const SEARCH_APIS = [
    {
        name: 'NexRay',
        url: (q) => `https://api.nexray.eu.cc/search/stickerly?q=${encodeURIComponent(q)}`,
        timeout: 15000,
        extract: (data) => (data?.result || []).map(item => ({
            name: item.name || 'Pack',
            thumbnail: item.thumbnail || '',
        })),
    },
    {
        name: 'DavidCyril',
        url: (q) => `https://apis.davidcyriltech.my.id/search/stickerly?q=${encodeURIComponent(q)}`,
        timeout: 15000,
        extract: (data) => {
            let results = data?.result || (Array.isArray(data) ? data : []);
            return results.map(item => ({
                name: item.name || item.title || 'Pack',
                thumbnail: item.thumbnail || item.thumbnailUrl || item.image || '',
            }));
        },
    },
];

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'stickget',
    aliases: ['stickerly', 'sly', 'getstickerly'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        let count = DEFAULT_COUNT;
        let queryStart = 0;
        if (/^\d+$/.test(args[0])) {
            count = Math.min(parseInt(args[0]), MAX_STICKERS);
            queryStart = 1;
        }
        const query = args.slice(queryStart).join(' ');
        if (!query) {
            return sock.sendMessage(jid, {
                text: '🔍 *Stickerly Search*\n\n⚡ .stickget [count] <query>\n📊 Max: 30 stickers',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            // RECHERCHE
            let allPacks = [];
            for (const api of SEARCH_APIS) {
                try {
                    const { data } = await axios.get(api.url(query), { timeout: api.timeout });
                    const results = api.extract(data);
                    allPacks = allPacks.concat(results);
                    if (results.length > 0) console.log(`✅ ${api.name}: ${results.length} packs`);
                } catch (_) {}
            }

            if (!allPacks.length) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, { text: '❌ No packs found.', contextInfo: STYLE }, { quoted: msg });
            }

            const seen = new Set();
            const unique = allPacks.filter(p => p.thumbnail && !seen.has(p.thumbnail) && seen.add(p.thumbnail));
            const shuffled = unique.sort(() => Math.random() - 0.5);

            await sock.sendMessage(jid, {
                text: `🔍 *Stickerly*\n\n📝 ${query}\n📦 ${unique.length} packs\n⏳ Downloading...`,
                contextInfo: STYLE,
            }, { quoted: msg });

            let sent = 0;
            let idx = 0;

            while (sent < count && idx < shuffled.length * 3) {
                const pack = shuffled[idx % shuffled.length];
                idx++;

                await new Promise(r => setTimeout(r, 1000));

                try {
                    const res = await axios.get(pack.thumbnail, {
                        responseType: 'arraybuffer',
                        timeout: 20000,
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                    });
                    const buffer = Buffer.from(res.data);

                    if (!buffer || buffer.length < MIN_FILE_SIZE) continue;

                    // ⭐ Détecter le type
                    const animated = isAnimatedWebp(buffer);

                    let finalSticker;

                    if (animated) {
                        // Sticker animé → garder tel quel, juste ajouter EXIF
                        finalSticker = await addExif(buffer, DEFAULT_PACK, DEFAULT_AUTHOR);
                    } else {
                        // Sticker statique → extraire PNG → recréer proprement (méthode take)
                        const png = await extractPngFromSticker(buffer);
                        if (!png || png.length < MIN_FILE_SIZE) continue;
                        finalSticker = await convertPngToSticker(png, DEFAULT_PACK, DEFAULT_AUTHOR);
                    }

                    if (!finalSticker || finalSticker.length < MIN_FILE_SIZE) continue;

                    await sock.sendMessage(jid, {
                        sticker: finalSticker,
                        contextInfo: STYLE,
                    }, { quoted: sent === 0 ? msg : undefined });

                    sent++;
                    console.log(`✅ [${sent}/${count}] ${pack.name} (${animated ? 'animé' : 'statique'})`);

                } catch (err) {
                    console.log(`⚠️ Failed: ${pack.name} — ${err.message}`);
                }
            }

            await sock.sendMessage(jid, {
                text: `✅ *Stickerly Complete!*\n\n🔍 ${query}\n✅ ${sent} | 📊 ${count}\n⚡ _Zenitsu_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: sent > 0 ? '✅' : '❌', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ stickget:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        }
    },
};
