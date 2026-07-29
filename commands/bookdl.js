// ./commands/bookdl.js

const axios = require('axios');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const TIMEOUT = 60000; // 60 secondes

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
// SOURCES DE LIVRES (par ordre de priorité)
// ═══════════════════════════════════════

const BOOK_SOURCES = [
    {
        name: 'Project Gutenberg (Gutendex)',
        search: async (query) => {
            const { data } = await axios.get(
                `https://gutendex.com/books?search=${encodeURIComponent(query)}`,
                { timeout: 15000 }
            );
            const books = data?.results;
            if (!books?.length) return null;

            const book = books[0];
            const formats = book.formats || {};

            // Chercher EPUB, puis MOBI, puis TXT, puis HTML
            const url = formats['application/epub+zip']
                || formats['application/x-mobipocket-ebook']
                || formats['text/plain']
                || formats['text/html']
                || '';

            if (!url) return null;

            return {
                url,
                title: book.title,
                author: book.authors?.[0]?.name || 'Unknown',
                source: 'Project Gutenberg',
                ext: url.includes('epub') ? 'epub' : url.includes('mobi') ? 'mobi' : url.includes('txt') ? 'txt' : 'html',
                thumbnail: book.formats['image/jpeg'] || '',
            };
        },
    },
    {
        name: 'Google Books (Public Domain)',
        search: async (query) => {
            const { data } = await axios.get(
                `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&filter=free-ebooks`,
                { timeout: 15000 }
            );
            const items = data?.items;
            if (!items?.length) return null;

            // Chercher un livre en domaine public avec lien de téléchargement
            for (const item of items) {
                const access = item.accessInfo;
                const info = item.volumeInfo || {};

                if (!access?.publicDomain) continue;

                let url = null;
                if (access.pdf?.isAvailable && access.pdf.downloadLink) {
                    url = access.pdf.downloadLink;
                } else if (access.epub?.isAvailable && access.epub.downloadLink) {
                    url = access.epub.downloadLink;
                }

                if (url) {
                    return {
                        url,
                        title: info.title || 'Unknown',
                        author: info.authors?.join(', ') || 'Unknown',
                        source: 'Google Books',
                        ext: url.includes('pdf') ? 'pdf' : 'epub',
                        thumbnail: info.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
                    };
                }
            }
            return null;
        },
    },
    {
        name: 'Internet Archive',
        search: async (query) => {
            // Étape 1 : Chercher sur Open Library
            const { data: olData } = await axios.get(
                `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=3`,
                { timeout: 15000 }
            );
            const docs = olData?.docs;
            if (!docs?.length) return null;

            // Étape 2 : Chercher un identifier pour Internet Archive
            for (const doc of docs) {
                const iaId = doc.ia?.[0] || doc.ia_collection?.[0] || '';
                if (!iaId) continue;

                try {
                    // Étape 3 : Récupérer les métadonnées Internet Archive
                    const { data: iaData } = await axios.get(
                        `https://archive.org/metadata/${iaId}`,
                        { timeout: 15000 }
                    );
                    const files = iaData?.files || [];

                    // Chercher EPUB, PDF, ou TXT
                    const epub = files.find(f => f.format === 'EPUB' || f.name?.endsWith('.epub'));
                    const pdf = files.find(f => f.format === 'PDF' || f.name?.endsWith('.pdf'));
                    const txt = files.find(f => f.format === 'Text' || f.name?.endsWith('.txt'));

                    const file = epub || pdf || txt;
                    if (file) {
                        return {
                            url: `https://archive.org/download/${iaId}/${file.name}`,
                            title: iaData.metadata?.title || doc.title || 'Unknown',
                            author: doc.author_name?.join(', ') || iaData.metadata?.creator || 'Unknown',
                            source: 'Internet Archive',
                            ext: file.name?.split('.').pop() || 'pdf',
                            thumbnail: `https://archive.org/services/img/${iaId}`,
                        };
                    }
                } catch (_) {
                    continue;
                }
            }
            return null;
        },
    },
    {
        name: 'Standard Ebooks',
        search: async (query) => {
            // Standard Ebooks n'a pas d'API REST, mais on peut chercher via leur catalogue OPDS
            try {
                const { data } = await axios.get(
                    `https://standardebooks.org/opds/all?q=${encodeURIComponent(query)}`,
                    { timeout: 15000, headers: { 'Accept': 'application/xml' } }
                );
                // Extraction simplifiée du XML (à améliorer avec un parser XML si nécessaire)
                const epubMatch = data.match(/href="([^"]+\.epub)"/);
                const titleMatch = data.match(/<title>([^<]+)<\/title>/);
                const authorMatch = data.match(/<author>([^<]+)<\/author>/);

                if (epubMatch) {
                    return {
                        url: epubMatch[1],
                        title: titleMatch?.[1] || query,
                        author: authorMatch?.[1] || 'Unknown',
                        source: 'Standard Ebooks',
                        ext: 'epub',
                        thumbnail: '',
                    };
                }
            } catch (_) {}
            return null;
        },
    },
];

// ═══════════════════════════════════════
// UTILS
// ═══════════════════════════════════════

async function checkFileSize(url) {
    try {
        const head = await axios.head(url, { timeout: 10000, maxRedirects: 5 });
        const size = Number(head.headers['content-length'] || 0);
        return size;
    } catch (_) {
        return 0;
    }
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'bookdl',
    aliases: ['downloadbook', 'getbook', 'book2', 'ebook'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text:
                    '📖 *Book Downloader — Public Domain*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.bookdl <title or author>\n\n' +
                    '✨ *Examples:*\n' +
                    '.bookdl Pride and Prejudice\n' +
                    '.bookdl Dracula\n' +
                    '.bookdl Moby Dick\n' +
                    '.bookdl Jane Austen\n\n' +
                    '📚 *Sources:* Gutenberg, Google Books, Internet Archive, Standard Ebooks\n' +
                    '📦 *Max:* 20 MB\n' +
                    '🔓 *Public domain books only*',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        let found = null;

        // Essayer chaque source
        for (const source of BOOK_SOURCES) {
            try {
                console.log(`📖 Trying ${source.name}...`);
                found = await source.search(query);
                if (found?.url) {
                    console.log(`✅ Found: ${source.name}`);
                    break;
                }
            } catch (err) {
                console.log(`⚠️ ${source.name}: ${err.message}`);
            }
        }

        if (!found) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, {
                text:
                    '❌ *No Free Book Found*\n\n' +
                    'No downloadable public domain book found.\n\n' +
                    '💡 *Try these:*\n' +
                    '• Pride and Prejudice\n' +
                    '• Dracula\n' +
                    '• Frankenstein\n' +
                    '• The Great Gatsby\n' +
                    '• Moby Dick\n' +
                    '• Jane Eyre',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Vérifier la taille
        const fileSize = await checkFileSize(found.url);

        if (fileSize > MAX_SIZE) {
            try { await sock.sendMessage(jid, { react: { text: '⚠️', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, {
                text:
                    '⚠️ *Book Too Large*\n\n' +
                    `📌 *Title:* ${found.title}\n` +
                    `✍️ *Author:* ${found.author}\n` +
                    `📦 *Size:* ${(fileSize / 1048576).toFixed(2)} MB\n` +
                    `📊 *Max:* 20 MB\n\n` +
                    `🔗 *Download manually:* ${found.url}\n\n` +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Télécharger
        try { await sock.sendMessage(jid, { react: { text: '⬇️', key: msg.key } }); } catch (_) {}

        try {
            const response = await axios.get(found.url, {
                responseType: 'arraybuffer',
                timeout: TIMEOUT,
                maxContentLength: MAX_SIZE,
                maxRedirects: 5,
            });

            const buffer = Buffer.from(response.data);

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
            const safeName = found.title.replace(/[^a-z0-9\s-]/gi, '').trim().slice(0, 60);

            // MIME type selon l'extension
            const mimeMap = {
                'epub': 'application/epub+zip',
                'pdf': 'application/pdf',
                'mobi': 'application/x-mobipocket-ebook',
                'txt': 'text/plain',
                'html': 'text/html',
            };
            const mime = mimeMap[found.ext] || 'application/octet-stream';

            // Envoyer le livre
            await sock.sendMessage(jid, {
                document: buffer,
                mimetype: mime,
                fileName: `${safeName}.${found.ext}`,
                caption:
                    '📖 *Book Downloaded!*\n\n' +
                    `📌 *Title:* ${found.title}\n` +
                    `✍️ *Author:* ${found.author}\n` +
                    `📦 *Size:* ${sizeMB} MB\n` +
                    `📚 *Source:* ${found.source}\n\n` +
                    '🔓 *Public Domain — Free to share*\n\n' +
                    '⚡ _Zenitsu Book Downloader_',
                contextInfo: STYLE,
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ bookdl download:', err.message);
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
    },
};
