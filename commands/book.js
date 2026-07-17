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
            let books = [];

            // Méthode 1 : Google Books API
            try {
                const { data } = await axios.get(
                    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&langRestrict=en,fr`,
                    { timeout: 15000 }
                );
                if (data?.items) {
                    books = data.items.map(book => {
                        const info = book.volumeInfo || {};
                        return {
                            title: info.title || 'Unknown',
                            authors: info.authors?.join(', ') || 'Unknown',
                            publisher: info.publisher || '',
                            publishedDate: info.publishedDate || '',
                            pages: info.pageCount || '',
                            rating: info.averageRating || '',
                            description: info.description?.slice(0, 300) || '',
                            thumbnail: info.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
                            previewLink: info.previewLink || info.canonicalVolumeLink || '',
                        };
                    });
                }
            } catch (_) {}

            // Méthode 2 : Open Library
            if (!books.length) {
                try {
                    const { data } = await axios.get(
                        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`,
                        { timeout: 15000 }
                    );
                    if (data?.docs) {
                        books = data.docs.slice(0, 5).map(doc => ({
                            title: doc.title || 'Unknown',
                            authors: doc.author_name?.join(', ') || 'Unknown',
                            publisher: doc.publisher?.[0] || '',
                            publishedDate: doc.first_publish_year || '',
                            pages: doc.number_of_pages_median || '',
                            rating: doc.ratings_average || '',
                            description: doc.first_sentence?.join('. ')?.slice(0, 300) || '',
                            thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
                            previewLink: `https://openlibrary.org${doc.key}`,
                        }));
                    }
                } catch (_) {}
            }

            if (!books.length) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: '❌ No books found.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Envoyer les résultats
            for (let i = 0; i < Math.min(books.length, 5); i++) {
                const book = books[i];

                let caption =
                    `📖 *Book ${i + 1}/${Math.min(books.length, 5)}*\n\n` +
                    `📌 *Title:* ${book.title}\n` +
                    `✍️ *Author(s):* ${book.authors}\n`;

                if (book.publisher) caption += `🏢 *Publisher:* ${book.publisher}\n`;
                if (book.publishedDate) caption += `📅 *Published:* ${book.publishedDate}\n`;
                if (book.pages) caption += `📄 *Pages:* ${book.pages}\n`;
                if (book.rating) caption += `⭐ *Rating:* ${book.rating}/5\n`;
                if (book.previewLink) caption += `🔗 ${book.previewLink}\n`;
                if (book.description) caption += `\n📝 ${book.description}...\n`;

                caption += '\n⚡ _Zenitsu_';

                if (book.thumbnail && book.thumbnail.startsWith('http')) {
                    try {
                        await sock.sendMessage(jid, {
                            image: { url: book.thumbnail },
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
