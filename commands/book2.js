// ./commands/book2.js

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

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

module.exports = {
    name: 'book2',
    aliases: ['bookdl', 'downloadbook', 'getbook'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text:
                    '📖 *Book Downloader*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.book2 <title>\n\n' +
                    '✨ *Examples:*\n' +
                    '.book2 The Great Gatsby\n' +
                    '.book2 Pride and Prejudice\n\n' +
                    '💡 Searches free/public domain books.\n' +
                    '📦 Max size: 20 MB',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            // Sources de livres gratuits/légaux
            const sources = [
                // Project Gutenberg (domaine public)
                async () => {
                    const { data } = await axios.get(
                        `https://gutendex.com/books?search=${encodeURIComponent(query)}`,
                        { timeout: 15000 }
                    );
                    const books = data?.results;
                    if (!books?.length) return null;

                    const book = books[0];
                    const formats = book.formats || {};

                    // Chercher un format téléchargeable (EPUB, PDF, TXT)
                    for (const ext of ['.epub', '.pdf', '.txt']) {
                        for (const [key, url] of Object.entries(formats)) {
                            if (key.includes(ext) && url && url.startsWith('http')) {
                                return {
                                    url,
                                    title: book.title,
                                    author: book.authors?.[0]?.name || 'Unknown',
                                    source: 'Project Gutenberg',
                                };
                            }
                        }
                    }
                    return null;
                },

                // Open Library (Internet Archive)
                async () => {
                    const { data } = await axios.get(
                        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`,
                        { timeout: 15000 }
                    );
                    const docs = data?.docs;
                    if (!docs?.length) return null;

                    // Chercher un livre avec un ID
                    for (const doc of docs) {
                        if (doc.cover_edition_key || doc.edition_key?.length) {
                            const editionId = doc.cover_edition_key || doc.edition_key[0];
                            const archiveUrl = `https://archive.org/download/${editionId}/${editionId}.pdf`;

                            return {
                                url: archiveUrl,
                                title: doc.title,
                                author: doc.author_name?.[0] || 'Unknown',
                                source: 'Internet Archive / Open Library',
                            };
                        }
                    }
                    return null;
                },

                // Feedbooks (domaine public)
                async () => {
                    const { data } = await axios.get(
                        `https://catalog.feedbooks.com/search.json?query=${encodeURIComponent(query)}&domain=publicdomain`,
                        { timeout: 15000 }
                    );
                    const books = data;
                    if (!books?.length) return null;

                    const book = books[0];
                    if (book?.download_epub) {
                        return {
                            url: book.download_epub,
                            title: book.title,
                            author: book.author?.name || 'Unknown',
                            source: 'Feedbooks',
                        };
                    }
                    return null;
                },
            ];

            let found = null;

            for (const source of sources) {
                try {
                    console.log(`🔍 Trying book source...`);
                    found = await source();
                    if (found?.url) {
                        console.log(`✅ Found: ${found.source}`);
                        break;
                    }
                } catch (err) {
                    console.log(`⚠️ Source failed: ${err.message}`);
                }
            }

            if (!found) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text:
                        '❌ *No Free Book Found*\n\n' +
                        'No downloadable version found for this title.\n\n' +
                        '💡 *Tips:*\n' +
                        '• Try classic/public domain books\n' +
                        '• Use .book to search for info first\n' +
                        '• Try a different title',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Vérifier la taille avant téléchargement
            try {
                const headRes = await axios.head(found.url, { timeout: 10000 });
                const contentLength = parseInt(headRes.headers['content-length'] || '0');

                if (contentLength > MAX_SIZE) {
                    try { await sock.sendMessage(jid, { react: { text: '⚠️', key: msg.key } }); } catch (_) {}
                    return sock.sendMessage(jid, {
                        text:
                            '⚠️ *Book Too Large*\n\n' +
                            `📦 *Size:* ${(contentLength / 1048576).toFixed(2)} MB\n` +
                            `📊 *Max:* 20 MB\n\n` +
                            `🔗 *Download manually:* ${found.url}\n\n` +
                            '⚡ _Zenitsu_',
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }
            } catch (_) {
                // Si HEAD échoue, on essaie quand même
            }

            // Télécharger le livre
            try { await sock.sendMessage(jid, { react: { text: '⬇️', key: msg.key } }); } catch (_) {}

            const bookRes = await axios.get(found.url, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: MAX_SIZE,
            });

            const buffer = Buffer.from(bookRes.data);

            if (buffer.length > MAX_SIZE) {
                try { await sock.sendMessage(jid, { react: { text: '⚠️', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text:
                        '⚠️ *Book Too Large*\n\n' +
                        `📦 *Size:* ${(buffer.length / 1048576).toFixed(2)} MB\n` +
                        `🔗 ${found.url}\n\n` +
                        '⚡ _Zenitsu_',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const sizeMB = (buffer.length / 1048576).toFixed(2);
            const safeName = found.title.replace(/[^a-z0-9]/gi, '_').slice(0, 50);
            const ext = found.url.split('.').pop()?.split('?')[0] || 'pdf';

            await sock.sendMessage(jid, {
                document: buffer,
                mimetype: ext === 'epub' ? 'application/epub+zip' : 'application/pdf',
                fileName: `${safeName}.${ext}`,
                caption:
                    '📖 *Book Downloaded!*\n\n' +
                    `📌 *Title:* ${found.title}\n` +
                    `✍️ *Author:* ${found.author}\n` +
                    `📦 *Size:* ${sizeMB} MB\n` +
                    `🔧 *Source:* ${found.source}\n\n` +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ book2:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: '❌ Book download failed. Try another title.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
