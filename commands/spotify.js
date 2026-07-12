
// ./commands/spotify.js

const axios = require('axios');

// ═══════════════════════════════════════
// STORE ACTIVE SEARCHES (per user)
// ═══════════════════════════════════════

const activeSearches = new Map();

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'spotify',
    aliases: ['spotifydl', 'spdl', 'spotifysearch'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const input = args.join(' ');

        // ═══════════════════════════════════════
        // NO ARGS → SHOW HELP
        // ═══════════════════════════════════════

        if (!input || input.trim().length < 1) {
            return sock.sendMessage(jid, {
                text:
                    '🎵 *Spotify Search & Download*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.spotify <song name>\n' +
                    '.spotify <number> (to download from results)\n\n' +
                    '✨ *Examples:*\n' +
                    '.spotify Blinding Lights\n' +
                    '.spotify 1 (after search, to download result #1)\n\n' +
                    '💡 Search first, then reply with the number.',
                contextInfo: {
                    forwardingScore: 350,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202,
                    },
                },
            }, { quoted: msg });
        }

        // ═══════════════════════════════════════
        // NUMBER INPUT → DOWNLOAD FROM STORED SEARCH
        // ═══════════════════════════════════════

        const numberMatch = input.match(/^(\d+)$/);

        if (numberMatch) {
            const selectedIndex = parseInt(numberMatch[1]) - 1;
            const stored = activeSearches.get(senderJid);

            if (!stored || !stored.results || stored.results.length === 0) {
                return sock.sendMessage(jid, {
                    text: '⚠️ *No active search*\n\nUse .spotify <song name> first to search.',
                    contextInfo: {
                        forwardingScore: 350,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363425394543602@newsletter',
                            newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                            serverMessageId: 202,
                        },
                    },
                }, { quoted: msg });
            }

            if (selectedIndex < 0 || selectedIndex >= stored.results.length) {
                return sock.sendMessage(jid, {
                    text: `⚠️ *Invalid number*\n\nChoose between 1 and ${stored.results.length}.`,
                    contextInfo: {
                        forwardingScore: 350,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363425394543602@newsletter',
                            newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                            serverMessageId: 202,
                        },
                    },
                }, { quoted: msg });
            }

            const selected = stored.results[selectedIndex];

            try { await sock.sendMessage(jid, { react: { text: '⬇️', key: msg.key } }); } catch (_) {}

            return downloadSpotify(sock, msg, jid, selected.url, selected.title, selected.artist);
        }

        // ═══════════════════════════════════════
        // TEXT INPUT → SEARCH
        // ═══════════════════════════════════════

        const query = input;

        try { await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        try {
            const { data } = await axios.get(
                `https://api.giftedtech.co.ke/api/search/spotifysearch?apikey=gifted&query=${encodeURIComponent(query)}`,
                { timeout: 30000 }
            );

            // Extract results
            let results = [];
            if (data?.results && Array.isArray(data.results)) {
                results = data.results;
            } else if (data?.data && Array.isArray(data.data)) {
                results = data.data;
            } else if (Array.isArray(data)) {
                results = data;
            }

            if (results.length === 0) {
                throw new Error('No results found');
            }

            // Store results for this user
            const maxResults = Math.min(results.length, 5);
            const cleanedResults = results.slice(0, maxResults).map(item => ({
                title: item.title || item.name || 'Unknown',
                artist: item.artist || item.artists || item.author || 'Unknown',
                url: item.url || item.link || item.track_url || '',
                album: item.album || '',
                duration: item.duration || '',
            }));

            activeSearches.set(senderJid, {
                results: cleanedResults,
                timestamp: Date.now(),
            });

            // Build response
            let replyText = `🎵 *Spotify Search: ${query}*\n\n`;

            cleanedResults.forEach((item, i) => {
                replyText += `*${i + 1}.* ${item.title}\n`;
                replyText += `   🎤 ${item.artist}\n`;
                if (item.album) replyText += `   💿 ${item.album}\n`;
                if (item.duration) replyText += `   ⏱ ${item.duration}\n`;
                replyText += '\n';
            });

            replyText +=
                `📌 *Reply with:* .spotify <number>\n` +
                `⚡ _Example: .spotify 1_\n\n` +
                `⏳ Results expire in 5 minutes.`;

            await sock.sendMessage(jid, {
                text: replyText,
                contextInfo: {
                    forwardingScore: 350,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202,
                    },
                },
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

            // Auto-clean after 5 minutes
            setTimeout(() => {
                const stored = activeSearches.get(senderJid);
                if (stored && Date.now() - stored.timestamp > 300000) {
                    activeSearches.delete(senderJid);
                }
            }, 300000);

        } catch (err) {
            console.error('❌ spotify search error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            await sock.sendMessage(jid, {
                text:
                    '❌ *Search Failed*\n\n' +
                    'No results found. Try a different search term.\n\n' +
                    '⚡ _Example: .spotify Blinding Lights_',
                contextInfo: {
                    forwardingScore: 350,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202,
                    },
                },
            }, { quoted: msg });
        }
    },
};

// ═══════════════════════════════════════
// DOWNLOAD FUNCTION
// ═══════════════════════════════════════

async function downloadSpotify(sock, msg, jid, trackUrl, title, artist) {
    try {
        const encodedUrl = encodeURIComponent(trackUrl);

        const { data } = await axios.get(
            `https://api.giftedtech.co.ke/api/download/spotifydlv4?apikey=gifted&url=${encodedUrl}`,
            { timeout: 90000 }
        );

        let downloadUrl = null;
        if (data?.result?.download_url) downloadUrl = data.result.download_url;
        else if (data?.url) downloadUrl = data.url;
        else if (data?.link) downloadUrl = data.link;
        else if (data?.download_url) downloadUrl = data.download_url;
        else if (typeof data === 'string' && data.startsWith('http')) downloadUrl = data;

        if (!downloadUrl) throw new Error('No download URL');

        // Download the audio
        const audioRes = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
        });

        const buffer = Buffer.from(audioRes.data);
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        // Send as audio
        await sock.sendMessage(jid, {
            audio: buffer,
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: `${title.substring(0, 100)}.mp3`,
        }, { quoted: msg });

        // Send info
        await sock.sendMessage(jid, {
            text:
                `🎵 *Spotify Download*\n\n` +
                `📌 *Title:* ${title}\n` +
                `🎤 *Artist:* ${artist}\n` +
                `📦 *Size:* ${sizeMB} MB\n` +
                `🔗 ${trackUrl}\n\n` +
                `⚡ _Downloaded by Zenitsu_`,
            contextInfo: {
                forwardingScore: 350,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363425394543602@newsletter',
                    newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                    serverMessageId: 202,
                },
            },
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (err) {
        console.error('❌ spotify download error:', err.message);
        try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

        await sock.sendMessage(jid, {
            text:
                '❌ *Download Failed*\n\n' +
                `${err.message}\n\n` +
                '⚡ Try again or another search',
            contextInfo: {
                forwardingScore: 350,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363425394543602@newsletter',
                    newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                    serverMessageId: 202,
                },
            },
        }, { quoted: msg });
    }
}
