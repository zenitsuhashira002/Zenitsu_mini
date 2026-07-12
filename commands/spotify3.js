// ./commands/spotify2.js

const axios = require('axios');

// ═══════════════════════════════════════
// STORE ACTIVE SEARCHES
// ═══════════════════════════════════════

const activeSearches = new Map();

// ═══════════════════════════════════════
// SEARCH APIS (ordered)
// ═══════════════════════════════════════

const SEARCH_APIS = [
    {
        name: 'GiftedTech',
        url: (query) => `https://api.giftedtech.co.ke/api/search/spotifysearch?apikey=gifted&query=${encodeURIComponent(query)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.results && Array.isArray(data.results)) results = data.results;
            else if (Array.isArray(data)) results = data;
            return results.slice(0, 5).map(item => ({
                title: item.title || item.name || 'Unknown',
                artist: item.artist || item.artists || item.author || 'Unknown',
                url: item.url || item.link || item.track_url || '',
                album: item.album || '',
                duration: item.duration || item.timestamp || '',
                image: item.image || item.thumbnail || item.cover || '',
            }));
        },
    },
    {
        name: 'NexRay',
        url: (query) => `https://api.nexray.eu.cc/search/spotify?q=${encodeURIComponent(query)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;
            return results.slice(0, 5).map(item => ({
                title: item.title || item.name || 'Unknown',
                artist: item.artist || item.artists || item.author || 'Unknown',
                url: item.url || item.link || item.track_url || '',
                album: item.album || '',
                duration: item.duration || '',
                image: item.image || item.thumbnail || item.cover || '',
            }));
        },
    },
    {
        name: 'Yupra',
        url: (query) => `https://api.yupra.my.id/api/search/spotify?q=${encodeURIComponent(query)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;
            return results.slice(0, 5).map(item => ({
                title: item.title || item.name || 'Unknown',
                artist: item.artist || item.artists || item.author || 'Unknown',
                url: item.url || item.link || item.track_url || '',
                album: item.album || '',
                duration: item.duration || '',
                image: item.image || item.thumbnail || item.cover || '',
            }));
        },
    },
    {
        name: 'YanzBotz',
        url: (query) => `https://api.yanzbotz.my.id/api/search/spotify?query=${encodeURIComponent(query)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;
            return results.slice(0, 5).map(item => ({
                title: item.title || item.name || 'Unknown',
                artist: item.artist || item.artists || 'Unknown',
                url: item.url || item.link || '',
                album: item.album || '',
                duration: item.duration || '',
                image: item.image || item.thumbnail || '',
            }));
        },
    },
];

// ═══════════════════════════════════════
// DOWNLOAD APIS (ordered)
// ═══════════════════════════════════════

function getDownloadMethods(trackUrl) {
    const encoded = encodeURIComponent(trackUrl);
    return [
        {
            name: 'GiftedTech v4',
            fn: async () => {
                const { data } = await axios.get(
                    `https://api.giftedtech.co.ke/api/download/spotifydlv4?apikey=gifted&url=${encoded}`,
                    { timeout: 30000 }
                );
                return extractDownloadUrl(data);
            },
        },
        {
            name: 'PrinceTech',
            fn: async () => {
                const { data } = await axios.get(
                    `https://api.princetechn.com/api/download/spotifydl?apikey=prince&url=${encoded}`,
                    { timeout: 30000 }
                );
                return extractDownloadUrl(data);
            },
        },
        {
            name: 'NexRay Spotify',
            fn: async () => {
                const { data } = await axios.get(
                    `https://api.nexray.eu.cc/downloader/spotify?url=${encoded}`,
                    { timeout: 30000 }
                );
                return extractDownloadUrl(data);
            },
        },
        {
            name: 'NexRay Playlist',
            fn: async () => {
                const { data } = await axios.get(
                    `https://api.nexray.eu.cc/downloader/spotifyplay?q=${encoded}`,
                    { timeout: 30000 }
                );
                return extractDownloadUrl(data);
            },
        },
        {
            name: 'Yupra',
            fn: async () => {
                const { data } = await axios.get(
                    `https://api.yupra.my.id/api/downloader/spotify?url=${encoded}`,
                    { timeout: 30000 }
                );
                return extractDownloadUrl(data);
            },
        },
        {
            name: 'YanzBotz',
            fn: async () => {
                const { data } = await axios.get(
                    `https://api.yanzbotz.my.id/api/download/spotify?url=${encoded}`,
                    { timeout: 30000 }
                );
                return extractDownloadUrl(data);
            },
        },
        {
            name: 'Nexor',
            fn: async () => {
                const { data } = await axios.get(
                    `https://api.nexor.my.id/api/download/spotify?url=${encoded}`,
                    { timeout: 30000 }
                );
                return extractDownloadUrl(data);
            },
        },
    ];
}

function extractDownloadUrl(data) {
    let url = null;
    if (data?.result?.download_url) url = data.result.download_url;
    else if (data?.result?.url) url = data.result.url;
    else if (data?.url) url = data.url;
    else if (data?.link) url = data.link;
    else if (data?.download_url) url = data.download_url;
    else if (typeof data === 'string' && data.startsWith('http')) url = data;
    if (url && url.startsWith('http')) return url;
    throw new Error('No download URL');
}

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
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'spotify3',
    aliases: ['sp2', 'spdl2', 'spotifysearch2'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const input = args.join(' ');

        // ═══════════════════
        // HELP
        // ═══════════════════
        if (!input || input.trim().length < 1) {
            return sock.sendMessage(jid, {
                text:
                    '🎵 *Spotify Search & Download v2*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.spotify3 <song name>\n' +
                    '.spotify3 <number> (to download)\n\n' +
                    '✨ *Examples:*\n' +
                    '.spotify3 Blinding Lights\n' +
                    '.spotify3 1\n\n' +
                    '🔄 *Search:* 4 sources\n' +
                    '⬇️ *Download:* 7 sources\n' +
                    '💡 Search → pick number → auto-download.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // NUMBER → DOWNLOAD
        // ═══════════════════
        const numberMatch = input.match(/^(\d+)$/);

        if (numberMatch) {
            const selectedIndex = parseInt(numberMatch[1]) - 1;
            const stored = activeSearches.get(senderJid);

            if (!stored || !stored.results || stored.results.length === 0) {
                return sock.sendMessage(jid, {
                    text: '⚠️ *No active search*\n\nUse .spotify2 <song name> first.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            if (selectedIndex < 0 || selectedIndex >= stored.results.length) {
                return sock.sendMessage(jid, {
                    text: `⚠️ Choose between 1 and ${stored.results.length}.`,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const selected = stored.results[selectedIndex];

            try { await sock.sendMessage(jid, { react: { text: '⬇️', key: msg.key } }); } catch (_) {}

            return downloadTrack(sock, msg, jid, selected);
        }

        // ═══════════════════
        // TEXT → SEARCH
        // ═══════════════════
        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        let allResults = [];
        let usedSource = '';

        for (const api of SEARCH_APIS) {
            try {
                console.log(`🔍 Spotify search: ${api.name}...`);
                const { data } = await axios.get(api.url(input), { timeout: api.timeout });
                const results = api.extract(data);

                if (results && results.length > 0) {
                    allResults = results;
                    usedSource = api.name;
                    console.log(`✅ Found ${results.length} results via ${api.name}`);
                    break;
                }
            } catch (err) {
                console.log(`⚠️ ${api.name} failed: ${err.message}`);
            }
        }

        if (allResults.length === 0) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, {
                text:
                    '❌ *No Results Found*\n\n' +
                    `No tracks found for "${input}".\n\n` +
                    '💡 Try a different search term.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Store results
        const maxResults = Math.min(allResults.length, 5);
        const cleanedResults = allResults.slice(0, maxResults);

        activeSearches.set(senderJid, {
            results: cleanedResults,
            timestamp: Date.now(),
        });

        // Build response
        let replyText = `🎵 *Spotify — ${input}*\n`;
        replyText += `🔍 *Source:* ${usedSource}\n\n`;

        cleanedResults.forEach((item, i) => {
            replyText += `*${i + 1}.* ${item.title}\n`;
            replyText += `   🎤 ${item.artist}\n`;
            if (item.album) replyText += `   💿 ${item.album}\n`;
            if (item.duration) replyText += `   ⏱ ${item.duration}\n`;
            replyText += '\n';
        });

        replyText +=
            '📌 *Reply:* .spotify3 <number>\n' +
            '⚡ _Example: .spotify3 1_\n\n' +
            '⏳ Results expire in 5 minutes.';

        // Send with image if available
        const firstImage = cleanedResults[0]?.image;
        if (firstImage && firstImage.startsWith('http')) {
            try {
                await sock.sendMessage(jid, {
                    image: { url: firstImage },
                    caption: replyText,
                    contextInfo: STYLE,
                }, { quoted: msg });
            } catch (_) {
                await sock.sendMessage(jid, { text: replyText, contextInfo: STYLE }, { quoted: msg });
            }
        } else {
            await sock.sendMessage(jid, { text: replyText, contextInfo: STYLE }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        // Auto-clean after 5 minutes
        setTimeout(() => {
            const stored = activeSearches.get(senderJid);
            if (stored && Date.now() - stored.timestamp > 300000) {
                activeSearches.delete(senderJid);
            }
        }, 300000);
    },
};

// ═══════════════════════════════════════
// DOWNLOAD TRACK WITH ALL FALLBACKS
// ═══════════════════════════════════════

async function downloadTrack(sock, msg, jid, track) {
    if (!track.url) {
        try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        return sock.sendMessage(jid, {
            text: '❌ *No URL available* for this track.',
            contextInfo: STYLE,
        }, { quoted: msg });
    }

    const methods = getDownloadMethods(track.url);
    let downloadUrl = null;
    let usedMethod = '';

    for (const method of methods) {
        try {
            console.log(`⬇️ Trying ${method.name}...`);
            downloadUrl = await method.fn();
            if (downloadUrl) {
                usedMethod = method.name;
                console.log(`✅ Download via ${method.name}`);
                break;
            }
        } catch (err) {
            console.log(`⚠️ ${method.name} failed: ${err.message}`);
        }
    }

    if (!downloadUrl) {
        try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        return sock.sendMessage(jid, {
            text:
                '❌ *Download Failed*\n\n' +
                `All 7 sources failed for "${track.title}".\n\n` +
                '⚡ Try another track.',
            contextInfo: STYLE,
        }, { quoted: msg });
    }

    // Download the audio file
    try {
        const audioRes = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
        });

        const buffer = Buffer.from(audioRes.data);
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        // Send audio
        await sock.sendMessage(jid, {
            audio: buffer,
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: `${track.title.substring(0, 100)}.mp3`,
        }, { quoted: msg });

        // Send info
        await sock.sendMessage(jid, {
            text:
                '🎵 *Spotify Download*\n\n' +
                `📌 *Title:* ${track.title}\n` +
                `🎤 *Artist:* ${track.artist}\n` +
                (track.album ? `💿 *Album:* ${track.album}\n` : '') +
                (track.duration ? `⏱ *Duration:* ${track.duration}\n` : '') +
                `📦 *Size:* ${sizeMB} MB\n` +
                `🔧 *Source:* ${usedMethod}\n` +
                `🔗 ${track.url}\n\n` +
                '⚡ _Downloaded by Zenitsu_',
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (err) {
        console.error('❌ Audio download error:', err.message);
        try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        await sock.sendMessage(jid, {
            text: '❌ *Download Failed*\n\nCould not download the audio file.',
            contextInfo: STYLE,
        }, { quoted: msg });
    }
}
