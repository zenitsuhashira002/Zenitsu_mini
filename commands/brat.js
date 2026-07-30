// commands/brat.js
const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Dossier temporaire
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

module.exports = {
    name: 'brat',
    aliases: ['bratv', 'brat-video', 'textvideo'],
    description: 'Transform text into a stylish video and sticker',

    async execute({ sock, msg, args, jid, text, config, stats }) {
        const from = jid || msg?.key?.remoteJid;

        if (!from) {
            console.error('❌ JID not available');
            return;
        }

        // =========================
        // 📋 SHOW HELP
        // =========================
        if (args.length === 0 || args[0].toLowerCase() === 'help') {
            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: '📋', key: msg.key }
                });
            }

            const helpMessage = `╭━━━❲ *BRAT VIDEO GENERATOR* ❳━━━╮
┃
┃  🎬 *Usage :*
┃  .brat [text]
┃
┃  💡 *Examples :*
┃  .brat Hello World
┃  .brat I love coding
┃  .bratv Zenitsu Bot
┃
┃  🎯 *Features :*
┃  • Generate stylish video
┃  • Convert to animated sticker
┃  • Unique style per text
┃
┃  ⚠️ *Max characters :* 100
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━
_©CybernovA_`;

            return sock.sendMessage(from, {
                text: helpMessage,
                contextInfo: {
                    mentionedJid: [from],
                    forwardingScore: 540,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202
                    }
                }
            }, { quoted: msg });
        }

        const userText = args.join(' ');

        if (!userText) {
            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: '❓', key: msg.key }
                });
            }
            return sock.sendMessage(from, {
                text: '❌ *Text missing*\n\nUsage: .brat [text]\n\nExample: .brat Hello World'
            }, { quoted: msg });
        }

        // Limiter la longueur du texte
        if (userText.length > 100) {
            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: '⚠️', key: msg.key }
                });
            }
            return sock.sendMessage(from, {
                text: '⚠️ *Text too long*\n\nMaximum 100 characters allowed.'
            }, { quoted: msg });
        }

        if (msg?.key) {
            await sock.sendMessage(from, {
                react: { text: '🎬', key: msg.key }
            });
        }


        let videoPath = null;
        let stickerPath = null;

        try {
            // =========================
            // 🎬 GENERATE VIDEO
            // =========================
            const apiUrl = `https://zellapi.autos/tools/bratanimate?q=${encodeURIComponent(userText)}`;
            
            const videoResponse = await axios.get(apiUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!videoResponse.data || videoResponse.data.length < 1000) {
                throw new Error('Invalid video response');
            }

            // Sauvegarder la vidéo temporairement
            const timestamp = Date.now();
            videoPath = path.join(TEMP_DIR, `brat_video_${timestamp}.mp4`);
            fs.writeFileSync(videoPath, Buffer.from(videoResponse.data));

            const videoSizeKB = (videoResponse.data.length / 1024).toFixed(2);
            const videoSizeMB = (videoResponse.data.length / (1024 * 1024)).toFixed(2);
            const sizeDisplay = videoSizeKB > 1024 ? `${videoSizeMB} MB` : `${videoSizeKB} KB`;

            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: '🔄', key: msg.key }
                });
            }


            // =========================
            // 🎨 CONVERT TO STICKER
            // =========================
            stickerPath = path.join(TEMP_DIR, `brat_sticker_${timestamp}.webp`);

            // Vérifier ffmpeg
            try {
                await execPromise('ffmpeg -version');
            } catch (ffmpegError) {
                throw new Error('FFmpeg is not installed. Please install ffmpeg to use this command.');
            }

            // Convertir vidéo en sticker WebP animé
            const command = `ffmpeg -i "${videoPath}" -vf "fps=50,scale=512:512:force_original_aspect_ratio=1,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -quality 80 -loop 0 -vcodec libwebp -pix_fmt yuv420p -preset default -an -vsync 0 "${stickerPath}"`;
            
            await execPromise(command);

            // Vérifier que le sticker existe
            if (!fs.existsSync(stickerPath) || fs.statSync(stickerPath).size < 100) {
                throw new Error('Sticker generation failed');
            }

            const stickerSizeKB = (fs.statSync(stickerPath).size / 1024).toFixed(2);

            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: '✨', key: msg.key }
                });
            }

            // =========================
            // 📤 SEND STICKER
            // =========================
            const stickerBuffer = fs.readFileSync(stickerPath);

            await sock.sendMessage(from, {
                sticker: stickerBuffer,
                contextInfo: {
                    mentionedJid: [from],
                    forwardingScore: 540,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202
                    }
                }
            });

            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: '✅', key: msg.key }
                });
            }

            // =========================
            // 📊 CONFIRMATION
            // =========================
            const summary = `╭━━━❲ *BRAT STICKER READY* ❳━━━╮
┃
┃  ✅ *Video converted to sticker*
┃
┃  📝 *Text :* "${userText.substring(0, 40)}${userText.length > 40 ? '...' : ''}"
┃  📦 *Size :* ${stickerSizeKB} KB
┃
┃  💡 *Tip :* Use .brat to generate
┃  more stylish stickers
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━
_©CybernovA_`;

            await sock.sendMessage(from, {
                text: summary
            }, { quoted: msg });

        } catch (error) {
            console.error('[BRAT] Error:', error.message);

            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: '💥', key: msg.key }
                });
            }

            // =========================
            // ❌ ERROR HANDLING
            // =========================
            let errorMessage = `╭━━━━❲ *BRAT ERROR* ❳━━━━╮\n┃\n┃  ❌ *Failed to generate video*\n┃\n`;

            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                errorMessage += `┃  ⏰ *Request timeout*\n┃\n┃  💡 *The API took too long*\n┃  • Try again later\n┃  • Use shorter text\n`;
            } else if (error.message.includes('FFmpeg is not installed')) {
                errorMessage += `┃  ⚠️ *FFmpeg required*\n┃\n┃  💡 *Install FFmpeg :*\n┃  • apt-get install ffmpeg\n┃  • pkg install ffmpeg\n`;
            } else if (error.message.includes('Invalid video response')) {
                errorMessage += `┃  ❌ *Invalid API response*\n┃\n┃  💡 *The API may be down*\n┃  • Try again later\n┃  • Use different text\n`;
            } else if (error.message.includes('Sticker generation failed')) {
                errorMessage += `┃  🎨 *Sticker conversion failed*\n┃\n┃  💡 *Try again with shorter text*\n`;
            } else if (error.response?.status === 404) {
                errorMessage += `┃  🔍 *API endpoint not found*\n┃\n┃  💡 *The service may be unavailable*\n`;
            } else if (error.response?.status === 429) {
                errorMessage += `┃  ⏰ *Rate limit exceeded*\n┃\n┃  💡 *Please wait before retrying*\n`;
            } else {
                errorMessage += `┃  📝 *Error :* ${error.message.substring(0, 50)}\n┃\n┃  💡 *Try again in a few minutes*\n`;
            }

            errorMessage += `┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n━━━━━━━━━━━━━\n_©CybernovA_`;

            await sock.sendMessage(from, {
                text: errorMessage
            }, { quoted: msg });

        } finally {
            // =========================
            // 🧹 CLEANUP TEMP FILES
            // =========================
            if (videoPath && fs.existsSync(videoPath)) {
                try { fs.unlinkSync(videoPath); } catch (e) {}
            }
            if (stickerPath && fs.existsSync(stickerPath)) {
                try { fs.unlinkSync(stickerPath); } catch (e) {}
            }
        }
    }
};
