// ./commands/play.js

const axios = require('axios');
const { createReadStream } = require('fs');
const { Readable } = require('stream');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const QUALITIES = ['128kbps', '192kbps', '256kbps', '320kbps'];
const DEFAULT_QUALITY = '128kbps';
const MAX_DURATION_SECONDS = 600;
const FALLBACK_THUMB = 'https://iili.io/COzVllj.jpg';

const activeSearches = new Map();

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
// UTILS
// ═══════════════════════════════════════

function parseDuration(str) {
    if (!str) return 0;
    const s = String(str).trim();
    const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) return (parseInt(m[1])||0)*3600 + (parseInt(m[2])||0)*60 + (parseInt(m[3])||0);
    return 0;
}

function formatDuration(sec) {
    if (!sec) return 'Unknown';
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.floor(sec%60);
    return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ═══════════════════════════════════════
// SEARCH FALLBACKS
// ═══════════════════════════════════════

const SEARCH_APIS = [
    {
        name: 'NexRay',
        fn: async (q) => {
            const { data } = await axios.get(`https://api.nexray.eu.cc/search/youtube?q=${encodeURIComponent(q)}`, { timeout: 15000 });
            return (data?.result || []).map(r => ({
                title: r.title, url: `https://youtube.com/watch?v=${r.id}`,
                duration: r.duration, durationSeconds: r.seconds || parseDuration(r.duration),
                views: r.views, thumbnail: r.image_url || '', channel: r.channel || '',
            }));
        },
    },
    {
        name: 'DavidCyril',
        fn: async (q) => {
            const { data } = await axios.get(`https://apis.davidcyriltech.my.id/youtube/search?query=${encodeURIComponent(q)}`, { timeout: 15000 });
            return (data?.results || []).map(r => ({
                title: r.title, url: `https://youtube.com/watch?v=${r.videoId}`,
                duration: r.duration, durationSeconds: parseDuration(r.duration),
                views: r.views?.toString() || '', thumbnail: r.thumbnail || '',
            }));
        },
    },
    {
        name: 'ZellAPI',
        fn: async (q) => {
            const { data } = await axios.get(`https://zellapi.autos/search/youtube?q=${encodeURIComponent(q)}`, { timeout: 15000 });
            return (data?.result || []).map(r => ({
                title: r.title, url: `https://youtube.com/watch?v=${r.id}`,
                duration: r.duration, durationSeconds: parseDuration(r.duration),
                views: r.views, thumbnail: r.thumbnail || r.image_url || '',
            }));
        },
    },
    {
        name: 'Yupra',
        fn: async (q) => {
            const { data } = await axios.get(`https://api.yupra.my.id/api/search/youtube?q=${encodeURIComponent(q)}`, { timeout: 15000 });
            return (data?.results || []).map(r => ({
                title: r.title, url: `https://www.youtube.com/watch?v=${r.videoId}`,
                duration: r.duration, durationSeconds: r.seconds || parseDuration(r.duration),
                views: r.views || '', thumbnail: r.image_url || '',
            }));
        },
    },
    {
        name: 'GiftedTech',
        fn: async (q) => {
            const { data } = await axios.get(`https://api.giftedtech.co.ke/api/search/yts?apikey=gifted&query=${encodeURIComponent(q)}`, { timeout: 15000 });
            let results = data?.result || data?.results || (Array.isArray(data) ? data : []);
            return results.map(r => ({
                title: r.title || r.name, url: r.url || r.link || '',
                duration: r.duration || r.timestamp, durationSeconds: parseDuration(r.duration || r.timestamp),
                views: r.views || r.view_count, thumbnail: r.image_url || r.thumbnail || '',
            }));
        },
    },
];

// ═══════════════════════════════════════
// DOWNLOAD FALLBACKS
// ═══════════════════════════════════════

const DOWNLOAD_APIS = [
    {
        name: 'NeoSoft',
        fn: async (url) => {
            const { data } = await axios.get(`https://api.neosoft.best/api/downloader/youtube-play?q=${encodeURIComponent(url)}&type=mp3`, { timeout: 40000 });
            return {
                downloadUrl: data?.download || '',
                title: data?.title || '',
                artist: data?.artist || '',
                thumbnail: data?.thumbnail || FALLBACK_THUMB,
                duration: data?.duration || 0,
            };
        },
    },
    {
        name: 'NexRay YTPlay',
        fn: async (url) => {
            const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/ytplay?q=${encodeURIComponent(url)}`, { timeout: 40000 });
            return {
                downloadUrl: data?.result?.download_url || '',
                title: data?.result?.title || '',
                thumbnail: data?.result?.thumbnail || FALLBACK_THUMB,
                duration: data?.result?.seconds || 0,
            };
        },
    },
    {
        name: 'NexRay YTMP3',
        fn: async (url) => {
            const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/ytmp3?url=${encodeURIComponent(url)}`, { timeout: 40000 });
            return {
                downloadUrl: data?.result?.download_url || '',
                title: data?.result?.title || '',
                thumbnail: data?.result?.thumbnail || FALLBACK_THUMB,
                duration: data?.result?.seconds || 0,
            };
        },
    },
    {
        name: 'DavidCyril YTMP3',
        fn: async (url) => {
            const { data } = await axios.get(`https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(url)}`, { timeout: 40000 });
            return {
                downloadUrl: data?.result?.download_url || '',
                title: data?.result?.title || '',
                thumbnail: data?.result?.thumbnail || FALLBACK_THUMB,
            };
        },
    },
    {
        name: 'DavidCyril YTMP3V2',
        fn: async (url) => {
            const { data } = await axios.get(`https://apis.davidcyriltech.my.id/download/ytmp3v2?url=${encodeURIComponent(url)}`, { timeout: 40000 });
            return {
                downloadUrl: data?.result?.download_url || data?.download_url || '',
                title: data?.result?.title || data?.title || '',
                thumbnail: data?.result?.thumbnail || data?.thumbnail || FALLBACK_THUMB,
            };
        },
    },
    {
        name: 'Sylphy V2',
        fn: async (url) => {
            const { data } = await axios.get(`https://sylphyy.xyz/download/v2/ytmp3?url=${encodeURIComponent(url)}`, { timeout: 40000 });
            return {
                downloadUrl: data?.result?.dl_url || '',
                title: data?.result?.title || '',
                thumbnail: FALLBACK_THUMB,
            };
        },
    },
    {
        name: 'Aswin Sparky',
        fn: async (url) => {
            const { data } = await axios.get(`https://api-aswin-sparky.koyeb.app/api/downloader/ytv?url=${encodeURIComponent(url)}`, { timeout: 40000 });
            return {
                downloadUrl: data?.data?.url || '',
                title: data?.data?.title || '',
                thumbnail: FALLBACK_THUMB,
            };
        },
    },
    {
        name: 'PrinceTech',
        fn: async (url) => {
            const { data } = await axios.get(`https://api.princetechn.com/api/download/ytmp3?apikey=prince&url=${encodeURIComponent(url)}`, { timeout: 40000 });
            return {
                downloadUrl: data?.result?.download_url || data?.result?.url || data?.download_url || data?.url || '',
                title: data?.result?.title || data?.title || '',
                thumbnail: data?.result?.thumbnail || FALLBACK_THUMB,
            };
        },
    },
    {
        name: 'GiftedTech',
        fn: async (url) => {
            const { data } = await axios.get(`https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(url)}`, { timeout: 40000 });
            return {
                downloadUrl: data?.result?.download_url || data?.result?.url || data?.url || data?.link || data?.download_url || '',
                title: data?.result?.title || data?.title || '',
                thumbnail: data?.result?.thumbnail || data?.thumbnail || FALLBACK_THUMB,
            };
        },
    },
];

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'play',
    aliases: ['ytmp3', 'music', 'song', 'youtube', 'yts'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const input = args.join(' ');

        if (!input || input.trim().length < 1) {
            return sock.sendMessage(jid, {
                text:
                    '🎵 *YouTube Music Downloader*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.play <song name>\n' +
                    '.play <number> (to download)\n\n' +
                    '✨ *Examples:*\n' +
                    '.play Spectre\n' +
                    '.play Faded Alan Walker\n' +
                    '.play 1\n\n' +
                    '🔄 5 search + 9 download sources',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        const numberMatch = input.match(/^(\d+)$/);

        if (numberMatch) {
            const selectedIndex = parseInt(numberMatch[1]) - 1;
            const stored = activeSearches.get(senderJid);
            if (!stored?.results?.length) {
                return sock.sendMessage(jid, { text: '⚠️ No active search.', contextInfo: STYLE }, { quoted: msg });
            }
            if (selectedIndex < 0 || selectedIndex >= stored.results.length) {
                return sock.sendMessage(jid, { text: `⚠️ Choose 1-${stored.results.length}.`, contextInfo: STYLE }, { quoted: msg });
            }
            const selected = stored.results[selectedIndex];
            try { await sock.sendMessage(jid, { react: { text: '⬇️', key: msg.key } }); } catch (_) {}
            return downloadMusic(sock, msg, jid, selected, input);
        }

        // SEARCH
        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        let results = null;
        let searchSource = '';

        for (const api of SEARCH_APIS) {
            try {
                results = await api.fn(input);
                if (results?.length) {
                    searchSource = api.name;
                    console.log(`✅ Search: ${api.name} (${results.length})`);
                    break;
                }
            } catch (err) {
                console.log(`⚠️ Search ${api.name}: ${err.message}`);
            }
        }

        if (!results?.length) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, { text: '❌ No results found.', contextInfo: STYLE }, { quoted: msg });
        }

        const valid = results.filter(r => !r.durationSeconds || r.durationSeconds <= MAX_DURATION_SECONDS).slice(0, 5);
        const final = valid.length ? valid : results.slice(0, 5);

        activeSearches.set(senderJid, { results: final, timestamp: Date.now() });

        let reply = `🎵 *Search: ${input}*\n🎼 *Source:* ${searchSource}\n\n`;
        final.forEach((r, i) => {
            reply += `*${i + 1}.* ${r.title}\n   ⏱ ${formatDuration(r.durationSeconds)}`;
            if (r.views) reply += ` | 👁 ${r.views}`;
            if (r.channel) reply += ` | 📺 ${r.channel}`;
            reply += '\n\n';
        });
        reply += '📌 Reply: .play <number>\n⏳ Expires in 5 min.';

        await sock.sendMessage(jid, { text: reply, contextInfo: STYLE }, { quoted: msg });
        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        setTimeout(() => {
            if (activeSearches.get(senderJid)?.timestamp < Date.now() - 300000) activeSearches.delete(senderJid);
        }, 300000);
    },
};

// ═══════════════════════════════════════
// DOWNLOAD - VERSION CORRIGÉE
// ═══════════════════════════════════════

async function downloadMusic(sock, msg, jid, track, query) {
    // Envoyer un message de progression
    await sock.sendMessage(jid, {
        text: `⏳ *Downloading:* ${track.title}\n📥 Please wait...`,
        contextInfo: STYLE,
    }, { quoted: msg });

    let dlResult = null;
    let usedApi = '';

    // Essayer chaque API de téléchargement
    for (const api of DOWNLOAD_APIS) {
        try {
            console.log(`⬇️ Download: ${api.name}...`);
            dlResult = await api.fn(track.url);
            if (dlResult?.downloadUrl && dlResult.downloadUrl.startsWith('http')) {
                usedApi = api.name;
                console.log(`✅ Download: ${api.name}`);
                break;
            }
        } catch (err) {
            console.log(`⚠️ Download ${api.name}: ${err.message}`);
        }
    }

    if (!dlResult?.downloadUrl) {
        try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        return sock.sendMessage(jid, { 
            text: '❌ *All download sources failed.*\n\n💡 Try again later or use another song.',
            contextInfo: STYLE 
        }, { quoted: msg });
    }

    try { 
        await sock.sendMessage(jid, { react: { text: '⬇️', key: msg.key } }); 
    } catch (_) {}

    // TÉLÉCHARGER L'AUDIO
    let audioBuffer = null;
    let sizeMB = 0;
    
    try {
        console.log(`📥 Downloading audio from: ${dlResult.downloadUrl}`);
        
        const audioRes = await axios.get(dlResult.downloadUrl, { 
            responseType: 'arraybuffer', 
            timeout: 120000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        audioBuffer = Buffer.from(audioRes.data);
        sizeMB = (audioBuffer.length / 1048576).toFixed(2);
        
        console.log(`✅ Audio downloaded: ${sizeMB} MB`);
        
    } catch (err) {
        console.log(`❌ Audio download error: ${err.message}`);
        try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        return sock.sendMessage(jid, { 
            text: '❌ *Failed to download audio.*\n\n' +
                  `⚠️ Error: ${err.message}\n` +
                  '💡 Try again with a different song.',
            contextInfo: STYLE 
        }, { quoted: msg });
    }

    // Préparer les métadonnées
    const title = dlResult.title || track.title || query;
    const artist = dlResult.artist || track.channel || 'YouTube Music';
    const thumb = dlResult.thumbnail || track.thumbnail || FALLBACK_THUMB;
    const duration = track.durationSeconds || dlResult.duration || 0;

    try {
        // ENVOYER L'AUDIO AVEC CONTEXTE
        console.log(`📤 Sending audio: ${title}`);
        
        await sock.sendMessage(jid, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: `${title.slice(0, 100)}_zenitsu.mp3`,
            contextInfo: {
                externalAdReply: {
                    title: title.slice(0, 100),
                    body: artist.slice(0, 100),
                    thumbnailUrl: thumb,
                    sourceUrl: track.url || `https://youtube.com/watch?v=${track.id || ''}`,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    showAdAttribution: false,
                },
            },
        }, { quoted: msg });

        console.log(`✅ Audio sent successfully`);

        // Envoyer un message récapitulatif (plus court cette fois)
        await sock.sendMessage(jid, {
            text:
                '🎵 *Music Downloaded*\n\n' +
                `📌 *Title:* ${title.slice(0, 100)}${title.length > 100 ? '...' : ''}\n` +
                `🎤 *Artist:* ${artist.slice(0, 100)}${artist.length > 100 ? '...' : ''}\n` +
                (duration ? `⏱ *Duration:* ${formatDuration(duration)}\n` : '') +
                `📦 *Size:* ${sizeMB} MB\n` +
                `🔧 *Source:* ${usedApi}\n\n` +
                `⚡ _Powered by Zenitsu AI_`,
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (err) {
        console.log(`❌ Send audio error: ${err.message}`);
        try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        return sock.sendMessage(jid, { 
            text: '❌ *Failed to send audio.*\n\n' +
                  `⚠️ Error: ${err.message}\n` +
                  '💡 Try again or use a shorter song.',
            contextInfo: STYLE 
        }, { quoted: msg });
    }
}
