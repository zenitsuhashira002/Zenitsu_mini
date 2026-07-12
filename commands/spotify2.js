// ./commands/spotify.js

const axios = require('axios');

// ═══════════════════════════════════════
// STORE ACTIVE SEARCHES
// ═══════════════════════════════════════

const activeSearches = new Map();

// ═══════════════════════════════════════
// SEARCH APIS (ordered by priority)
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

            return results.map(item => ({
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
        name: 'Yupra',
        url: (query) => `https://api.yupra.my.id/api/search/spotify?q=${encodeURIComponent(query)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;

            return results.map(item => ({
                title: item.title || item.name || 'Unknown',
                artist: item.artist || item.artists || item.author || 'Unknown',
                url: item.url || item.link || item.track_url || '',
                album: item.album || '',
                duration: item.duration || '',
                image: item.image || item.thumbnail || '',
            }));
        },
    },
    {
        name: 'Nexor',
        url: (query) => `https://api.nexor.my.id/api/search/spotify?query=${encodeURIComponent(query)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;

            return results.map(item => ({
                title: item.title || item.name || 'Unknown',
                artist: item.artist || item.artists || 'Unknown',
                url: item.url || item.link || '',
                album: item.album || '',
                duration: item.duration || '',
                image: item.image || item.thumbnail || '',
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

            return results.map(item => ({
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
// DOWNLOAD APIS (ordered by priority)
// ═══════════════════════════════════════

const DOWNLOAD_APIS = [
    {
        name: 'GiftedTech v4',
        url: (trackUrl) => `https://api.giftedtech.co.ke/api/download/spotifydlv4?apikey=gifted&url=${encodeURIComponent(trackUrl)}`,
        timeout: 30000,
        extract: (data) => {
            return data?.result?.download_url || data?.result?.url || data?.url || data?.link || data?.download_url || null;
        },
    },
    {
        name: 'Yupra',
        url: (trackUrl) => `https://api.yupra.my.id/api/downloader/spotify?url=${encodeURIComponent(trackUrl)}`,
        timeout: 30000,
        extract: (data) => {
            return data?.result?.download_url || data?.result?.url || data?.url || data?.link || data?.download_url || null;
        },
    },
    {
        name: 'GiftedTech',
        url: (trackUrl) => `https://api.giftedtech.co.ke/api/download/spotifydlv2?apikey=gifted&url=${encodeURIComponent(trackUrl)}`,
        timeout: 30000,
        extract: (data) => {
            return data?.result?.download_url || data?.result?.url || data?.url || data?.link || null;
        },
    },
    {
        name: 'Nexor',
        url: (trackUrl) => `https://api.nexor.my.id/api/download/spotify?url=${encodeURIComponent(trackUrl)}`,
        timeout: 30000,
        extract: (data) => {
            return data?.result?.download_url || data?.result?.url || data?.url || data?.link || null;
        },
    },
    {
        name: 'YanzBotz',
        url: (trackUrl) => `https://api.yanzbotz.my.id/api/download/spotify?url=${encodeURIComponent(trackUrl)}`,
        timeout: 30000,
        extract: (data) => {
            return data?.result?.download_url || data?.result?.url || data?.url || data?.link || null;
        },
    },
];

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
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'spotify2',
    aliases: ['spotifydl', 'spdl', 'spotifysearch'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const input = args.join(' ');

        // ═══════════════════════════════════
        // HELP
        // ═══════════════════════════════════

        if (!input || input.trim().length < 1) {
            return sock.sendMessage(jid, {
                text:
                    '🎵 *Spotify Search & Download*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.spotify2 <song name>\n' +
                    '.spotify2 <number> (to download)\n\n' +
                    '✨ *Examples:*\n' +
                    '.spotify2 Blinding Lights\n' +
                    '.spotify2 set fire to the rain\n' +
                    '.spotify2 1\n\n' +
                    '🔄 *Multiple sources for fallback*',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════════════════════
        // NUMBER → DOWNLOAD
        // ═══════════════════════════════════

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

        // ═══════════════════════════════
        // TEXT → SEARCH WITH FALLBACKS
        // ═══════════════════════════════

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
                    console.log(`✅ Spotify search success: ${api.name} (${results.length} results)`);
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
                    `No Spotify tracks found for "${input}".\n\n` +
                    '💡 Try a different search term.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Store results
        const maxResults = Math.min(allResults.length, 5);
        const cleanedResults = allResults.slice(0, maxResults).map(item => ({
            title: item.title || 'Unknown',
            artist: item.artist || 'Unknown',
            url: item.url || '',
            album: item.album || '',
            duration: item.duration || '',
            image: item.image || '',
        }));

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
            '📌 *Reply:* .spotify2 <number>\n' +
            '⚡ _Example: .spotify2 1_\n\n' +
            '⏳ Results expire in 5 minutes.';

        // Send with first result's image if available
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
// DOWNLOAD WITH FALLBACKS
// ═══════════════════════════════════════

async function downloadTrack(sock, msg, jid, track) {
    let downloadUrl = null;
    let usedSource = '';

    for (const api of DOWNLOAD_APIS) {
        try {
            console.log(`⬇️ Spotify download: ${api.name}...`);

            const { data } = await axios.get(api.url(track.url), { timeout: api.timeout });
            downloadUrl = api.extract(data);

            if (downloadUrl && downloadUrl.startsWith('http')) {
                usedSource = api.name;
                console.log(`✅ Spotify download success: ${api.name}`);
                break;
            }
        } catch (err) {
            console.log(`⚠️ ${api.name} failed: ${err.message}`);
        }
    }

    if (!downloadUrl) {
        try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

        return sock.sendMessage(jid, {
            text:
                '❌ *Download Failed*\n\n' +
                `Could not download "${track.title}".\n\n` +
                '⚡ All download sources are unavailable.\n' +
                'Try another track or try again later.',
            contextInfo: STYLE,
        }, { quoted: msg });
    }

    try {
        // Download audio
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
                `🔧 *Source:* ${usedSource}\n` +
                `🔗 ${track.url}\n\n` +
                '⚡ _Downloaded by Zenitsu_',
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (err) {
        console.error('❌ Audio download error:', err.message);
        try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

        await sock.sendMessage(jid, {
            text:
                '❌ *Download Failed*\n\n' +
                `${err.message}\n\n` +
                '⚡ Try another result.',
            contextInfo: STYLE,
        }, { quoted: msg });
    }
}
