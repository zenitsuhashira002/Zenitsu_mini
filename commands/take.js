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
    forwardingScore: 350, isForwarded: true,
    forwardedNewsletterMessageInfo: { newsletterJid: '120363425394543602@newsletter', newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟', serverMessageId: 202 },
};

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

function buildDownloadableMessage(originalMsg, located) {
    const { mediaMessage, quotedInfo } = located;
    if (!quotedInfo) return { key: originalMsg.key, message: mediaMessage };
    return { key: { remoteJid: originalMsg.key.remoteJid, fromMe: false, id: quotedInfo.stanzaId || crypto.randomBytes(8).toString('hex'), participant: quotedInfo.participant || originalMsg.key.participant || originalMsg.key.remoteJid }, message: mediaMessage };
}

async function downloadMedia(sock, originalMsg, located) {
    const rebuilt = buildDownloadableMessage(originalMsg, located);
    try { return await downloadMediaMessage(rebuilt, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage }); } catch (_) {}
    try { return await downloadMediaMessage({ key: originalMsg.key, message: located.mediaMessage }, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage }); } catch (_) {}
    return await downloadMediaMessage(originalMsg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
}

// Fonction de conversion avec Fallback intégré
async function convertToSticker(buffer, mediaType, packname, author) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-'));
    const isVideo = mediaType === 'videoMessage';
    const inputExt = isVideo ? 'mp4' : 'png';
    const inputPath = path.join(tmpDir, `input.${inputExt}`);
    const outputPath = path.join(tmpDir, 'output.webp');
    
    fs.writeFileSync(inputPath, buffer);

    // 🌟 STRATÉGIE 1 : Haute qualité avec fond transparent et format carré (512x512)
    // Note : Pour les vidéos, on réduit l'échelle à 320x320 car WhatsApp rejette les stickers > 1MB
    const scaleVideo = '320:320'; 
    const scaleImage = '512:512';
    
    const argsPrimary = isVideo
        ? ['-i', inputPath, '-vcodec', 'libwebp', '-vf', `scale=${scaleVideo}:force_original_aspect_ratio=decrease,format=rgba,pad=${scaleVideo}:(ow-iw)/2:(oh-ih)/2:color=white@0.0`, '-loop', '0', '-preset', 'default', '-an', '-vsync', '0', '-t', '10', '-q:v', '50', '-y', outputPath]
        : ['-i', inputPath, '-vcodec', 'libwebp', '-vf', `scale=${scaleImage}:force_original_aspect_ratio=decrease,format=rgba,pad=${scaleImage}:(ow-iw)/2:(oh-ih)/2:color=white@0.0`, '-lossless', '0', '-q:v', '80', '-y', outputPath];

    // 🛟 STRATÉGIE 2 (Fallback) : Plus simple, sans padding, si la première échoue
    const argsFallback = isVideo
        ? ['-i', inputPath, '-vcodec', 'libwebp', '-vf', 'scale=320:-1', '-loop', '0', '-preset', 'ultrafast', '-an', '-t', '10', '-q:v', '40', '-y', outputPath]
        : ['-i', inputPath, '-vcodec', 'libwebp', '-vf', 'scale=512:-1', '-q:v', '70', '-y', outputPath];

    try {
        try {
            // Tentative Primaire
            await execFileAsync('ffmpeg', argsPrimary, { timeout: 45000 });
        } catch (errPrimary) {
            console.log('⚠️ [TAKE] Échec de la conversion primaire, exécution du Fallback...');
            // Tentative de Secours (Fallback)
            await execFileAsync('ffmpeg', argsFallback, { timeout: 30000 });
        }

        if (!fs.existsSync(outputPath)) throw new Error('Conversion failed entirely');
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
        const metadata = { 'sticker-pack-id': crypto.randomBytes(32).toString('hex'), 'sticker-pack-name': packname || '', 'sticker-pack-publisher': author || '', 'emojis': ['⚡'] };
        const exifAttr = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00]);
        const jsonBuffer = Buffer.from(JSON.stringify(metadata), 'utf8');
        const exif = Buffer.concat([exifAttr, jsonBuffer]);
        exif.writeUIntLE(jsonBuffer.length, 14, 4);
        img.exif = exif;
        return await img.save(null);
    } catch (err) { 
        console.error('Erreur EXIF:', err);
        return webpBuffer; 
    }
}

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

module.exports = {
    name: 'take',
    aliases: ['steal', 'takesticker', 'takestick',],
    category: 'media',

    async execute({ sock, msg, args, jid }) {
        const located = locateMedia(msg);
        if (!located) return sock.sendMessage(jid, { text: '🎨 *Take*\n\n.take a:AuthorName (author only)\n.take p:PackName (pack only)\n\n💡 Reply to sticker/image/video.', contextInfo: STYLE }, { quoted: msg });

        if (located.mediaType === 'videoMessage' && (located.mediaMessage?.videoMessage?.seconds || 0) > 11) {
            return sock.sendMessage(jid, { text: '❌ Video too long! Max 10s.', contextInfo: STYLE }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🎨', key: msg.key } }); } catch (_) {}

        try {
            const { packname, author } = parseArgs(args);
            if (!packname && !author) return sock.sendMessage(jid, { text: '⚠️ Specify author or packname.\nExample: .take a:Zenitsu', contextInfo: STYLE }, { quoted: msg });

            const buffer = await downloadMedia(sock, msg, located);
            if (!buffer || buffer.length < 100) throw new Error('Download failed');

            let finalSticker;

            // 🔥 CHANGEMENT MAJEUR ICI : 
            // Si c'est déjà un sticker, PAS BESOIN DE FFMPEG ! On modifie juste l'EXIF.
            if (located.mediaType === 'stickerMessage') {
                finalSticker = await addExif(buffer, packname, author);
            } 
            else {
                // Sinon (Image ou Vidéo), on convertit d'abord en WebP avec FFmpeg
                finalSticker = await convertToSticker(buffer, located.mediaType, packname, author);
            }

            await sock.sendMessage(jid, { sticker: finalSticker, contextInfo: STYLE }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ take:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        }
    },
};
