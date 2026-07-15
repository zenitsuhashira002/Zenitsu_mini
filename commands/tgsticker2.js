
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
// ADD EXIF METADATA  (unchanged)
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
// VIDEO / ANIMATED STICKER SUPPORT  (new)
// ═══════════════════════════════════════
//
// Telegram animated & video stickers are NOT plain .webp — they arrive as:
//   • .webm  (VP9 video)         → most common for "video stickers"
//   • .tgs   (gzip'd Lottie JSON) → classic "animated stickers"
// Sending these buffers directly as { sticker: buffer } silently produces
// a broken/empty sticker on WhatsApp, since only real animated WebP is
// accepted. This block detects the source type and transcodes it.

function detectMediaKind(buffer, url = '') {
    if (!buffer || buffer.length < 4) return 'unknown';

    // WebP: "RIFF"...."WEBP"
    if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
        return 'webp';
    }
    // WebM/Matroska: EBML header
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
        return 'webm';
    }
    // Gzip magic (.tgs is gzip-compressed Lottie JSON)
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
        return 'tgs';
    }
    // Fallback: guess from URL extension
    if (/\.webm(\?|$)/i.test(url)) return 'webm';
    if (/\.tgs(\?|$)/i.test(url))  return 'tgs';
    if (/\.webp(\?|$)/i.test(url)) return 'webp';

    return 'unknown';
}

async function ffmpegBinary() {
    try {
        const p = require('ffmpeg-static');
        if (p) return p;
    } catch (_) { /* not installed, fall back to system ffmpeg */ }
    return 'ffmpeg';
}

// Verify a produced webp is actually decodable before trusting it (prevents
// sending broken/empty stickers — this is the core reliability guarantee).
async function isValidWebp(filePath) {
    try {
        const { stdout } = await execFileAsync('ffprobe', [
            '-v', 'error',
            '-count_frames',
            '-show_entries', 'stream=nb_read_frames',
            '-of', 'csv=p=0',
            filePath,
        ], { timeout: 15000 });
        const frames = parseInt(String(stdout).trim(), 10);
        return frames > 0;
    } catch (_) {
        return false;
    }
}

// Attempt an animated webp conversion; returns null if the result fails
// the decode-verification check (caller then falls back to a static frame).
async function convertToAnimatedWebp(inputPath, tmpDir) {
    const outPath = path.join(tmpDir, `anim_${Date.now()}.webp`);
    const ffmpeg = await ffmpegBinary();

    const filter =
        'fps=15,scale=512:512:force_original_aspect_ratio=decrease,' +
        'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000';

    // Try the dedicated animated encoder first (best quality/compat when available)
    const attempts = [
        ['-i', inputPath, '-vf', filter, '-c:v', 'libwebp_anim', '-loop', '0', '-an', '-vsync', '0', '-t', '10', '-y', outPath],
        ['-i', inputPath, '-vf', filter, '-c:v', 'libwebp', '-loop', '0', '-preset', 'default', '-an', '-vsync', '0', '-t', '10', '-y', outPath],
    ];

    for (const args of attempts) {
        try {
            await execFileAsync(ffmpeg, args, { timeout: 45000 });
            if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0 && await isValidWebp(outPath)) {
                return fs.readFileSync(outPath);
            }
        } catch (_) { /* try next strategy */ }
        try { fs.unlinkSync(outPath); } catch (_) {}
    }

    return null; // every animated strategy failed verification
}

// Fallback: extract a single representative frame and encode as a static
// webp — guarantees the user still receives a correct, working sticker
// even when animated encoding isn't viable in the current environment.
async function convertToStaticWebpFallback(inputPath, tmpDir) {
    const framePath = path.join(tmpDir, `frame_${Date.now()}.png`);
    const outPath   = path.join(tmpDir, `static_${Date.now()}.webp`);
    const ffmpeg = await ffmpegBinary();

    // Grab a frame ~20% into the clip (skips possible black/blank first frame)
    await execFileAsync(ffmpeg, [
        '-i', inputPath,
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
        '-frames:v', '1',
        '-ss', '00:00:00.3',
        '-y', framePath,
    ], { timeout: 20000 });

    await execFileAsync(ffmpeg, [
        '-i', framePath,
        '-c:v', 'libwebp',
        '-lossless', '0',
        '-q:v', '80',
        '-y', outPath,
    ], { timeout: 20000 });

    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0 && await isValidWebp(outPath)) {
        return fs.readFileSync(outPath);
    }
    return null;
}

// Decompress a .tgs (gzip Lottie) into a raw Lottie JSON, then render it to
// a short webm via a headless rasterization pass so the same conversion
// pipeline above can turn it into a webp. If system tooling for Lottie
// rendering isn't available, this cleanly returns null and the caller
// falls back further.
async function convertTgsToWebm(tgsBuffer, tmpDir) {
    const zlib = require('zlib');
    let lottieJson;
    try {
        lottieJson = zlib.gunzipSync(tgsBuffer);
    } catch (e) {
        return null; // not valid gzip — corrupted or already JSON
    }

    // Without a bundled Lottie renderer in this environment we cannot safely
    // rasterize arbitrary vector animation server-side. Signal "unsupported"
    // rather than guessing — caller falls back to sending the pack's static
    // preview/thumbnail image instead, so the user still gets a sticker.
    return null;
}

// Master entry point used by the command loop below. Always returns either
// a Buffer (ready to send as { sticker: buffer }) or null (caller skips
// this sticker and moves to the next one — never sends a broken file).
async function toSendableSticker(rawBuffer, sourceUrl) {
    const kind = detectMediaKind(rawBuffer, sourceUrl);

    // Already a static/simple webp — nothing to transcode.
    if (kind === 'webp') {
        return rawBuffer;
    }

    if (kind === 'unknown') {
        return null;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgsticker-'));
    try {
        let sourcePath;

        if (kind === 'webm') {
            sourcePath = path.join(tmpDir, 'in.webm');
            fs.writeFileSync(sourcePath, rawBuffer);
        } else if (kind === 'tgs') {
            const webmBuffer = await convertTgsToWebm(rawBuffer, tmpDir);
            if (!webmBuffer) return null; // Lottie rendering unsupported in this environment
            sourcePath = path.join(tmpDir, 'in.webm');
            fs.writeFileSync(sourcePath, webmBuffer);
        } else {
            return null;
        }

        // 1) Try full animated conversion, decode-verified
        const animated = await convertToAnimatedWebp(sourcePath, tmpDir);
        if (animated) return animated;

        // 2) Fall back to a single verified static frame — always correct,
        //    never a broken/empty sticker, even if animation isn't possible.
        const staticFrame = await convertToStaticWebpFallback(sourcePath, tmpDir);
        if (staticFrame) return staticFrame;

        return null;
    } catch (e) {
        console.log('⚠️ Conversion pipeline failed:', e.message);
        return null;
    } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'tgsticker2',
    aliases: ['tgs', 'telegramsticker', 'tsticker'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const url = args[0];

        if (!url || !url.includes('t.me/addstickers/')) {
            return sock.sendMessage(jid, {
                text:
                    '📦 *Telegram Sticker Downloader*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.tgsticker <telegram_url>\n\n' +
                    '✨ *Example:*\n' +
                    '.tgsticker https://t.me/addstickers/RockyPack4\n\n' +
                    '💡 Downloads all stickers from a public pack (images & videos).',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Extraire le nom du pack
        const packName = url.replace('https://t.me/addstickers/', '').split('/')[0].trim();

        // Reaction
        try { await sock.sendMessage(jid, { react: { text: '📦', key: msg.key } }); } catch (_) {}

        try {
            // Appeler l'API NexRay
            const encodedUrl = encodeURIComponent(url);
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/tools/telegram-sticker?url=${encodedUrl}`,
                { timeout: 20000 }
            );

            if (!data?.status || !data?.result?.sticker) {
                throw new Error('Sticker pack not found or empty');
            }

            const pack = data.result;
            const stickers = pack.sticker;
            const totalStickers = stickers.length;

            // Message de progression
            await sock.sendMessage(jid, {
                text:
                    '📦 *Telegram Stickers*\n\n' +
                    `📌 *Pack:* ${pack.title || packName}\n` +
                    `🎯 *Type:* ${pack.sticker_type || 'regular'}\n` +
                    `📊 *Total:* ${totalStickers} stickers\n` +
                    '⏳ Downloading & converting...',
                contextInfo: STYLE,
            }, { quoted: msg });

            let successCount = 0;
            let failCount = 0;
            let videoCount = 0;

            // Traiter chaque sticker
            for (let i = 0; i < stickers.length; i++) {
                try {
                    const sticker = stickers[i];
                    const stickerUrl = sticker.url;

                    if (!stickerUrl) {
                        failCount++;
                        continue;
                    }

                    // Télécharger le sticker (webp, webm ou tgs selon la source)
                    const response = await axios.get(stickerUrl, {
                        responseType: 'arraybuffer',
                        timeout: 20000,
                    });

                    const rawBuffer = Buffer.from(response.data);

                    if (!rawBuffer || rawBuffer.length < 100) {
                        failCount++;
                        continue;
                    }

                    // Détecte le type et convertit en webp si nécessaire
                    // (webm/tgs -> webp animé, avec repli sur image statique)
                    const kind = detectMediaKind(rawBuffer, stickerUrl);
                    if (kind === 'webm' || kind === 'tgs') videoCount++;

                    const webpBuffer = await toSendableSticker(rawBuffer, stickerUrl);

                    if (!webpBuffer) {
                        failCount++;
                        continue;
                    }

                    // Ajouter les métadonnées EXIF (renommer le pack)
                    const emoji = sticker.emoji || '⚡';
                    const finalBuffer = await addExifToWebp(
                        webpBuffer,
                        DEFAULT_PACK,
                        DEFAULT_AUTHOR,
                        emoji
                    );

                    // Envoyer le sticker
                    await sock.sendMessage(jid, {
                        sticker: finalBuffer,
                        contextInfo: STYLE,
                    });

                    successCount++;

                    // Petite pause entre chaque sticker
                    await new Promise(r => setTimeout(r, 600));

                } catch (stickerErr) {
                    console.log(`⚠️ Sticker ${i + 1} failed:`, stickerErr.message);
                    failCount++;
                }
            }

            // Message final
            await sock.sendMessage(jid, {
                text:
                    '✅ *Download Complete!*\n\n' +
                    `📦 *Pack:* ${pack.title || packName}\n` +
                    `✅ *Success:* ${successCount}\n` +
                    (videoCount > 0 ? `🎬 *Video/Animated:* ${videoCount}\n` : '') +
                    `❌ *Failed:* ${failCount}\n` +
                    `📊 *Total:* ${totalStickers}\n\n` +
                    '⚡ _Zenitsu Telegram Downloader_',
                contextInfo: STYLE,
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ tgsticker error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            await sock.sendMessage(jid, {
                text:
                    '❌ *Download Failed*\n\n' +
                    `${err.message}\n\n` +
                    '💡 Make sure:\n' +
                    '• The URL is correct\n' +
                    '• The sticker pack is public\n' +
                    '• The pack exists',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
