
// ./commands/logo.js

const axios = require('axios');

// ═══════════════════════════════════════
// AVAILABLE EFFECTS
// ═══════════════════════════════════════

const EFFECTS = {
    glossysilver:     { name: 'Glossy Silver',        icon: '✨' },
    writetext:        { name: 'Write Text',           icon: '✍️' },
    blackpinklogo:    { name: 'Blackpink Logo',       icon: '🖤' },
    glitchtext:       { name: 'Glitch Text',          icon: '💾' },
    advancedglow:     { name: 'Advanced Glow',        icon: '🌟' },
    typographytext:   { name: 'Typography Text',      icon: '📝' },
    pixelglitch:      { name: 'Pixel Glitch',         icon: '👾' },
    neonglitch:       { name: 'Neon Glitch',          icon: '💜' },
    nigerianflag:     { name: 'Nigerian Flag',        icon: '🇳🇬' },
    americanflag:     { name: 'American Flag',        icon: '🇺🇸' },
    deletingtext:     { name: 'Deleting Text',        icon: '🗑️' },
    blackpinkstyle:   { name: 'Blackpink Style',      icon: '💗' },
    glowingtext:      { name: 'Glowing Text',         icon: '🔆' },
    underwater:       { name: 'Underwater',           icon: '🌊' },
    logomaker:        { name: 'Logo Maker',           icon: '🎯' },
    cartoonstyle:     { name: 'Cartoon Style',        icon: '🎨' },
    papercut:         { name: 'Paper Cut',            icon: '✂️' },
    effectclouds:     { name: 'Cloud Effect',         icon: '☁️' },
    gradienttext:     { name: 'Gradient Text',        icon: '🌈' },
    summerbeach:      { name: 'Summer Beach',         icon: '🏖️' },
    sandsummer:       { name: 'Sand Summer',          icon: '🏝️' },
    luxurygold:       { name: 'Luxury Gold',          icon: '👑' },
    galaxy:           { name: 'Galaxy',               icon: '🌌' },
    1917:             { name: '1917 Style',           icon: '🎞️' },
    makingneon:       { name: 'Making Neon',          icon: '💡' },
    texteffect:       { name: 'Text Effect',          icon: '🔤' },
    galaxystyle:      { name: 'Galaxy Style',         icon: '⭐' },
    lighteffect:      { name: 'Light Effect',         icon: '💫' },
    foilBalloon:      { name: 'Foil Ballon',          icon: '🎈' },
    narutoShippuden:  { name: 'Naruto Style',         icon: '🍥' },
};

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'logo',
    aliases: ['textmaker', 'effect', 'logomaker', 'textlogo'],
    category: 'textmaker',

    async execute({ sock, msg, args, jid }) {
        // ── Show list ──
        if (args.length === 0) {
            const effectList = Object.entries(EFFECTS)
                .map(([key, val]) => `  ${val.icon} *${key}* — ${val.name}`)
                .join('\n');

            return sock.sendMessage(jid, {
                text:
                    '🎨 *Logo & Text Effects*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.logo <effect> <text>\n\n' +
                    '📋 *Available Effects:*\n' +
                    `${effectList}\n\n` +
                    '✨ *Examples:*\n' +
                    '.logo glossysilver Zenitsu\n' +
                    '.logo galaxy My Bot\n' +
                    '.logo 1917 CyberNova\n' +
                    '.logo neonglitch Welcome',
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

        // ── Parse args ──
        let effectKey = args[0]?.toLowerCase();

        // Handle "1917" style
        if (effectKey === '1917') effectKey = '1917';

        const effect = EFFECTS[effectKey];
        const text = args.slice(1).join(' ');

        // ── Invalid effect ──
        if (!effect) {
            return sock.sendMessage(jid, {
                text:
                    '⚠️ *Invalid Effect*\n\n' +
                    `"${args[0]}" is not a valid effect.\n\n` +
                    '📋 Use .logo to see all effects.',
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

        // ── No text ──
        if (!text || text.trim().length < 1) {
            return sock.sendMessage(jid, {
                text:
                    `${effect.icon} *${effect.name}*\n\n` +
                    '⚡ *Usage:*\n' +
                    `.logo ${args[0]} <text>\n\n` +
                    `✨ *Example:*\n` +
                    `.logo ${args[0]} Zenitsu Bot`,
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

        // ── Reaction ──
        try { await sock.sendMessage(jid, { react: { text: effect.icon, key: msg.key } }); } catch (_) {}

        try {
            const encodedText = encodeURIComponent(text);

            const { data } = await axios.get(
                `https://api.giftedtech.co.ke/api/ephoto360/${effectKey}?apikey=gifted&text=${encodedText}`,
                { timeout: 45000 }
            );

            console.log('🎨 Logo Response:', JSON.stringify(data).substring(0, 300));

            // ── Extract image URL ──
            let imageUrl = null;

            if (data?.result?.image_url) {
                imageUrl = data.result.image_url;
            } else if (data?.result?.url) {
                imageUrl = data.result.url;
            } else if (data?.image_url) {
                imageUrl = data.image_url;
            } else if (data?.url) {
                imageUrl = data.url;
            } else if (typeof data === 'string' && data.startsWith('http')) {
                imageUrl = data;
            }

            if (!imageUrl) throw new Error('No image generated');

            // ── Send result ──
            let sent = false;

            try {
                await sock.sendMessage(jid, {
                    image: { url: imageUrl },
                    caption:
                        `${effect.icon} *${effect.name}*\n\n` +
                        `📝 *Text:* ${text}\n` +
                        `🎨 *Effect:* ${effect.name}\n\n` +
                        '⚡ _Generated by Zenitsu_',
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
                sent = true;
            } catch (imgErr) {
                console.log('⚠️ Logo image send failed:', imgErr.message);
            }

            // Fallback link
            if (!sent) {
                await sock.sendMessage(jid, {
                    text:
                        `${effect.icon} *${effect.name}*\n\n` +
                        `📝 *Text:* ${text}\n` +
                        `🔗 *Image:* ${imageUrl}\n\n` +
                        '⚠️ Sent as link.\n\n' +
                        '⚡ _Generated by Zenitsu_',
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
            console.error('❌ logo error:', err.message);                          try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            await sock.sendMessage(jid, {
                text:
                    '❌ *Logo Generation Failed*\n\n' +
                    'The effect service is currently unavailable.\n\n' +
                    '⚡ Try again or use a different effect.',                         contextInfo: {
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
