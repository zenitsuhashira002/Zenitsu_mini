// ./commands/remini.js

const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ═══════════════════════════════════════
// DOWNLOAD & UPLOAD
// ═══════════════════════════════════════

async function downloadQuotedMedia(mediaMessage, mediaType) {
    const stream = await downloadContentFromMessage(mediaMessage, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

async function uploadToCatbox(buffer) {
    try {
        const form = new FormData();
        form.append('fileToUpload', buffer, `remini_${Date.now()}.jpg`);
        form.append('reqtype', 'fileupload');
        const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            timeout: 30000,
        });
        return data.trim();
    } catch (err) {
        console.error('❌ Catbox upload error:', err.message);
        return null;
    }
}

// ═══════════════════════════════════════
// ENHANCEMENT METHODS (ordered)
// ═══════════════════════════════════════

const ENHANCERS = [
    // NexRay v1/upscale renvoie directement l'image (buffer)
    {
        name: 'NexRay Upscale (image)',
        fn: async (imageUrl) => {
            const resp = await axios.get(
                `https://api.nexray.eu.cc/tools/v1/upscale?url=${encodeURIComponent(imageUrl)}`,
                { responseType: 'arraybuffer', timeout: 60000 }
            );
            const buffer = Buffer.from(resp.data);
            if (buffer.length < 100) throw new Error('Empty image');
            // On retourne l'image en base64 ou on la sauvegarde et on renvoie l'URL
            // Plus simple : renvoyer le buffer directement pour envoi
            return { buffer, method: 'NexRay Upscale' };
        },
    },
    // NexRay Enhancer (retourne URL)
    {
        name: 'NexRay Enhancer',
        fn: async (imageUrl) => {
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/tools/v1/enhancer?url=${encodeURIComponent(imageUrl)}`,
                { timeout: 60000 }
            );
            const url = data?.result?.url || data?.url || data?.image_url;
            if (url && url.startsWith('http')) return { url, method: 'NexRay Enhancer' };
            throw new Error('No URL');
        },
    },
    // NexRay Remini
    {
        name: 'NexRay Remini',
        fn: async (imageUrl) => {
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/tools/remini?url=${encodeURIComponent(imageUrl)}`,
                { timeout: 60000 }
            );
            const url = data?.result?.url || data?.url || data?.image_url;
            if (url && url.startsWith('http')) return { url, method: 'NexRay Remini' };
            throw new Error('No URL');
        },
    },
    // GiftedTech Remini (fallback classique)
    {
        name: 'GiftedTech Remini',
        fn: async (imageUrl) => {
            const { data } = await axios.get(
                `https://api.giftedtech.co.ke/api/tools/remini?apikey=gifted&url=${encodeURIComponent(imageUrl)}`,
                { timeout: 60000 }
            );
            const url = data?.result?.url || data?.url || data?.image_url;
            if (url && url.startsWith('http')) return { url, method: 'GiftedTech Remini' };
            throw new Error('No URL');
        },
    },
];

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'remini2',
    aliases: ['hd', 'enhance', 'upscale'],
    category: 'tools',

    async execute({ sock, msg, args, jid }) {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted || !quoted.imageMessage) {
            const urlArg = args[0];
            if (urlArg && urlArg.startsWith('http')) {
                return processEnhance(sock, msg, jid, urlArg);
            }
            return sock.sendMessage(jid, {
                text:
                    '🔮 *Remini HD Enhancer*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.remini2 (reply to image)\n' +
                    '.remini2 <image_url>\n\n' +
                    '🔄 Multiple fallback services.',
                contextInfo: {
                    forwardingScore: 350,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202,
                    },
                },
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🔮', key: msg.key } }); } catch (_) {}

        try {
            const buffer = await downloadQuotedMedia(quoted.imageMessage, 'image');
            const imageUrl = await uploadToCatbox(buffer);
            if (!imageUrl) throw new Error('Upload failed');
            await processEnhance(sock, msg, jid, imageUrl);
        } catch (err) {
            console.error('❌ remini error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: '❌ Enhancement failed.',
                contextInfo: {
                    forwardingScore: 350,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202,
                    },
                },
            }, { quoted: msg });
        }
    },
};

async function processEnhance(sock, msg, jid, imageUrl) {
    let result = null;
    let usedMethod = '';

    for (const enhancer of ENHANCERS) {
        try {
            console.log(`🔮 Trying ${enhancer.name}...`);
            result = await enhancer.fn(imageUrl);
            if (result) {
                usedMethod = result.method || enhancer.name;
                console.log(`✅ Success with ${usedMethod}`);
                break;
            }
        } catch (err) {
            console.log(`⚠️ ${enhancer.name} failed: ${err.message}`);
        }
    }

    if (!result) {
        try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        return sock.sendMessage(jid, {
            text: '❌ All enhancement services failed.',
            contextInfo: {
                forwardingScore: 350,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363425394543602@newsletter',
                    newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                    serverMessageId: 202,
                },
            },
        }, { quoted: msg });
    }

    // Envoyer l'image améliorée
    let sent = false;
    const contextInfo = {
        forwardingScore: 350,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363425394543602@newsletter',
            newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
            serverMessageId: 202,
        },
    };

    if (result.buffer) {
        // Cas où l'API a retourné directement l'image (upscale)
        try {
            await sock.sendMessage(jid, {
                image: result.buffer,
                caption: `🔮 *Enhanced (${usedMethod})*\n\n⚡ _Powered by Zenitsu_`,
                contextInfo,
            }, { quoted: msg });
            sent = true;
        } catch (_) {}
    }

    if (!sent && result.url) {
        try {
            await sock.sendMessage(jid, {
                image: { url: result.url },
                caption: `🔮 *Enhanced (${usedMethod})*\n\n⚡ _Powered by Zenitsu_`,
                contextInfo,
            }, { quoted: msg });
            sent = true;
        } catch (_) {}
    }

    if (!sent) {
        await sock.sendMessage(jid, {
            text: `🔮 *Enhanced (${usedMethod})*\n🔗 ${result.url || 'Image ready'}\n\n⚠️ Sent as link.`,
            contextInfo,
        }, { quoted: msg });
    }

    try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
}
