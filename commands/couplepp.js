// ./commands/couplepp.js

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
// APIS DE FALLBACK
// ═══════════════════════════════════════

const COUPLE_APIS = [
    {
        name: 'DavidCyril',
        url: 'https://apis.davidcyriltech.my.id/couplepp',
        extract: (data) => {
            if (data?.success && data?.male && data?.female) {
                return { male: data.male, female: data.female };
            }
            return null;
        }
    },
    {
        name: 'DavidCyril V2',
        url: 'https://apis.davidcyriltech.my.id/coupleppv2',
        extract: (data) => {
            if (data?.success && data?.male && data?.female) {
                return { male: data.male, female: data.female };
            }
            return null;
        }
    }
];

// ═══════════════════════════════════════
// COMMANDE
// ═══════════════════════════════════════

module.exports = {
    name: 'couplepp',
    aliases: ['couplepfp', 'coupleavatar', 'couplephoto'],
    category: 'fun',

    async execute({ sock, msg, args, jid }) {
        try {
            await sock.sendMessage(jid, { react: { text: '💑', key: msg.key } });

            let result = null;
            let usedApi = '';

            // Essayer chaque API
            for (const api of COUPLE_APIS) {
                try {
                    console.log(`📤 Trying ${api.name}...`);
                    const { data } = await axios.get(api.url, {
                        timeout: 15000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
                        },
                    });

                    const extracted = api.extract(data);
                    if (extracted) {
                        result = extracted;
                        usedApi = api.name;
                        console.log(`✅ ${api.name} succeeded`);
                        break;
                    }
                } catch (err) {
                    console.log(`⚠️ ${api.name} failed: ${err.message}`);
                }
            }

            if (!result) {
                await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(jid, {
                    text: '❌ *Failed to fetch couple photos*\n\n' +
                          '💡 Try again later.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Télécharger les deux images
            let maleBuffer, femaleBuffer;
            try {
                const [maleRes, femaleRes] = await Promise.all([
                    axios.get(result.male, { responseType: 'arraybuffer', timeout: 15000 }),
                    axios.get(result.female, { responseType: 'arraybuffer', timeout: 15000 })
                ]);
                maleBuffer = Buffer.from(maleRes.data);
                femaleBuffer = Buffer.from(femaleRes.data);
            } catch (err) {
                console.error('❌ Download error:', err.message);
                await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(jid, {
                    text: '❌ *Failed to download images*\n\n' +
                          '💡 Try again later.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Envoyer les deux photos
            await sock.sendMessage(jid, {
                image: maleBuffer,
                caption: `💑 *Couple Profile Pictures*\n\n` +
                         `👤 *Male:* Photo 1\n` +
                         `🔧 *Source:* ${usedApi}\n\n` +
                         `⚡ _Powered by Cybernova_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            await sock.sendMessage(jid, {
                image: femaleBuffer,
                caption: `💑 *Couple Profile Pictures*\n\n` +
                         `👩 *Female:* Photo 2\n` +
                         `🔧 *Source:* ${usedApi}\n\n` +
                         `⚡ _Powered by Cybernova_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('❌ CouplePP error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to generate couple photos*\n\n' +
                      `⚠️ Error: ${err.message}\n\n` +
                      '💡 Try again later.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
