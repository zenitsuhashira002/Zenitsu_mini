// ./commands/ssweb.js

const axios = require('axios');

module.exports = {
    name: 'ssweb',
    aliases: ['ss', 'screenshot', 'ssmobile'],
    category: 'tools',

    async execute({ sock, msg, args, jid }) {
        let url = args[0];

        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
            return sock.sendMessage(jid, {
                text:
                    '📸 *Website Screenshot*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.ssweb <url>\n\n' +
                    '✨ *Examples:*\n' +
                    '.ssweb https://google.com\n' +
                    '.ssweb https://github.com\n\n' +
                    '📱 Mobile view 1080×1920',
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

        try { await sock.sendMessage(jid, { react: { text: '📸', key: msg.key } }); } catch (_) {}

        // Ajouter https:// si nécessaire
        if (!url.match(/^https?:\/\//)) url = 'https://' + url;

        try {
            const encodedUrl = encodeURIComponent(url);
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/tools/ssweb?url=${encodedUrl}&width=1080&height=1920&device_scale=2`,
                { timeout: 45000 }
            );

            let imageUrl = null;
            if (data?.result?.url) imageUrl = data.result.url;
            else if (data?.url) imageUrl = data.url;
            else if (typeof data === 'string' && data.startsWith('http')) imageUrl = data;

            if (!imageUrl) throw new Error('No screenshot generated');

            // Envoyer l'image
            try {
                await sock.sendMessage(jid, {
                    image: { url: imageUrl },
                    caption:
                        '📸 *Website Screenshot*\n\n' +
                        `🔗 ${url}\n` +
                        '📱 1080×1920\n\n' +
                        '⚡ _Captured by Zenitsu_',
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
            } catch (sendErr) {
                // Fallback lien
                await sock.sendMessage(jid, {
                    text:
                        '📸 *Website Screenshot*\n\n' +
                        `🔗 ${url}\n` +
                        `🖼️ ${imageUrl}\n\n` +
                        '⚠️ Sent as link.',
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

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ ssweb error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: '❌ Screenshot failed. Website may be inaccessible.',
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
