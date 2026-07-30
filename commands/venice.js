
// ./commands/venice.js

const axios = require('axios');

module.exports = {
    name: 'venice',
    aliases: ['veniceai', 'vai'],
    category: 'ai',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 2) {
            return sock.sendMessage(jid, {
                text:
                    '🧠 *Venice AI*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.venice <your question>\n\n' +
                    '✨ *Examples:*\n' +
                    '.venice What is your model?\n' +
                    '.venice Write a poem\n' +
                    '.venice Explain machine learning',
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

        try { await sock.sendMessage(jid, { react: { text: '🧠', key: msg.key } }); } catch (_) {}

        try {
            const { data } = await axios.get(
                `https://apis.davidcyriltech.my.id/ai/claude-sonnet-4.6?prompt=${encodeURIComponent(query)}`,
                { timeout: 60000 }
            );

            let reply = '';
            if (typeof data === 'string') reply = data;
            else if (data?.result) reply = data.result;
            else if (data?.reply) reply = data.reply;
            else if (data?.response) reply = data.response;
            else if (data?.answer) reply = data.answer;
            else reply = JSON.stringify(data);

            if (!reply || reply.trim().length < 2) throw new Error('Empty response');

            const caption =
                `🧠 *Venice AI*\n\n` +
                `❓ *Q:* ${query.length > 200 ? query.substring(0, 200) + '...' : query}\n\n` +
                `💬 *A:* ${reply}\n\n` +
                `⚡ _Powered by Venice AI_`;

            await sock.sendMessage(jid, {
                text: caption,
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
            console.error('❌ venice error:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            await sock.sendMessage(jid, {
                text: '❌ *Venice AI Unavailable*\n\nPlease try again in a few seconds.',
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
