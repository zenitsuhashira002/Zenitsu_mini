const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// 📁 Dossier temporaire
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ✅ Vérifier ffmpeg
const checkFFmpeg = async () => {
    try {
        await execPromise('ffmpeg -version');
        return true;
    } catch {
        return false;
    }
};

// ✅ Télécharger un média WhatsApp
const downloadMedia = async (mediaMessage, messageType) => {
    const stream = await downloadContentFromMessage(mediaMessage, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
};

// ✅ Obtenir les dimensions d'une vidéo/image
const getDimensions = async (filePath) => {
    try {
        const { stdout } = await execPromise(
            `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${filePath}"`
        );
        const [width, height] = stdout.trim().split('x').map(Number);
        return { width, height };
    } catch {
        return { width: 512, height: 512 };
    }
};

// ✅ Convertir image en WebP (sticker statique)
const imageToSticker = async (inputPath, outputPath, options = {}) => {
    const {
        quality = 80,
        pack = 'ZenitsuBot',
        author = 'Z3niTsu'
    } = options;

    const dims = await getDimensions(inputPath);
    const size = Math.max(dims.width, dims.height);
    const finalSize = Math.min(size, 512);

    const command = `ffmpeg -i "${inputPath}" -vf "scale=${finalSize}:${finalSize}:force_original_aspect_ratio=1,pad=${finalSize}:${finalSize}:(ow-iw)/2:(oh-ih)/2:color=#00000000" -quality ${quality} -loop 0 -vcodec libwebp -pix_fmt yuv420p -preset default -an -vsync 0 "${outputPath}"`;

    await execPromise(command);
    return outputPath;
};

// ✅ Convertir vidéo en WebP animé (sticker animé)
const videoToSticker = async (inputPath, outputPath, options = {}) => {
    const {
        duration = 10,
        quality = 70,
        fps = 15,
        pack = 'ZenitsuBot2',
        author = 'Zenitsu'
    } = options;

    const dims = await getDimensions(inputPath);
    const size = Math.max(dims.width, dims.height);
    const finalSize = Math.min(size, 512);

    const command = `ffmpeg -i "${inputPath}" -t ${duration} -vf "fps=${fps},scale=${finalSize}:${finalSize}:force_original_aspect_ratio=1,pad=${finalSize}:${finalSize}:(ow-iw)/2:(oh-ih)/2:color=#00000000" -quality ${quality} -loop 0 -vcodec libwebp -pix_fmt yuv420p -preset default -an -vsync 0 "${outputPath}"`;

    await execPromise(command);
    return outputPath;
};

module.exports = {
    name: 's2',
    description: 'Crée un sticker personnalisé',
    aliases: ['s', 'stiker', 'stk', 'fig', 'sticker'],

    async execute({ sock, msg, args, jid, text, config, stats }) {
        // Utiliser jid au lieu de msg.key.remoteJid
        const from = jid || msg?.key?.remoteJid;
        const sender = msg?.key?.participant || from;
        const senderName = sender?.split('@')[0] || 'unknown';
        let tempInputPath = null;
        let tempOutputPath = null;

        if (!from) {
            console.error('❌ JID non disponible');
            return;
        }

        try {
            // Vérifier ffmpeg
            const hasFFmpeg = await checkFFmpeg();
            if (!hasFFmpeg) {
                return sock.sendMessage(from, {
                    text: '❌ *ffmpeg non installé*\n\n```bash\npkg install ffmpeg\n```'
                }, { quoted: msg });
            }

            // Analyser les arguments
            let packName = 'ZenitsuBot';
            let authorName = 'Zenitsu';
            let quality = 80;

            for (const arg of args) {
                if (arg.startsWith('pack:')) {
                    packName = arg.replace('pack:', '').replace(/_/g, ' ').substring(0, 30);
                } else if (arg.startsWith('author:') || arg.startsWith('auteur:')) {
                    authorName = arg.replace(/^(author|auteur):/, '').replace(/_/g, ' ').substring(0, 30);
                } else if (arg.startsWith('q:') || arg.startsWith('quality:')) {
                    quality = parseInt(arg.replace(/^(q|quality):/, '')) || 80;
                    if (quality < 10) quality = 10;
                    if (quality > 100) quality = 100;
                }
            }

            // Récupérer le média
            const quoted = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            let messageType = null;
            let mediaMessage = null;
            let isVideo = false;
            let extension = 'jpg';

            if (quoted?.imageMessage) {
                messageType = 'imageMessage';
                mediaMessage = quoted.imageMessage;
                isVideo = false;
                extension = 'jpg';
            } else if (quoted?.videoMessage) {
                messageType = 'videoMessage';
                mediaMessage = quoted.videoMessage;
                isVideo = true;
                extension = 'mp4';
            } else if (msg?.message?.imageMessage) {
                messageType = 'imageMessage';
                mediaMessage = msg.message.imageMessage;
                isVideo = false;
                extension = 'jpg';
            } else if (msg?.message?.videoMessage) {
                messageType = 'videoMessage';
                mediaMessage = msg.message.videoMessage;
                isVideo = true;
                extension = 'mp4';
            } else {
                return sock.sendMessage(from, {
                    text: `🎨 Sticker creator` +
                          `━━━━━━━━━━━━━━━━━━━━━\n` +
                          `📌 *Usage:*\n` +
                          `• Reply with *.s2*\n` +
                          `• Or send media with  *.s2r* in caption, view-once not inclued\n\n` +
                          `✨ *Options :*\n` +
                          `• q:80 → Quality (10-100)\n\n` +
                          `📝 *Exemples :*\n` +
                          `.s2 q:70\n` +
                          `🎬 Format : Images & Videos\n` +
                          `━━━━━━━━━━━━━━━━━━━━━`
                }, { quoted: msg });
            }

            // Réaction
            if (msg?.key) {
                await sock.sendMessage(from, { react: { text: '🎨', key: msg.key } });
            }

            // Télécharger le média
            const buffer = await downloadMedia(mediaMessage, messageType.replace('Message', ''));

            // Sauvegarder temporairement
            const timestamp = Date.now();
            tempInputPath = path.join(TEMP_DIR, `sticker_in_${timestamp}.${extension}`);
            fs.writeFileSync(tempInputPath, buffer);

            // Convertir en WebP
            tempOutputPath = path.join(TEMP_DIR, `sticker_out_${timestamp}.webp`);

            console.log(`🎨 Conversion ${isVideo ? 'vidéo' : 'image'} → sticker...`);

            if (isVideo) {
                await videoToSticker(tempInputPath, tempOutputPath, {
                    quality: Math.min(quality, 60),
                    fps: 10,
                    duration: 10
                });
            } else {
                await imageToSticker(tempInputPath, tempOutputPath, {
                    quality: quality
                });
            }

            // Vérifier la taille
            let statsFile = fs.statSync(tempOutputPath);
            let fileSizeKB = statsFile.size / 1024;

            // Si trop gros, réduire qualité et réessayer
            if (fileSizeKB > 50000 && quality > 50) {
                console.log(`⚠️ Sticker volumineux (${fileSizeKB.toFixed(0)} KB), réduction...`);

                if (isVideo) {
                    await videoToSticker(tempInputPath, tempOutputPath, {
                        quality: 40,
                        fps: 20,
                        duration: 10
                    });
                } else {
                    await imageToSticker(tempInputPath, tempOutputPath, {
                        quality: 50
                    });
                }

                statsFile = fs.statSync(tempOutputPath);
                fileSizeKB = statsFile.size / 1024;
            }

            // Envoyer le sticker
            const stickerBuffer = fs.readFileSync(tempOutputPath);

            await sock.sendMessage(from, {
                sticker: stickerBuffer
            });

            // Confirmation simple
            await sock.sendMessage(from, {
                text: `✅ *Sticker created succefully !*\n📏 ${fileSizeKB.toFixed(0)} KB`,
                contextInfo: { mentionedJid: [sender] }
            });

            if (msg?.key) {
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
            }

            console.log(`✅ Sticker envoyé : ${fileSizeKB.toFixed(0)} KB`);

        } catch (error) {
            console.error('❌ Erreur Sticker:', error.message);

            if (msg?.key) {
                try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch (e) {}
            }

            await sock.sendMessage(from, {
                text: `❌ *Erreur*\n\n${error.message}`
            }, { quoted: msg });

        } finally {
            // Nettoyer
            if (tempInputPath && fs.existsSync(tempInputPath)) {
                try { fs.unlinkSync(tempInputPath); } catch (e) {}
            }
            if (tempOutputPath && fs.existsSync(tempOutputPath)) {
                try { fs.unlinkSync(tempOutputPath); } catch (e) {}
            }
        }
    }
};
