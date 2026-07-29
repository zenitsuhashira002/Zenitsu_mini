// ./commands/generate.js

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
// IMAGE GENERATION APIS
// ═══════════════════════════════════════

const IMAGE_APIS = [
    {
        name: 'NexRay Ideogram',
        url: (prompt) => `https://api.nexray.eu.cc/ai/ideogram?prompt=${encodeURIComponent(prompt)}`,
        timeout: 60000,
        extract: (data) => {
            if (data?.result?.url) return { url: data.result.url, type: 'url' };
            if (data?.result?.image_url) return { url: data.result.image_url, type: 'url' };
            if (data?.url) return { url: data.url, type: 'url' };
            if (data?.image_url) return { url: data.image_url, type: 'url' };
            if (typeof data === 'string' && data.startsWith('http')) return { url: data, type: 'url' };
            return null;
        },
    },
    {
        name: 'DavidCyril FluxV2',
        url: (prompt) => `https://apis.davidcyriltech.my.id/fluxv2?prompt=${encodeURIComponent(prompt)}`,
        timeout: 60000,
        extract: (data) => {
            if (data?.result && typeof data.result === 'string' && data.result.startsWith('http')) {
                return { url: data.result, type: 'url', expires: true };
            }
            if (data?.url && data.url.startsWith('http')) return { url: data.url, type: 'url' };
            return null;
        },
    },
    {
        name: 'ZellAPI DALL-E',
        url: (prompt) => `https://zellapi.autos/ai/dalle?prompt=${encodeURIComponent(prompt)}`,
        timeout: 60000,
        extract: (response) => {
            // ZellAPI renvoie l'image directement en buffer
            if (response && response.length > 500) {
                return { buffer: response, type: 'buffer' };
            }
            return null;
        },
    },
    {
        name: 'PrinceTech Flux',
        url: (prompt) => `https://api.princetechn.com/api/ai/fluximg?apikey=prince&prompt=${encodeURIComponent(prompt)}`,
        timeout: 60000,
        extract: (data) => {
            if (data?.result && typeof data.result === 'string' && data.result.startsWith('http')) {
                return { url: data.result, type: 'url' };
            }
            if (data?.url && data.url.startsWith('http')) return { url: data.url, type: 'url' };
            return null;
        },
    },
    {
        name: 'GiftedTech Flux',
        url: (prompt) => `https://api.giftedtech.co.ke/api/ai/fluximg?apikey=gifted&prompt=${encodeURIComponent(prompt)}&ratio=1:1`,
        timeout: 60000,
        extract: (data) => {
            if (data?.result?.url) return { url: data.result.url, type: 'url' };
            if (data?.url) return { url: data.url, type: 'url' };
            return null;
        },
    },
];

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'generate',
    aliases: ['gen', 'aiimg', 'imagine', 'create'],
    category: 'ai',

    async execute({ sock, msg, args, jid }) {
        const prompt = args.join(' ');

        if (!prompt || prompt.trim().length < 3) {
            return sock.sendMessage(jid, {
                text:
                    '🎨 *AI Image Generator*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.generate <prompt>\n\n' +
                    '✨ *Examples:*\n' +
                    '.generate A handsome gentle man\n' +
                    '.generate Cyberpunk city with neon lights\n' +
                    '.generate Cute cat in space\n\n' +
                    '🔄 5 AI models with fallback\n' +
                    '⏱ 60 seconds per model',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '🎨', key: msg.key } }); } catch (_) {}

        let result = null;
        let usedModel = '';

        for (const api of IMAGE_APIS) {
            try {
                console.log(`🎨 Trying ${api.name}...`);

                const response = await axios.get(api.url(prompt), {
                    timeout: api.timeout,
                    responseType: api.name === 'ZellAPI DALL-E' ? 'arraybuffer' : 'json',
                });

                // Pour ZellAPI, response.data est déjà le buffer
                if (api.name === 'ZellAPI DALL-E') {
                    result = api.extract(response.data);
                } else {
                    result = api.extract(response.data);
                }

                if (result) {
                    usedModel = api.name;
                    console.log(`✅ ${api.name} succeeded`);
                    break;
                }
            } catch (err) {
                console.log(`⚠️ ${api.name} failed: ${err.message}`);
            }

            // Délai de 60 secondes entre chaque API
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!result) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, {
                text:
                    '❌ *Image Generation Failed*\n\n' +
                    'All AI models are currently unavailable.\n\n' +
                    '⚡ Try again in a few minutes with a different prompt.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // ENVOYER L'IMAGE
        // ═══════════════════

        let sent = false;

        if (result.type === 'buffer' && result.buffer) {
            try {
                await sock.sendMessage(jid, {
                    image: result.buffer,
                    caption:
                        '🎨 *AI Generated Image*\n\n' +
                        `📝 *Prompt:* ${prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt}\n` +
                        `🔧 *Model:* ${usedModel}\n\n` +
                        '⚡ _Zenitsu_',
                    contextInfo: STYLE,
                }, { quoted: msg });
                sent = true;
            } catch (err) {
                console.log(`⚠️ Buffer send failed: ${err.message}`);
            }
        }

        if (!sent && result.url) {
            try {
                await sock.sendMessage(jid, {
                    image: { url: result.url },
                    caption:
                        '🎨 *AI Generated Image*\n\n' +
                        `📝 *Prompt:* ${prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt}\n` +
                        `🔧 *Model:* ${usedModel}\n` +
                        (result.expires ? '⏳ *Expires in 59 minutes*\n' : '') +
                        `🔗 ${result.url}\n\n` +
                        '⚡ _Zenitsu_',
                    contextInfo: STYLE,
                }, { quoted: msg });
                sent = true;
            } catch (err) {
                console.log(`⚠️ URL send failed: ${err.message}`);
            }
        }

        if (!sent && result.url) {
            // Fallback : envoyer le lien en texte
            await sock.sendMessage(jid, {
                text:
                    '🎨 *AI Generated Image*\n\n' +
                    `📝 *Prompt:* ${prompt}\n` +
                    `🔧 *Model:* ${usedModel}\n` +
                    (result.expires ? '⏳ *Expires in 59 minutes*\n' : '') +
                    `🔗 *Link:* ${result.url}\n\n` +
                    '⚠️ Image sent as link.\n\n' +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
