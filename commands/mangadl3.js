// ./commands/mangadl2.js
const axios = require('axios');
const { PDFDocument } = require('pdf-lib');
const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, BorderStyle } = require('docx');
const fs = require('fs');
const path = require('path');

const STYLE = {
    forwardingScore: 355,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 340,
    },
};

const MANGADEX_API = 'https://api.mangadex.org';
const MAX_PAGES = 50;
const TEMP_DIR = '/tmp/zenitsu-manga';
const activeSearches = new Map();

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const LANGUAGES = ['en', 'fr', 'es', 'pt-br', 'de', 'it', 'ja', 'ko', 'zh'];

module.exports = {
    name: 'mangadl3',
    aliases: ['mangabook', 'mangapdf', 'mangadocx'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const input = args.join(' ').trim();

        if (!input) {
            return sock.sendMessage(jid, {
                text: '📚 *Manga to Book — PDF/DOCX Converter*\n\n' +
                      '⚡ *Usage:*\n' +
                      '.mangadl3 <manga title>\n' +
                      '.mangadl3 <number> (select manga)\n' +
                      '.mangadl3 pdf <chapter number> (PDF)\n' +
                      '.mangadl3 docx <chapter number> (DOCX)\n\n' +
                      '💡 Search → select → choose format\n' +
                      '📖 PDF for reading | 📝 DOCX for editing\n' +
                      '📦 Up to 50 pages per chapter\n' +
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
                    text: '⚠️ Use .mangadl3 <title> first.',
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

                let list = `📚 *${manga.title}*\n` +
                           `🌍 *Language:* ${usedLang.toUpperCase()}\n` +
                           `📚 *Chapters:* ${chapters.length}\n\n` +
                           `💾 *Export to:* PDF or DOCX\n\n`;

                chapters.slice(0, 100).forEach((ch, i) => {
                    const num = ch.attributes?.chapter || '?';
                    const title = ch.attributes?.title ? ` - ${ch.attributes.title}` : '';
                    list += `*${i + 1}.* Ch. ${num}${title}\n`;
                });

                if (chapters.length > 100) {
                    list += `\n_... and ${chapters.length - 100} more chapters_\n`;
                }

                list += '\n📌 .mangadl2 pdf <number>\n📌 .mangadl2 docx <number>\n⚡ _Zenitsu_';

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
        // EXPORT CHAPTER TO PDF/DOCX
        // ═══════════════════

        const pdfMatch = input.match(/^pdf\s+(\d+)$/i);
        const docxMatch = input.match(/^docx\s+(\d+)$/i);
        const format = pdfMatch ? 'pdf' : docxMatch ? 'docx' : null;

        if (format) {
            const idx = parseInt((pdfMatch || docxMatch)[1]) - 1;
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
            const fileId = `${stored.manga.id}_ch${chapNum}_${Date.now()}`;

            try { await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } }); } catch (_) {}

            try {
                await sock.sendMessage(jid, {
                    text: `📖 *Ch. ${chapNum}* — Converting to ${format.toUpperCase()}...\n⏳ This may take a moment...`,
                    contextInfo: STYLE,
                }, { quoted: msg });

                // Fetch pages
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

                // Télécharger les images
                const images = [];
                let downloaded = 0;

                for (let i = 0; i < pageCount; i++) {
                    const dataSaverUrl = `${baseUrl}/data-saver/${chapterHash}/${pages[i]}`;
                    const standardUrl = `${baseUrl}/data/${chapterHash}/${pages[i]}`;

                    await new Promise(r => setTimeout(r, 500));

                    let buffer = null;

                    // Fallback 1: dataSaver
                    try {
                        const res = await axios.get(dataSaverUrl, {
                            responseType: 'arraybuffer',
                            timeout: 20000,
                            headers: { 'Referer': 'https://mangadex.org', 'User-Agent': 'Mozilla/5.0' },
                        });
                        buffer = Buffer.from(res.data);
                    } catch (_) {
                        // Fallback 2: standard
                        try {
                            const res = await axios.get(standardUrl, {
                                responseType: 'arraybuffer',
                                timeout: 20000,
                                headers: { 'Referer': 'https://mangadex.org', 'User-Agent': 'Mozilla/5.0' },
                            });
                            buffer = Buffer.from(res.data);
                        } catch (_) {
                            console.log(`⚠️ Page ${i + 1} skipped`);
                            continue;
                        }
                    }

                    if (buffer && buffer.length > 500) {
                        images.push({ buffer, index: i + 1 });
                        downloaded++;
                    }
                }

                if (images.length === 0) throw new Error('No images downloaded');

                // Créer le fichier (PDF ou DOCX)
                const filePath = path.join(TEMP_DIR, `${fileId}.${format}`);

                if (format === 'pdf') {
                    await createPDF(images, stored.manga.title, chapNum, filePath);
                } else {
                    await createDOCX(images, stored.manga.title, chapNum, filePath);
                }

                // Envoyer le fichier
                const fileBuffer = fs.readFileSync(filePath);
                const fileName = `${stored.manga.title.replace(/[^a-z0-9]/gi, '_')}_Ch${chapNum}.${format}`;

                await sock.sendMessage(jid, {
                    document: fileBuffer,
                    fileName,
                    mimetype: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    caption: `📚 *${stored.manga.title} — Ch. ${chapNum}*\n` +
                             `📄 Format: ${format.toUpperCase()}\n` +
                             `📖 Pages: ${downloaded}/${pageCount}\n` +
                             `⚡ _Zenitsu_`,
                    contextInfo: STYLE,
                }, { quoted: msg });

                // Cleanup
                fs.unlinkSync(filePath);

                try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

            } catch (err) {
                console.error('❌ Export error:', err.message);
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                await sock.sendMessage(jid, {
                    text: `❌ ${err.message}`,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
            return;
        }

        // ═══════════════════
        // SEARCH
        // ═══════════════════

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            const { data } = await axios.get(
                `${MANGADEX_API}/manga?title=${encodeURIComponent(input)}&limit=50&includes[]=cover_art&order[relevance]=desc`,
                { timeout: 15000 }
            );
            let results = data?.data || [];

            if (!results.length) throw new Error('No results');

            results = results.sort(() => Math.random() - 0.5).slice(0, 50);

            const mangas = results.map(m => {
                const attr = m.attributes || {};
                const coverRel = m.relationships?.find(r => r.type === 'cover_art');
                const coverFileName = coverRel?.attributes?.fileName || '';
                return {
                    id: m.id,
                    title: attr.title?.en || Object.values(attr.title || {})[0] || 'Unknown',
                    status: attr.status || '?',
                    lastChapter: attr.lastChapter || '?',
                };
            });

            activeSearches.set(senderJid, { type: 'manga_search', results: mangas, timestamp: Date.now() });

            let reply = `📚 *Manga to Book — "${input}"*\n` +
                       `📊 *Results:* ${mangas.length}\n\n`;

            mangas.slice(0, 100).forEach((m, i) => {
                reply += `*${i + 1}.* ${m.title}\n   📊 ${m.status} | 📖 Ch: ${m.lastChapter}\n`;
            });

            if (mangas.length > 100) {
                reply += `\n_... and ${mangas.length - 100} more results_\n`;
            }

            reply += '\n📌 .mangadl3 <number>\n⏳ 5 min timeout\n⚡ _Zenitsu_';

            await sock.sendMessage(jid, { text: reply, contextInfo: STYLE }, { quoted: msg });
            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

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

// ═══════════════════════════════════════
// PDF CREATION FUNCTION
// ═══════════════════════════════════════
async function createPDF(images, mangaTitle, chapNum, outputPath) {
    const pdfDoc = await PDFDocument.create();

    for (const img of images) {
        try {
            const pngOrJpg = img.buffer[0] === 0xFF ? 'jpg' : 'png';
            const embeddedImg = pngOrJpg === 'jpg'
                ? await pdfDoc.embedJpg(img.buffer)
                : await pdfDoc.embedPng(img.buffer);

            const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
            page.drawImage(embeddedImg, { x: 0, y: 0, width: embeddedImg.width, height: embeddedImg.height });
        } catch (err) {
            console.log(`⚠️ Could not embed image ${img.index}: ${err.message}`);
        }
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    console.log(`✅ PDF created: ${outputPath}`);
}

// ═══════════════════════════════════════
// DOCX CREATION FUNCTION
// ═══════════════════════════════════════
async function createDOCX(images, mangaTitle, chapNum, outputPath) {
    const sections = [];

    // Titre
    sections.push(
        new Paragraph({
            text: `${mangaTitle} — Chapter ${chapNum}`,
            heading: 'Heading1',
            alignment: 'center',
        })
    );

    // Ajouter les images
    for (const img of images) {
        try {
            const base64 = img.buffer.toString('base64');
            sections.push(
                new Paragraph({
                    text: `\n`,
                }),
                new Paragraph({
                    text: `Page ${img.index}`,
                    alignment: 'center',
                    italics: true,
                })
            );

            // Note: DOCX a des limites pour les images. On va créer des sections avec les images
            sections.push(
                new Table({
                    rows: [
                        new TableRow({
                            cells: [
                                new TableCell({
                                    children: [
                                        new Paragraph({
                                            children: [
                                                {
                                                    type: 'image',
                                                    data: base64,
                                                    transformation: { width: 500, height: 700 },
                                                },
                                            ],
                                        }),
                                    ],
                                    borders: { top: { style: BorderStyle.NONE } },
                                }),
                            ],
                        }),
                    ],
                })
            );
        } catch (err) {
            console.log(`⚠️ Could not add image ${img.index} to DOCX`);
        }
    }

    const doc = new Document({ sections: [{ children: sections }] });
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ DOCX created: ${outputPath}`);
}
