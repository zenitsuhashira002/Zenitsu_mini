
// ./commands/sticker.js

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const execPromise = util.promisify(exec);

module.exports = {
    name: 'sticker',
    aliases: ['s', 'sticker', 'stick', 'makeit'],
    category: 'tools',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;

        // Check if there's a quoted message with media
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quotedMsg && args.length === 0) {
            return sock.sendMessage(jid, {
                text:
                    '🎨 *Sticker Maker*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.sticker <quality>\n' +
                    'Or reply to an image/video with:\n' +
                    '.sticker <quality>\n\n' +
                    '🎯 *Quality (1-100):*\n' +
                    '  Default: 50\n' +
                    '  1 = Lowest | 100 = Highest\n\n' +
                    '✨ *Examples:*\n' +
                    '.sticker 80\n' +
                    '.sticker 60 (reply to image)\n' +
                    '.sticker  70 (caption)\n\n' +
                    '💡 Reply to an image or video to create sticker.',
                contextInfo: {
                    forwardingScore: 350,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202,
                    },
                }
            }, { quoted: msg });
        }

        try {
            // Parse arguments
            let packname = 'Zenitsu Stickers';
            let author = 'Zenitsu';
            let quality = 50;

            if (args.length > 0) {
                // Check if last arg is a number (quality)
                const lastArg = args[args.length - 1];
                const isQuality = /^\d+$/.test(lastArg);

                if (isQuality) {
                    quality = Math.min(100, Math.max(1, parseInt(lastArg)));
                    const remaining = args.slice(0, -1);

                    if (remaining.length >= 2) {
                        packname = remaining.slice(0, -1).join(' ');
                        author = remaining[remaining.length - 1];
                    } else if (remaining.length === 1) {
                        packname = remaining[0];
                    }
                } else {
                    // No quality specified
                    if (args.length >= 2) {
                        packname = args.slice(0, -1).join(' ');
                        author = args[args.length - 1];
                    } else if (args.length === 1) {
                        packname = args[0];
                    }
                }
            }

            // Check if we have media
            let mediaBuffer = null;
            let mediaType = null;
            let isVideo = false;

            // Function to download media using Baileys
            const downloadMedia = async (quotedMsg) => {
                try {
                    const msgType = Object.keys(quotedMsg)[0];
                    const mediaMsg = {
                        key: msg.key,
                        message: {
                            [msgType]: quotedMsg[msgType]
                        }
                    };

                    return await downloadMediaMessage(mediaMsg, 'buffer', {}, {
                        logger: console,
                        reuploadRequest: sock.updateMediaMessage
                    });
                } catch (err) {
                    console.error('Download error:', err);
                    return null;
                }
            };

            // Check quoted message for media
            if (quotedMsg) {
                if (quotedMsg.imageMessage) {
                    mediaBuffer = await downloadMedia(quotedMsg);
                    mediaType = 'image';
                } else if (quotedMsg.videoMessage) {
                    mediaBuffer = await downloadMedia(quotedMsg);
                    mediaType = 'video';
                    isVideo = true;
                } else if (quotedMsg.stickerMessage) {
                    mediaBuffer = await downloadMedia(quotedMsg);
                    mediaType = 'sticker';
                } else if (quotedMsg.documentMessage) {
                    // Check if it's a webp sticker
                    if (quotedMsg.documentMessage.mimetype === 'image/webp') {
                        mediaBuffer = await downloadMedia(quotedMsg);
                        mediaType = 'sticker';
                    }
                }
            }

            // If no media from quoted, check if message has media directly
            if (!mediaBuffer) {
                if (msg.message?.imageMessage) {
                    const mediaMsg = {
                        key: msg.key,
                        message: msg.message
                    };
                    mediaBuffer = await downloadMediaMessage(mediaMsg, 'buffer', {}, {
                        logger: console,
                        reuploadRequest: sock.updateMediaMessage
                    });
                    mediaType = 'image';
                } else if (msg.message?.videoMessage) {
                    const mediaMsg = {
                        key: msg.key,
                        message: msg.message
                    };
                    mediaBuffer = await downloadMediaMessage(mediaMsg, 'buffer', {}, {
                        logger: console,
                        reuploadRequest: sock.updateMediaMessage
                    });
                    mediaType = 'video';
                    isVideo = true;
                }
            }

            if (!mediaBuffer) {
                return sock.sendMessage(jid, {
                    text: '❌ Please reply to an image, video, or sticker.'
                }, { quoted: msg });
            }

            // React to show processing
            try { await sock.sendMessage(jid, { react: { text: '🔄', key: msg.key } }); } catch (_) {}

            // Create temp directory if it doesn't exist
            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Create temp file
            const tempId = Date.now().toString(36);
            const inputExt = mediaType === 'video' ? 'mp4' : mediaType === 'sticker' ? 'webp' : 'jpg';
            const inputPath = path.join(tempDir, `input_${tempId}.${inputExt}`);
            const outputPath = path.join(tempDir, `output_${tempId}.webp`);

            // Save media to file
            fs.writeFileSync(inputPath, mediaBuffer);

            // Process based on media type
            let command = '';

            if (mediaType === 'video') {
                // Extract video duration using ffprobe
                try {
                    const { stdout: videoInfo } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`);
                    const duration = parseFloat(videoInfo.trim()) || 0;

                    if (duration > 10) {
                        fs.unlinkSync(inputPath);
                        return sock.sendMessage(jid, {
                            text: '⚠️ Video is too long. Maximum duration is 10 seconds.'
                        }, { quoted: msg });
                    }
                } catch (_) {
                    // If ffprobe fails, proceed anyway
                }

                // Create sticker from video
                command = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2,fps=15" -vcodec libwebp -lossless 0 -compression_level 6 -q:v ${quality} -loop 0 -an -vsync 0 "${outputPath}"`;
            } else if (mediaType === 'image') {
                // Create sticker from image
                command = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" -vcodec libwebp -lossless 0 -compression_level 6 -q:v ${quality} -loop 0 -an -vsync 0 "${outputPath}"`;
            } else if (mediaType === 'sticker') {
                // Already a sticker, just forward it
                await sock.sendMessage(jid, {
                    sticker: mediaBuffer,
                    contextInfo: {
                        packname: packname,
                        author: author,
                        forwardingScore: 350,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363425394543602@newsletter',
                            newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                            serverMessageId: 202,
                        },
                    }
                }, { quoted: msg });

                // Clean up
                try { fs.unlinkSync(inputPath); } catch (_) {}
                try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
                return;
            }

            // Execute ffmpeg command
            await execPromise(command);

            // Check if output file exists
            if (!fs.existsSync(outputPath)) {
                throw new Error('Failed to create sticker');
            }

            // Read the generated sticker
            const stickerBuffer = fs.readFileSync(outputPath);

            // Send sticker with pack info
            await sock.sendMessage(jid, {
                sticker: stickerBuffer,
                contextInfo: {
                    packname: packname,
                    author: author,
                    forwardingScore: 350,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202,
                    },
                }
            }, { quoted: msg });

            // Clean up temp files
            try {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (_) {}

            // Success reaction
            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ Sticker command error:', err);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            await sock.sendMessage(jid, {
                text: `❌ Failed to create sticker: ${err.message}\n\nMake sure ffmpeg is installed:\napt-get install ffmpeg`
            }, { quoted: msg });
        }
    }
};
