// ./commands/tourl2.js

const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');
const crypto = require('crypto');

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

async function downloadMedia(mediaMessage, type) {
    const stream = await downloadContentFromMessage(mediaMessage, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

function getFileExt(filename, defaultExt = 'bin') {
    if (!filename) return defaultExt;
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : defaultExt;
}

// ═══════════════════════════════════════
// PERMANENT UPLOAD SERVICES
// ═══════════════════════════════════════

const PERMANENT_SERVICES = [
    {
        name: 'Catbox',
        fn: async (buffer, filename) => {
            const form = new FormData();
            form.append('fileToUpload', buffer, filename);
            form.append('reqtype', 'fileupload');
            const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
                headers: form.getHeaders(),
                timeout: 60000,
            });
            const url = data.trim();
            if (url && url.startsWith('http')) return url;
            throw new Error('Invalid response');
        },
    },
    {
        name: 'Iili',
        fn: async (buffer, filename) => {
            const form = new FormData();
            form.append('source', buffer, filename);
            form.append('type', 'file');
            form.append('action', 'upload');
            form.append('timestamp', Math.floor(Date.now() / 1000).toString());
            const { data } = await axios.post('https://freeimage.host/api/1/upload', form, {
                headers: {
                    ...form.getHeaders(),
                    'X-API-Key': '6d207e02198a847aa98d0a2a901485a5',
                },
                timeout: 60000,
            });
            if (data?.image?.url) return data.image.url;
            if (data?.image?.display_url) return data.image.display_url;
            throw new Error('No URL in response');
        },
    },
    {
        name: 'ImgBB',
        fn: async (buffer, filename) => {
            const form = new FormData();
            form.append('image', buffer.toString('base64'));
            const { data } = await axios.post('https://api.imgbb.com/1/upload?key=YOUR_IMGBB_API_KEY', form, {
                headers: form.getHeaders(),
                timeout: 60000,
            });
            if (data?.data?.url) return data.data.url;
            throw new Error('No URL');
        },
    },
    {
        name: 'File.io',
        fn: async (buffer, filename) => {
            const form = new FormData();
            form.append('file', buffer, filename);
            const { data } = await axios.post('https://file.io', form, {
                headers: form.getHeaders(),
                timeout: 60000,
            });
            if (data?.link) return data.link;
            throw new Error('No link');
        },
    },
];

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'tourl2',
    aliases: ['upload2', 'permanenturl', 'uploadpermanent'],
    category: 'tools',

    async execute({ sock, msg, args, jid }) {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted) {
            return sock.sendMessage(jid, {
                text:
                    '📤 *Permanent Upload*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.tourl2 (reply to media/file)\n\n' +
                    '💡 Uploads permanently.\n' +
                    '🔄 Multiple services with fallback.\n\n' +
                    '📁 *Supported:* Images, Videos, Audio, Documents',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '📤', key: msg.key } }); } catch (_) {}

        let mediaType = null;
        let mediaMessage = null;
        let filename = '';

        if (quoted.imageMessage) {
            mediaType = 'image';
            mediaMessage = quoted.imageMessage;
            filename = `image_${Date.now()}.jpg`;
        } else if (quoted.videoMessage) {
            mediaType = 'video';
            mediaMessage = quoted.videoMessage;
            filename = `video_${Date.now()}.mp4`;
        } else if (quoted.audioMessage) {
            mediaType = 'audio';
            mediaMessage = quoted.audioMessage;
            filename = `audio_${Date.now()}.${quoted.audioMessage.ptt ? 'ogg' : 'mp3'}`;
        } else if (quoted.documentMessage) {
            mediaType = 'document';
            mediaMessage = quoted.documentMessage;
            filename = quoted.documentMessage.fileName || `doc_${Date.now()}.bin`;
        } else if (quoted.stickerMessage) {
            mediaType = 'sticker';
            mediaMessage = quoted.stickerMessage;
            filename = `sticker_${Date.now()}.webp`;
        } else {
            return sock.sendMessage(jid, {
                text: '❌ Unsupported media type.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            const buffer = await downloadMedia(mediaMessage, mediaType);

            if (!buffer || buffer.length < 100) {
                throw new Error('Download failed');
            }

            const sizeMB = (buffer.length / 1048576).toFixed(2);
            let uploadedUrl = null;
            let usedService = '';

            for (const service of PERMANENT_SERVICES) {
                try {
                    console.log(`📤 Uploading to ${service.name}...`);
                    uploadedUrl = await service.fn(buffer, filename);
                    if (uploadedUrl && uploadedUrl.startsWith('http')) {
                        usedService = service.name;
                        console.log(`✅ Uploaded via ${service.name}`);
                        break;
                    }
                } catch (err) {
                    console.log(`⚠️ ${service.name} failed: ${err.message}`);
                }
            }

            if (!uploadedUrl) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: '❌ All upload services failed.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            await sock.sendMessage(jid, {
                text:
                    '📤 *Upload Complete (Permanent)*\n\n' +
                    `📄 *File:* ${filename}\n` +
                    `📏 *Size:* ${sizeMB} MB\n` +
                    `📁 *Type:* ${mediaType}\n` +
                    `🏷️ *Service:* ${usedService}\n\n` +
                    `🔗 *URL:*\n${uploadedUrl}\n\n` +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ tourl2:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: `❌ Failed: ${err.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
