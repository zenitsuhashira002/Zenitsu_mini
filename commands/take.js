// ./commands/take.js

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const webp = require('node-webpmux');

const execFileAsync = promisify(execFile);

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
// LOCATE MEDIA
// ═══════════════════════════════════════
function locateMedia(msg) {
    const m = msg.message || {};
    const types = ['imageMessage', 'videoMessage', 'stickerMessage'];
    for (const t of types) if (m[t]) return { mediaMessage: m, mediaType: t, quotedInfo: null };
    if (m.viewOnceMessage?.message) for (const t of types) if (m.viewOnceMessage.message[t]) return { mediaMessage: m.viewOnceMessage.message, mediaType: t, quotedInfo: null };
    const ctx = m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo || m.videoMessage?.contextInfo || null;
    let quoted = ctx?.quotedMessage;
    if (quoted) {
        if (quoted.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;
        if (quoted.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;
        for (const t of types) if (quoted[t]) return { mediaMessage: quoted, mediaType: t, quotedInfo: ctx };
    }
    return null;
}

// ═══════════════════════════════════════
// DOWNLOAD
// ═══════════════════════════════════════
function buildDownloadableMessage(originalMsg, located) {
    const { mediaMessage, quotedInfo } = located;
    if (!quotedInfo) return { key: originalMsg.key, message: mediaMessage };
    return {
        key: {
            remoteJid: originalMsg.key.remoteJid,
            fromMe: false,
            id: quotedInfo.stanzaId || crypto.randomBytes(8).toString('hex'),
            participant: quotedInfo.participant || originalMsg.key.participant || originalMsg.key.remoteJid,
        },
        message: mediaMessage,
    };
}

async function downloadMedia(sock, originalMsg, located) {
    const rebuilt = buildDownloadableMessage(originalMsg, located);
    try { return await downloadMediaMessage(rebuilt, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage }); } catch (_) {}
    try { return await downloadMediaMessage({ key: originalMsg.key, message: located.mediaMessage }, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage }); } catch (_) {}
    return await downloadMediaMessage(originalMsg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
}

// ═══════════════════════════════════════
// DETECT ANIMATED STICKER
// ═══════════════════════════════════════
function isAnimatedWebp(buffer) {
    if (buffer.length < 20) return false;
    const anim = Buffer.from('ANIM');
    for (let i = 12; i < buffer.length - 4; i++) {
        if (buffer[i] === anim[0] && buffer[i + 1] === anim[1] && buffer[i + 2] === anim[2] && buffer[i + 3] === anim[3]) return true;
    }
    return false;
}

// ═══════════════════════════════════════
// EXTRACT FRAME FROM STICKER
// ═══════════════════════════════════════
async function extractFrameFromSticker(stickerBuffer) {
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

// ═══════════════════════════════════════
// CONVERT TO WEBP STICKER WITH FALLBACKS
// ═══════════════════════════════════════
async function convertToSticker(buffer, mediaType, packname, author, originalMime = null) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-'));
    const isVideo = mediaType === 'videoMessage' || mediaType === 'sticker_animated';
    let inputPath;

    // Déterminer l'extension correcte pour la vidéo
    if (isVideo) {
        let ext = 'mp4';
        if (originalMime) {
            if (originalMime.includes('3gp')) ext = '3gp';
            else if (originalMime.includes('webm')) ext = 'webm';
            else if (originalMime.includes('mkv')) ext = 'mkv';
            else if (originalMime.includes('avi')) ext = 'avi';
        }
        inputPath = path.join(tmpDir, `input.${ext}`);
    } else {
        inputPath = path.join(tmpDir, 'input.png');
    }
    const outputPath = path.join(tmpDir, 'output.webp');
    fs.writeFileSync(inputPath, buffer);

    const scale = '512:512';
    const baseArgs = ['-i', inputPath, '-vcodec', 'libwebp', '-vf', `scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale}:-1:-1:color=white@0.0`, '-q:v', '80', '-y', outputPath];

    // Stratégie 1 : conversion standard pour vidéo/animation
    if (isVideo) {
        const strategies = [
            // Stratégie 1a : conversion standard 15fps, 10s max
            ['-loop', '0', '-preset', 'default', '-an', '-fps_mode', 'vfr', '-t', '10', '-lossless', '0', '-compression_level', '6'],
            // Stratégie 1b : fps réduit, compression plus forte
            ['-loop', '0', '-preset', 'fast', '-an', '-fps_mode', 'vfr', '-t', '10', '-lossless', '1', '-compression_level', '6', '-r', '10'],
            // Stratégie 1c : très léger, 5fps, 5 secondes
            ['-loop', '0', '-preset', 'ultrafast', '-an', '-fps_mode', 'vfr', '-t', '5', '-lossless', '1', '-compression_level', '6', '-r', '5'],
        ];

        let lastError = null;
        for (const strategy of strategies) {
            try {
                const args = [...baseArgs, ...strategy];
                await execFileAsync('ffmpeg', args, { timeout: 45000 });
                if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 500) {
                    const webpBuffer = fs.readFileSync(outputPath);
                    return await addExif(webpBuffer, packname, author);
                }
            } catch (e) {
                lastError = e;
                // Nettoyer le fichier de sortie pour la prochaine tentative
                try { fs.unlinkSync(outputPath); } catch (_) {}
                continue;
            }
        }
        throw lastError || new Error('Video conversion failed after all strategies');
    } else {
        // Conversion pour image statique
        const args = [...baseArgs, '-lossless', '0', '-quality', '85'];
        try {
            await execFileAsync('ffmpeg', args, { timeout: 30000 });
        } catch (e) {
            // Fallback avec des paramètres plus simples
            const fallbackArgs = ['-i', inputPath, '-vcodec', 'libwebp', '-vf', `${scale}:force_original_aspect_ratio=decrease,pad=${scale}:-1:-1:color=white@0.0`, '-lossless', '1', '-quality', '75', '-y', outputPath];
            await execFileAsync('ffmpeg', fallbackArgs, { timeout: 30000 });
        }
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 500) {
            throw new Error('Image conversion failed');
        }
        const webpBuffer = fs.readFileSync(outputPath);
        return await addExif(webpBuffer, packname, author);
    }
}

// ═══════════════════════════════════════
// ADD EXIF METADATA
// ═══════════════════════════════════════
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
        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
        const jsonBuffer = Buffer.from(JSON.stringify(metadata), 'utf8');
        const exif = Buffer.concat([exifAttr, jsonBuffer]);
        exif.writeUIntLE(jsonBuffer.length, 14, 4);
        img.exif = exif;
        return await img.save(null);
    } catch (_) { return webpBuffer; }
}

// ═══════════════════════════════════════
// PARSE ARGS
// ═══════════════════════════════════════
function parseArgs(args) {
    let packname = '', author = '';
    const fullText = args.join(' ');
    const am = fullText.match(/a:(.+?)(?:\s+p:|$)/) || fullText.match(/a:(.+)/);
    if (am) author = am[1].trim();
    const pm = fullText.match(/p:(.+?)(?:\s+a:|$)/) || fullText.match(/p:(.+)/);
    if (pm) packname = pm[1].trim();
    if (!am && !pm) {
        if (args.length >= 2) { packname = args[0]; author = args.slice(1).join(' '); }
        else if (args.length === 1) { author = args[0]; packname = ''; }
    }
    return { packname, author };
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════
module.exports = {
    name: 'take',
    aliases: ['steal', 'getsticker', 't', 's'],
    category: 'media',

    async execute({ sock, msg, args, jid }) {
        const located = locateMedia(msg);
        if (!located) return sock.sendMessage(jid, { text: '🎨 *Take*\n\n.take a:AuthorName (author only)\n.take p:PackName (pack only)\n\n💡 Reply to sticker/image/video.', contextInfo: STYLE }, { quoted: msg });

        if (located.mediaType === 'videoMessage') {
            const dur = located.mediaMessage?.videoMessage?.seconds || 0;
            if (dur > 11) {
                return sock.sendMessage(jid, { text: '❌ Video too long! Max 10s.', contextInfo: STYLE }, { quoted: msg });
            }
        }

        try { await sock.sendMessage(jid, { react: { text: '🎨', key: msg.key } }); } catch (_) {}

        try {
            const { packname, author } = parseArgs(args);
            if (!packname && !author) return sock.sendMessage(jid, { text: '⚠️ Specify author or packname.\nExample: .take a:Zenitsu', contextInfo: STYLE }, { quoted: msg });

            const buffer = await downloadMedia(sock, msg, located);
            if (!buffer || buffer.length < 100) throw new Error('Download failed');

            // Récupérer le MIME type pour la vidéo
            let originalMime = null;
            if (located.mediaType === 'videoMessage') {
                originalMime = located.mediaMessage?.videoMessage?.mimetype || 'video/mp4';
            }

            let finalSticker;

            if (located.mediaType === 'stickerMessage') {
                const animated = isAnimatedWebp(buffer);
                if (animated) {
                    finalSticker = await convertToSticker(buffer, 'sticker_animated', packname, author);
                } else {
                    const png = await extractFrameFromSticker(buffer);
                    if (!png) throw new Error('Extraction failed');
                    finalSticker = await convertToSticker(png, 'imageMessage', packname, author);
                }
            } else if (located.mediaType === 'videoMessage') {
                finalSticker = await convertToSticker(buffer, 'videoMessage', packname, author, originalMime);
            } else {
                finalSticker = await convertToSticker(buffer, 'imageMessage', packname, author);
            }

            await sock.sendMessage(jid, { sticker: finalSticker, contextInfo: STYLE }, { quoted: msg });

            let confirm = '✅ *Sticker Taken!*\n\n';
            if (packname) confirm += `📦 Pack: ${packname}\n`;
            if (author) confirm += `✍️ Author: ${author}\n`;
            confirm += '\n⚡ _Zenitsu_';
            await sock.sendMessage(jid, { text: confirm, contextInfo: STYLE }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ take:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, { text: `❌ Failed: ${err.message}`, contextInfo: STYLE }, { quoted: msg });
        }
    },
};
