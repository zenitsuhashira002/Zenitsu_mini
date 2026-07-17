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
            let found = null;

            // Méthode 1 : Project Gutenberg
            try {
                console.log('🔍 Trying Gutenberg...');
                const { data } = await axios.get(
                    `https://gutendex.com/books?search=${encodeURIComponent(query)}`,
                    { timeout: 15000 }
                );
                const books = data?.results;
                if (books?.length) {
                    const book = books[0];
                    const formats = book.formats || {};
                    // Chercher PDF, TXT, ou EPUB
                    for (const ext of ['pdf', 'txt', 'epub']) {
                        for (const [key, url] of Object.entries(formats)) {
                            if (key.includes(ext) && url && url.startsWith('http')) {
                                found = {
                                    url,
                                    title: book.title,
                                    author: book.authors?.[0]?.name || 'Unknown',
                                    source: 'Project Gutenberg',
                                    ext: ext,
                                };
                                break;
                            }
                        }
                        if (found) break;
                    }
                }
            } catch (err) {
                console.log('⚠️ Gutenberg:', err.message);
            }

            // Méthode 2 : Open Library
            if (!found) {
                try {
                    console.log('🔍 Trying Open Library...');
                    const { data } = await axios.get(
                        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=3`,
                        { timeout: 15000 }
                    );
                    const docs = data?.docs;
                    if (docs?.length) {
                        for (const doc of docs) {
                            if (doc.cover_edition_key) {
                                found = {
                                    url: `https://archive.org/download/${doc.cover_edition_key}/${doc.cover_edition_key}.pdf`,
                                    title: doc.title,
                                    author: doc.author_name?.[0] || 'Unknown',
                                    source: 'Internet Archive / Open Library',
                                    ext: 'pdf',
                                };
                                break;
                            }
                        }
                    }
                } catch (err) {
                    console.log('⚠️ Open Library:', err.message);
                }
            }

            if (!found) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text:
                        '❌ *No Free Book Found*\n\n' +
                        'No downloadable version found.\n\n' +
                        '💡 Try classic/public domain books:\n' +
                        '• The Great Gatsby\n' +
                        '• Pride and Prejudice\n' +
                        '• Moby Dick\n' +
                        '• Dracula',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // ⭐ Vérifier la taille avant téléchargement
            let sizeOk = true;
            try {
                const headRes = await axios.head(found.url, { timeout: 10000 });
                const contentLength = parseInt(headRes.headers['content-length'] || '0');
                if (contentLength > MAX_SIZE) {
                    sizeOk = false;
                    console.log(`⚠️ Too large: ${(contentLength / 1048576).toFixed(2)} MB`);
                }
            } catch (_) {
                // Si HEAD échoue, on essaie quand même
            }

            if (!sizeOk) {
                try { await sock.sendMessage(jid, { react: { text: '⚠️', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text:
                        '⚠️ *Book Too Large*\n\n' +
                        `📌 *Title:* ${found.title}\n` +
                        `🔗 *Download manually:* ${found.url}\n\n` +
                        '⚡ _Zenitsu_',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Télécharger
            try { await sock.sendMessage(jid, { react: { text: '⬇️', key: msg.key } }); } catch (_) {}

            let buffer;
            try {
                const bookRes = await axios.get(found.url, {
                    responseType: 'arraybuffer',
                    timeout: 60000,
                    maxContentLength: MAX_SIZE,
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                });
                buffer = Buffer.from(bookRes.data);
            } catch (dlErr) {
                console.log('⚠️ Download failed:', dlErr.message);
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text:
                        '❌ *Download Failed*\n\n' +
                        `📌 *Title:* ${found.title}\n` +
                        `🔗 *Try manually:* ${found.url}\n\n` +
                        '⚡ _Zenitsu_',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            if (!buffer || buffer.length < 100 || buffer.length > MAX_SIZE) {
                try { await sock.sendMessage(jid, { react: { text: '⚠️', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text:
                        '⚠️ *Book Unavailable*\n\n' +
                        `📌 *Title:* ${found.title}\n` +
                        `🔗 ${found.url}\n\n` +
                        '⚡ _Zenitsu_',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const sizeMB = (buffer.length / 1048576).toFixed(2);
            const safeName = found.title.replace(/[^a-z0-9]/gi, '_').slice(0, 50);

            await sock.sendMessage(jid, {
                document: buffer,
                mimetype: found.ext === 'epub' ? 'application/epub+zip' : 'application/pdf',
                fileName: `${safeName}.${found.ext}`,
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
