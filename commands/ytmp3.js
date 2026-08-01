// ./commands/ytmp3.js

const axios = require('axios');

// ═══════════════════════════════════════
// STYLE
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
// APIS DE RECHERCHE
// ═══════════════════════════════════════

const SEARCH_APIS = [
    {
        name: 'NexRay',
        fn: async (q) => {
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/search/youtube?q=${encodeURIComponent(q)}`,
                { timeout: 15000 }
            );
            if (data?.result?.length > 0) {
                const first = data.result[0];
                return first.url || `https://youtube.com/watch?v=${first.id}`;
            }
            return null;
        }
    },
    {
        name: 'Neosoft',
        fn: async (q) => {
            const { data } = await axios.get(
                `https://api.neosoft.best/api/search/youtube?q=${encodeURIComponent(q)}`,
                { timeout: 15000 }
            );
            if (data?.results?.length > 0) {
                return data.results[0].url;
            }
            return null;
        }
    },
    {
        name: 'DavidCyril',
        fn: async (q) => {
            const { data } = await axios.get(
                `https://apis.davidcyriltech.my.id/youtube/search?query=${encodeURIComponent(q)}`,
                { timeout: 15000 }
            );
            if (data?.results?.length > 0) {
                return `https://youtube.com/watch?v=${data.results[0].videoId}`;
            }
            return null;
        }
    }
];

// ═══════════════════════════════════════
// APIS DE TÉLÉCHARGEMENT (ordre de priorité)
// ═══════════════════════════════════════

const DOWNLOAD_APIS = [
    // 1. PrinceTech (meilleure qualité)
    {
        name: 'PrinceTech',
        fn: async (url) => {
            const { data } = await axios.get(
                `https://api.princetechn.com/api/download/ytmusic?apikey=prince&quality=mp3&url=${encodeURIComponent(url)}`,
                { timeout: 60000 }
            );
            if (data?.success && data?.result?.download_url) {
                return {
                    downloadUrl: data.result.download_url,
                    title: data.result.title,
                    duration: data.result.quality || '320kbps',
                    thumbnail: data.result.thumbnail,
                };
            }
            return null;
        }
    },
    // 2. Sylphy
    {
        name: 'Sylphy',
        fn: async (url) => {
            const { data } = await axios.get(
                `https://sylphyy.xyz/download/ytmp3?url=${encodeURIComponent(url)}`,
                { timeout: 60000 }
            );
            if (data?.status && data?.result?.dl_url) {
                return {
                    downloadUrl: data.result.dl_url,
                    title: data.result.title || 'YouTube Audio',
                    duration: data.result.duration || 'Unknown',
                    thumbnail: data.result.thumbnail || '',
                };
            }
            return null;
        }
    },
    // 3. NexRay (ytmp3)
    {
        name: 'NexRay YTMP3',
        fn: async (url) => {
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/downloader/ytmp3?url=${encodeURIComponent(url)}`,
                { timeout: 60000 }
            );
            if (data?.status && data?.result?.url) {
                return {
                    downloadUrl: data.result.url,
                    title: data.result.title,
                    duration: data.result.duration ? `${data.result.duration}s` : 'Unknown',
                    thumbnail: data.result.thumbnail || '',
                };
            }
            return null;
        }
    },
    // 4. NexRay (ytplay)
    {
        name: 'NexRay YTPlay',
        fn: async (url) => {
            // Pour ytplay, on extrait l'ID de la vidéo
            const videoId = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
            if (!videoId) return null;
            
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/downloader/ytplay?q=${videoId}`,
                { timeout: 60000 }
            );
            if (data?.status && data?.result?.download_url) {
                return {
                    downloadUrl: data.result.download_url,
                    title: data.result.title,
                    duration: data.result.duration || 'Unknown',
                    thumbnail: data.result.thumbnail || '',
                };
            }
            return null;
        }
    },
    // 5. NeoSoft
    {
        name: 'NeoSoft',
        fn: async (url) => {
            const { data } = await axios.get(
                `https://api.neosoft.best/api/downloader/youtube?url=${encodeURIComponent(url)}&type=mp3`,
                { timeout: 60000 }
            );
            if (data?.status && data?.download) {
                return {
                    downloadUrl: data.download,
                    title: data.title,
                    duration: data.duration ? `${data.duration}s` : 'Unknown',
                    thumbnail: data.thumbnail || '',
                };
            }
            return null;
        }
    },
    // 6. NexRay (v1)
    {
        name: 'NexRay V1',
        fn: async (url) => {
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/downloader/v1/ytmp3?url=${encodeURIComponent(url)}`,
                { timeout: 60000 }
            );
            if (data?.status && data?.result?.url) {
                return {
                    downloadUrl: data.result.url,
                    title: data.result.title,
                    duration: data.result.duration ? `${data.result.duration}s` : 'Unknown',
                    thumbnail: data.result.thumbnail || '',
                };
            }
            return null;
        }
    },
    // 7. DavidCyril
    {
        name: 'DavidCyril',
        fn: async (url) => {
            const { data } = await axios.get(
                `https://apis.davidcyriltech.my.id/download/ytmp333?url=${encodeURIComponent(url)}`,
                { timeout: 60000 }
            );
            if (data?.result?.download_url) {
                return {
                    downloadUrl: data.result.download_url,
                    title: data.result.title,
                    duration: data.result.duration || 'Unknown',
                    thumbnail: data.result.thumbnail || '',
                };
            }
            return null;
        }
    },
    // 8. GiftedTech (fallback final)
    {
        name: 'GiftedTech',
        fn: async (url) => {
            const { data } = await axios.get(
                `https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(url)}`,
                { timeout: 60000 }
            );
            if (data?.result?.download_url) {
                return {
                    downloadUrl: data.result.download_url,
                    title: data.result.title,
                    duration: data.result.duration || 'Unknown',
                    thumbnail: data.result.thumbnail || '',
                };
            }
            return null;
        }
    }
];

// ═══════════════════════════════════════
// COMMANDE PRINCIPALE
// ═══════════════════════════════════════

module.exports = {
    name: 'ytmp3',
    aliases: ['music', 'song', 'youtube', 'yt'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 1) {
            return sock.sendMessage(jid, {
                text:
                    '🎵 *YouTube Music Downloader*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.ytmp3 <YouTube URL or song name>\n\n' +
                    '✨ *Examples:*\n' +
                    '.ytmp3 https://youtube.com/watch?v=dQw4w9WgXcQ\n' +
                    '.ytmp3 Alan Walker Faded\n' +
                    '.ytmp3 Never Gonna Give You Up\n\n' +
                    '🔧 *8+ download sources with fallback*',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ── Reaction ──
        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        let youtubeUrl = query;
        let searchUsed = '';

        // Vérifier si c'est une URL YouTube
        const isUrl = query.includes('youtube.com') || query.includes('youtu.be');

        if (!isUrl) {
            // Recherche
            try { await sock.sendMessage(jid, { react: { text: '🔎', key: msg.key } }); } catch (_) {}

            let found = false;
            for (const api of SEARCH_APIS) {
                try {
                    const result = await api.fn(query);
                    if (result) {
                        youtubeUrl = result;
                        searchUsed = api.name;
                        found = true;
                        console.log(`✅ Search: ${api.name}`);
                        break;
                    }
                } catch (err) {
                    console.log(`⚠️ Search ${api.name}: ${err.message}`);
                }
            }

            if (!found) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: '❌ *No results found*\n\n' +
                          'Try with a direct YouTube URL.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
        }

        // ── Téléchargement ──
        try { await sock.sendMessage(jid, { react: { text: '⬇️', key: msg.key } }); } catch (_) {}

        let audioData = null;
        let usedApi = '';

        for (const api of DOWNLOAD_APIS) {
            try {
                console.log(`⬇️ Trying ${api.name}...`);
                const result = await api.fn(youtubeUrl);
                if (result && result.downloadUrl) {
                    audioData = result;
                    usedApi = api.name;
                    console.log(`✅ Download: ${api.name}`);
                    break;
                }
            } catch (err) {
                console.log(`⚠️ Download ${api.name}: ${err.message}`);
            }
        }

        if (!audioData || !audioData.downloadUrl) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, {
                text: '❌ *All download sources failed*\n\n' +
                      'Try again later or use another song.\n' +
                      `🔍 Search: ${searchUsed || 'N/A'}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ── Télécharger le fichier ──
        try { await sock.sendMessage(jid, { react: { text: '📥', key: msg.key } }); } catch (_) {}

        let audioBuffer;
        let sizeMB = 0;

        try {
            const audioRes = await axios.get(audioData.downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 120000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });
            audioBuffer = Buffer.from(audioRes.data);
            sizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
            
            if (audioBuffer.length < 50000) {
                throw new Error('File too small, likely corrupt');
            }
        } catch (err) {
            console.error('❌ Download file error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, {
                text: '❌ *Failed to download audio file*\n\n' +
                      `${err.message}\n\n` +
                      'Try again with a different link.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ── Envoyer l'audio ──
        try { await sock.sendMessage(jid, { react: { text: '📤', key: msg.key } }); } catch (_) {}

        const title = audioData.title || 'YouTube Audio';
        const duration = audioData.duration || 'Unknown';
        const thumbnail = audioData.thumbnail || '';

        try {
            await sock.sendMessage(jid, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: false,
                fileName: `${title.substring(0, 100)}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: title.substring(0, 100),
                        body: `Duration: ${duration}`,
                        thumbnailUrl: thumbnail,
                        sourceUrl: youtubeUrl,
                        mediaType: 1,
                        renderLargerThumbnail: true,
                    },
                },
            }, { quoted: msg });

            // ── Message d'info ──
            await sock.sendMessage(jid, {
                text:
                    '🎵 *Music Downloaded*\n\n' +
                    `📌 *Title:* ${title}\n` +
                    `⏱ *Duration:* ${duration}\n` +
                    `📦 *Size:* ${sizeMB} MB\n` +
                    `🔧 *Source:* ${usedApi}\n` +
                    `🔗 ${youtubeUrl}\n\n` +
                    '⚡ _Powered by Zenitsu AI_',
                contextInfo: STYLE,
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ Send audio error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, {
                text: '❌ *Failed to send audio*\n\n' +
                      `${err.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
