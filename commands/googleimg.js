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
// SEARCH APIS
// ═══════════════════════════════════════

const SEARCH_APIS = [
    {
        name: 'PrinceTech Google Image',
        url: (q) => `https://api.princetechn.com/api/search/googleimage?apikey=prince&query=${encodeURIComponent(q)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;
            return results
                .map(item => ({
                    image: item.image || item.url || item.thumbnail || item.source || '',
                    title: item.title || '',
                }))
                .filter(item => item.image && item.image.startsWith('http'));
        },
    },
    {
        name: 'Sylphyy Image Search',
        url: (q) => `https://sylphyy.xyz/search/image?q=${encodeURIComponent(q)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;
            return results
                .map(item => ({
                    image: item.image || item.url || item.thumbnail || item.source || item.url || '',
                    title: item.title || item.description || '',
                }))
                .filter(item => item.image && item.image.startsWith('http'));
        },
    },
    {
        name: 'NexRay Image Search',
        url: (q) => `https://api.nexray.eu.cc/search/image?q=${encodeURIComponent(q)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;
            return results
                .map(item => ({
                    image: item.image || item.url || item.thumbnail || item.source || '',
                    title: item.title || item.description || '',
                }))
                .filter(item => item.image && item.image.startsWith('http'));
        },
    },
    {
        name: 'GiftedTech Google Image',
        url: (q) => `https://api.giftedtech.co.ke/api/search/googleimage?apikey=gifted&query=${encodeURIComponent(q)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            else if (Array.isArray(data)) results = data;
            return results
                .map(item => ({
                    image: item.image || item.url || item.thumbnail || item.source || (typeof item === 'string' ? item : ''),
                    title: item.title || '',
                }))
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
                    '🖼️ *Google Image Search*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.googleimage <query>\n\n' +
                    '✨ *Examples:*\n' +
                    '.googleimage Cute cats\n' +
                    '.googleimage Sunset over mountains\n' +
                    '.googleimage Cyberpunk city\n\n' +
                    '💡 Returns up to 5 images.\n' +
                    '🔄 4 search sources',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🖼️', key: msg.key } }); } catch (_) {}

        try {
            // Chercher avec toutes les APIs
            let allImages = [];
            let usedSource = '';

            for (const api of SEARCH_APIS) {
                try {
                    console.log(`🖼️ Google Image: ${api.name}...`);
                    const { data } = await axios.get(api.url(query), { timeout: api.timeout });
                    const results = api.extract(data);

                    if (results.length > 0) {
                        allImages = results;
                        usedSource = api.name;
                        console.log(`✅ ${api.name}: ${results.length} images`);
                        break;
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

            // Envoyer les images une par une
            for (let i = 0; i < selected.length; i++) {
                const item = selected[i];

                await new Promise(r => setTimeout(r, 1200));

                try {
                    // Essayer l'envoi direct par URL
                    try {
                        await sock.sendMessage(jid, {
                            image: { url: item.image },
                            caption: `🖼️ *Image ${i + 1}/${selected.length}*\n🔍 ${query}\n${item.title ? `📝 ${item.title.slice(0, 80)}\n` : ''}⚡ _Zenitsu_`,
                            contextInfo: STYLE,
                        }, { quoted: i === 0 ? msg : undefined });
                        continue;
                    } catch (_) {}

                    // Fallback : télécharger en buffer
                    const imgRes = await axios.get(item.image, {
                        responseType: 'arraybuffer',
                        timeout: 25000,
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                    });
                    const buffer = Buffer.from(imgRes.data);

                    if (buffer.length > 500) {
                        await sock.sendMessage(jid, {
                            image: buffer,
                            caption: `🖼️ *Image ${i + 1}/${selected.length}*\n🔍 ${query}\n⚡ _Zenitsu_`,
                            contextInfo: STYLE,
                        }, { quoted: i === 0 ? msg : undefined });
                    }

                } catch (err) {
                    console.log(`⚠️ Image ${i + 1} failed:`, err.message);
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
