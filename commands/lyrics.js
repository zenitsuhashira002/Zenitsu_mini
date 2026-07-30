// ./commands/lyrics.js

const axios = require('axios');

// ═══════════════════════════════════════
// LYRICS APIS (ordered by priority)
// ═══════════════════════════════════════

const LYRICS_APIS = [
    {
        name: 'Prince tech Lyrics',
        url: (query) => `https://api.princetechn.com/api/search/lyrics?apikey=prince&query=${encodeURIComponent(query)}`,
        extract: (data) => ({
            title: data?.result?.title || '',
            artist: data?.result?.artist || '',
            lyrics: data?.result?.lyrics || '',
            image: data?.result?.image || '',
            link: data?.result?.link || '',
            source: 'Prince tech',
        }),
    },
    {
        name: 'Prince Tech Lyrics v2',
        url: (query) => `https://api.princetechn.com/api/search/lyricsv2?apikey=prince&query=${encodeURIComponent(query)}`,
        extract: (data) => ({
            title: data?.result?.title || data?.title || '',
            artist: data?.result?.artist || data?.artist || '',
            lyrics: data?.result?.lyrics || data?.lyrics || '',
            image: data?.result?.image || data?.image || '',
            link: data?.result?.link || data?.link || '',
            source: 'Prince V2',
        }),
    },
    {
        name: 'Nexor Lyrics',
        url: (query) => `https://api.nexor.my.id/api/search/lyrics?query=${encodeURIComponent(query)}`,
        extract: (data) => ({
            title: data?.result?.title || data?.title || '',
            artist: data?.result?.artist || data?.artist || '',
            lyrics: data?.result?.lyrics || data?.lyrics || '',
            image: data?.result?.image || data?.image || '',
            link: data?.result?.link || '',
            source: 'Nexor',
        }),
    },
    {
        name: 'YanzBotz Lyrics',
        url: (query) => `https://api.yanzbotz.my.id/api/search/lyrics?query=${encodeURIComponent(query)}`,
        extract: (data) => ({
            title: data?.result?.title || data?.title || '',
            artist: data?.result?.artist || data?.artist || '',
            lyrics: data?.result?.lyrics || data?.lyrics || '',
            image: data?.result?.image || data?.image || '',
            link: data?.result?.link || '',
            source: 'YanzBotz',
        }),
    },
    {
        name: 'Aemt Lyrics',
        url: (query) => `https://aemt.me/api/search/lyrics?query=${encodeURIComponent(query)}`,
        extract: (data) => ({
            title: data?.result?.title || data?.title || '',
            artist: data?.result?.artist || data?.artist || '',
            lyrics: data?.result?.lyrics || data?.lyrics || '',
            image: data?.result?.image || data?.image || '',
            link: data?.result?.link || '',
            source: 'Aemt',
        }),
    },
];

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'lyrics',
    aliases: ['lyric', 'letra', 'songtext', 'paroles'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text:
                    '🎵 *Lyrics Finder*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.lyrics <song name> | <artist>\n' +
                    '.lyrics <song name>\n\n' +
                    '✨ *Examples:*\n' +
                    '.lyrics Dynasty | MIIA\n' +
                    '.lyrics Faded Alan Walker\n' +
                    '.lyrics Blinding Lights\n\n' +
                    '💡 Add artist name for better results.\n' +
                    '🔄 Multiple sources for fallback.',
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

        // Format query: if "Title | Artist", keep as is
        let searchQuery = query;
        if (query.includes('|')) {
            const parts = query.split('|');
            searchQuery = `${parts[0].trim()} ${parts[1].trim()}`;
        }

        // ── Reaction ──
        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        // ── Try all APIs ──
        let result = null;
        let usedSource = '';

        for (const api of LYRICS_APIS) {
            try {
                console.log(`🔄 Trying ${api.name}...`);

                const { data } = await axios.get(api.url(searchQuery), { timeout: 20000 });

                const extracted = api.extract(data);

                if (extracted.lyrics && extracted.lyrics.trim().length > 20) {
                    result = extracted;
                    usedSource = api.name;
                    console.log(`✅ Success with ${api.name}`);
                    break;
                }
            } catch (err) {
                console.log(`⚠️ ${api.name} failed: ${err.message}`);
            }
        }

        // ── No results ──
        if (!result || !result.lyrics) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            return sock.sendMessage(jid, {
                text:
                    '❌ *Lyrics Not Found*\n\n' +
                    `No lyrics found for "${query}".\n\n` +
                    '💡 *Tips:*\n' +
                    '• Include the artist name\n' +
                    '• Check spelling\n' +
                    '• Try: Title | Artist\n\n' +
                    '⚡ _Zenitsu Lyrics Finder_',
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

        // ── Format lyrics ──
        const maxLyrics = 2500;
        const lyrics = result.lyrics.length > maxLyrics
            ? result.lyrics.substring(0, maxLyrics) + '\n\n... (truncated)'
            : result.lyrics;

        // ── Build caption ──
        let caption = '';
        caption += `🎵 *${result.title || 'Unknown'}*\n`;
        caption += `🎤 *Artist:* ${result.artist || 'Unknown'}\n`;
        caption += `🔍 *Source:* ${usedSource}\n`;
        if (result.link) caption += `🔗 ${result.link}\n`;
        caption += `\n📝 *Lyrics:*\n${lyrics}\n\n`;
        caption += '⚡ _Zenitsu Lyrics Finder_';

        // ── Send with or without image ──
        if (result.image && result.image.startsWith('http')) {
            try {
                await sock.sendMessage(jid, {
                    image: { url: result.image },
                    caption: caption,
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
            } catch (imgErr) {
                // Fallback: text only
                await sock.sendMessage(jid, {
                    text: caption,
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
                text: caption,
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
    },
};
