'use strict';

const axios = require('axios');

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202
    },
};

module.exports = {
    name: 'tgstalk',
    aliases: ['telegramstalk', 'tstalk'],
    category: 'stalker',

    async execute({ sock, msg, args, jid }) {
        const username = args[0]?.replace('@', '').trim();

        if (!username) {
            return sock.sendMessage(
                jid,
                {
                    text: '🎨 *Telegram Stalk*\n\nUsage: `.tgstalk <username>`\nExample: `.tgstalk Virtunum_bot`',
                    contextInfo: STYLE
                },
                { quoted: msg }
            );
        }

        // Réaction de chargement
        try {
            await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } });
        } catch (_) {}

        try {
            const apiUrl = `https://apis.davidcyriltech.my.id/stalk/telegram?username=${encodeURIComponent(username)}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            const data = response.data;

            if (!data || !data.success) {
                await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(
                    jid,
                    {
                        text: `❌ User or bot *${username}* not found on Telegram.`,
                        contextInfo: STYLE
                    },
                    { quoted: msg }
                );
            }

            // Construction du message d'informations
            let caption = `🌐 *TELEGRAM STALK INFO* 🌐\n\n`;
            caption += `📌 *Name* : ${data.name || 'N/A'}\n`;
            caption += `👤 *Username* : @${data.username || username}\n`;
            
            if (data.bio) {
                caption += `📝 *Bio* : ${data.bio}\n`;
            } else {
                caption += `📝 *Bio* : (No bio available)\n`;
            }

            if (data.members !== null && data.members !== undefined) {
                caption += `👥 *Members* : ${data.members}\n`;
            }

            caption += `🔗 *Profile URL* : ${data.url || `https://t.me/${username}`}\n\n`;
            caption += `⚡ _Zenitsu_`;

            // Envoi avec l'image si disponible, sinon texte simple
            if (data.image) {
                await sock.sendMessage(
                    jid,
                    {
                        image: { url: data.image },
                        caption: caption,
                        contextInfo: STYLE
                    },
                    { quoted: msg }
                );
            } else {
                await sock.sendMessage(
                    jid,
                    {
                        text: caption,
                        contextInfo: STYLE
                    },
                    { quoted: msg }
                );
            }

            try {
                await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
            } catch (_) {}

        } catch (err) {
            console.error('❌ tgstalk error:', err.message);
            try {
                await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            } catch (_) {}
            
            await sock.sendMessage(
                jid,
                {
                    text: `❌ Failed to fetch Telegram data. Please try again later.`,
                    contextInfo: STYLE
                },
                { quoted: msg }
            );
        }
    },
};
