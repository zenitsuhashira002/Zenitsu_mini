// ./commands/shazam.js

const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ═══════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════

async function downloadMedia(mediaMessage, type) {
    const stream = await downloadContentFromMessage(mediaMessage, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

async function uploadToCatbox(buffer, ext = 'mp3') {
    const form = new FormData();
    form.append('fileToUpload', buffer, `shazam_${Date.now()}.${ext}`);
    form.append('reqtype', 'fileupload');

    const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders(),
        timeout: 30000,
    });

    return data.trim();
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'shazam',
    aliases: ['recognize', 'identify', 'whatsong'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // Check for quoted audio/voice
        if (!quoted || (!quoted.audioMessage && !quoted.voiceMessage && !quoted.videoMessage)) {
            // Check if URL provided
            const urlArg = args[0];
            if (urlArg && urlArg.startsWith('http')) {
                return processShazam(sock, msg, jid, urlArg);
            }

            return sock.sendMessage(jid, {
                text:
                    '🎵 *Shazam — Music Recognition*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.shazam (reply to audio/voice/video)\n' +
                    '.shazam <audio_url>\n\n' +
                    '✨ *Examples:*\n' +
                    '.shazam (reply to a voice note)\n' +
                    '.shazam https://example.com/song.mp3\n\n' +
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

        try {
            let mediaType = 'audio';
            let mediaMessage = quoted.audioMessage || quoted.voiceMessage;

            if (quoted.videoMessage) {
                mediaType = 'video';
                mediaMessage = quoted.videoMessage;
            }

            const buffer = await downloadMedia(mediaMessage, mediaType);
            const audioUrl = await uploadToCatbox(buffer, mediaType === 'video' ? 'mp4' : 'mp3');

            if (!audioUrl) throw new Error('Upload failed');

            await processShazam(sock, msg, jid, audioUrl);

        } catch (err) {
            console.error('❌ shazam error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            await sock.sendMessage(jid, {
                text: '❌ *Recognition Failed*\n\nThe audio could not be identified. Try a clearer recording.',
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

// ═══════════════════════════════════════
// PROCESS SHAZAM
// ═══════════════════════════════════════

async function processShazam(sock, msg, jid, audioUrl) {
    try {
        const encodedUrl = encodeURIComponent(audioUrl);

        const { data } = await axios.get(
            `https://api.giftedtech.co.ke/api/search/shazam?apikey=gifted&url=${encodedUrl}`,
            { timeout: 60000 }
        );

        // Extract song info
        const title = data?.title || data?.result?.title || 'Unknown';
        const artist = data?.artist || data?.result?.artist || 'Unknown';
        const album = data?.album || data?.result?.album || '';
        const genre = data?.genre || data?.result?.genre || '';
        const releaseDate = data?.release_date || data?.result?.release_date || '';
        const coverUrl = data?.cover || data?.result?.cover || data?.image || '';
        const lyrics = data?.lyrics || data?.result?.lyrics || '';

        // Build response
        let replyText =
            `🎵 *Shazam — Music Found!*\n\n` +
            `📌 *Title:* ${title}\n` +
            `🎤 *Artist:* ${artist}\n`;

        if (album) replyText += `💿 *Album:* ${album}\n`;
        if (genre) replyText += `🎼 *Genre:* ${genre}\n`;
        if (releaseDate) replyText += `📅 *Released:* ${releaseDate}\n`;

        if (lyrics && lyrics.length > 10) {
            const maxLyrics = lyrics.substring(0, 800);
            replyText += `\n📝 *Lyrics:*\n${maxLyrics}${lyrics.length > 800 ? '...' : ''}\n`;
        }

        replyText += `\n⚡ _Identified by Zenitsu_`;

        // Send with cover if available
        if (coverUrl) {
            try {
                await sock.sendMessage(jid, {
                    image: { url: coverUrl },
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
                await sock.sendMessage(jid, {
                    text: replyText,
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
        } else {
            await sock.sendMessage(jid, {
                text: replyText,
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

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (err) {
        console.error('❌ shazam process error:', err.message);
        throw err;
    }
}
