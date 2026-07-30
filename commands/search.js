// ./commands/search.js

const axios = require('axios');

module.exports = {
    name: 'search',
    aliases: ['google', 'find', 'lookup'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text:
                    '🔍 *Google Search*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.search <query>\n\n' +
                    '✨ *Examples:*\n' +
                    '.search JavaScript tutorial\n' +
                    '.search What is quantum computing\n' +
                    '.search Latest tech news 2025',
                contextInfo: {
                    forwardingScore: 350,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202,
                    },
                },
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            const { data } = await axios.get(
                `https://apis.davidcyriltech.my.id/search/google?q=${encodeURIComponent(query)}&start=0&hl=fr&safe=active`,
                { timeout: 30000 }
            );

            // Extract results
            let results = [];
            if (data?.results && Array.isArray(data.results)) {
                results = data.results;
            } else if (data?.data && Array.isArray(data.data)) {
                results = data.data;
            } else if (Array.isArray(data)) {
                results = data;
            }

            if (results.length === 0) {
                throw new Error('No results found');
            }

            // Build response (top 10 results)
            const maxResults = Math.min(results.length, 10);
            let replyText = `🔍 *Search Results:* _${query}_\n\n`;

            for (let i = 0; i < maxResults; i++) {
                const item = results[i];
                const title = item.title || item.name || `Result ${i + 1}`;
                const url = item.url || item.link || '';
                const snippet = item.snippet || item.description || item.body || '';

                replyText += `*${i + 1}. ${title}*\n`;
                if (snippet && snippet.length > 0) {
                    replyText += `📝 ${snippet.substring(0, 150)}...\n`;
                }
                if (url) {
                    replyText += `🔗 ${url}\n`;
                }
                replyText += '\n';
            }

            replyText += `⚡ _Powered by Google_`;

            await sock.sendMessage(jid, {
                text: replyText,
                contextInfo: {
                    forwardingScore: 350,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202,
                    },
                },
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ search error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            await sock.sendMessage(jid, {
                text:
                    '❌ *Search Failed*\n\n' +
                    'No results found or service unavailable.\n\n' +
                    '⚡ Try a different query.',
                contextInfo: {
                    forwardingScore: 350,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202,
                    },
                },
            }, { quoted: msg });
        }
    },
};
