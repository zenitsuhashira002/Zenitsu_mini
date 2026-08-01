// ./commands/chinfo.js

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

// ═══════════════════════════════════════
// APIS DE STALK CHAÎNE WHATSAPP
// ═══════════════════════════════════════

const CHANNEL_APIS = [
    {
        name: 'PrinceTech',
        fn: async (url) => {
            const { data } = await axios.get(
                `https://api.princetechn.com/api/stalk/wachannel?apikey=prince&url=${encodeURIComponent(url)}`,
                { timeout: 15000 }
            );
            if (data?.success && data?.result) {
                return data.result;
            }
            return null;
        }
    },
    {
        name: 'GiftedTech',
        fn: async (url) => {
            const { data } = await axios.get(
                `https://api.giftedtech.co.ke/api/stalk/wachannel?apikey=gifted&url=${encodeURIComponent(url)}`,
                { timeout: 15000 }
            );
            if (data?.success && data?.result) {
                return data.result;
            }
            return null;
        }
    },
    {
        name: 'DavidCyril',
        fn: async (url) => {
            const { data } = await axios.get(
                `https://apis.davidcyriltech.my.id/stalk/wa?url=${encodeURIComponent(url)}`,
                { timeout: 15000 }
            );
            if (data?.success) {
                return {
                    followers: data.followers || data.followersCount || 'N/A',
                    title: data.title || 'WhatsApp Channel',
                    img: data.image || '',
                    description: data.description || 'No description',
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
    name: 'chinfo',
    aliases: ['channel', 'whatsappchannel', 'wachannel'],
    category: 'stalker',

    async execute({ sock, msg, args, jid }) {
        const url = args[0];

        if (!url || !url.includes('whatsapp.com/channel/')) {
            return sock.sendMessage(jid, {
                text: '📢 *WhatsApp Channel Info*\n\n' +
                      '⚡ *Usage:* .chinfo <channel_url>\n\n' +
                      '✨ *Examples:*\n' +
                      '.chinfo https://whatsapp.com/channel/0029VbCKzJ66hENmMeROfT0e\n' +
                      '.chinfo https://whatsapp.com/channel/0029VbCpYtZLtOj5LDuj7Q1p\n\n' +
                      '📊 *Shows:* Channel name, followers, description & image',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '📢', key: msg.key } });

            let channelData = null;
            let usedApi = '';

            // Essayer chaque API
            for (const api of CHANNEL_APIS) {
                try {
                    const result = await api.fn(url);
                    if (result) {
                        channelData = result;
                        usedApi = api.name;
                        console.log(`✅ Channel: ${api.name}`);
                        break;
                    }
                } catch (err) {
                    console.log(`⚠️ Channel ${api.name}: ${err.message}`);
                }
            }

            if (!channelData) {
                throw new Error('Channel not found or API unavailable');
            }

            // Formatage des données
            const title = channelData.title || 'WhatsApp Channel';
            const followers = channelData.followers || 'N/A';
            const description = channelData.description || 'No description';
            const img = channelData.img || channelData.image || '';

            // Créer le message
            let message = `📢 *WhatsApp Channel*\n\n`;
            message += `📌 *Name:* ${title}\n`;
            message += `👥 *Followers:* ${followers}\n`;
            message += `📝 *Description:*\n${description.substring(0, 500)}${description.length > 500 ? '...' : ''}\n\n`;
            message += `🔧 *Source:* ${usedApi}\n`;
            message += `⚡ _Powered by Zenitsu AI_`;

            // Envoyer avec l'image si disponible
            if (img) {
                try {
                    const imgResponse = await axios.get(img, {
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
            console.error('❌ Channel error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to fetch channel info*\n\n' +
                      `⚠️ Error: ${err.message}\n\n` +
                      '💡 Make sure the URL is correct.\n' +
                      '🔗 Example: https://whatsapp.com/channel/0029VbCKzJ66hENmMeROfT0e',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
