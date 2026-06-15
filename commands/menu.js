const axios = require('axios');

module.exports = {
    name: 'menu',
    aliases: ['help', 'commands', 'cmd'],
    description: 'Affiche le menu du bot',

    async execute({ sock, msg, args, jid, text, config, stats }) {
        // Utiliser jid au lieu de msg.key.remoteJid
        const from = jid || msg?.key?.remoteJid;
        const participant = msg?.key?.participant;
        const sender = participant || from;
        
        if (!from) {
            console.error('❌ JID non disponible');
            return;
        }

        try {
            // Réaction
            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: {
                        text: '⚡',
                        key: msg.key
                    }
                });
            }

            // Image par défaut
            const pp = 'https://iili.io/BihaZ0J.jpg';

            // Construction du message
            const caption = `ϟ 𝐙𝐞𝐧𝐢𝐭𝐬𝐮 𝐌𝐢𝐧𝐢 𝐁𝐨𝐭 ϟ
*The most useful bot you can have!*
👋 *@${sender.split('@')[0]}* !

• Library : *Baileys - Local Termux*
• Owner   : *Z3niTsu*
• Commands: ${stats?.commandsUsed || 50}+
• Prefix  : *${config?.prefix || '.'}*
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

┌─────【 MAIN 】─────❃
│‣ alive 🔋
│‣ owner 👑
│‣ ping ⚡
│‣ channel 🔗
│‣ uptime ⌛
│‣ menu 📋
└───────────────❃

┌───【 UTILITY 】───❃
│‣ getjid 🔢
│‣ qrcode 🖼️
│‣ ocr 📃
│‣ ask 🤖
│‣ ask2 🧠
│‣ join 🔗
│‣ leave 🥀
│‣ tts 🗣️
│‣ topdf 📄
│‣ upload 🪄
│‣ Tiktok 📥
│‣ link 🔗
│‣ vu 😄
│‣ hidetag / ht 🏷️
│‣ tagall 🗣️
│‣ tag 🏷️
└───────────────❃

┌────【 MEDIA 】────❃
│‣ img 🌅
│‣ img2 📸
│‣ imghd 📷
│‣ img3 🎑
│‣ imagine ✨
│‣ view /view2 👀
│‣ getpp 🖼️
│‣ getppgc 🗺️
│‣ info ➕
└───────────────❃

┌───【 OTHER 🚫】───❃
│‣ welcome 👋
│‣ goodbye 👋
│‣ bc ⏩
└───────────────❃

© Powered by CybernovA
*https://whatsapp.com/channel/0029Vb8BKWwH5JLxq1ef1R43*`;

            // Envoyer l'image avec le menu
            await sock.sendMessage(from, {
                image: { url: pp },
                caption: caption,
                contextInfo: {
                    mentionedJid: [sender],
                    forwardingScore: 540,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 195
                    }
                }
            });

            // Envoyer l'audio (optionnel)
            try {
                await sock.sendMessage(from, {
                    audio: { url: 'https://d.uguu.se/EDlpLfch.mp4' },
                    mimetype: 'audio/mpeg',
                    ptt: false
                });
            } catch (audioErr) {
                console.log('⚠️ Audio non disponible:', audioErr.message);
            }

            // Anti-spam
            await new Promise(res => setTimeout(res, 500));

        } catch (err) {
            console.log('❌ Erreur menu:', err);
            
            // Message de secours en cas d'erreur
            try {
                await sock.sendMessage(from, {
                    text: `📋 *Menu ${config?.botName || 'Zenitsu'}*\n\nUtilisez .help pour la liste des commandes.\nPrefix: ${config?.prefix || '.'}`
                });
            } catch (e) {}
        }
    }
};
