// ./commands/aio.js

const axios = require('axios');

// ═══════════════════════════════════════
// PLATFORM DETECTION
// ═══════════════════════════════════════

function detectPlatform(url) {
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('tiktok.com')) return 'tiktok';
    if (lower.includes('instagram.com')) return 'instagram';
    if (lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.com')) return 'facebook';
    if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
    if (lower.includes('pinterest.com') || lower.includes('pin.it')) return 'pinterest';
    if (lower.includes('spotify.com')) return 'spotify';
    if (lower.includes('capcut.com')) return 'capcut';
    if (lower.includes('apple.com') || lower.includes('music.apple.com')) return 'applemusic';
    if (lower.includes('mediafire.com')) return 'mediafire';
    if (lower.includes('dailymotion.com')) return 'dailymotion';
    if (lower.includes('reddit.com')) return 'reddit';
    if (lower.includes('snapchat.com')) return 'snapchat';
    if (lower.includes('vimeo.com')) return 'vimeo';
    if (lower.includes('threads.net')) return 'threads';
    if (lower.includes('soundcloud.com')) return 'soundcloud';
    return 'unknown';
}

// ═══════════════════════════════════════
// CYBERNOVA STYLE
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

// ═══════════════════════════════════════
// DOWNLOAD METHODS BY PLATFORM
// ═══════════════════════════════════════

async function tryDownload(sock, jid, url, platform, quotedMsg) {
    const methods = getMethodsForPlatform(platform, url);

    for (const method of methods) {
        try {
            console.log(`📥 Trying ${method.name}...`);
            const result = await method.fn(url);
            if (result && result.medias && result.medias.length > 0) {
                console.log(`✅ Success with ${method.name}`);
                await sendMedias(sock, jid, result.medias, result.title || '', platform, url, quotedMsg);
                return { success: true, method: method.name };
            }
        } catch (err) {
            console.log(`⚠️ ${method.name} failed: ${err.message}`);
        }
    }

    return { success: false };
}

function getMethodsForPlatform(platform, url) {
    const encoded = encodeURIComponent(url);
    const methods = [];

    switch (platform) {
        case 'youtube':
            methods.push(
                {
                    name: 'NexRay YT MP4',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/ytmp4?url=${encoded}&resolusi=720`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
                {
                    name: 'PrinceTech YT MP4',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.princetechn.com/api/download/ytmp4?apikey=prince&url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
                {
                    name: 'PrinceTech YT MP3',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.princetechn.com/api/download/ytmp3?apikey=prince&url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
                {
                    name: 'GiftedTech SaveTube MP4',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.giftedtech.co.ke/api/download/savetubemp4?apikey=gifted&url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
                {
                    name: 'GiftedTech SaveTube MP3',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.giftedtech.co.ke/api/download/savetubemp3?apikey=gifted&url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
            );
            break;

        case 'facebook':
            methods.push(
                {
                    name: 'GiftedTech FB v3',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.giftedtech.co.ke/api/download/facebookv3?apikey=gifted&url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
                {
                    name: 'NexRay FB',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/facebook?url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
            );
            break;

        case 'twitter':
            methods.push(
                {
                    name: 'GiftedTech Twitter v2',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.giftedtech.co.ke/api/download/twitterdlv2?apikey=gifted&url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
                {
                    name: 'NexRay Twitter',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/twitter?url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
            );
            break;

        case 'spotify':
            methods.push(
                {
                    name: 'GiftedTech Spotify v4',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.giftedtech.co.ke/api/download/spotifydlv4?apikey=gifted&url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
                {
                    name: 'NexRay Spotify',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/spotify?url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
                {
                    name: 'NexRay Spotify Playlist',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/spotifyplay?url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
            );
            break;

        case 'pinterest':
            methods.push(
                {
                    name: 'GiftedTech Pinterest v4',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.giftedtech.co.ke/api/download/pinterestv4?apikey=gifted&url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
                {
                    name: 'NexRay Pinterest',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/pinterest?url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
            );
            break;

        case 'capcut':
            methods.push(
                {
                    name: 'NexRay CapCut',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/capcut?url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
            );
            break;

        case 'applemusic':
            methods.push(
                {
                    name: 'NexRay Apple Music',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/applemusic?url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
            );
            break;

        case 'mediafire':
            methods.push(
                {
                    name: 'NexRay MediaFire',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/mediafire?url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
            );
            break;

        case 'dailymotion':
            methods.push(
                {
                    name: 'GiftedTech Dailymotion',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.giftedtech.co.ke/api/download/dailymotion?apikey=gifted&url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
            );
            break;

        default:
            // AIO générique
            methods.push(
                {
                    name: 'NexRay AIO',
                    fn: async () => {
                        const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/aio?url=${encoded}`, { timeout: 60000 });
                        return extractMedia(data);
                    },
                },
            );
            break;
    }

    return methods;
}

// ═══════════════════════════════════════
// EXTRACT MEDIA FROM API RESPONSE
// ═══════════════════════════════════════

function extractMedia(data) {
    let medias = [];
    let title = '';

    // Format 1: data.result.medias (array)
    if (data?.result?.medias && Array.isArray(data.result.medias)) {
        medias = data.result.medias.map(m => m.url || m.download_url || m.link || (typeof m === 'string' ? m : null)).filter(Boolean);
        title = data.result.title || data.result.name || '';
    }
    // Format 2: data.result.data
    else if (data?.result?.data) {
        const inner = data.result.data;
        if (inner.medias && Array.isArray(inner.medias)) {
            medias = inner.medias.map(m => m.url || m.download_url || m.link || (typeof m === 'string' ? m : null)).filter(Boolean);
        } else if (inner.url || inner.download_url) {
            medias = [inner.url || inner.download_url].filter(Boolean);
        }
        title = inner.title || data.result.title || '';
    }
    // Format 3: data.result.url
    else if (data?.result?.url) {
        medias = [data.result.url];
        title = data.result.title || '';
    }
    // Format 4: data.result.download_url
    else if (data?.result?.download_url) {
        medias = [data.result.download_url];
        title = data.result.title || '';
    }
    // Format 5: data.url / data.download_url
    else if (data?.url || data?.download_url) {
        medias = [data.url || data.download_url].filter(Boolean);
        title = data.title || '';
    }
    // Format 6: data is string URL
    else if (typeof data === 'string' && data.startsWith('http')) {
        medias = [data];
    }
    // Format 7: data is array
    else if (Array.isArray(data)) {
        medias = data.map(m => typeof m === 'string' ? m : m?.url || m?.link).filter(Boolean);
    }

    return { medias, title };
}

// ═══════════════════════════════════════
// SEND MEDIAS
// ═══════════════════════════════════════

async function sendMedias(sock, jid, medias, title, platform, sourceUrl, quotedMsg) {
    for (let i = 0; i < medias.length; i++) {
        const mediaUrl = medias[i];
        let sent = false;

        // Essayer vidéo
        try {
            await sock.sendMessage(jid, {
                video: { url: mediaUrl },
                caption:
                    `📥 *Download Complete*\n\n` +
                    (title ? `📌 ${title}\n` : '') +
                    `📱 ${platform}\n` +
                    `🔗 ${sourceUrl}\n\n` +
                    '⚡ _Zenitsu AIO_',
                contextInfo: STYLE,
            }, { quoted: i === 0 ? quotedMsg : undefined });
            sent = true;
        } catch (_) {}

        // Essayer image
        if (!sent) {
            try {
                await sock.sendMessage(jid, {
                    image: { url: mediaUrl },
                    caption:
                        `📥 *Download Complete*\n\n` +
                        (title ? `📌 ${title}\n` : '') +
                        `📱 ${platform}\n\n` +
                        '⚡ _Zenitsu AIO_',
                    contextInfo: STYLE,
                }, { quoted: i === 0 ? quotedMsg : undefined });
                sent = true;
            } catch (_) {}
        }

        // Essayer audio
        if (!sent) {
            try {
                await sock.sendMessage(jid, {
                    audio: { url: mediaUrl },
                    mimetype: 'audio/mpeg',
                    ptt: false,
                }, { quoted: i === 0 ? quotedMsg : undefined });

                await sock.sendMessage(jid, {
                    text:
                        `📥 *Download Complete*\n\n` +
                        (title ? `📌 ${title}\n` : '') +
                        `📱 ${platform}\n\n` +
                        '⚡ _Zenitsu AIO_',
                    contextInfo: STYLE,
                });
                sent = true;
            } catch (_) {}
        }

        // Essayer document
        if (!sent) {
            try {
                await sock.sendMessage(jid, {
                    document: { url: mediaUrl },
                    mimetype: 'application/octet-stream',
                    fileName: title ? `${title.substring(0, 50)}.mp4` : `download_${Date.now()}.mp4`,
                    caption:
                        `📥 *Download Complete (Doc)*\n\n` +
                        (title ? `📌 ${title}\n` : '') +
                        `📱 ${platform}\n\n` +
                        '⚡ _Zenitsu AIO_',
                    contextInfo: STYLE,
                }, { quoted: i === 0 ? quotedMsg : undefined });
                sent = true;
            } catch (_) {}
        }

        // Fallback lien
        if (!sent) {
            await sock.sendMessage(jid, {
                text:
                    `📥 *Link ${i + 1}:*\n${mediaUrl}\n\n` +
                    '⚠️ Sent as link.',
                contextInfo: STYLE,
            });
        }

        if (i < medias.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'aio',
    aliases: ['download', 'dl', 'allinone'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const url = args[0];

        if (!url || !url.startsWith('http')) {
            return sock.sendMessage(jid, {
                text:
                    '📥 *AIO Downloader*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.aio <url>\n\n' +
                    '✨ *Supported:*\n' +
                    '  ▸ YouTube (MP4/MP3)\n' +
                    '  ▸ TikTok\n' +
                    '  ▸ Instagram\n' +
                    '  ▸ Facebook\n' +
                    '  ▸ Twitter/X\n' +
                    '  ▸ Pinterest\n' +
                    '  ▸ Spotify (track/playlist)\n' +
                    '  ▸ Apple Music\n' +
                    '  ▸ CapCut\n' +
                    '  ▸ MediaFire\n' +
                    '  ▸ Dailymotion\n' +
                    '  ▸ + many more\n\n' +
                    '💡 *Example:*\n' +
                    '.aio https://youtu.be/dQw4w9WgXcQ',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        const platform = detectPlatform(url);

        try { await sock.sendMessage(jid, { react: { text: '📥', key: msg.key } }); } catch (_) {}

        const result = await tryDownload(sock, jid, url, platform, msg);

        if (result.success) {
            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
        } else {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text:
                    '❌ *Download Failed*\n\n' +
                    'All sources are unavailable.\n\n' +
                    '⚡ Try again or use a different URL.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
