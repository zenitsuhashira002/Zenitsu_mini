// ./commands/anime.js

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
    name: 'anime',
    aliases: ['animu', 'manga'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text:
                    '🎌 *Anime Search*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.anime <title>\n\n' +
                    '✨ *Examples:*\n' +
                    '.anime Naruto\n' +
                    '.anime Demon Slayer\n' +
                    '.anime One Piece',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            // GraphQL query vers AniList
            const query_gql = `
                query ($search: String) {
                    Media(search: $search, type: ANIME) {
                        id
                        title { romaji english native }
                        description
                        coverImage { large extraLarge }
                        bannerImage
                        episodes
                        duration
                        status
                        season
                        seasonYear
                        averageScore
                        popularity
                        genres
                        studios { nodes { name } }
                        siteUrl
                        trailer { id site }
                    }
                }
            `;

            const { data } = await axios.post(
                'https://graphql.anilist.co',
                { query: query_gql, variables: { search: query } },
                { timeout: 15000 }
            );

            const anime = data?.data?.Media;
            if (!anime) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: '❌ Anime not found.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Construire les infos
            const title = anime.title?.english || anime.title?.romaji || anime.title?.native || 'Unknown';
            const nativeTitle = anime.title?.native ? ` (${anime.title.native})` : '';
            const episodes = anime.episodes || '?';
            const duration = anime.duration ? `${anime.duration} min` : '?';
            const status = anime.status?.replace(/_/g, ' ') || '?';
            const season = anime.season ? `${anime.season} ${anime.seasonYear || ''}` : '?';
            const score = anime.averageScore ? `${anime.averageScore}%` : '?';
            const genres = anime.genres?.join(', ') || '?';
            const studios = anime.studios?.nodes?.map(s => s.name).join(', ') || '?';
            const description = anime.description?.replace(/<[^>]+>/g, '').slice(0, 500) || '';

            let caption =
                '🎌 *Anime Info*\n\n' +
                `📌 *Title:* ${title}${nativeTitle}\n` +
                `📺 *Episodes:* ${episodes}\n` +
                `⏱ *Duration:* ${duration}\n` +
                `📊 *Status:* ${status}\n` +
                `📅 *Season:* ${season}\n` +
                `⭐ *Score:* ${score}\n` +
                `🎭 *Genres:* ${genres}\n` +
                `🏢 *Studios:* ${studios}\n`;

            if (description) caption += `\n📝 *Synopsis:* ${description.slice(0, 400)}...\n`;

            caption +=
                `\n🔗 ${anime.siteUrl}\n` +
                '\n⚡ _Zenitsu_';

            // Envoyer avec l'image de couverture
            const coverImage = anime.coverImage?.extraLarge || anime.coverImage?.large || '';
            const bannerImage = anime.bannerImage || '';

            // Essayer d'envoyer la bannière d'abord
            if (bannerImage && bannerImage.startsWith('http')) {
                try {
                    await sock.sendMessage(jid, {
                        image: { url: bannerImage },
                        caption: caption,
                        contextInfo: STYLE,
                    }, { quoted: msg });
                } catch (_) {
                    await sock.sendMessage(jid, { text: caption, contextInfo: STYLE }, { quoted: msg });
                }
            } else if (coverImage && coverImage.startsWith('http')) {
                try {
                    await sock.sendMessage(jid, {
                        image: { url: coverImage },
                        caption: caption,
                        contextInfo: STYLE,
                    }, { quoted: msg });
                } catch (_) {
                    await sock.sendMessage(jid, { text: caption, contextInfo: STYLE }, { quoted: msg });
                }
            } else {
                await sock.sendMessage(jid, { text: caption, contextInfo: STYLE }, { quoted: msg });
            }

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ anime:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: '❌ Anime search failed.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
