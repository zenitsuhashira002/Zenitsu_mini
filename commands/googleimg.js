// ./commands/googleimage.js

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

// ═══════════════════════════════════════
// IMAGE SEARCH APIS (par ordre de priorité)
// ═══════════════════════════════════════

const IMAGE_APIS = [
    {
        name: 'PrinceTech',
        url: (q) => `https://api.princetechn.com/api/search/googleimage?apikey=prince&query=${encodeURIComponent(q)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;

            return results
                .map(item => {
                    if (typeof item === 'string') return { image: item, title: '' };
                    return {
                        image: item.image || item.url || item.thumbnail || item.source || item.img || item.link || '',
                        title: item.title || item.name || item.description || '',
                    };
                })
                .filter(item => item.image && item.image.startsWith('http'));
        },
    },
    {
        name: 'Sylphyy',
        url: (q) => `https://sylphyy.xyz/search/image?q=${encodeURIComponent(q)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;

            return results
                .map(item => {
                    if (typeof item === 'string') return { image: item, title: '' };
                    return {
                        image: item.image || item.url || item.thumbnail || item.source || item.img || '',
                        title: item.title || item.name || item.description || '',
                    };
                })
                .filter(item => item.image && item.image.startsWith('http'));
        },
    },
    {
        name: 'NexRay',
        url: (q) => `https://api.nexray.eu.cc/search/image?q=${encodeURIComponent(q)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;

            return results
                .map(item => {
                    if (typeof item === 'string') return { image: item, title: '' };
                    return {
                        image: item.image || item.url || item.thumbnail || item.source || item.img || '',
                        title: item.title || item.name || item.description || '',
                    };
                })
                .filter(item => item.image && item.image.startsWith('http'));
        },
    },
    {
        name: 'GiftedTech',
        url: (q) => `https://api.giftedtech.co.ke/api/search/googleimage?apikey=gifted&query=${encodeURIComponent(q)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;

            return results
                .map(item => {
                    if (typeof item === 'string') return { image: item, title: '' };
                    return {
                        image: item.image || item.url || item.thumbnail || item.source || item.img || item.link || '',
                        title: item.title || item.name || item.description || '',
                    };
                })
                .filter(item => item.image && item.image.startsWith('http'));
        },
    },
    {
        name: 'PopCat',
        url: (q) => `https://api.popcat.xyz/v2/image-search?q=${encodeURIComponent(q)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;

            return results
                .map(item => {
                    if (typeof item === 'string') return { image: item, title: '' };
                    return {
                        image: item.image || item.url || item.thumbnail || item.source || item.img || '',
                        title: item.title || item.name || item.description || '',
                    };
                })
                .filter(item => item.image && item.image.startsWith('http'));
        },
    },
];

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'googleimage',
    aliases: ['gimage', 'imgsearch', 'searchimage', 'gi'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text:
                    '🖼️ *Image Search*\n\n' +
                    '⚡ *Usage:* .googleimage <query>\n\n' +
                    '✨ *Examples:*\n' +
                    '.googleimage Cute cats\n' +
                    '.googleimage Sunset mountains\n\n' +
                    '🔄 5 search sources',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🖼️', key: msg.key } }); } catch (_) {}

        try {
            let allImages = [];
            let usedSource = '';

            // Essayer chaque API
            for (const api of IMAGE_APIS) {
                try {
                    console.log(`🖼️ Trying ${api.name}...`);
                    const { data } = await axios.get(api.url(query), { timeout: api.timeout });
                    const images = api.extract(data);
                    console.log(`   Response sample:`, JSON.stringify(data).slice(0, 200));

                    if (images.length > 0) {
                        allImages = images;
                        usedSource = api.name;
                        console.log(`✅ ${api.name}: ${images.length} images`);
                        break;
                    } else {
                        console.log(`⚠️ ${api.name}: 0 images extracted`);
                    }
                } catch (err) {
                    console.log(`⚠️ ${api.name}: ${err.message}`);
                }
            }

            if (allImages.length === 0) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: '❌ No images found. Try a different search term.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Dédupliquer + limiter à 5
            const seen = new Set();
            const unique = allImages.filter(img => img.image && !seen.has(img.image) && seen.add(img.image));
            const selected = unique.slice(0, 5);

            console.log(`📌 Sending ${selected.length} images from ${usedSource}...`);

            // Envoyer les images une par une avec téléchargement buffer (plus fiable)
            for (let i = 0; i < selected.length; i++) {
                const item = selected[i];

                await new Promise(r => setTimeout(r, 1200));

                try {
                    // Télécharger l'image en buffer directement (évite les problèmes d'URL)
                    const imgRes = await axios.get(item.image, {
                        responseType: 'arraybuffer',
                        timeout: 20000,
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                    });
                    const buffer = Buffer.from(imgRes.data);

                    if (buffer.length > 500) {
                        await sock.sendMessage(jid, {
                            image: buffer,
                            caption: `🖼️ *Image ${i + 1}/${selected.length}*\n🔍 ${query}\n⚡ _Zenitsu_`,
                            contextInfo: STYLE,
                        }, { quoted: i === 0 ? msg : undefined });
                    } else {
                        console.log(`⚠️ Image ${i + 1} too small: ${buffer.length} bytes`);
                    }
                } catch (err) {
                    console.log(`⚠️ Image ${i + 1} download failed:`, err.message);
                }
            }

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ googleimage:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: '❌ Image search failed.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
