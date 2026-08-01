// ./events/goodbye.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 📁 Configuration des chemins
const GOODBYE_FILE = path.join(process.cwd(), 'database', 'goodbye.json');

// 📁 Créer dossier + fichier si inexistant
const dbDir = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(GOODBYE_FILE)) fs.writeFileSync(GOODBYE_FILE, '{}');

// 🔁 Fonctions de lecture/sauvegarde avec gestion d'erreurs
function getGoodbye() {
    try {
        return JSON.parse(fs.readFileSync(GOODBYE_FILE, 'utf8'));
    } catch (err) {
        console.error('❌ Error reading goodbye.json:', err);
        return {};
    }
}

function saveGoodbye(data) {
    try {
        fs.writeFileSync(GOODBYE_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('❌ Error saving goodbye.json:', err);
    }
}

// 🎲 Backgrounds pour la carte de départ (styles disponibles)
const GOODBYE_STYLES = [
    'gaming1', 'gaming2', 'gaming3', 'gaming4',
];

// 🎲 Images de fallback pour le départ
const FALLBACK_IMAGES = [
    'https://iili.io/BQeNq0b.jpg',
    'https://files.catbox.moe/tz07yl.jpg',
    'https://files.catbox.moe/jcf2qc.jpg',
    'https://iili.io/CY3iYba.jpg',
    'https://iili.io/CY3igd7.jpg',
    'https://iili.io/CY3sB2I.jpg',
    'https://iili.io/CY3s542.jpg',
    'https://iili.io/CY3sNv1.jpg',
    'https://iili.io/CY3sgGR.jpg',
    'https://iili.io/CY3LHaS.jpg',
    'https://iili.io/CY3LFwu.jpg',
    'https://iili.io/CY3LRta.jpg',
    'https://iili.io/BsJvF7R.jpg',
    'https://iili.io/BsJUPjV.jpg',
    'https://iili.io/BsdTfqJ.jpg',
    'https://iili.io/Bsd7U0u.jpg',
    'https://iili.io/BsdNyMu.jpg',
    'https://iili.io/Bsdk4MF.jpg',
    'https://iili.io/BsdgELN.jpg',
    'https://iili.io/Bsd6h21.jpg',
    'https://iili.io/BsdsRrN.jpg',
    'https://iili.io/BsdGUHF.jpg',
    'https://files.catbox.moe/8s31s2.jpg',
    'https://files.catbox.moe/48pqbp.jpg',
    'https://files.catbox.moe/ufzn87.jpg',
    'https://files.catbox.moe/718prk.jpg',
    'https://files.catbox.moe/3c33kh.jpg',
    'https://files.catbox.moe/verxnu.jpg',
    'https://files.catbox.moe/noph7e.jpg',
    'https://iili.io/CE2i0kg.jpg'
];

const DEFAULT_AVATAR = 'https://iili.io/CSAJ38v.jpg';

// 🔀 Fonctions utilitaires
function getRandomStyle() {
    return GOODBYE_STYLES[Math.floor(Math.random() * GOODBYE_STYLES.length)];
}

function getRandomFallback() {
    return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
}

// 🔒 Anti-spam : cache des derniers messages envoyés
const lastGoodbyeSent = new Map();

// Nettoyer périodiquement le cache
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of lastGoodbyeSent) {
        if (now - timestamp > 300000) { // 5 minutes
            lastGoodbyeSent.delete(key);
        }
    }
}, 60000);

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
// GÉNÉRATION DE LA CARTE DE DÉPART
// ═══════════════════════════════════════

async function generateGoodbyeCard(sock, groupId, userJid, groupName, memberCount) {
    try {
        // Récupérer l'avatar de l'utilisateur
        let avatarUrl = DEFAULT_AVATAR;
        try {
            avatarUrl = await sock.profilePictureUrl(userJid, 'image');
        } catch (_) {
            // Utiliser l'avatar par défaut
        }

        let userName = 'User';
        try {
            const contact = await sock.getContact?.(userJid);
            if (contact?.name) {
                userName = contact.name;
            } else {
                const metadata = await sock.groupMetadata(groupId);
                const participant = metadata.participants.find(p => p.id === user.Jid);
                if (participant?.name) {
                    userName = participant.name;
                } else {
                    userName = userJid.split('@')[0];
                }
            }
        } catch(_) {
            userName = userJid.split('@')[0];
        }
        // Choisir un style aléatoire
        const style = getRandomStyle();
        const textColor = 'yellow'; // Couleur du texte

        // Construire l'URL de l'API Some-Random-API
        const apiUrl = `https://api.some-random-api.com/welcome/img/2/${style}?` +
                       `type=leave` +
                       `&textcolor=${textColor}` +
                       `&username=User` +
                       `&guildName=${encodeURIComponent(groupName)}` +
                       `&memberCount=${memberCount}` +
                       `&avatar=${encodeURIComponent(avatarUrl)}`;

        console.log(`📤 Goodbye card URL: ${apiUrl}`);

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
            style,
        };
    } catch (err) {
        console.error('❌ Goodbye card generation failed:', err.message);
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════
// ENVOI DE MESSAGE DE DÉPART FALLBACK
// ═══════════════════════════════════════

async function sendFallbackGoodbye(sock, groupId, userJid, groupName, memberCount) {
    try {
        const userName = userJid.split('@')[0];
        const randomImage = getRandomFallback();

        const caption = `╭━━━━❲ *GOODBYE* ❳━━━━╮\n` +
                       `┃\n` +
                       `┃  🫂 @${userName}\n` +
                       `┃  Has left *${groupName}*\n` +
                       `┃\n` +
                       `┃  👥 Member: ${memberCount}\n` +
                       `┃  🤖 Bot: Zenitsu Mini\n` +
                       `┃\n` +
                       `┃  🥀 We'll miss you!\n` +
                       `┃\n` +
                       `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
                       `© 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 𝙘𝙮𝙗𝙚𝙧𝙣𝙤𝙫𝘼`;

        const contextInfo = {
            mentionedJid: [userJid],
            ...STYLE,
        };

        await sock.sendMessage(groupId, {
            image: { url: randomImage },
            caption,
            contextInfo,
        });

        return true;
    } catch (err) {
        console.error('❌ Fallback goodbye failed:', err.message);
        return false;
    }
}

// ═══════════════════════════════════════
// ENVOI DE MESSAGE TEXT SIMPLE
// ═══════════════════════════════════════

async function sendTextGoodbye(sock, groupId, userJid, groupName, memberCount) {
    try {
        const userName = userJid.split('@')[0];

        const text = `🫂 *𝔾𝕠𝕠𝕕𝕓𝕪𝕖 @${userName}.\n${groupName.toUpperCase()}* 🫂\n\n` +
                    `👥 ${memberCount} 𝕄𝕖𝕞𝕓𝕖𝕣𝕤 𝕟𝕠𝕨.\n` +
                    `🤖 *Bot:* 𝐙𝐞𝐧𝐢𝐭𝐬𝐮 𝐌𝐢𝐧𝐢 𝐕𝟒.𝟎.𝟏\n\n` +
                    `🥀 𝕎𝕖 𝕨𝕚𝕤𝕙 𝕪𝕠𝕦 𝕒𝕝𝕝 𝕥𝕙𝕖 𝕓𝕖𝕤𝕥\n\n` +
                    `𝑼𝒔𝒆 *.𝒘𝒆𝒍𝒄𝒐𝒎𝒆 𝒐𝒇𝒇* 𝒕𝒐 𝒅𝒊𝒔𝒂𝒃𝒍𝒆 𝒕𝒉𝒊𝒔 𝒆𝒗𝒆𝒏𝒕\n` +
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
        console.error('❌ Text goodbye failed:', err.message);
        return false;
    }
}

// ═══════════════════════════════════════
// 👋 EVENT GOODBYE
// ═══════════════════════════════════════

async function goodbyeEvent(sock, update) {
    try {
        const { id, participants, action } = update;

        if (!id || !participants || !action) return;

        const db = getGoodbye();

        // Si désactivé pour ce groupe
        if (db[id] === false) return;

        if (action === 'remove') {
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
                const lastTime = lastGoodbyeSent.get(cacheKey);
                if (lastTime && Date.now() - lastTime < 10000) {
                    continue;
                }
                lastGoodbyeSent.set(cacheKey, Date.now());

                let sent = false;

                // 1. Essayer avec la carte de départ Some-Random-API
                try {
                    const cardResult = await generateGoodbyeCard(sock, id, jid, groupName, memberCount);
                    if (cardResult.success && cardResult.buffer) {
                        await sock.sendMessage(id, {
                            image: cardResult.buffer,
                            caption: `🫂 *𝔾𝕠𝕠𝕕𝕓𝕪𝕖 !*\n\n` +
                                     `👤 @${cardResult.userName || jid.split('@')[0]}\n` +
                                     `📢 ${groupName}\n` +
                                     `👥 ${memberCount} 𝕄𝕖𝕞𝕓𝕖𝕣𝕤 𝕟𝕠𝕨.\n\n` +
                                     `🥀 𝕐𝕠𝕦𝕣 𝕡𝕣𝕖𝕤𝕖𝕟𝕔𝕖 𝕨𝕒𝕤 𝕦𝕤𝕖𝕗𝕦𝕝 !\n\n` +
                                     `𝑼𝒔𝒆 *.𝒘𝒆𝒍𝒄𝒐𝒎𝒆 𝒐𝒇𝒇* 𝒕𝒐 𝒅𝒊𝒔𝒂𝒃𝒍𝒆 𝒕𝒉𝒊𝒔 𝒆𝒗𝒆𝒏𝒕*` +
                                     `⚡ _Powered by Cybernova_`,
                            contextInfo: {
                                mentionedJid: [jid],
                                ...STYLE,
                            },
                        });
                        sent = true;
                        console.log(`✅ Goodbye card sent for ${jid}`);
                    }
                } catch (err) {
                    console.log(`⚠️ Some-Random-API goodbye failed: ${err.message}`);
                }

                // 2. Fallback avec image
                if (!sent) {
                    try {
                        sent = await sendFallbackGoodbye(sock, id, jid, groupName, memberCount);
                        if (sent) console.log(`✅ Fallback goodbye sent for ${jid}`);
                    } catch (err) {
                        console.log(`⚠️ Fallback goodbye failed: ${err.message}`);
                    }
                }

                // 3. Fallback text simple
                if (!sent) {
                    try {
                        sent = await sendTextGoodbye(sock, id, jid, groupName, memberCount);
                        if (sent) console.log(`✅ Text goodbye sent for ${jid}`);
                    } catch (err) {
                        console.log(`⚠️ Text goodbye failed: ${err.message}`);
                    }
                }

                // Pause entre les membres
                await new Promise(res => setTimeout(res, 2000));
            }
        }

    } catch (err) {
        console.error('❌ Goodbye event error:', err.message || err);
    }
}

// ═══════════════════════════════════════
// ⚙️ COMMANDE GOODBYE
// ═══════════════════════════════════════

async function goodbyeCommand(sock, msg, args, jid) {
    try {
        // Seulement dans les groupes
        if (!jid.endsWith('@g.us')) {
            return sock.sendMessage(jid, {
                text: '❌ This command only works in groups.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        const option = args[0]?.toLowerCase();
        const db = getGoodbye();

        // Activer/Désactiver goodbye
        if (option === 'on') {
            db[jid] = true;
            saveGoodbye(db);
            return sock.sendMessage(jid, {
                text: `✅ *Goodbye System Enabled*\n\n` +
                      `📢 This group will now receive goodbye messages.\n` +
                      `⚡ _Powered by Cybernova_`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        if (option === 'off') {
            db[jid] = false;
            saveGoodbye(db);
            return sock.sendMessage(jid, {
                text: `❌ *Goodbye System Disabled*\n\n` +
                      `📢 Goodbye messages are now turned off.\n` +
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
            text: `╭━━━━❲ *GOODBYE SYSTEM* ❳━━━━╮\n` +
                  `┃\n` +
                  `┃  📢 *Group:* ${groupName}\n` +
                  `┃  👥 *Members:* ${memberCount}\n` +
                  `┃  ⚙️ *Status:* ${status}\n` +
                  `┃\n` +
                  `┃  📌 *Commands:*\n` +
                  `┃  ${prefix}goodbye on  = Enable\n` +
                  `┃  ${prefix}goodbye off = Disable\n` +
                  `┃\n` +
                  `┃  ✨ *Features:*\n` +
                  `┃  • Custom goodbye cards\n` +
                  `┃  • Member count display\n` +
                  `┃  • Auto-fallback system\n` +
                  `┃  • 17+ background styles\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
                  `© 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 𝙘𝙮𝙗𝙚𝙧𝙣𝙤𝙫𝘼`,
            contextInfo: STYLE,
        }, { quoted: msg });

    } catch (err) {
        console.error('❌ Goodbye command error:', err.message || err);
    }
}

// ═══════════════════════════════════════
// 📤 EXPORTS POUR LE CHARGEUR
// ═══════════════════════════════════════

module.exports = {
    // Pour le chargeur d'événements
    event: 'group-participants.update',
    execute: goodbyeEvent,

    // Pour le chargeur de commandes
    name: 'goodbye',
    command: goodbyeCommand,
};
