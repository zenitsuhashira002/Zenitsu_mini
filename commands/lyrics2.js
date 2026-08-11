// ./commands/lyrics.js

const axios = require('axios');

// ═══════════════════════════════════════
// STYLE CYBERNOVA
// ═══════════════════════════════════════

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
// UTILITAIRES
// ═══════════════════════════════════════

function cleanLyrics(text) {
    // Supprimer les lignes de crédits et d'informations inutiles
    const lines = text.split('\n');
    const cleanLines = [];
    let skipNext = false;
    
    for (const line of lines) {
        // Ignorer les lignes de crédits
        if (line.includes('Contributors') || 
            line.includes('Translations') || 
            line.includes('Read More') ||
            line.includes('Lyrics')) {
            skipNext = true;
            continue;
        }
        
        if (skipNext && line.trim() === '') {
            skipNext = false;
            continue;
        }
        
        if (skipNext) {
            skipNext = false;
            continue;
        }
        
        cleanLines.push(line);
    }
    
    return cleanLines.join('\n').trim();
}

// ═══════════════════════════════════════
// APIS DE FALLBACK
// ═══════════════════════════════════════

const LYRICS_APIS = [
    {
        name: 'Popcat',
        fn: async (song) => {
            const { data } = await axios.get(
                `https://api.popcat.xyz/v2/lyrics?song=${encodeURIComponent(song)}`,
                { timeout: 15000 }
            );
            if (!data?.error && data?.message) {
                return {
                    title: data.message.title,
                    artist: data.message.artist,
                    lyrics: data.message.lyrics,
                    image: data.message.image,
                };
            }
            return null;
        }
    },
    {
        name: 'Genius (via Popcat)',
        fn: async (song) => {
            // Fallback avec le même endpoint
            const { data } = await axios.get(
                `https://api.popcat.xyz/v2/lyrics?song=${encodeURIComponent(song)}`,
                { timeout: 15000 }
            );
            if (!data?.error && data?.message) {
                return {
                    title: data.message.title,
                    artist: data.message.artist,
                    lyrics: data.message.lyrics,
                    image: data.message.image,
                };
            }
            return null;
        }
    }
];

// ═══════════════════════════════════════
// COMMANDE
// ═══════════════════════════════════════

module.exports = {
    name: 'lyrics',
    aliases: ['paroles', 'songtext', 'lirik'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text: '🎵 *Lyrics Finder*\n\n' +
                      '⚡ *Usage:* .lyrics2 <song name>\n\n' +
                      '✨ *Examples:*\n' +
                      '.lyrics2 Never Gonna Give You Up\n' +
                      '.lyrics2 Bohemian Rhapsody\n' +
                      '.lyrics2 Shape of You\n\n' +
                      '📌 Search for song lyrics from Genius.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '🎵', key: msg.key } });

            let result = null;
            let usedApi = '';

            for (const api of LYRICS_APIS) {
                try {
                    const res = await api.fn(query);
                    if (res && res.lyrics) {
                        result = res;
                        usedApi = api.name;
                        console.log(`✅ Lyrics: ${api.name}`);
                        break;
                    }
                } catch (err) {
                    console.log(`⚠️ Lyrics ${api.name}: ${err.message}`);
                }
            }

            if (!result) {
                await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(jid, {
                    text: '❌ *No lyrics found*\n\n' +
                          `🔍 *Search:* ${query}\n\n` +
                          '💡 Try a different song or check the spelling.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Nettoyer les paroles
            let lyrics = cleanLyrics(result.lyrics);
            
            // Limiter la longueur
            if (lyrics.length > 4000) {
                lyrics = lyrics.slice(0, 3900) + '\n\n... [truncated]';
            }

            // Construire le message
            let message = `🎵 *${result.title}*\n` +
                         `👤 *Artist:* ${result.artist}\n\n` +
                         `📝 *Lyrics:*\n${lyrics}\n\n` +
                         `🔧 *Source:* ${usedApi}\n` +
                         `⚡ _Powered by Cybernova_`;

            // Envoyer avec l'image si disponible
            if (result.image) {
                try {
                    const imgResponse = await axios.get(result.image, {
                        responseType: 'arraybuffer',
                        timeout: 10000,
                    });
                    const buffer = Buffer.from(imgResponse.data);

                    await sock.sendMessage(jid, {
                        image: buffer,
                        caption: message,
                        contextInfo: STYLE,
                    }, { quoted: msg });
                } catch (_) {
                    // Fallback: envoyer sans image
                    await sock.sendMessage(jid, {
                        text: message,
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }
            } else {
                await sock.sendMessage(jid, {
                    text: message,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('❌ Lyrics error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to fetch lyrics*\n\n' +
                      `⚠️ Error: ${err.message}\n\n` +
                      '💡 Try again with a different song.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
