// ./commands/mangadl.js

const axios = require('axios');

const STYLE = {
    forwardingScore: 355,
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

// Langues supportées (en priorité)
const LANGUAGES = ['en', 'fr', 'es', 'pt-br', 'de', 'it', 'ja', 'ko', 'zh'];

module.exports = {
    name: 'mangadl2',
    aliases: ['mangadownload', 'dlmanga', 'mangachapter'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const input = args.join(' ').trim();

        if (!input) {
            return sock.sendMessage(jid, {
                text: '📘 *Manga Downloader — MangaDex*\n\n' +
                      '⚡ *Usage:*\n' +
                      '.mangadl2 <manga title>\n' +
                      '.mangadl2 <number> (select manga)\n' +
                      '.mangadl2 chap <number> (download chapter)\n\n' +
                      '💡 Search → select → download\n' +
                      '📦 Max 30 pages per chapter\n' +
                      '🌍 Multi-language support (EN, FR, ES, etc.)\n' +
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
                return sock.sendMessage(jid, {
                    text: '⚠️ Use .mangadl2 <title> first.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
            if (idx < 0 || idx >= stored.results.length) {
                return sock.sendMessage(jid, {
                    text: `⚠️ Choose 1-${stored.results.length}.`,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const manga = stored.results[idx];
            try { await sock.sendMessage(jid, { react: { text: '📖', key: msg.key } }); } catch (_) {}

            try {
                // Récupérer les chapitres (avec fallback sur plusieurs langues)
                let feedData = null;
                let usedLang = 'en';

                for (const lang of LANGUAGES) {
                    try {
                        const { data } = await axios.get(
                            `${MANGADEX_API}/manga/${manga.id}/feed?translatedLanguage[]=${lang}&limit=50&order[chapter]=desc`,
                            { timeout: 12000 }
                        );
                        if (data?.data?.length > 0) {
                            feedData = data;
                            usedLang = lang;
                            console.log(`📚 Found chapters in ${lang}`);
                            break;
                        }
                    } catch (_) {
                        continue;
                    }
                }

                const chapters = feedData?.data || [];
                if (!chapters.length) throw new Error('No chapters found');

                activeSearches.set(senderJid, {
                    type: 'chapter_list',
                    manga,
                    chapters,
                    usedLang,
                    timestamp: Date.now(),
                });

                let list = `📖 *${manga.title}*\n` +
                           `🌍 *Language:* ${usedLang.toUpperCase()}\n` +
                           `📚 *Chapters Available:* ${chapters.length}\n\n`;

                // Afficher 100 premiers chapitres
                chapters.slice(0, 100).forEach((ch, i) => {
                    const num = ch.attributes?.chapter || '?';
                    const title = ch.attributes?.title ? ` - ${ch.attributes.title}` : '';
                    list += `*${i + 1}.* Ch. ${num}${title}\n`;
                });

                if (chapters.length > 100) {
                    list += `\n_... and ${chapters.length - 100} more chapters_\n`;
                }

                list += '\n📌 .mangadl2 chap <number>\n⚡ _Zenitsu_';

                await sock.sendMessage(jid, { text: list, contextInfo: STYLE }, { quoted: msg });
                try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

            } catch (err) {
                console.error('❌ Chapters fetch:', err.message);
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                await sock.sendMessage(jid, {
                    text: `❌ ${err.message}`,
                    contextInfo: STYLE,
                }, { quoted: msg });
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
                return sock.sendMessage(jid, {
                    text: '⚠️ Select a manga first.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
            if (idx < 0 || idx >= stored.chapters.length) {
                return sock.sendMessage(jid, {
                    text: `⚠️ Choose 1-${stored.chapters.length}.`,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const chapter = stored.chapters[idx];
            const chapNum = chapter.attributes?.chapter || '?';

            try { await sock.sendMessage(jid, { react: { text: '⬇️', key: msg.key } }); } catch (_) {}

            try {
                const { data: serverData } = await axios.get(
                    `${MANGADEX_API}/at-home/server/${chapter.id}`,
                    { timeout: 15000 }
                );

                const baseUrl = serverData?.baseUrl;
                const chapterHash = serverData?.chapter?.hash;
                const pageFiles = serverData?.chapter?.data || [];
                const dataSaverFiles = serverData?.chapter?.dataSaver || pageFiles;

                if (!baseUrl || !pageFiles.length) throw new Error('No pages found');

                const pages = dataSaverFiles.length > 0 ? dataSaverFiles : pageFiles;
                const pageCount = Math.min(pages.length, MAX_PAGES);

                await sock.sendMessage(jid, {
                    text: `📖 *Ch. ${chapNum}* — ${pageCount} pages...\n⏳ Downloading...`,
                    contextInfo: STYLE,
                }, { quoted: msg });

                let sent = 0;
                let failed = 0;

                for (let i = 0; i < pageCount; i++) {
                    // Première tentative: dataSaver
                    const dataSaverUrl = `${baseUrl}/data-saver/${chapterHash}/${pages[i]}`;
                    const standardUrl = `${baseUrl}/data/${chapterHash}/${pages[i]}`;

                    await new Promise(r => setTimeout(r, 600));

                    let pageLoaded = false;

                    // Fallback 1: dataSaver
                    if (!pageLoaded) {
                        try {
                            const imgRes = await axios.get(dataSaverUrl, {
                                responseType: 'arraybuffer',
                                timeout: 20000,
                                headers: {
                                    'Referer': 'https://mangadex.org',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
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
                                pageLoaded = true;
                            }
                        } catch (_) {
                            // Essayer la suivante
                        }
                    }

                    // Fallback 2: Standard quality
                    if (!pageLoaded) {
                        try {
                            const imgRes = await axios.get(standardUrl, {
                                responseType: 'arraybuffer',
                                timeout: 20000,
                                headers: {
                                    'Referer': 'https://mangadex.org',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
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
                                pageLoaded = true;
                            }
                        } catch (_) {
                            // Essayer la suivante
                        }
                    }

                    // Fallback 3: Retry avec délai plus long
                    if (!pageLoaded && i < pageCount - 1) {
                        try {
                            await new Promise(r => setTimeout(r, 2000));
                            const imgRes = await axios.get(dataSaverUrl, {
                                responseType: 'arraybuffer',
                                timeout: 25000,
                                headers: {
                                    'Referer': 'https://mangadex.org',
                                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
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
                                pageLoaded = true;
                            }
                        } catch (_) {
                            failed++;
                            console.log(`⚠️ Page ${i + 1} failed after retries`);
                        }
                    }

                    if (!pageLoaded) {
                        failed++;
                    }
                }

                const successRate = Math.round((sent / pageCount) * 100);
                await sock.sendMessage(jid, {
                    text: `✅ *Ch. ${chapNum}* — ${sent}/${pageCount} pages (${successRate}%)\n` +
                          `${failed > 0 ? `⚠️ Failed: ${failed} pages\n` : ''}` +
                          `⚡ _Zenitsu_`,
                    contextInfo: STYLE,
                }, { quoted: msg });

                try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

            } catch (err) {
                console.error('❌ Download:', err.message);
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                await sock.sendMessage(jid, {
                    text: `❌ ${err.message}`,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
            return;
        }

        // ═══════════════════
        // SEARCH (100 résultats)
        // ═══════════════════

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            const { data } = await axios.get(
                `${MANGADEX_API}/manga?title=${encodeURIComponent(input)}&limit=50&includes[]=cover_art&order[relevance]=desc`,
                { timeout: 15000 }
            );
            let results = data?.data || [];
            
            if (!results.length) throw new Error('No results');

            // Mélanger les résultats pour prendre en compte les différentes langues
            results = results.sort(() => Math.random() - 0.5).slice(0, 100);

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
                    contentRating: attr.contentRating || 'safe',
                };
            });

            activeSearches.set(senderJid, { type: 'manga_search', results: mangas, timestamp: Date.now() });

            let reply = `📘 *Manga Search — "${input}"*\n` +
                       `📊 *Results:* ${mangas.length}\n\n`;

            // Afficher les 100 premiers
            mangas.slice(0, 100).forEach((m, i) => {
                reply += `*${i + 1}.* ${m.title}\n   📊 ${m.status} | 📖 Ch: ${m.lastChapter}\n`;
            });

            if (mangas.length > 100) {
                reply += `\n_... and ${mangas.length - 100} more results_\n`;
            }

            reply += '\n📌 .mangadl2 <number>\n⏳ 5 min timeout\n⚡ _Zenitsu_';

            await sock.sendMessage(jid, { text: reply, contextInfo: STYLE }, { quoted: msg });
            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

            // Cleanup après 5 minutes
            setTimeout(() => {
                if (activeSearches.get(senderJid)?.timestamp < Date.now() - 300000) {
                    activeSearches.delete(senderJid);
                }
            }, 300000);

        } catch (err) {
            console.error('❌ Search error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: `❌ ${err.message}\n\n💡 Try with a different query.`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
