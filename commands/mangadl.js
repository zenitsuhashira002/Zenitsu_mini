// ./commands/mangadl.js

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

const MANGADEX_API = 'https://api.mangadex.org';
const MAX_PAGES = 30;
const activeSearches = new Map();

module.exports = {
    name: 'mangadl',
    aliases: ['mangadownload', 'dlmanga', 'mangachapter'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const input = args.join(' ').trim();

        if (!input) {
            return sock.sendMessage(jid, {
                text:
                    '📘 *Manga Downloader — MangaDex*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.mangadl <manga title>\n' +
                    '.mangadl <number> (select manga)\n' +
                    '.mangadl chap <number> (download chapter)\n\n' +
                    '💡 Search → select → download\n' +
                    '📦 Max 30 pages\n' +
                    '🔓 MangaDex (free & legal)',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // SELECT MANGA
        // ═══════════════════

        const numberMatch = input.match(/^(\d+)$/);
        if (numberMatch) {
            const idx = parseInt(numberMatch[1]) - 1;
            const stored = activeSearches.get(senderJid);
            if (!stored?.results?.length || stored.type !== 'manga_search') {
                return sock.sendMessage(jid, { text: '⚠️ Use .mangadl <title> first.', contextInfo: STYLE }, { quoted: msg });
            }
            if (idx < 0 || idx >= stored.results.length) {
                return sock.sendMessage(jid, { text: `⚠️ Choose 1-${stored.results.length}.`, contextInfo: STYLE }, { quoted: msg });
            }

            const manga = stored.results[idx];
            try { await sock.sendMessage(jid, { react: { text: '📖', key: msg.key } }); } catch (_) {}

            try {
                const { data: feedData } = await axios.get(
                    `${MANGADEX_API}/manga/${manga.id}/feed?translatedLanguage[]=en&limit=30&order[chapter]=desc`,
                    { timeout: 15000 }
                );
                const chapters = feedData?.data || [];
                if (!chapters.length) throw new Error('No chapters');

                activeSearches.set(senderJid, { type: 'chapter_list', manga, chapters, timestamp: Date.now() });

                let list = `📖 *${manga.title} — Chapters*\n\n`;
                chapters.slice(0, 100).forEach((ch, i) => {
                    const num = ch.attributes?.chapter || '?';
                    const title = ch.attributes?.title ? ` - ${ch.attributes.title}` : '';
                    list += `*${i + 1}.* Ch. ${num}${title}\n`;
                });
                list += '\n📌 .mangadl chap <number>\n⚡ _Zenitsu_';

                await sock.sendMessage(jid, { text: list, contextInfo: STYLE }, { quoted: msg });
                try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
            } catch (err) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                await sock.sendMessage(jid, { text: '❌ No chapters found.', contextInfo: STYLE }, { quoted: msg });
            }
            return;
        }

        // ═══════════════════
        // DOWNLOAD CHAPTER
        // ═══════════════════

        const chapMatch = input.match(/^chap\s+(\d+)$/i);
        if (chapMatch) {
            const idx = parseInt(chapMatch[1]) - 1;
            const stored = activeSearches.get(senderJid);
            if (!stored?.chapters?.length || stored.type !== 'chapter_list') {
                return sock.sendMessage(jid, { text: '⚠️ Select a manga first.', contextInfo: STYLE }, { quoted: msg });
            }
            if (idx < 0 || idx >= stored.chapters.length) {
                return sock.sendMessage(jid, { text: `⚠️ Choose 1-${stored.chapters.length}.`, contextInfo: STYLE }, { quoted: msg });
            }

            const chapter = stored.chapters[idx];
            const chapNum = chapter.attributes?.chapter || '?';

            try { await sock.sendMessage(jid, { react: { text: '⬇️', key: msg.key } }); } catch (_) {}

            try {
                // ⭐ Récupérer les URLs des pages (format corrigé)
                const { data: serverData } = await axios.get(
                    `${MANGADEX_API}/at-home/server/${chapter.id}`,
                    { timeout: 15000 }
                );

                const baseUrl = serverData?.baseUrl;
                const chapterHash = serverData?.chapter?.hash;
                const pageFiles = serverData?.chapter?.data || [];
                // dataSaver pour images compressées (plus rapide)
                const dataSaverFiles = serverData?.chapter?.dataSaver || pageFiles;

                if (!baseUrl || !pageFiles.length) throw new Error('No pages');

                // ⭐ Utiliser dataSaver pour plus de rapidité et moins d'erreurs
                const pages = dataSaverFiles.length > 0 ? dataSaverFiles : pageFiles;
                const pageCount = Math.min(pages.length, MAX_PAGES);

                await sock.sendMessage(jid, {
                    text: `📖 *Ch. ${chapNum}* — ${pageCount} pages...`,
                    contextInfo: STYLE,
                }, { quoted: msg });

                let sent = 0;

                for (let i = 0; i < pageCount; i++) {
                    // ⭐ URL CORRIGÉE : /data-saver/ au lieu de /data/
                    const imageUrl = `${baseUrl}/data-saver/${chapterHash}/${pages[i]}`;

                    await new Promise(r => setTimeout(r, 800)); // Délai AVANT chaque page

                    try {
                        const imgRes = await axios.get(imageUrl, {
                            responseType: 'arraybuffer',
                            timeout: 25000,
                            headers: {
                                'Referer': 'https://mangadex.org',
                                'User-Agent': 'Mozilla/5.0',
                            },
                        });
                        const buffer = Buffer.from(imgRes.data);

                        if (buffer.length > 500) {
                            await sock.sendMessage(jid, {
                                image: buffer,
                                caption: `📘 Ch. ${chapNum} — ${i + 1}/${pageCount}`,
                                contextInfo: STYLE,
                            });
                            sent++;
                        }
                    } catch (pageErr) {
                        // Fallback : essayer avec /data/ au lieu de /data-saver/
                        try {
                            const fallbackUrl = `${baseUrl}/data/${chapterHash}/${pages[i]}`;
                            const fbRes = await axios.get(fallbackUrl, {
                                responseType: 'arraybuffer',
                                timeout: 25000,
                                headers: { 'Referer': 'https://mangadex.org', 'User-Agent': 'Mozilla/5.0' },
                            });
                            const fbBuffer = Buffer.from(fbRes.data);
                            if (fbBuffer.length > 500) {
                                await sock.sendMessage(jid, {
                                    image: fbBuffer,
                                    caption: `📘 Ch. ${chapNum} — ${i + 1}/${pageCount}`,
                                    contextInfo: STYLE,
                                });
                                sent++;
                            }
                        } catch (_) {
                            console.log(`⚠️ Page ${i + 1} failed`);
                        }
                    }
                }

                await sock.sendMessage(jid, {
                    text: `✅ *Ch. ${chapNum}* — ${sent}/${pageCount} pages\n⚡ _Zenitsu_`,
                    contextInfo: STYLE,
                }, { quoted: msg });

                try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

            } catch (err) {
                console.error('❌ Download:', err.message);
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                await sock.sendMessage(jid, { text: `❌ ${err.message}`, contextInfo: STYLE }, { quoted: msg });
            }
            return;
        }

        // ═══════════════════
        // SEARCH
        // ═══════════════════

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            const { data } = await axios.get(
                `${MANGADEX_API}/manga?title=${encodeURIComponent(input)}&limit=5&includes[]=cover_art`,
                { timeout: 15000 }
            );
            const results = data?.data || [];
            if (!results.length) throw new Error('No results');

            const mangas = results.map(m => {
                const attr = m.attributes || {};
                const coverRel = m.relationships?.find(r => r.type === 'cover_art');
                const coverFileName = coverRel?.attributes?.fileName || '';
                return {
                    id: m.id,
                    title: attr.title?.en || Object.values(attr.title || {})[0] || 'Unknown',
                    coverUrl: coverFileName ? `https://uploads.mangadex.org/covers/${m.id}/${coverFileName}` : '',
                    status: attr.status || '?',
                    lastChapter: attr.lastChapter || '?',
                };
            });

            activeSearches.set(senderJid, { type: 'manga_search', results: mangas, timestamp: Date.now() });

            let reply = `📘 *Manga — ${input}*\n\n`;
            mangas.forEach((m, i) => {
                reply += `*${i + 1}.* ${m.title}\n   📊 ${m.status} | 📖 Ch: ${m.lastChapter}\n\n`;
            });
            reply += '📌 .mangadl <number>\n⏳ 5 min.';

            await sock.sendMessage(jid, { text: reply, contextInfo: STYLE }, { quoted: msg });
            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

            setTimeout(() => {
                if (activeSearches.get(senderJid)?.timestamp < Date.now() - 300000) activeSearches.delete(senderJid);
            }, 300000);

        } catch (err) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, { text: '❌ No manga found.', contextInfo: STYLE }, { quoted: msg });
        }
    },
};
