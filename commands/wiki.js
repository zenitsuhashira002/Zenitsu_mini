// ./commands/wiki.js

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

module.exports = {
    name: 'wiki',
    aliases: ['wikipedia', 'encyclopedia'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        let lang = 'en';
        let query = '';

        if (args.length >= 2 && /^[a-z]{2}$/.test(args[0])) {
            lang = args[0];
            query = args.slice(1).join(' ');
        } else {
            query = args.join(' ');
        }

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text:
                    '📚 *Wikipedia Search*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.wiki <lang> <query>\n' +
                    '.wiki <query>\n\n' +
                    '✨ *Examples:*\n' +
                    '.wiki JavaScript\n' +
                    '.wiki fr Tour Eiffel\n' +
                    '.wiki es México',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            // Essayer plusieurs APIs
            let pageInfo = null;

            // Méthode 1 : API Wikipedia directe
            try {
                const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
                const { data: searchData } = await axios.get(searchUrl, { timeout: 15000 });
                const results = searchData?.query?.search;
                if (results?.length) {
                    const pageTitle = results[0].title;
                    const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
                    const { data: summaryData } = await axios.get(summaryUrl, { timeout: 15000 });
                    pageInfo = summaryData;
                }
            } catch (_) {}

            // Méthode 2 : NexRay Wikipedia
            if (!pageInfo) {
                try {
                    const { data } = await axios.get(
                        `https://api.nexray.eu.cc/search/wikipedia?q=${encodeURIComponent(query)}&lang=${lang}`,
                        { timeout: 15000 }
                    );
                    if (data?.result) {
                        pageInfo = {
                            title: data.result.title || query,
                            extract: data.result.extract || data.result.description || '',
                            content_urls: { desktop: { page: data.result.url || '' } },
                            thumbnail: data.result.thumbnail ? { source: data.result.thumbnail } : null,
                        };
                    }
                } catch (_) {}
            }

            // Méthode 3 : GiftedTech Wikipedia
            if (!pageInfo) {
                try {
                    const { data } = await axios.get(
                        `https://api.giftedtech.co.ke/api/search/wikipedia?apikey=gifted&query=${encodeURIComponent(query)}&lang=${lang}`,
                        { timeout: 15000 }
                    );
                    if (data?.result) {
                        pageInfo = {
                            title: data.result.title || query,
                            extract: data.result.extract || data.result.description || '',
                            content_urls: { desktop: { page: data.result.url || '' } },
                            thumbnail: data.result.image ? { source: data.result.image } : null,
                        };
                    }
                } catch (_) {}
            }

            if (!pageInfo || (!pageInfo.extract && !pageInfo.title)) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: '❌ No Wikipedia results found.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const title = pageInfo.title || query;
            const extract = (pageInfo.extract || '').slice(0, 1500);
            const pageUrl = pageInfo.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
            const imageUrl = pageInfo.thumbnail?.source || '';

            let caption =
                '📚 *Wikipedia*\n\n' +
                `📌 *Title:* ${title}\n` +
                `🌍 *Lang:* ${lang}\n` +
                `🔗 ${pageUrl}\n\n` +
                `📄 *Summary:*\n${extract}${extract.length >= 1500 ? '...' : ''}\n\n` +
                '⚡ _Zenitsu_';

            if (imageUrl && imageUrl.startsWith('http')) {
                try {
                    await sock.sendMessage(jid, {
                        image: { url: imageUrl },
                        caption: caption,
                        contextInfo: STYLE,
                    }, { quoted: msg });
                } catch (_) {
                    await sock.sendMessage(jid, { text: caption, contextInfo: STYLE }, { quoted: msg });
                }
            } else {
                await sock.sendMessage(jid, { text: caption, contextInfo: STYLE }, { quoted: msg });
            }

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ wiki:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: '❌ Wikipedia search failed. Try a different query.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
