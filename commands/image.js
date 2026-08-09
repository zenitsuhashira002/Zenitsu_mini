// ./commands/image.js

const axios = require('axios');

// ═══════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════

const GCSE_KEY = 'AIzaSyDMbI3nvmQUrfjoCJYLS69Lej1hSXQjnWI';
const GCSE_CX = 'baf9bdb0c631236e5';
const MAX_IMAGES = 5;
const DELAY_BETWEEN = 1200;

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
// COMMANDE
// ═══════════════════════════════════════

module.exports = {
    name: 'image',
    aliases: ['img', 'pic', 'searchimage', 'googleimg'],
    category: 'search',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ').trim();

        if (!query || query.length < 2) {
            return sock.sendMessage(jid, {
                text: '🖼️ *Image Search*\n\n' +
                      '⚡ *Usage:* .image <search term>\n\n' +
                      '✨ *Examples:*\n' +
                      '.image cats\n' +
                      '.image beautiful sunset\n' +
                      '.image anime girl\n\n' +
                      `📌 Shows up to ${MAX_IMAGES} images.`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } });

            const { data } = await axios.get('https://www.googleapis.com/customsearch/v1', {
                params: {
                    q: query,
                    key: GCSE_KEY,
                    cx: GCSE_CX,
                    searchType: 'image',
                    num: MAX_IMAGES,
                    safe: 'off',
                },
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
                },
            });

            if (!data.items || data.items.length === 0) {
                await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(jid, {
                    text: `❌ *No images found for "${query}"*\n\n` +
                          '💡 Try a different search term.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

            // Envoyer les images
            let sentCount = 0;
            for (let i = 0; i < data.items.length; i++) {
                const item = data.items[i];
                const title = item.title || query;
                const imageUrl = item.link;
                const contextLink = item.image?.contextLink || '';

                try {
                    await sock.sendMessage(jid, {
                        image: { url: imageUrl },
                        caption: `🖼️ *Image ${i + 1}/${data.items.length}*\n\n` +
                                 `📌 *Title:* ${title.slice(0, 80)}${title.length > 80 ? '...' : ''}\n` +
                                 `🔍 *Search:* ${query}\n` +
                                 (contextLink ? `🔗 *Source:* ${contextLink.slice(0, 60)}...\n` : '') +
                                 `\n⚡ _Powered by Zenitsu_`,
                        contextInfo: STYLE,
                    }, { quoted: msg });
                    sentCount++;

                    // Pause entre les envois
                    if (i < data.items.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN));
                    }
                } catch (imgErr) {
                    console.warn(`⚠️ Image ${i + 1} skipped: ${imgErr.message}`);
                }
            }

            if (sentCount === 0) {
                return sock.sendMessage(jid, {
                    text: `❌ *Failed to send images*\n\n` +
                          '💡 All images failed to download. Try again later.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

        } catch (error) {
            console.error('❌ Image search error:', error.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: `❌ *Image Search Failed*\n\n` +
                      `⚠️ Error: ${error.message}\n\n` +
                      '💡 Try again later or use a different search term.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
