// ./events/welcome.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
// 📁 Configuration des chemins
const WELCOME_FILE = path.join(process.cwd(), 'database', 'welcome.json');

// 📁 Créer dossier + fichier si inexistant
const dbDir = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(WELCOME_FILE)) fs.writeFileSync(WELCOME_FILE, '{}');

// 🔁 Fonctions de lecture/sauvegarde avec gestion d'erreurs
function getWelcome() {
    try {
        return JSON.parse(fs.readFileSync(WELCOME_FILE, 'utf8'));
    } catch (err) {
        console.error('❌ Error reading welcome.json:', err);
        return {};
    }
}

function saveWelcome(data) {
    try {
        fs.writeFileSync(WELCOME_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('❌ Error saving welcome.json:', err);
    }
}

// 🎲 Backgrounds pour la carte de bienvenue
const WELCOME_BACKGROUNDS = [
    'https://iili.io/CSuZmH7.jpg',
    'https://iili.io/CSuZGcB.jpg',
    'https://iili.io/CSuZqjs.jpg',
    'https://iili.io/CSut9Du.jpg',
    'https://iili.io/CSutBHP.jpg',
    'https://iili.io/CSutoDg.jpg',
    'https://iili.io/CSutTiv.jpg',
    'https://iili.io/CSut5UN.jpg',
    'https://iili.io/CSutW0l.jpg',
    'https://iili.io/CSutP5P.jpg',
    'https://iili.io/CSutsmF.jpg'
];

// 🎲 Fallback backgrounds si l'API Popcat échoue
const FALLBACK_IMAGES = [
    'https://files.catbox.moe/jcf2qc.jpg',
    'https://files.catbox.moe/tz07yl.jpg',
    'https://iili.io/BsJvF7R.jpg',
    'https://iili.io/BsJUPjV.jpg',
    'https://iili.io/CE2i0kg.jpg',
    'https://iili.io/BsdTfqJ.jpg',
    'https://iili.io/Bsd7U0u.jpg',
    'https://iili.io/BsdNyMu.jpg',
    'https://iili.io/Bsdk4MF.jpg',
    'https://iili.io/BsdgELN.jpg',
    'https://iili.io/Bsd6h21.jpg',
    'https://iili.io/BsdsRrN.jpg',
    'https://iili.io/BsdGUHF.jpg',
    'https://iili.io/CY3iYba.jpg',
    'https://iili.io/CY3igd7.jpg',
    'https://iili.io/CY3sB2I.jpg',
    'https://iili.io/CY3s542.jpg',
    'https://iili.io/CY3sNv1.jpg',
    'https://iili.io/CY3sgGR.jpg',
    'https://iili.io/CY3LHaS.jpg',
    'https://iili.io/CY3LFwu.jpg',
    'https://iili.io/CY3LRta.jpg',
    'https://files.catbox.moe/8s31s2.jpg',
    'https://files.catbox.moe/48pqbp.jpg',
    'https://files.catbox.moe/ufzn87.jpg',
    'https://files.catbox.moe/718prk.jpg',
    'https://files.catbox.moe/3c33kh.jpg',
    'https://files.catbox.moe/verxnu.jpg',
    'https://files.catbox.moe/noph7e.jpg'
];

const DEFAULT_AVATAR = 'https://iili.io/CSAJ38v.jpg';

// 🔀 Fonctions utilitaires
function getRandomBackground() {
    return WELCOME_BACKGROUNDS[Math.floor(Math.random() * WELCOME_BACKGROUNDS.length)];
}

function getRandomFallback() {
    return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
}

// 🔒 Anti-spam : cache des derniers messages envoyés
const lastWelcomeSent = new Map();

// Nettoyer périodiquement le cache
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of lastWelcomeSent) {
        if (now - timestamp > 300000) { // 5 minutes
            lastWelcomeSent.delete(key);
        }
    }
}, 60000);

// ═══════════════════════════════════════
// STYLE CYBERNOVA
// ═══════════════════════════════════════

const STYLE = {
    forwardingScore: 550,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 340,
    },
};

// ═══════════════════════════════════════
// GÉNÉRATION DE LA CARTE DE BIENVENUE
// ═══════════════════════════════════════

async function generateWelcomeCard(sock, groupId, userJid, groupName, memberCount) {
    try {
        // Récupérer l'avatar de l'utilisateur
        let avatarUrl = DEFAULT_AVATAR;
        try {
            avatarUrl = await sock.profilePictureUrl(userJid, 'image');
        } catch (_) {
            // Utiliser l'avatar par défaut
        }

        // Récupérer le nom de l'utilisateur
        let userName = 'User';
        try {
            const contact = await sock.getContact?.(userJid);
            if (contact?.name) {
                userName = contact.name;
            } else {
                const metadata = await sock.groupMetadata(groupId);
                const participant = metadata.participants.find(p => p.id === userJid);
                if (participant?.name) {
                    userName = participant.name;
                } else {
                    userName = userJid.split('@')[0];
                }
            }
        } catch (_) {
            userName = userJid.split('@')[0];
        }

        // Choisir un background aléatoire
        const background = getRandomBackground();

        // Construire l'URL de l'API Popcat
        const apiUrl = `https://api.popcat.xyz/v2/welcomecard?` +
                       `background=${encodeURIComponent(background)}` +
                       `&text1=User` +
                       `&text2=${encodeURIComponent(`Welcome to ${groupName}`)}` +
                       `&text3=${encodeURIComponent(`Member ${memberCount}`)}` +
                       `&avatar=${encodeURIComponent(avatarUrl)}`;

        console.log(`📤 Welcome card URL: ${apiUrl}`);

        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
            },
        });

        return {
            success: true,
            buffer: Buffer.from(response.data),
            userName,
            avatarUrl,
        };
    } catch (err) {
        console.error('❌ Welcome card generation failed:', err.message);
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════
// ENVOI DE MESSAGE DE BIENVENUE FALLBACK
// ═══════════════════════════════════════

async function sendFallbackWelcome(sock, groupId, userJid, groupName, memberCount) {
    try {
        const userName = userJid.split('@')[0];
        const randomImage = getRandomFallback();
        const isVideo = randomImage.endsWith('.mp4');

        const caption = `╭━━❲ *𝚆𝚎𝚕𝚌𝚘𝚖𝚎* ❳━━╮\n` +
                       `┃\n` +
                       `┃ ✮ @${userName}\n` +
                       `┃ *${groupName}*\n` +
                       `┃\n` +
                       `┃ 👥 Member: ${memberCount}\n` +
                       `┃ 🤖 Bot: 𝐙𝐞𝐧𝐢𝐭𝐬𝐮 𝐌𝐢𝐧𝐢 𝐕𝟒.𝟎.𝟏\n` +
                       `┃\n` +
                       `┃ ⚡ Respect all admins\n` +
                       `┃ 📢 Follow our channel\n` +
                       `┃ 𝑼𝒔𝒆 *.𝒘𝒆𝒍𝒄𝒐𝒎𝒆* 𝒐𝒇𝒇 𝒕𝒐 𝒅𝒊𝒔𝒂𝒃𝒍𝒆 𝒕𝒉𝒊𝒔 𝒆𝒗𝒆𝒏𝒕\n` +
                       `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
                       `© 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 𝙘𝙮𝙗𝙚𝙧𝙣𝙤𝙫𝘼`;

        const contextInfo = {
            mentionedJid: [userJid],
            ...STYLE,
        };

        if (isVideo) {
            await sock.sendMessage(groupId, {
                video: { url: randomImage },
                caption,
                contextInfo,
            });
        } else {
            await sock.sendMessage(groupId, {
                image: { url: randomImage },
                caption,
                contextInfo,
            });
        }

        return true;
    } catch (err) {
        console.error('❌ Fallback welcome failed:', err.message);
        return false;
    }
}

// ═══════════════════════════════════════
// ENVOI DE MESSAGE TEXT SIMPLE
// ═══════════════════════════════════════

async function sendTextWelcome(sock, groupId, userJid, groupName, memberCount) {
    try {
        const userName = userJid.split('@')[0];

        const text = `✮ *ᴡᴇʟᴄᴏᴍᴇ @${userName}😁*\n${groupName.toUpperCase()}* ✮\n\n` +
                    `👥 *Members:* ${memberCount}\n` +
                    `🤖 *Bot: 𝐙𝐞𝐧𝐢𝐭𝐬𝐮 𝐌𝐢𝐧𝐢 𝐕𝟒.𝟎.𝟏*\n\n` +
                    `⚡ *Rules:*\n` +
                    `• 𝙍𝙚𝙨𝙥𝙚𝙘𝙩 𝙖𝙡𝙡 𝙢𝙚𝙢𝙗𝙚𝙧𝙨\n` +
                    `• 𝙉𝙤 𝙨𝙥𝙖𝙢 𝙤𝙧 𝙉𝙎𝙁𝙒\n` +
                    `• 𝙁𝙤𝙡𝙡𝙤𝙬 𝙖𝙙𝙢𝙞𝙣𝙨' 𝙞𝙣𝙨𝙩𝙧𝙪𝙘𝙩𝙞𝙤𝙣𝙨 𝙣 𝙛𝙤𝙡𝙡𝙤𝙬 𝙤𝙪𝙧 𝙘𝙝𝙖𝙣𝙣𝙚𝙡\n\n` +
                    ` 𝑼𝒔𝒆 *.𝒘𝒆𝒍𝒄𝒐𝒎𝒆* 𝒐𝒇𝒇 𝒕𝒐 𝒅𝒊𝒔𝒂𝒃𝒍𝒆 𝒕𝒉𝒊𝒔 𝒆𝒗𝒆𝒏𝒕` +
                    `© 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 𝙘𝙮𝙗𝙚𝙧𝙣𝙤𝙫𝘼`;

        await sock.sendMessage(groupId, {
            text,
            contextInfo: {
                mentionedJid: [userJid],
                ...STYLE,
            },
        });

        return true;
    } catch (err) {
        console.error('❌ Text welcome failed:', err.message);
        return false;
    }
}

// ═══════════════════════════════════════
// 🎉 EVENT WELCOME
// ═══════════════════════════════════════

async function welcomeEvent(sock, update) {
    try {
        const { id, participants, action } = update;

        if (!id || !participants || !action) return;

        const db = getWelcome();

        // Si désactivé pour ce groupe
        if (db[id] === false) return;

        if (action === 'add') {
            // Récupérer les métadonnées du groupe
            let metadata;
            try {
                metadata = await sock.groupMetadata(id);
            } catch (err) {
                console.error('❌ Error fetching group metadata:', err.message);
                return;
            }

            if (!metadata) return;

            const groupName = metadata.subject || 'Group';
            const memberCount = metadata.participants ? metadata.participants.length : 0;

            for (let user of participants) {
                const jid = typeof user === 'string' ? user : user.id;
                if (!jid) continue;

                // 🔒 Anti-spam
                const cacheKey = `${id}_${jid}`;
                const lastTime = lastWelcomeSent.get(cacheKey);
                if (lastTime && Date.now() - lastTime < 10000) {
                    continue;
                }
                lastWelcomeSent.set(cacheKey, Date.now());

                let sent = false;

                // 1. Essayer avec la carte de bienvenue Popcat
                try {
                    const cardResult = await generateWelcomeCard(sock, id, jid, groupName, memberCount);
                    if (cardResult.success && cardResult.buffer) {
                        await sock.sendMessage(id, {
                            image: cardResult.buffer,
                            caption: `✮ *𝗪𝗲𝗹𝗰𝗼𝗺𝗲* ✮\n\n` +
                                     `👤 @${cardResult.userName || jid.split('@')[0]}\n` +
                                     `📢 ${groupName}\n` +
                                     `👥 𝗠𝗲𝗺𝗯𝗲𝗿𝘀 : ${memberCount}\n` +
                                     `𝑼𝒔𝒆 *.𝒘𝒆𝒍𝒄𝒐𝒎𝒆 𝒐𝒇𝒇* 𝒕𝒐 𝒅𝒊𝒔𝒂𝒃𝒍𝒆 𝒕𝒉𝒊𝒔 𝒆𝒗𝒆𝒏𝒕*`,
                            contextInfo: {
                                mentionedJid: [jid],
                                ...STYLE,
                            },
                        });
                        sent = true;
                        console.log(`✅ Welcome card sent for ${jid}`);
                    }
                } catch (err) {
                    console.log(`⚠️ Popcat welcome failed: ${err.message}`);
                }

                // 2. Fallback avec image/vidéo
                if (!sent) {
                    try {
                        sent = await sendFallbackWelcome(sock, id, jid, groupName, memberCount);
                        if (sent) console.log(`✅ Fallback welcome sent for ${jid}`);
                    } catch (err) {
                        console.log(`⚠️ Fallback welcome failed: ${err.message}`);
                    }
                }

                // 3. Fallback text simple
                if (!sent) {
                    try {
                        sent = await sendTextWelcome(sock, id, jid, groupName, memberCount);
                        if (sent) console.log(`✅ Text welcome sent for ${jid}`);
                    } catch (err) {
                        console.log(`⚠️ Text welcome failed: ${err.message}`);
                    }
                }

                // Pause entre les membres
                await new Promise(res => setTimeout(res, 2000));
            }
        }

    } catch (err) {
        console.error('❌ Welcome event error:', err.message || err);
    }
}

// ═══════════════════════════════════════
// ⚙️ COMMANDE WELCOME
// ═══════════════════════════════════════

async function welcomeCommand(sock, msg, args, jid) {
    try {
        // Seulement dans les groupes
        if (!jid.endsWith('@g.us')) {
            return sock.sendMessage(jid, {
                text: '❌ This command only works in groups.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        const option = args[0]?.toLowerCase();
        const db = getWelcome();

        // Activer/Désactiver welcome
        if (option === 'on') {
            db[jid] = true;
            saveWelcome(db);
            return sock.sendMessage(jid, {
                text: `✅ *Welcome System Enabled*\n\n` +
                      `📢 This group will now receive welcome messages.\n` +
                      `⚡ _Powered by Cybernova_`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        if (option === 'off') {
            db[jid] = false;
            saveWelcome(db);
            return sock.sendMessage(jid, {
                text: `❌ *Welcome System Disabled*\n\n` +
                      `📢 Welcome messages are now turned off.\n` +
                      `⚡ _Powered by Cybernova_`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Afficher le statut
        const status = db[jid] === false ? '❌ DISABLED' : '✅ ENABLED';
        const prefix = global.PREFIX || '.';

        // Récupérer les métadonnées pour plus d'infos
        let metadata;
        try {
            metadata = await sock.groupMetadata(jid);
        } catch (_) {}

        const groupName = metadata?.subject || 'Unknown Group';
        const memberCount = metadata?.participants?.length || '?';

        await sock.sendMessage(jid, {
            text: `╭━━━━❲ *WELCOME SYSTEM* ❳━━━━╮\n` +
                  `┃\n` +
                  `┃  📢 *Group:* ${groupName}\n` +
                  `┃  👥 *Members:* ${memberCount}\n` +
                  `┃  ⚙️ *Status:* ${status}\n` +
                  `┃\n` +
                  `┃  📌 *Commands:*\n` +
                  `┃  ${prefix}welcome on  = Enable\n` +
                  `┃  ${prefix}welcome off = Disable\n` +
                  `┃\n` +
                  `┃  ✨ *Features:*\n` +
                  `┃  • Custom welcome cards\n` +
                  `┃  • Member count display\n` +
                  `┃  • Auto-fallback system\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
                  `© 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 𝙘𝙮𝙗𝙚𝙧𝙣𝙤𝙫𝘼`,
            contextInfo: STYLE,
        }, { quoted: msg });

    } catch (err) {
        console.error('❌ Welcome command error:', err.message || err);
    }
}

// ═══════════════════════════════════════
// 📤 EXPORTS POUR LE CHARGEUR
// ═══════════════════════════════════════

module.exports = {
    // Pour le chargeur d'événements
    event: 'group-participants.update',
    execute: welcomeEvent,

    // Pour le chargeur de commandes
    name: 'welcome',
    command: welcomeCommand,
};
