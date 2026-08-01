// ./commands/gitstalk.js

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
// APIS DE STALK GITHUB
// ═══════════════════════════════════════

const STALK_APIS = [
    {
        name: 'NexRay',
        fn: async (username) => {
            const { data } = await axios.get(
                `https://api.nexray.eu.cc/stalker/github?username=${encodeURIComponent(username)}`,
                { timeout: 10000 }
            );
            if (data?.status && data?.result) {
                return data.result;
            }
            return null;
        }
    },
    {
        name: 'PrinceTech',
        fn: async (username) => {
            const { data } = await axios.get(
                `https://api.princetechn.com/api/stalk/gitstalk?apikey=prince&username=${encodeURIComponent(username)}`,
                { timeout: 10000 }
            );
            if (data?.success && data?.result) {
                return data.result;
            }
            return null;
        }
    },
    {
        name: 'GiftedTech',
        fn: async (username) => {
            const { data } = await axios.get(
                `https://api.giftedtech.co.ke/api/stalk/gitstalk?apikey=gifted&username=${encodeURIComponent(username)}`,
                { timeout: 10000 }
            );
            if (data?.success && data?.result) {
                return data.result;
            }
            return null;
        }
    },
    {
        name: 'Popcat',
        fn: async (username) => {
            const { data } = await axios.get(
                `https://api.popcat.xyz/v2/github/${encodeURIComponent(username)}`,
                { timeout: 10000 }
            );
            if (!data?.error && data?.message) {
                return data.message;
            }
            return null;
        }
    }
];

// ═══════════════════════════════════════
// COMMANDE
// ═══════════════════════════════════════

module.exports = {
    name: 'gitstalk',
    aliases: ['github', 'ghstalk', 'git'],
    category: 'stalker',

    async execute({ sock, msg, args, jid }) {
        const username = args[0];

        if (!username || username.trim().length < 1) {
            return sock.sendMessage(jid, {
                text: '🐙 *GitHub Stalker*\n\n' +
                      '⚡ *Usage:* .gitstalk <username>\n\n' +
                      '✨ *Examples:*\n' +
                      '.gitstalk zenitsuhashira002\n' +
                      '.gitstalk Mrbeast\n' +
                      '.gitstalk mayelprince\n\n' +
                      '📊 *Shows:* Profile info, repos, followers & more',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } });

            let userData = null;
            let usedApi = '';

            // Essayer chaque API
            for (const api of STALK_APIS) {
                try {
                    const result = await api.fn(username);
                    if (result) {
                        userData = result;
                        usedApi = api.name;
                        console.log(`✅ GitStalk: ${api.name}`);
                        break;
                    }
                } catch (err) {
                    console.log(`⚠️ GitStalk ${api.name}: ${err.message}`);
                }
            }

            if (!userData) {
                throw new Error('User not found or API unavailable');
            }

            // Formatage des données
            const name = userData.name || userData.nickname || userData.login || username;
            const bio = userData.bio || 'No Bio';
            const company = userData.company || 'Not set';
            const location = userData.location || 'Not set';
            const blog = userData.blog || 'Not set';
            const twitter = userData.twitter_username || 'Not set';
            const email = userData.email || 'Not set';
            const repos = userData.public_repos || userData.public_repo || '0';
            const gists = userData.public_gists || '0';
            const followers = userData.followers || '0';
            const following = userData.following || '0';
            const avatar = userData.avatar_url || userData.profile_pic || '';
            const url = userData.html_url || userData.url || `https://github.com/${username}`;
            const type = userData.type || userData.account_type || 'User';
            const created = userData.created_at || 'Unknown';
            const updated = userData.updated_at || 'Unknown';

            // Créer le message
            let message = `🐙 *GitHub Profile*\n\n`;
            message += `👤 *Name:* ${name}\n`;
            message += `🔗 *Username:* ${username}\n`;
            message += `📝 *Bio:* ${bio}\n`;
            message += `🏢 *Company:* ${company}\n`;
            message += `📍 *Location:* ${location}\n`;
            message += `🌐 *Website:* ${blog}\n`;
            message += `🐦 *Twitter:* ${twitter}\n`;
            message += `📧 *Email:* ${email}\n`;
            message += `📦 *Type:* ${type}\n`;
            message += `📊 *Repos:* ${repos}\n`;
            message += `📄 *Gists:* ${gists}\n`;
            message += `👥 *Followers:* ${followers}\n`;
            message += `👤 *Following:* ${following}\n`;
            message += `📅 *Created:* ${new Date(created).toLocaleDateString('en-US')}\n`;
            message += `🔄 *Updated:* ${new Date(updated).toLocaleDateString('en-US')}\n`;
            message += `🔗 ${url}\n\n`;
            message += `🔧 *Source:* ${usedApi}\n`;
            message += `⚡ _Powered by Zenitsu AI_`;

            // Envoyer avec l'avatar si disponible
            if (avatar) {
                try {
                    const imgResponse = await axios.get(avatar, {
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
            console.error('❌ GitStalk error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to fetch GitHub profile*\n\n' +
                      `⚠️ Error: ${err.message}\n\n` +
                      '💡 Make sure the username is correct.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
