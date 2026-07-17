// ./commands/book.js

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
    name: 'book',
    aliases: ['books', 'livre', 'googlebooks'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text:
                    '📖 *Book Search*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.book <title or author>\n\n' +
                    '✨ *Examples:*\n' +
                    '.book Harry Potter\n' +
                    '.book The Hobbit\n' +
                    '.book Victor Hugo',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&langRestrict=en,fr`;
            const { data } = await axios.get(url, { timeout: 15000 });

            const books = data?.items;
            if (!books || books.length === 0) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: '❌ No books found.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Envoyer les 5 premiers résultats
            for (let i = 0; i < Math.min(books.length, 5); i++) {
                const book = books[i];
                const info = book.volumeInfo || {};

                const title = info.title || 'Unknown';
                const authors = info.authors?.join(', ') || 'Unknown';
                const publisher = info.publisher || '';
                const publishedDate = info.publishedDate || '';
                const pages = info.pageCount || '';
                const rating = info.averageRating || '';
                const description = info.description?.slice(0, 500) || '';
                const thumbnail = info.imageLinks?.thumbnail || '';
                const previewLink = info.previewLink || info.canonicalVolumeLink || '';

                let caption =
                    `📖 *Book ${i + 1}/${Math.min(books.length, 5)}*\n\n` +
                    `📌 *Title:* ${title}\n` +
                    `✍️ *Author(s):* ${authors}\n`;

                if (publisher) caption += `🏢 *Publisher:* ${publisher}\n`;
                if (publishedDate) caption += `📅 *Published:* ${publishedDate}\n`;
                if (pages) caption += `📄 *Pages:* ${pages}\n`;
                if (rating) caption += `⭐ *Rating:* ${rating}/5\n`;
                if (previewLink) caption += `🔗 ${previewLink}\n`;
                if (description) caption += `\n📝 *Desc:* ${description.slice(0, 300)}...\n`;

                caption += '\n⚡ _Zenitsu_';

                if (thumbnail && thumbnail.startsWith('http')) {
                    try {
                        await sock.sendMessage(jid, {
                            image: { url: thumbnail },
                            caption: caption,
                            contextInfo: STYLE,
                        }, { quoted: i === 0 ? msg : undefined });
                    } catch (_) {
                        await sock.sendMessage(jid, { text: caption, contextInfo: STYLE }, { quoted: i === 0 ? msg : undefined });
                    }
                } else {
                    await sock.sendMessage(jid, { text: caption, contextInfo: STYLE }, { quoted: i === 0 ? msg : undefined });
                }

                await new Promise(r => setTimeout(r, 800));
            }

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ book:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: '❌ Book search failed.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
