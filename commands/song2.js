// ./commands/song.js

const axios = require('axios');

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

const FALLBACK_THUMB = 'https://iili.io/COzVllj.jpg';

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
            };
        },
    },
    {
        name: 'DavidCyril',
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
];

module.exports = {
    name: 'song2',
    aliases: ['ytmp3direct', 'musicdl', 'getmusic'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query) {
            return sock.sendMessage(jid, {
                text:
                    '🎵 *Direct Music Downloader*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.song <youtube_url or search>\n\n' +
                    '✨ *Examples:*\n' +
                    '.song2 https://youtube.com/watch?v=60ItHLz5WEA\n' +
                    '.song2 Faded Alan Walker\n\n' +
                    '🔄 5 download sources',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        let url = query;
        // Si pas une URL, rechercher
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            try {
                const { data } = await axios.get(`https://api.nexray.eu.cc/search/youtube?q=${encodeURIComponent(query)}`, { timeout: 15000 });
                if (data?.result?.[0]?.id) {
                    url = `https://youtube.com/watch?v=${data.result[0].id}`;
                }
            } catch (_) {}
        }

        try { await sock.sendMessage(jid, { react: { text: '🎵', key: msg.key } }); } catch (_) {}

        let dlResult = null;

        for (const api of DOWNLOAD_APIS) {
            try {
                console.log(`⬇️ Song: ${api.name}...`);
                dlResult = await api.fn(url);
                if (dlResult?.downloadUrl && dlResult.downloadUrl.startsWith('http')) {
                    console.log(`✅ Song: ${api.name}`);
                    break;
                }
            } catch (err) {
                console.log(`⚠️ Song ${api.name}: ${err.message}`);
            }
        }

        if (!dlResult?.downloadUrl) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, { text: '❌ All sources failed.', contextInfo: STYLE }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '⬇️', key: msg.key } }); } catch (_) {}

        const audioRes = await axios.get(dlResult.downloadUrl, { responseType: 'arraybuffer', timeout: 120000 });
        const buffer = Buffer.from(audioRes.data);
        const sizeMB = (buffer.length / 1048576).toFixed(2);

        const title = dlResult.title || query;
        const thumb = dlResult.thumbnail || FALLBACK_THUMB;

        // ⭐ Envoi audio avec nom ET image
        await sock.sendMessage(jid, {
            audio: buffer,
            mimetype: 'audio/mpeg',
            ptt: false,
            contextInfo: {
                externalAdReply: {
                    title: title,
                    body: dlResult.artist || 'YouTube Music',
                    thumbnailUrl: thumb,
                    sourceUrl: url,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                },
                ...STYLE,
            },
        }, { quoted: msg });

        // Message d'info
        await sock.sendMessage(jid, {
            text:
                '🎵 *Song Downloaded*\n\n' +
                `📌 *Title:* ${title}\n` +
                (dlResult.artist ? `🎤 *Artist:* ${dlResult.artist}\n` : '') +
                (dlResult.duration ? `⏱ *Duration:* ${Math.floor(dlResult.duration/60)}m ${dlResult.duration%60}s\n` : '') +
                `📦 *Size:* ${sizeMB} MB\n\n` +
                '⚡ _Zenitsu_',
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
