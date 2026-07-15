
// ./commands/tiksearch.js

const axios = require('axios');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const DEFAULT_COUNT = 6;
const MAX_COUNT = 10;
const MAX_VIDEO_SIZE = 10 * 1024 * 1024;

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
// SEARCH + DOWNLOAD DIRECT
// ═══════════════════════════════════════

const SEARCH_APIS = [
    {
        name: 'NexRay',
        url: (query) => `https://api.nexray.eu.cc/search/tiktok?q=${encodeURIComponent(query)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (Array.isArray(data)) results = data;
            return results.map(item => ({
                url: item.data || item.no_watermark || '',
                title: item.title || '',
                cover: item.cover || '',
                duration: item.duration || '',
            }));
        },
    },
    {
        name: 'PrinceTech',
        url: (query) => `https://api.princetechn.com/api/search/tiktoksearch?apikey=prince&query=${encodeURIComponent(query)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.results) results = [data.results];
            else if (data?.result && Array.isArray(data.result)) results = data.result;
            return results.map(item => ({
                url: item.no_watermark || item.data || '',
                title: item.title || '',
                cover: item.cover || '',
            }));
        },
    },
    {
        name: 'GiftedTech',
        url: (query) => `https://api.giftedtech.co.ke/api/search/tiktoksearch?apikey=gifted&query=${encodeURIComponent(query)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (data?.result?.url) results = [{ url: data.result.url, title: data.result.title || '' }];
            return results.map(item => ({
                url: item.no_watermark || item.data || item.url || item.link || '',
                title: item.title || '',
            }));
        },
    },
];

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'tiksearch',
    aliases: ['tiktoksearch', 'tts', 'tsearch'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text:
                    '🎵 *TikTok Search & Download*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.tiksearch <query> [count]\n\n' +
                    `📊 Default: ${DEFAULT_COUNT}, Max: ${MAX_COUNT}\n` +
                    '🔄 Downloads directly from search results.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        let count = DEFAULT_COUNT;
        let searchQuery = query;
        const lastArg = args[args.length - 1];
        const parsedCount = parseInt(lastArg);
        if (!isNaN(parsedCount) && parsedCount >= 2 && parsedCount <= MAX_COUNT && parsedCount % 2 === 0) {
            count = parsedCount;
            searchQuery = args.slice(0, -1).join(' ');
        }

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            // Cumuler les résultats de toutes les APIs
            let allResults = [];
            let usedSources = [];

            for (const api of SEARCH_APIS) {
                try {
                    console.log(`🔍 ${api.name}...`);
                    const { data } = await axios.get(api.url(searchQuery), { timeout: api.timeout });
                    const results = api.extract(data);
                    if (results.length > 0) {
                        allResults = allResults.concat(results);
                        usedSources.push(`${api.name}(${results.length})`);
                        console.log(`✅ ${api.name}: ${results.length}`);
                    }
                } catch (err) {
                    console.log(`⚠️ ${api.name}: ${err.message}`);
                }
            }

            if (allResults.length === 0) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, { text: '❌ No results.', contextInfo: STYLE }, { quoted: msg });
            }

            // Dédupliquer + mélanger + sélectionner
            const seen = new Set();
            const unique = allResults.filter(r => {
                if (!r.url || seen.has(r.url)) return false;
                seen.add(r.url);
                return true;
            });
            const shuffled = unique.sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, count);

            // ═══════════════════
            // TÉLÉCHARGER DIRECTEMENT (un par un, avec attente)
            // ═══════════════════

            let sent = 0;
            let failed = 0;

            for (let i = 0; i < selected.length; i++) {
                const video = selected[i];

                if (!video.url) {
                    failed++;
                    continue;
                }

                try {
                    console.log(`⬇️ [${i + 1}/${selected.length}] Downloading: ${video.title?.slice(0, 30)}...`);

                    // Télécharger directement depuis l'URL du résultat de recherche
                    const response = await axios.get(video.url, {
                        responseType: 'arraybuffer',
                        timeout: 90000, // 90 secondes
                        maxContentLength: MAX_VIDEO_SIZE,
                        headers: {
                            'User-Agent': 'Mozilla/5.0',
                            'Referer': 'https://www.tiktok.com/',
                        },
                    });

                    const buffer = Buffer.from(response.data);

                    if (buffer.length < 1000) {
                        console.log(`⚠️ Video too small: ${buffer.length} bytes`);
                        failed++;
                        continue;
                    }

                    if (buffer.length > MAX_VIDEO_SIZE) {
                        console.log(`⚠️ Video too large: ${(buffer.length / 1048576).toFixed(2)} MB`);
                        failed++;
                        continue;
                    }

                    const sizeMB = (buffer.length / 1048576).toFixed(2);

                    // Envoyer la vidéo
                    await sock.sendMessage(jid, {
                        video: buffer,
                        caption:
                            `🎬 *TikTok ${i + 1}/${selected.length}*\n\n` +
                            (video.title ? `📝 ${video.title.slice(0, 100)}\n` : '') +
                            (video.duration ? `⏱ ${video.duration}\n` : '') +
                            `📦 ${sizeMB} MB\n\n` +
                            '⚡ _Zenitsu_',
                        contextInfo: STYLE,
                    }, { quoted: msg });

                    sent++;
                    console.log(`✅ [${i + 1}/${selected.length}] Sent!`);

                } catch (err) {
                    console.log(`❌ [${i + 1}/${selected.length}] Failed: ${err.message}`);
                    failed++;

                    // Essayer avec l'API de download en fallback
                    try {
                        const encoded = encodeURIComponent(video.url);
                        const dlRes = await axios.get(
                            `https://api.giftedtech.co.ke/api/download/tiktokdlv5?apikey=gifted&url=${encoded}`,
                            { timeout: 30000 }
                        );
                        const dlUrl = extractDownloadUrl(dlRes.data);
                        if (dlUrl) {
                            const dlResponse = await axios.get(dlUrl, {
                                responseType: 'arraybuffer',
                                timeout: 60000,
                                maxContentLength: MAX_VIDEO_SIZE,
                            });
                            const dlBuffer = Buffer.from(dlResponse.data);
                            if (dlBuffer.length > 1000 && dlBuffer.length < MAX_VIDEO_SIZE) {
                                await sock.sendMessage(jid, {
                                    video: dlBuffer,
                                    caption:
                                        `🎬 *TikTok ${i + 1}/${selected.length}*\n\n` +
                                        (video.title ? `📝 ${video.title.slice(0, 100)}\n` : '') +
                                        '⚡ _Zenitsu (fallback)_',
                                    contextInfo: STYLE,
                                }, { quoted: msg });
                                sent++;
                                failed--;
                            }
                        }
                    } catch (_) {}

                    // Si toujours échoué, envoyer le lien
                    if (failed > 0 && i === selected.length - 1) {
                        await sock.sendMessage(jid, {
                            text:
                                '⚠️ *Download Failed*\n\n' +
                                `🔗 ${video.url}\n\n` +
                                '💡 Use .tiktok <url> to try again.',
                            contextInfo: STYLE,
                        });
                    }
                }

                // Attendre entre chaque téléchargement
                await new Promise(r => setTimeout(r, 2000));
            }

            // Résumé final
            await sock.sendMessage(jid, {
                text:
                    '✅ *TikTok Complete!*\n\n' +
                    `✅ Sent: ${sent}\n` +
                    `❌ Failed: ${failed}\n` +
                    `📊 Total: ${selected.length}\n\n` +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: sent > 0 ? '✅' : '❌', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ tiksearch:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, { text: `❌ ${err.message}`, contextInfo: STYLE }, { quoted: msg });
        }
    },
};

function extractDownloadUrl(data) {
    let url = null;
    if (data?.result?.video?.download_url) url = data.result.video.download_url;
    else if (data?.result?.video?.url) url = data.result.video.url;
    else if (data?.result?.url) url = data.result.url;
    else if (data?.url) url = data.url;
    else if (typeof data === 'string' && data.startsWith('http')) url = data;
    return url;
}
