
// ./commands/tgsticker.js

const axios = require('axios');
const crypto = require('crypto');
const webp = require('node-webpmux');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');

const execFileAsync = promisify(execFile);

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

const DEFAULT_PACK = 'ᴛɢsᴛɪᴄᴋ_𝟼𝟽';
const DEFAULT_AUTHOR = '모 🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟';

// ═══════════════════════════════════════
// EXIF
// ═══════════════════════════════════════

async function addExifToWebp(webpBuffer, packname, author, emoji = '⚡') {
    try {
        const img = new webp.Image();
        await img.load(webpBuffer);

        const metadata = {
            'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
            'sticker-pack-name': packname,
            'sticker-pack-publisher': author,
            'emojis': [emoji],
        };

        const exifAttr = Buffer.from([
            0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
            0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
        ]);

        const jsonBuffer = Buffer.from(JSON.stringify(metadata), 'utf8');
        const exif = Buffer.concat([exifAttr, jsonBuffer]);
        exif.writeUIntLE(jsonBuffer.length, 14, 4);

        img.exif = exif;
        return await img.save(null);
    } catch (err) {
        console.log('⚠️ EXIF failed:', err.message);
        return webpBuffer;
    }
}

// ═══════════════════════════════════════
// DETECTION
// ═══════════════════════════════════════

function detectMediaKind(buffer, url = '') {
    if (!buffer || buffer.length < 4) return 'unknown';
    if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'webm';
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) return 'tgs';
    if (/\.webm(\?|$)/i.test(url)) return 'webm';
    if (/\.tgs(\?|$)/i.test(url))  return 'tgs';
    if (/\.webp(\?|$)/i.test(url)) return 'webp';
    return 'unknown';
}

function isAnimatedWebp(buffer) {
    if (buffer.length < 20) return false;
    const anim = Buffer.from('ANIM');
    for (let i = 12; i < buffer.length - 4; i++) {
        if (buffer[i] === anim[0] && buffer[i+1] === anim[1] && buffer[i+2] === anim[2] && buffer[i+3] === anim[3]) {
            return true;
        }
    }
    return false;
}

async function ffmpegBinary() {
    try { return require('ffmpeg-static'); } catch (_) {}
    return 'ffmpeg';
}

async function isValidWebp(filePath) {
    try {
        const { stdout } = await execFileAsync('ffprobe', [
            '-v', 'error', '-count_frames', '-show_entries', 'stream=nb_read_frames',
            '-of', 'csv=p=0', filePath,
        ], { timeout: 15000 });
        const frames = parseInt(String(stdout).trim(), 10);
        return frames > 0;
    } catch (_) {
        return false;
    }
}

// ═══════════════════════════════════════
// CONVERSION AVEC FALLBACK GIF
// ═══════════════════════════════════════

async function convertToAnimatedWebp(inputPath, tmpDir) {
    const outPath = path.join(tmpDir, `anim_${Date.now()}.webp`);
    const ffmpeg = await ffmpegBinary();

    // Méthode 1 : direct libwebp
    try {
        await execFileAsync(ffmpeg, [
            '-i', inputPath,
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=15',
            '-c:v', 'libwebp', '-lossless', '0', '-compression_level', '6', '-q:v', '80',
            '-loop', '0', '-an', '-vsync', '0', '-t', '10', '-y', outPath,
        ], { timeout: 45000 });

        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 500 && isAnimatedWebp(fs.readFileSync(outPath))) {
            return fs.readFileSync(outPath);
        }
    } catch (_) {}

    // Méthode 2 : GIF intermédiaire + gif2webp (fiable partout)
    const gifPath = path.join(tmpDir, `tmp_${Date.now()}.gif`);
    try {
        await execFileAsync(ffmpeg, [
            '-i', inputPath,
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=10',
            '-t', '6', '-y', gifPath,
        ], { timeout: 30000 });

        if (fs.existsSync(gifPath)) {
            await execFileAsync('gif2webp', [
                '-q', '80', '-m', '6', '-lossy', '-min_size',
                gifPath, '-o', outPath,
            ], { timeout: 30000 });

            if (fs.existsSync(outPath) && fs.statSync(outPath).size > 500 && isAnimatedWebp(fs.readFileSync(outPath))) {
                return fs.readFileSync(outPath);
            }
        }
    } catch (_) {}

    // Méthode 3 : fallback statique (toujours fonctionnel)
    try {
        const framePath = path.join(tmpDir, `frame_${Date.now()}.png`);
        await execFileAsync(ffmpeg, [
            '-i', inputPath,
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
            '-frames:v', '1', '-ss', '00:00:00.3', '-y', framePath,
        ], { timeout: 20000 });

        const staticWebp = path.join(tmpDir, `static_${Date.now()}.webp`);
        await execFileAsync(ffmpeg, [
            '-i', framePath, '-c:v', 'libwebp', '-lossless', '0', '-q:v', '80', '-y', staticWebp,
        ], { timeout: 20000 });

        if (fs.existsSync(staticWebp) && fs.statSync(staticWebp).size > 500) {
            return fs.readFileSync(staticWebp);
        }
    } catch (_) {}

    return null;
}

async function toSendableSticker(rawBuffer, sourceUrl) {
    const kind = detectMediaKind(rawBuffer, sourceUrl);
    if (kind === 'webp') return rawBuffer;
    if (kind === 'unknown' || kind === 'tgs') return null; // TGS non supporté sans Lottie

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgsticker-'));
    try {
        const inputPath = path.join(tmpDir, 'in.webm');
        fs.writeFileSync(inputPath, rawBuffer);
        return await convertToAnimatedWebp(inputPath, tmpDir);
    } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
}

// ═══════════════════════════════════════
// COMMAND (identique, seule la conversion change)
// ═══════════════════════════════════════

module.exports = {
    name: 'tgsticker',
    aliases: ['tgs', 'telegramsticker', 'tsticker'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const url = args[0];
        if (!url || !url.includes('t.me/addstickers/')) {
            return sock.sendMessage(jid, {
                text: '📦 *Telegram Sticker Downloader*\n\n⚡ .tgsticker <url>\n\n💡 Example: .tgsticker https://t.me/addstickers/RockyPack4',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        const packName = url.replace('https://t.me/addstickers/', '').split('/')[0].trim();
        try { await sock.sendMessage(jid, { react: { text: '📦', key: msg.key } }); } catch (_) {}

        try {
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/tools/telegram-sticker?url=${encodeURIComponent(url)}`,
                { timeout: 20000 }
            );

            if (!data?.status || !data?.result?.sticker) throw new Error('Pack not found');
            const stickers = data.result.sticker;

            await sock.sendMessage(jid, {
                text: `📦 *${data.result.title || packName}*\n📊 ${stickers.length} stickers\n⏳ Downloading...`,
                contextInfo: STYLE,
            }, { quoted: msg });

            let sent = 0, failed = 0;

            for (let i = 0; i < stickers.length; i++) {
                const s = stickers[i];
                if (!s.url) { failed++; continue; }

                try {
                    const res = await axios.get(s.url, { responseType: 'arraybuffer', timeout: 20000 });
                    const raw = Buffer.from(res.data);
                    if (!raw || raw.length < 100) { failed++; continue; }

                    const webpBuf = await toSendableSticker(raw, s.url);
                    if (!webpBuf) { failed++; continue; }

                    const finalBuf = await addExifToWebp(webpBuf, DEFAULT_PACK, DEFAULT_AUTHOR, s.emoji || '⚡');
                    await sock.sendMessage(jid, { sticker: finalBuf, contextInfo: STYLE });
                    sent++;
                    await new Promise(r => setTimeout(r, 500));
                } catch (err) {
                    console.log(`⚠️ Sticker ${i + 1} failed:`, err.message);
                    failed++;
                }
            }

            await sock.sendMessage(jid, {
                text: `✅ *Done!*\n\n📦 ${data.result.title || packName}\n✅ ${sent} ❌ ${failed}\n⚡ _Zenitsu_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: sent > 0 ? '✅' : '❌', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ tgsticker:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, { text: `❌ ${err.message}`, contextInfo: STYLE }, { quoted: msg });
        }
    },
};
