
// ./commands/dl.js

const axios = require('axios');

// ═══════════════════════════════════════
// PLATFORM DETECTION
// ═══════════════════════════════════════

function detectPlatform(url) {
    const lower = url.toLowerCase();

    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
    if (lower.includes('pinterest.com') || lower.includes('pin.it')) return 'pinterest';
    if (lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.com')) return 'facebook';
    if (lower.includes('tiktok.com')) return 'tiktok';
    if (lower.includes('instagram.com')) return 'instagram';
    if (lower.includes('reddit.com')) return 'reddit';
    if (lower.includes('snapchat.com')) return 'snapchat';
    if (lower.includes('capcut.com')) return 'capcut';
    if (lower.includes('threads.net')) return 'threads';
    if (lower.includes('vimeo.com')) return 'vimeo';
    if (lower.includes('dailymotion.com')) return 'dailymotion';
    if (lower.includes('likee.com')) return 'likee';

    return 'unknown';
}

// ═══════════════════════════════════════
// YOUTUBE QUALITIES
// ═══════════════════════════════════════

const YT_QUALITIES = ['144p', '240p', '360p', '480p', '720p', '1080p'];
const DEFAULT_QUALITY = '240p';

function extractQuality(args) {
    for (let i = 0; i < args.length; i++) {
        const arg = args[i].toLowerCase();
        if (YT_QUALITIES.includes(arg)) {
            return { quality: arg, index: i };
        }
        // Handle formats like 720, 1080
        const match = arg.match(/^(\d{3,4})p?$/);
        if (match && YT_QUALITIES.includes(match[1] + 'p')) {
            return { quality: match[1] + 'p', index: i };
        }
    }
    return { quality: DEFAULT_QUALITY, index: -1 };
}

// ═══════════════════════════════════════
// API CALLS PER PLATFORM
// ═══════════════════════════════════════

async function downloadYouTube(url, quality) {
    const encodedUrl = encodeURIComponent(url);
    const { data } = await axios.get(
        `https://api.giftedtech.co.ke/api/download/ytmp4?apikey=gifted&url=${encodedUrl}&quality=${quality}`,
        { timeout: 60000 }
    );

    let videoUrl = null;
    let title = '';

    if (data?.result?.download_url) {
        videoUrl = data.result.download_url;
        title = data.result.title || '';
    } else if (data?.result?.url) {
        videoUrl = data.result.url;
        title = data.result.title || '';
    } else if (data?.url) {
        videoUrl = data.url;
        title = data.title || '';
    } else if (data?.download_url) {
        videoUrl = data.download_url;
    } else if (typeof data === 'string' && data.startsWith('http')) {
        videoUrl = data;
    }

    return { url: videoUrl, title, platform: 'YouTube' };
}

async function downloadTwitter(url) {
    const encodedUrl = encodeURIComponent(url);
    const { data } = await axios.get(
        `https://api.giftedtech.co.ke/api/download/twitterdlv2?apikey=gifted&url=${encodedUrl}`,
        { timeout: 60000 }
    );

    let mediaUrls = [];
    let title = '';

    if (data?.result?.medias && Array.isArray(data.result.medias)) {
        mediaUrls = data.result.medias.map(m => m.url || m.link || (typeof m === 'string' ? m : null)).filter(Boolean);
        title = data.result.title || data.result.text || '';
    } else if (data?.result?.url) {
        mediaUrls = [data.result.url];
        title = data.result.title || data.result.text || '';
    } else if (data?.url) {
        mediaUrls = [data.url];
    } else if (Array.isArray(data)) {
        mediaUrls = data.map(m => typeof m === 'string' ? m : m?.url).filter(Boolean);
    }

    return { urls: mediaUrls, title, platform: 'Twitter/X' };
}

async function downloadPinterest(url) {
    const encodedUrl = encodeURIComponent(url);
    const { data } = await axios.get(
        `https://api.giftedtech.co.ke/api/download/pinterestv3?apikey=gifted&url=${encodedUrl}`,
        { timeout: 60000 }
    );

    let mediaUrls = [];
    let title = '';

    if (data?.result?.medias && Array.isArray(data.result.medias)) {
        mediaUrls = data.result.medias.map(m => m.url || m.link || (typeof m === 'string' ? m : null)).filter(Boolean);
        title = data.result.title || '';
    } else if (data?.result?.url) {
        mediaUrls = [data.result.url];
        title = data.result.title || '';
    } else if (data?.url) {
        mediaUrls = [data.url];
    }

    return { urls: mediaUrls, title, platform: 'Pinterest' };
}

async function downloadFacebook(url) {
    const encodedUrl = encodeURIComponent(url);
    const { data } = await axios.get(
        `https://api.giftedtech.co.ke/api/download/facebookv3?apikey=gifted&url=${encodedUrl}`,
        { timeout: 60000 }
    );

    let mediaUrls = [];
    let title = '';

    if (data?.result?.medias && Array.isArray(data.result.medias)) {
        mediaUrls = data.result.medias.map(m => m.url || m.link || (typeof m === 'string' ? m : null)).filter(Boolean);
        title = data.result.title || '';
    } else if (data?.result?.url) {
        mediaUrls = [data.result.url];
        title = data.result.title || '';
    } else if (data?.url) {
        mediaUrls = [data.url];
    }

    return { urls: mediaUrls, title, platform: 'Facebook' };
}

// ═══════════════════════════════════════
// MEDIA SENDER
// ═══════════════════════════════════════

async function sendMedia(sock, jid, mediaUrl, title, platform, sourceUrl, quotedMsg, isFirst = true) {
    let sent = false;

    // Try video
    try {
        await sock.sendMessage(jid, {
            video: { url: mediaUrl },
            caption:
                '📥 *Download Complete*\n\n' +
                (title ? `📌 *Title:* ${title}\n` : '') +
                `📱 *Platform:* ${platform}\n` +
                `🔗 ${sourceUrl}\n\n` +
                '⚡ _Downloaded by Zenitsu_',
            contextInfo: {
                forwardingScore: 350,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363425394543602@newsletter',
                    newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                    serverMessageId: 202,
                },
            },
        }, { quoted: isFirst ? quotedMsg : undefined });
        sent = true;
        return true;
    } catch (_) {}

    // Try image
    try {
        await sock.sendMessage(jid, {
            image: { url: mediaUrl },
            caption:
                '📥 *Download Complete*\n\n' +
                (title ? `📌 *Title:* ${title}\n` : '') +
                `📱 *Platform:* ${platform}\n` +
                `🔗 ${sourceUrl}\n\n` +
                '⚡ _Downloaded by Zenitsu_',
            contextInfo: {
                forwardingScore: 350,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363425394543602@newsletter',
                    newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                    serverMessageId: 202,
                },
            },
        }, { quoted: isFirst ? quotedMsg : undefined });
        sent = true;
        return true;
    } catch (_) {}

    // Try document
    try {
        await sock.sendMessage(jid, {
            document: { url: mediaUrl },
            mimetype: 'application/octet-stream',
            fileName: title ? `${title.substring(0, 50)}.mp4` : `download_${Date.now()}.mp4`,
            caption:
                '📥 *Download Complete (as document)*\n\n' +
                (title ? `📌 *Title:* ${title}\n` : '') +
                `📱 *Platform:* ${platform}\n` +
                `🔗 ${sourceUrl}\n\n` +
                '⚡ _Downloaded by Zenitsu_',
            contextInfo: {
                forwardingScore: 350,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363425394543602@newsletter',
                    newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                    serverMessageId: 202,
                },
            },
        }, { quoted: isFirst ? quotedMsg : undefined });
        sent = true;
        return true;
    } catch (_) {}

    // Fallback: send as link
    if (!sent) {
        await sock.sendMessage(jid, {
            text:
                '📥 *Download Link*\n\n' +
                (title ? `📌 *Title:* ${title}\n` : '') +
                `📱 *Platform:* ${platform}\n` +
                `🔗 *Media:* ${mediaUrl}\n` +
                `🔗 *Source:* ${sourceUrl}\n\n` +
                '⚠️ Media sent as link.\n\n' +
                '⚡ _Downloaded by Zenitsu_',
            contextInfo: {
                forwardingScore: 350,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363425394543602@newsletter',
                    newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                    serverMessageId: 202,
                },
            },
        }, { quoted: isFirst ? quotedMsg : undefined });
        return true;
    }

    return false;
}

// ═══════════════════════════════════════
// MAIN COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'dl',
    aliases: ['download2', 'youtube', 'twitter', 'pint', 'faceb', 'fb2'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        // ── Extract quality and URL ──
        const qualityInfo = extractQuality(args);
        let urlArgs = [...args];

        // Remove quality from args if found
        if (qualityInfo.index >= 0) {
            urlArgs.splice(qualityInfo.index, 1);
        }

        const url = urlArgs[0];
        const quality = qualityInfo.quality;

        // ── No URL ──
        if (!url || !url.startsWith('http')) {
            return sock.sendMessage(jid, {
                text:
                    '📥 *Universal Downloader*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.dl <quality> <url>\n' +
                    '.dl <url>\n\n' +
                    '📐 *YouTube Qualities:*\n' +
                    '  144p | 240p | 360p | 480p | 720p | 1080p\n' +
                    `  Default: ${DEFAULT_QUALITY}\n\n` +
                    '✨ *Supported Platforms:*\n' +
                    '  ▸ YouTube (videos/shorts)\n' +
                    '  ▸ Twitter/X (videos/images)\n' +
                    '  ▸ Pinterest (images/videos)\n' +
                    '  ▸ Facebook (videos/reels)\n\n' +
                    '💡 *Examples:*\n' +
                    '.dl https://youtu.be/xxx\n' +
                    '.dl 720p https://youtu.be/xxx\n' +
                    '.dl https://twitter.com/xxx/status/xxx\n' +
                    '.dl https://pin.it/xxx\n' +
                    '.dl https://www.facebook.com/reel/xxx',
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

        // ── Reaction ──
        try { await sock.sendMessage(jid, { react: { text: '📥', key: msg.key } }); } catch (_) {}

        // ── Detect platform ──
        const platform = detectPlatform(url);

        try {
            let result;

            switch (platform) {
                case 'youtube': {
                    result = await downloadYouTube(url, quality);
                    if (!result.url) throw new Error('No video URL found');

                    await sendMedia(sock, jid, result.url, result.title, `YouTube (${quality})`, url, msg);
                    break;
                }

                case 'twitter': {
                    result = await downloadTwitter(url);
                    if (!result.urls || result.urls.length === 0) throw new Error('No media found');

                    for (let i = 0; i < result.urls.length; i++) {
                        await sendMedia(sock, jid, result.urls[i], result.title, result.platform, url, msg, i === 0);
                        if (i < result.urls.length - 1) {
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                    break;
                }

                case 'pinterest': {
                    result = await downloadPinterest(url);
                    if (!result.urls || result.urls.length === 0) throw new Error('No media found');

                    for (let i = 0; i < result.urls.length; i++) {
                        await sendMedia(sock, jid, result.urls[i], result.title, result.platform, url, msg, i === 0);
                        if (i < result.urls.length - 1) {
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                    break;
                }

                case 'facebook': {
                    result = await downloadFacebook(url);
                    if (!result.urls || result.urls.length === 0) throw new Error('No media found');

                    for (let i = 0; i < result.urls.length; i++) {
                        await sendMedia(sock, jid, result.urls[i], result.title, result.platform, url, msg, i === 0);
                        if (i < result.urls.length - 1) {
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                    break;
                }

                default: {
                    throw new Error(`Platform not supported. Use YouTube, Twitter/X, Pinterest, or Facebook URLs.`);
                }
            }

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ dl error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            await sock.sendMessage(jid, {
                text:
                    '❌ *Download Failed*\n\n' +
                    `${err.message}\n\n` +
                    'Use The .aio command if you need it quickly\n' +
                    '⚡ Make sure:\n' +
                    '• The URL is valid and public\n' +
                    '• The platform is supported\n' +
                    '• The content is accessible',
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
