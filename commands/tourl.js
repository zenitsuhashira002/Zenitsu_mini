// ./commands/tourl.js

const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');

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

// ═══════════════════════════════════════
// TEMPORARY UPLOAD SERVICES
// ═══════════════════════════════════════

const TEMPORARY_SERVICES = [
    {
        name: 'Litterbox',
        fn: async (buffer, filename) => {
            const form = new FormData();
            form.append('fileToUpload', buffer, filename);
            form.append('reqtype', 'fileupload');
            form.append('time', '1h'); // 1 hour, 12h, 24h, 72h
            const { data } = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                headers: form.getHeaders(),
                timeout: 60000,
            });
            const url = data.trim();
            if (url && url.startsWith('http')) return url;
            throw new Error('Invalid response');
        },
    },
    {
        name: 'Uguu',
        fn: async (buffer, filename) => {
            const form = new FormData();
            form.append('files[]', buffer, filename);
            const { data } = await axios.post('https://uguu.se/upload.php', form, {
                headers: form.getHeaders(),
                timeout: 60000,
            });
            if (data?.files?.[0]?.url) return data.files[0].url;
            throw new Error('No URL');
        },
    },
    {
        name: 'Tmpfiles',
        fn: async (buffer, filename) => {
            const form = new FormData();
            form.append('file', buffer, filename);
            const { data } = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
                headers: form.getHeaders(),
                timeout: 60000,
            });
            if (data?.data?.url) return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
            throw new Error('No URL');
        },
    },
    {
        name: '0x0.st',
        fn: async (buffer, filename) => {
            const form = new FormData();
            form.append('file', buffer, filename);
            const { data } = await axios.post('https://0x0.st', form, {
                headers: form.getHeaders(),
                timeout: 60000,
            });
            const url = data.trim();
            if (url && url.startsWith('http')) return url;
            throw new Error('Invalid response');
        },
    },
];

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'tourl',
    aliases: ['upload', 'tempurl', 'uploadtemp'],
    category: 'tools',

    async execute({ sock, msg, args, jid }) {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted) {
            return sock.sendMessage(jid, {
                text:
                    '📤 *Temporary Upload*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.tourl (reply to media/file)\n\n' +
                    '⏳ Uploads temporarily (1h - 72h).\n' +
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

            for (const service of TEMPORARY_SERVICES) {
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
                    '📤 *Upload Complete (Temporary)*\n\n' +
                    `📄 *File:* ${filename}\n` +
                    `📏 *Size:* ${sizeMB} MB\n` +
                    `📁 *Type:* ${mediaType}\n` +
                    `🏷️ *Service:* ${usedService}\n` +
                    `⏳ *Duration:* 1h - 72h\n\n` +
                    `🔗 *URL:*\n${uploadedUrl}\n\n` +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ tourl:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: `❌ Failed: ${err.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
