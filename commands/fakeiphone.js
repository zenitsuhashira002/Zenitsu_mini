// ./commands/fakeiphone.js

const axios = require('axios');

// ═══════════════════════════════════════
// STYLE CYBERNOVA
// ═══════════════════════════════════════

const STYLE = {
    forwardingScore: 540,
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

const FALLBACK_APIS = [
    {
        name: 'Deline IQC',
        url: (text, chatTime, statusTime) => 
            `https://api.deline.web.id/maker/iqc?text=${encodeURIComponent(text)}&chatTime=${encodeURIComponent(chatTime)}&statusBarTime=${encodeURIComponent(statusTime)}`,
        timeout: 15000,
    },
    {
        name: 'Deline IQC V2',
        url: (text, chatTime, statusTime) => 
            `https://api.deline.web.id/maker/iqc2?text=${encodeURIComponent(text)}&chatTime=${encodeURIComponent(chatTime)}&statusBarTime=${encodeURIComponent(statusTime)}`,
        timeout: 15000,
    },
];

// ═══════════════════════════════════════
// COMMANDE
// ═══════════════════════════════════════

module.exports = {
    name: 'fakeiphone',
    aliases: ['iphone', 'fakechat', 'imessage'],
    category: 'fun',

    async execute({ sock, msg, args, jid }) {
        const query = args.join(' ');

        if (!query || query.trim().length < 1) {
            return sock.sendMessage(jid, {
                text: '📱 *Fake iPhone Message Generator*\n\n' +
                      '⚡ *Usage:* .fakeiphone <text>\n\n' +
                      '✨ *Examples:*\n' +
                      '.fakeiphone Hello Zenitsu\n' +
                      '.fakeiphone This is a test\n' +
                      '.fakeiphone Brat\n\n' +
                      '📌 *Features:*\n' +
                      '• Fake iMessage screenshot\n' +
                      '• Custom text display\n' +
                      '• iPhone style interface\n\n' +
                      '⚡ _Powered by Cybernova_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Obtenir l'heure actuelle pour le statut et le chat
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const chatTime = `${hours}:${minutes}`;
        
        // Heure du statut (un peu plus tard)
        const statusHours = String((now.getHours() + 1) % 24).padStart(2, '0');
        const statusTime = `${statusHours}:${minutes}`;

        try {
            await sock.sendMessage(jid, { react: { text: '📱', key: msg.key } });

            let result = null;
            let usedApi = '';

            // Essayer chaque API
            for (const api of FALLBACK_APIS) {
                try {
                    console.log(`📤 Trying ${api.name}...`);
                    const url = api.url(query, chatTime, statusTime);
                    
                    const response = await axios.get(url, {
                        responseType: 'arraybuffer',
                        timeout: api.timeout,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
                        },
                    });

                    // Vérifier si c'est une image valide
                    const buffer = Buffer.from(response.data);
                    if (buffer.length > 1000) { // Au moins 1KB
                        result = buffer;
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
                    text: '❌ *All APIs failed*\n\n' +
                          '💡 Try again later with different text.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Envoyer l'image
            await sock.sendMessage(jid, {
                image: result,
                caption: `📱 *Fake iPhone Message*\n\n` +
                         `💬 *Text:* ${query}\n` +
                         `🕐 *Time:* ${chatTime}\n` +
                         `🔧 *Source:* ${usedApi}\n\n` +
                         `⚡ _Powered by Cybernova_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('❌ FakeiPhone error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: `❌ *Failed to generate fake iPhone message*\n\n` +
                      `⚠️ Error: ${err.message}\n\n` +
                      '💡 Try again with different text.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
