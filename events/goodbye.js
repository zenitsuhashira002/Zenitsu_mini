
// ./events/goodbye.js
const fs = require('fs');
const path = require('path');

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

// 🖼️ Image de secours par défaut
const DEFAULT_GOODBYE_IMAGE = 'https://iili.io/BQeNq0b.jpg';

// 🎲 Liste d'images supplémentaires pour goodbye (optionnel)
const goodbyeImages = [
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

// 🔀 Fonction pour choisir une image aléatoire
function getRandomGoodbyeImage() {
    return goodbyeImages[Math.floor(Math.random() * goodbyeImages.length)];
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

// =========================
// 👋 EVENT GOODBYE
// =========================
async function goodbyeEvent(sock, update) {
    try {
        const { id, participants, action } = update;

        if (!id || !participants || !action) return;

        const db = getGoodbye();

        // ✅ Par défaut ON (si non défini)
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
            const members = metadata.participants ? metadata.participants.length : 0;

            for (let user of participants) {
                const jid = typeof user === 'string' ? user : user.id;
                if (!jid) continue;

                // 🔒 Anti-spam : éviter les doublons
                const cacheKey = `${id}_${jid}`;
                const lastTime = lastGoodbyeSent.get(cacheKey);
                if (lastTime && Date.now() - lastTime < 10000) { // 1 minute
                    continue;
                }
                lastGoodbyeSent.set(cacheKey, Date.now());

                // 📸 Récupérer la photo de profil
                let profilePic = null;
                try {
                    profilePic = await sock.profilePictureUrl(jid, 'image');
                } catch (ppErr) {
                    // Photo de profil non disponible
                    console.log(`⚠️ No profile picture for ${jid}, trying fallback image...`);
                }

                // Message caption commun
                const captionText = `ϟ 𝐙𝐞𝐧𝐢𝐭𝐬𝐮 𝐌𝐢𝐧𝐢\n\n` +
                    `𝙶𝚘𝚘𝚍𝚋𝚢𝚎 🫂 @${jid.split('@')[0]} !☹\n\n` +
                    `➟ *Group* ${groupName}\n` +
                    `➟ ${members} members now.\n\n` +
                    `🥀\n` +
                    `**`;

                // Contexte CyberNova commun
                const contextInfo = {
                    mentionedJid: [jid],
                    forwardingScore: 240,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 193
                    }
                };

                let sent = false;

                // Essayer avec photo de profil
                if (profilePic) {
                    try {
                        await sock.sendMessage(id, {
                            image: { url: profilePic },
                            caption: captionText,
                            contextInfo: contextInfo
                        });
                        sent = true;
                    } catch (profilePicErr) {
                        console.error('⚠️ Profile picture send failed:', profilePicErr.message);
                    }
                }

                // Fallback 1 : image de secours aléatoire
                if (!sent) {
                    try {
                        const fallbackImage = getRandomGoodbyeImage();
                        await sock.sendMessage(id, {
                            image: { url: fallbackImage },
                            caption: captionText,
                            contextInfo: contextInfo
                        });
                        sent = true;
                    } catch (fallbackImgErr) {
                        console.error('⚠️ Fallback image failed:', fallbackImgErr.message);
                    }
                }

                // Fallback 2 : image par défaut ultime
                if (!sent) {
                    try {
                        await sock.sendMessage(id, {
                            image: { url: DEFAULT_GOODBYE_IMAGE },
                            caption: captionText,
                            contextInfo: contextInfo
                        });
                        sent = true;
                    } catch (defaultImgErr) {
                        console.error('⚠️ Default image failed:', defaultImgErr.message);
                    }
                }

                // Fallback 3 : texte seul (sans image)
                if (!sent) {
                    try {
                        await sock.sendMessage(id, {
                            text: captionText,
                            contextInfo: contextInfo
                        });
                    } catch (textErr) {
                        console.error('❌ Goodbye text fallback also failed:', textErr.message);
                    }
                }

                // ⚡ Anti-spam entre les membres
                await new Promise(res => setTimeout(res, 900));
            }
        }

    } catch (err) {
        console.error('❌ Goodbye event error:', err.message || err);
    }
}

// =========================
// ⚙️ COMMANDE GOODBYE
// =========================
async function goodbyeCommand(sock, msg, args, jid) {
    try {
        // Seulement dans les groupes
        if (!jid.endsWith('@g.us')) {
            return sock.sendMessage(jid, {
                text: '❌ This command only works in groups.',
                contextInfo: {
                    forwardingScore: 350,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202
                    }
                }
            }, { quoted: msg });
        }

        const option = args[0]?.toLowerCase();
        const db = getGoodbye();

        // Contexte CyberNova commun
        const contextInfo = {
            forwardingScore: 350,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363425394543602@newsletter',
                newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                serverMessageId: 202
            }
        };

        // Activer/Désactiver goodbye
        if (option === 'on') {
            db[jid] = true;
            saveGoodbye(db);
            return sock.sendMessage(jid, {
                text: '✅ *Goodbye Enabled* in this group',
                contextInfo: contextInfo
            }, { quoted: msg });
        }

        if (option === 'off') {
            db[jid] = false;
            saveGoodbye(db);
            return sock.sendMessage(jid, {
                text: '❌ *Goodbye Disabled* in this group',
                contextInfo: contextInfo
            }, { quoted: msg });
        }

        // Afficher le statut
        const status = db[jid] === false ? '❌ OFF' : '✅ ON';
        const prefix = global.PREFIX || '.';

        await sock.sendMessage(jid, {
            text: `╭━━━━❲ *GOODBYE STATUS* ❳━━━━╮\n` +
                  `┃\n` +
                  `┃  ⚙️ *Status :* ${status}\n` +
                  `┃\n` +
                  `┃  ${prefix}goodbye on  = Enable\n` +
                  `┃  ${prefix}goodbye off = Disable\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
            contextInfo: contextInfo
        }, { quoted: msg });

    } catch (err) {
        console.error('❌ Goodbye command error:', err.message || err);
    }
}

// =========================
// 📤 EXPORTS POUR LE CHARGEUR
// =========================
module.exports = {
    // Pour le chargeur d'événements
    event: 'group-participants.update',
    execute: goodbyeEvent,

    // Pour le chargeur de commandes
    name: 'goodbye',
    command: goodbyeCommand
};
