// ./commands/shazam.js

const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ═══════════════════════════════════════
// UPLOAD TO CATBOX
// ═══════════════════════════════════════

async function uploadToCatbox(buffer, ext = 'mp3') {
    try {
        const form = new FormData();
        form.append('fileToUpload', buffer, `shazam_${Date.now()}.${ext}`);
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
// DOWNLOAD QUOTED MEDIA
// ═══════════════════════════════════════

async function downloadMedia(mediaMessage, type) {
    const stream = await downloadContentFromMessage(mediaMessage, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

// ═══════════════════════════════════════
// SHAZAM APIS (ordered)
// ═══════════════════════════════════════

const SHAZAM_APIS = [
    {
        name: 'GiftedTech Shazam',
        url: (audioUrl) => `https://api.giftedtech.co.ke/api/search/shazam?apikey=gifted&url=${encodeURIComponent(audioUrl)}`,
        timeout: 30000,
        extract: (data) => ({
            title: data?.result?.title || data?.title,
            artist: data?.result?.artist || data?.artist,
            album: data?.result?.album || data?.album,
            cover: data?.result?.cover || data?.image || data?.cover_url,
            lyrics: data?.result?.lyrics || data?.lyrics,
            link: data?.result?.link || '',
        }),
    },
    {
        name: 'NexRay Music',
        url: (audioUrl) => `https://api.nexray.eu.cc/tools/whatsmusic?url=${encodeURIComponent(audioUrl)}`,
        timeout: 30000,
        extract: (data) => ({
            title: data?.result?.title || data?.title,
            artist: data?.result?.artist || data?.artist,
            album: data?.result?.album || data?.album,
            cover: data?.result?.cover || data?.image || data?.cover_url,
            lyrics: data?.result?.lyrics || data?.lyrics,
            link: data?.result?.link || '',
        }),
    },
    {
        name: 'YanzBotz Shazam',
        url: (audioUrl) => `https://api.yanzbotz.my.id/api/search/shazam?url=${encodeURIComponent(audioUrl)}`,
        timeout: 25000,
        extract: (data) => ({
            title: data?.result?.title || data?.title,
            artist: data?.result?.artist || data?.artist,
            album: data?.result?.album || data?.album,
            cover: data?.result?.cover || data?.image,
            lyrics: data?.result?.lyrics || data?.lyrics,
            link: data?.result?.link || '',
        }),
    },
    {
        name: 'Nexor Shazam',
        url: (audioUrl) => `https://api.nexor.my.id/api/search/shazam?url=${encodeURIComponent(audioUrl)}`,
        timeout: 25000,
        extract: (data) => ({
            title: data?.result?.title || data?.title,
            artist: data?.result?.artist || data?.artist,
            album: data?.result?.album || data?.album,
            cover: data?.result?.cover || data?.image,
            lyrics: data?.result?.lyrics || data?.lyrics,
            link: data?.result?.link || '',
        }),
    },
];

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'shazam2',
    aliases: ['whatmusic', 'recognize', 'identify'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let audioUrl = args[0]; // URL directe fournie

        // Si pas d'URL et pas de média quoté → aide
        if (!audioUrl && !quoted) {
            return sock.sendMessage(jid, {
                text:
                    '🎵 *Shazam — Music Recognition*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.shazam2 (reply to audio/voice/video)\n' +
                    '.shazam2 <audio_url>\n\n' +
                    '💡 Recognizes songs and finds lyrics.',
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

        try { await sock.sendMessage(jid, { react: { text: '🎵', key: msg.key } }); } catch (_) {}

        // Si pas d'URL mais média quoté → télécharger et uploader
        if (!audioUrl && quoted) {
            let mediaType = null;
            let mediaMessage = null;
            if (quoted.audioMessage) { mediaType = 'audio'; mediaMessage = quoted.audioMessage; }
            else if (quoted.voiceMessage) { mediaType = 'audio'; mediaMessage = quoted.voiceMessage; }
            else if (quoted.videoMessage) { mediaType = 'video'; mediaMessage = quoted.videoMessage; }
            else {
                return sock.sendMessage(jid, {
                    text: '❌ Please reply to an audio, voice note, or video.',
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

            try {
                const buffer = await downloadMedia(mediaMessage, mediaType);
                const ext = mediaType === 'video' ? 'mp4' : 'mp3';
                audioUrl = await uploadToCatbox(buffer, ext);
                if (!audioUrl) throw new Error('Upload failed');
            } catch (err) {
                console.error('❌ Upload error:', err.message);
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: '❌ Failed to upload media for recognition.',
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
        }

        // Essayer toutes les APIs
        let result = null;
        for (const api of SHAZAM_APIS) {
            try {
                console.log(`🎵 Trying ${api.name}...`);
                const { data } = await axios.get(api.url(audioUrl), { timeout: api.timeout });
                result = api.extract(data);
                if (result && (result.title || result.artist)) {
                    console.log(`✅ Success with ${api.name}`);
                    break;
                }
            } catch (err) {
                console.log(`⚠️ ${api.name} failed: ${err.message}`);
            }
        }

        if (!result || (!result.title && !result.artist)) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, {
                text: '❌ Could not identify the music. Try a clearer recording.',
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

        // Construire la réponse
        let replyText = '🎵 *Shazam — Music Found!*\n\n';
        if (result.title) replyText += `📌 *Title:* ${result.title}\n`;
        if (result.artist) replyText += `🎤 *Artist:* ${result.artist}\n`;
        if (result.album) replyText += `💿 *Album:* ${result.album}\n`;
        if (result.link) replyText += `🔗 ${result.link}\n`;
        if (result.lyrics && result.lyrics.length > 10) {
            const maxLyrics = result.lyrics.substring(0, 800);
            replyText += `\n📝 *Lyrics:*\n${maxLyrics}${result.lyrics.length > 800 ? '...' : ''}\n`;
        }
        replyText += '\n⚡ _Identified by Zenitsu_';

        // Envoyer avec cover si disponible
        if (result.cover && result.cover.startsWith('http')) {
            try {
                await sock.sendMessage(jid, {
                    image: { url: result.cover },
                    caption: replyText,
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
            } catch (_) {
                await sock.sendMessage(jid, { text: replyText }, { quoted: msg });
            }
        } else {
            await sock.sendMessage(jid, { text: replyText }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
