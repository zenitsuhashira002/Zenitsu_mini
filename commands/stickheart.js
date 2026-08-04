// ./commands/stickheart.js

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
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

const DEFAULT_PACK = 'Zenitsu Mini';
const DEFAULT_AUTHOR = 'Heart Sticker';

// ═══════════════════════════════════════
// LOCATE & DOWNLOAD (same as stickcircle)
// ═══════════════════════════════════════

function locateMedia(msg) {
    const m = msg.message || {};
    const types = ['imageMessage', 'videoMessage', 'stickerMessage'];
    for (const t of types) if (m[t]) return { mediaMessage: m, mediaType: t, quotedInfo: null };
    const ctx = m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo || m.videoMessage?.contextInfo || null;
    let quoted = ctx?.quotedMessage;
    if (quoted) {
        if (quoted.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;
        if (quoted.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;
        for (const t of types) if (quoted[t]) return { mediaMessage: quoted, mediaType: t, quotedInfo: ctx };
    }
    return null;
}

function buildDownloadableMessage(originalMsg, located) {
    const { mediaMessage, quotedInfo } = located;
    if (!quotedInfo) return { key: originalMsg.key, message: mediaMessage };
    return {
        key: { remoteJid: originalMsg.key.remoteJid, fromMe: false,
               id: quotedInfo.stanzaId || crypto.randomBytes(8).toString('hex'),
               participant: quotedInfo.participant || originalMsg.key.participant || originalMsg.key.remoteJid },
        message: mediaMessage,
    };
}

async function downloadMedia(sock, originalMsg, located) {
    const rebuilt = buildDownloadableMessage(originalMsg, located);
    try { return await downloadMediaMessage(rebuilt, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage }); } catch (_) {}
    try { return await downloadMediaMessage({ key: originalMsg.key, message: located.mediaMessage }, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage }); } catch (_) {}
    return await downloadMediaMessage(originalMsg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
}

async function uploadToCatbox(buffer) {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('fileToUpload', buffer, `heart_${Date.now()}.jpg`);
    form.append('reqtype', 'fileupload');
    const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders(), timeout: 30000,
    });
    return data.trim();
}

// ═══════════════════════════════════════
// APPLY HEART EFFECT
// ═══════════════════════════════════════

async function applyHeartEffect(imageBuffer) {
    // Method 1: some-random-api.com
    try {
        const imageUrl = await uploadToCatbox(imageBuffer);
        if (!imageUrl) throw new Error('Upload failed');

        const { data } = await axios.get(
            `https://api.some-random-api.com/canvas/misc/heart?avatar=${encodeURIComponent(imageUrl)}`,
            { responseType: 'arraybuffer', timeout: 30000 }
        );
        const buffer = Buffer.from(data);
        if (buffer.length > 500) return buffer;
    } catch (err) {
        console.log('⚠️ some-random-api heart failed:', err.message);
    }

    // Method 2: Local ffmpeg heart mask
    try {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heart-'));
        const inputPath = path.join(tmpDir, 'input.png');
        const outputPath = path.join(tmpDir, 'output.png');
        fs.writeFileSync(inputPath, imageBuffer);

        await execFileAsync('ffmpeg', [
            '-i', inputPath,
            '-vf', 'geq=r=p(X,Y):g=p(X,Y):b=p(X,Y):a=if(lt(pow(X/W-0.5\\,2)+pow(Y/H-0.45\\,2)-0.3*sin(X/W*PI)*sin(Y/H*PI)\\,0.15)\\,255\\,0)',
            '-frames:v', '1', '-y', outputPath,
        ], { timeout: 15000 });

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 500) {
            return fs.readFileSync(outputPath);
        }
    } catch (err) {
        console.log('⚠️ Local heart failed:', err.message);
    }

    // Method 3: NexRay heart API
    try {
        const imageUrl = await uploadToCatbox(imageBuffer);
        const { data } = await axios.get(
            `https://api.nexray.eu.cc/tools/heart?url=${encodeURIComponent(imageUrl)}`,
            { responseType: 'arraybuffer', timeout: 30000 }
        );
        const buffer = Buffer.from(data);
        if (buffer.length > 500) return buffer;
    } catch (err) {
        console.log('⚠️ NexRay heart failed:', err.message);
    }

    return null;
}

// ═══════════════════════════════════════
// CONVERT TO STICKER
// ═══════════════════════════════════════

async function convertToSticker(buffer, packname, author) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sticker-'));
    const inputPath = path.join(tmpDir, 'input.png');
    const outputPath = path.join(tmpDir, 'output.webp');
    fs.writeFileSync(inputPath, buffer);

    await execFileAsync('ffmpeg', [
        '-i', inputPath, '-vcodec', 'libwebp',
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=white@0.0',
        '-lossless', '0', '-quality', '85', '-q:v', '80', '-y', outputPath,
    ], { timeout: 30000 });

    if (!fs.existsSync(outputPath)) throw new Error('Sticker conversion failed');
    const webpBuffer = fs.readFileSync(outputPath);

    try {
        const img = new webp.Image();
        await img.load(webpBuffer);
        const metadata = {
            'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
            'sticker-pack-name': packname || '',
            'sticker-pack-publisher': author || '',
            'emojis': ['❤️'],
        };
        const exifAttr = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00]);
        const jsonBuffer = Buffer.from(JSON.stringify(metadata), 'utf8');
        const exif = Buffer.concat([exifAttr, jsonBuffer]);
        exif.writeUIntLE(jsonBuffer.length, 14, 4);
        img.exif = exif;
        return await img.save(null);
    } catch (_) {
        return webpBuffer;
    } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'stickheart',
    aliases: ['sheart', 'heartsticker'],
    category: 'media',

    async execute({ sock, msg, args, jid }) {
        const located = locateMedia(msg);

        if (!located) {
            return sock.sendMessage(jid, {
                text:
                    '❤️ *Heart Sticker*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.stickheart (reply to image/video/sticker)\n\n' +
                    '💡 Creates a heart-shaped sticker.\n' +
                    '🔄 Multiple fallback methods.\n\n' +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        if (located.mediaType === 'videoMessage') {
            const dur = located.mediaMessage?.videoMessage?.seconds || 0;
            if (dur > 11) {
                return sock.sendMessage(jid, {
                    text: '❌ Video too long! Max 10s.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
        }

        try { await sock.sendMessage(jid, { react: { text: '❤️', key: msg.key } }); } catch (_) {}

        try {
            const buffer = await downloadMedia(sock, msg, located);
            if (!buffer || buffer.length < 100) throw new Error('Download failed');

            let imageBuffer;

            if (located.mediaType === 'stickerMessage') {
                const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-'));
                const inputPath = path.join(tmpDir, 'sticker.webp');
                const outputPath = path.join(tmpDir, 'frame.png');
                fs.writeFileSync(inputPath, buffer);
                try {
                    await execFileAsync('ffmpeg', ['-i', inputPath, '-vframes', '1', '-y', outputPath], { timeout: 10000 });
                    imageBuffer = fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : buffer;
                } catch (_) { imageBuffer = buffer; }
                finally { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {} }
            } else if (located.mediaType === 'videoMessage') {
                const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-'));
                const inputPath = path.join(tmpDir, 'video.mp4');
                const outputPath = path.join(tmpDir, 'frame.png');
                fs.writeFileSync(inputPath, buffer);
                try {
                    await execFileAsync('ffmpeg', ['-i', inputPath, '-vframes', '1', '-y', outputPath], { timeout: 10000 });
                    imageBuffer = fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : null;
                } catch (_) { imageBuffer = null; }
                finally { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {} }
                if (!imageBuffer) throw new Error('Frame extraction failed');
            } else {
                imageBuffer = buffer;
            }

            // Appliquer l'effet cœur
            let heartBuffer = await applyHeartEffect(imageBuffer);

            if (!heartBuffer) {
                await sock.sendMessage(jid, {
                    image: imageBuffer,
                    caption: '⚠️ *Heart effect failed*\nSent original image.\n⚡ _Zenitsu_',
                    contextInfo: STYLE,
                }, { quoted: msg });
                try { await sock.sendMessage(jid, { react: { text: '⚠️', key: msg.key } }); } catch (_) {}
                return;
            }

            const finalSticker = await convertToSticker(heartBuffer, DEFAULT_PACK, DEFAULT_AUTHOR);

            await sock.sendMessage(jid, {
                sticker: finalSticker,
                contextInfo: STYLE,
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ stickheart:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: `❌ Failed: ${err.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
