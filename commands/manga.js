// ./commands/manga.js

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
    name: 'manga',
    aliases: ['mangasearch', 'searchmanga'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text:
                    '📘 *Manga Search*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.manga <title>\n\n' +
                    '✨ *Examples:*\n' +
                    '.manga One Piece\n' +
                    '.manga Attack on Titan\n' +
                    '.manga Demon Slayer',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            // AniList GraphQL
            const query_gql = `
                query ($search: String) {
                    Page(perPage: 5) {
                        media(search: $search, type: MANGA) {
                            id
                            title { romaji english native }
                            description
                            coverImage { large extraLarge }
                            bannerImage
                            chapters
                            volumes
                            status
                            startDate { year month day }
                            averageScore
                            genres
                            siteUrl
                        }
                    }
                }
            `;

            const { data } = await axios.post(
                'https://graphql.anilist.co',
                { query: query_gql, variables: { search: query } },
                { timeout: 15000 }
            );

            const mangas = data?.data?.Page?.media;
            if (!mangas || mangas.length === 0) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: '❌ No manga found.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            for (let i = 0; i < Math.min(mangas.length, 5); i++) {
                const manga = mangas[i];
                const title = manga.title?.english || manga.title?.romaji || manga.title?.native || 'Unknown';
                const nativeTitle = manga.title?.native ? ` (${manga.title.native})` : '';
                const chapters = manga.chapters || '?';
                const volumes = manga.volumes || '?';
                const status = manga.status?.replace(/_/g, ' ') || '?';
                const score = manga.averageScore ? `${manga.averageScore}%` : '?';
                const genres = manga.genres?.join(', ') || '?';
                const description = manga.description?.replace(/<[^>]+>/g, '').slice(0, 400) || '';

                let caption =
                    `📘 *Manga ${i + 1}/${Math.min(mangas.length, 5)}*\n\n` +
                    `📌 *Title:* ${title}${nativeTitle}\n` +
                    `📖 *Chapters:* ${chapters}\n` +
                    `📚 *Volumes:* ${volumes}\n` +
                    `📊 *Status:* ${status}\n` +
                    `⭐ *Score:* ${score}\n` +
                    `🎭 *Genres:* ${genres}\n`;

                if (description) caption += `\n📝 *Synopsis:* ${description}...\n`;

                caption +=
                    `\n🔗 ${manga.siteUrl}\n` +
                    '\n⚡ _Zenitsu_';

                const coverImage = manga.coverImage?.extraLarge || manga.coverImage?.large || '';

                if (coverImage && coverImage.startsWith('http')) {
                    try {
                        await sock.sendMessage(jid, {
                            image: { url: coverImage },
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
            console.error('❌ manga:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: '❌ Manga search failed.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
