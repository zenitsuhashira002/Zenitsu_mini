
// ./commands/toimg.js

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ═══════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════

function getRandomId() {
    return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

async function downloadMedia(mediaMessage, mediaType) {
    const stream = await downloadContentFromMessage(mediaMessage, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

function execCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) return reject(error);
            resolve(stdout);
        });
    });
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'toimg',
    aliases: ['stickertoimg', 'simg'],
    category: 'media',

    async execute({ sock, msg, args, jid }) {
        // ── Get quoted sticker ──
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted || !quoted.stickerMessage) {
            return sock.sendMessage(jid, {
                text:
                    '🖼️ *Sticker to Image*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.toimg (reply to a sticker)\n\n' +
                    '💡 *Tip:* Only works with static stickers.\n' +
                    'Animated stickers will show the first frame.',
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

        // ── Check if animated sticker ──
        const isAnimated = quoted.stickerMessage?.isAnimated || false;
        const inputFile = path.join(TEMP_DIR, `${getRandomId()}.webp`);
        const outputFile = path.join(TEMP_DIR, `${getRandomId()}.${isAnimated ? 'gif' : 'png'}`);

        // ── Reaction: processing ──
        try {
            await sock.sendMessage(jid, {
                react: { text: '🔄', key: msg.key },
            });
        } catch (_) {}

        try {
            // ── Download sticker ──
            const buffer = await downloadMedia(quoted.stickerMessage, 'sticker');
            fs.writeFileSync(inputFile, buffer);

            // ── Convert with ffmpeg ──
            let convertCommand = '';

            if (isAnimated) {
                // Animated sticker → GIF
                convertCommand = `ffmpeg -i "${inputFile}" -vf "fps=10,scale=512:-1:flags=lanczos" -c:v gif -f gif "${outputFile}" -y`;
            } else {
                // Static sticker → PNG
                convertCommand = `ffmpeg -i "${inputFile}" -vframes 1 "${outputFile}" -y`;
            }

            await execCommand(convertCommand);

            // ── Check if output exists ──
            if (!fs.existsSync(outputFile)) {
                throw new Error('Conversion failed - output file not created');
            }

            // ── Read output ──
            const outputBuffer = fs.readFileSync(outputFile);
            const sizeKB = (outputBuffer.length / 1024).toFixed(2);

            // ── Send result ──
            if (isAnimated) {
                // Send as GIF/video
                await sock.sendMessage(jid, {
                    video: outputBuffer,
                    mimetype: 'video/mp4',
                    gifPlayback: true,
                    caption:
                        `🖼️ *Sticker → GIF*\n\n` +
                        `📏 Size: ${sizeKB} KB\n` +
                        `⚡ Converted by Zenitsu`,
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
            } else {
                // Send as image
                await sock.sendMessage(jid, {
                    image: outputBuffer,
                    mimetype: 'image/png',
                    caption:
                        `🖼️ *Sticker → Image*\n\n` +
                        `📏 Size: ${sizeKB} KB\n` +
                        `⚡ Converted by Zenitsu`,
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

            // ── Reaction: success ──
            try {
                await sock.sendMessage(jid, {
                    react: { text: '✅', key: msg.key },
                });
            } catch (_) {}

        } catch (err) {
            console.error('❌ toimg error:', err.message);

            // ── Reaction: error ──
            try {
                await sock.sendMessage(jid, {
                    react: { text: '❌', key: msg.key },
                });
            } catch (_) {}

            // ── Fallback: send as document ──
            try {
                if (fs.existsSync(inputFile)) {
                    const stickerBuffer = fs.readFileSync(inputFile);
                    await sock.sendMessage(jid, {
                        document: stickerBuffer,
                        mimetype: 'image/webp',
                        fileName: `sticker_${Date.now()}.webp`,
                        caption:
                            '⚠️ *Conversion failed*\n\n' +
                            'The sticker could not be converted.\n' +
                            'Here is the original sticker file.\n\n' +
                            '💡 Make sure ffmpeg is installed on the server.',
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
                } else {
                    await sock.sendMessage(jid, {
                        text:
                            '❌ *Conversion Failed*\n\n' +
                            'The sticker could not be converted to image.\n\n' +
                            '⚡ Make sure:\n' +
                            '• The sticker is not corrupted\n' +
                            '• ffmpeg is installed\n' +
                            '• You replied to a valid sticker',
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
            } catch (fallbackErr) {
                console.error('❌ toimg fallback error:', fallbackErr.message);
            }

        } finally {
            // ── Cleanup ──
            try {
                if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
                if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
            } catch (_) {}
        }
    },
};
