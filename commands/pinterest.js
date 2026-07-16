// ./commands/pinterest.js

const axios = require('axios');

// ═══════════════════════════════════════
// CONFIG
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
// SEARCH APIS
// ═══════════════════════════════════════

const SEARCH_APIS = [
    {
        name: 'NexRay',
        url: (query) => `https://api.nexray.eu.cc/search/pinterest?q=${encodeURIComponent(query)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            return results.map(item => ({
                image: item.images_url || item.image || '',
                title: item.grid_title || item.title || '',
            })).filter(item => item.image && item.image.startsWith('http'));
        },
    },
    {
        name: 'DavidCyril',
        url: (query) => `https://apis.davidcyriltech.my.id/search/pinterest?text=${encodeURIComponent(query)}`,
        timeout: 15000,
        extract: (data) => {
            let results = [];
            if (data?.result && Array.isArray(data.result)) results = data.result;
            else if (data?.data && Array.isArray(data.data)) results = data.data;
            return results.map(item => ({
                image: item.image || item.url || item.images_url || '',
                title: item.title || item.grid_title || '',
            })).filter(item => item.image && item.image.startsWith('http'));
        },
    },
];

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'pinterest',
    aliases: ['pin', 'pindl', 'pinsearch'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        let count = 5;
        let queryStart = 0;

        const firstArg = args[0];
        if (firstArg && /^\d+$/.test(firstArg)) {
            count = Math.min(Math.max(parseInt(firstArg), 1), 20);
            queryStart = 1;
        }

        const query = args.slice(queryStart).join(' ');

        if (!query || query.trim().length < 1) {
            return sock.sendMessage(jid, {
                text: '📌 *Pinterest Search*\n\n⚡ .pinterest [count] <query>\n💡 Default: 5 | Max: 20',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            // RECHERCHE
            let allImages = [];
            let usedSource = '';

            for (const api of SEARCH_APIS) {
                try {
                    console.log(`🔍 Pinterest: ${api.name}...`);
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
                return sock.sendMessage(jid, { text: '❌ No images found.', contextInfo: STYLE }, { quoted: msg });
            }

            // Dédupliquer + mélanger
            const seen = new Set();
            const unique = allImages.filter(img => img.image && !seen.has(img.image) && seen.add(img.image));
            const shuffled = unique.sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, count);

            await sock.sendMessage(jid, {
                text: `📌 *Pinterest*\n\n🔍 ${query}\n🔧 ${usedSource}\n📊 ${selected.length} images\n⏳ Downloading...`,
                contextInfo: STYLE,
            }, { quoted: msg });

            // ═══════════════════
            // TÉLÉCHARGER EN BUFFER + ENVOYER (un par un)
            // ═══════════════════

            let sent = 0;

            for (let i = 0; i < selected.length; i++) {
                const item = selected[i];

                // Petit délai
                await new Promise(r => setTimeout(r, 1500));

                try {
                    console.log(`⬇️ [${i + 1}/${selected.length}] ${item.image.slice(0, 60)}...`);

                    // ⭐ Télécharger directement en buffer (obligatoire)
                    const response = await axios.get(item.image, {
                        responseType: 'arraybuffer',
                        timeout: 30000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Referer': 'https://www.pinterest.com/',
                        },
                    });

                    const buffer = Buffer.from(response.data);

                    if (!buffer || buffer.length < 500) {
                        console.log(`⚠️ [${i + 1}] Buffer too small: ${buffer?.length || 0}`);
                        continue;
                    }

                    // Envoyer l'image
                    await sock.sendMessage(jid, {
                        image: buffer,
                        caption: `📌 *${i + 1}/${selected.length}*\n🔍 ${query}\n${item.title ? `📝 ${item.title.slice(0, 80)}\n` : ''}⚡ _Zenitsu_`,
                        contextInfo: STYLE,
                    }, { quoted: i === 0 ? msg : undefined });

                    sent++;
                    console.log(`✅ [${i + 1}/${selected.length}] ${(buffer.length / 1024).toFixed(1)} KB`);

                } catch (err) {
                    console.log(`❌ [${i + 1}] Failed: ${err.message}`);
                }
            }

            // Résumé
            try { await sock.sendMessage(jid, { react: { text: sent > 0 ? '✅' : '❌', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ pinterest:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, { text: `❌ ${err.message}`, contextInfo: STYLE }, { quoted: msg });
        }
    },
};
