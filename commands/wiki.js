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

const LANGUAGES = {
    'fr': 'Français',
    'en': 'English',
    'es': 'Español',
    'de': 'Deutsch',
    'it': 'Italiano',
    'pt': 'Português',
    'ar': 'العربية',
    'ru': 'Русский',
    'ja': '日本語',
    'zh': '中文',
};

module.exports = {
    name: 'wiki',
    aliases: ['wikipedia', 'encyclopedia'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        let lang = 'en';
        let query = '';

        // Détecter la langue
        if (args.length >= 2 && args[0].length === 2 && LANGUAGES[args[0]]) {
            lang = args[0];
            query = args.slice(1).join(' ');
        } else {
            query = args.join(' ');
        }

        if (!query || query.trim().length < 2) {
            const langList = Object.entries(LANGUAGES).map(([k, v]) => `  ${k} — ${v}`).join('\n');
            return sock.sendMessage(jid, {
                text:
                    '📚 *Wikipedia Search*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.wiki <lang> <query>\n' +
                    '.wiki <query>\n\n' +
                    '🌍 *Languages:*\n' + langList + '\n\n' +
                    '✨ *Examples:*\n' +
                    '.wiki JavaScript\n' +
                    '.wiki fr Tour Eiffel\n' +
                    '.wiki es Machu Picchu',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            // Recherche via Wikipedia API
            const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
            const { data: searchData } = await axios.get(searchUrl, { timeout: 15000 });

            const results = searchData?.query?.search;
            if (!results || results.length === 0) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: '❌ No Wikipedia results found.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Prendre le premier résultat
            const page = results[0];
            const pageTitle = page.title;

            // Récupérer le résumé
            const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
            const { data: summaryData } = await axios.get(summaryUrl, { timeout: 15000 });

            const title = summaryData?.title || pageTitle;
            const extract = summaryData?.extract || page.snippet?.replace(/<[^>]+>/g, '') || '';
            const pageUrl = summaryData?.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
            const imageUrl = summaryData?.thumbnail?.source || summaryData?.originalimage?.source || '';
            const description = summaryData?.description || '';

            // Construire la réponse
            const maxExtract = 1500;
            const truncatedExtract = extract.length > maxExtract
                ? extract.slice(0, maxExtract) + '...'
                : extract;

            let caption =
                '📚 *Wikipedia*\n\n' +
                `📌 *Title:* ${title}\n` +
                (description ? `📝 *Desc:* ${description}\n` : '') +
                `🌍 *Lang:* ${LANGUAGES[lang] || lang}\n` +
                `🔗 ${pageUrl}\n\n` +
                `📄 *Summary:*\n${truncatedExtract}\n\n` +
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
