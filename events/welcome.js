
// ./events/welcome.js
const fs = require('fs');
const path = require('path');

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

// 🎲 Liste d'images (support mp4 et jpg)
const welcomeImages = [
    'https://files.catbox.moe/jcf2qc.jpg',
    'https://files.catbox.moe/tz07yl.jpg',
    'https://iili.io/BsJvF7R.jpg',
    'https://d.uguu.se/Kkpvxtht.mp4',
    'https://o.uguu.se/AlRGXkPp.mp4',
    'https://iili.io/BsJUPjV.jpg',
    'https://d.uguu.se/NhGBrPFH.jpg',
    'https://h.uguu.se/JeLSJQgU.jpg',
    'https://h.uguu.se/KkidxvpM.jpg',
    'https://d.uguu.se/LlRKOetp.jpg',
    'https://h.uguu.se/UFLXrYtO.jpg',
    'https://n.uguu.se/cBjBqDty.jpg',
    'https://h.uguu.se/UFLXrYtO.jpg',
    'https://n.uguu.se/gojQfPbO.jpg',
    'https://h.uguu.se/gYEmTiXe.jpg',
    'https://h.uguu.se/vuGhrvAv.jpg',
    'https://n.uguu.se/nCYhoSam.jpg',
    'https://d.uguu.se/oTpXKPLZ.mp4',
    'https://d.uguu.se/oTpXKPLZ.mp4',
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
    'https://files.catbox.moe/ddmpaw.mp4',
    'https://files.catbox.moe/verxnu.jpg',
    'https://files.catbox.moe/noph7e.jpg'
];

// 🔀 Fonction pour choisir une image aléatoire
function getRandomImage() {
    return welcomeImages[Math.floor(Math.random() * welcomeImages.length)];
}

// ✅ Vérifier si c'est une image ou vidéo
function getMediaType(url) {
    return url.endsWith('.mp4') ? 'video' : 'image';
}

// 🔒 Anti-spam : cache des derniers messages envoyés
const lastWelcomeSent = new Map();

// Nettoyer périodiquement le cache pour éviter les fuites mémoire
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of lastWelcomeSent) {
        if (now - timestamp > 300000) { // 5 minutes
            lastWelcomeSent.delete(key);
        }
    }
}, 60000); // Vérifier chaque minute

// =========================
// 🎉 EVENT WELCOME
// =========================
async function welcomeEvent(sock, update) {
    try {
        const { id, participants, action } = update;

        if (!id || !participants || !action) return;

        const db = getWelcome();

        // ✅ Par défaut ON (si non défini)
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
            const members = metadata.participants ? metadata.participants.length : 0;

            for (let user of participants) {
                const jid = typeof user === 'string' ? user : user.id;
                if (!jid) continue;

                // 🔒 Anti-spam : éviter les doublons
                const cacheKey = `${id}_${jid}`;
                const lastTime = lastWelcomeSent.get(cacheKey);
                if (lastTime && Date.now() - lastTime < 10000) { // 10 SEC
                    continue;
                }
                lastWelcomeSent.set(cacheKey, Date.now());

                // Message caption commun
                const captionText = `ϟ 𝐙𝐞𝐧𝐢𝐭𝐬𝐮 𝐌𝐢𝐧𝐢\n\n` +
                    `*🅆🄴🄻🄲🄾🄼🄴 ✮* @${jid.split('@')[0]} to ${groupName} !\n\n` +
                    `We are ${members} members now ☕︎.\n\n` +
                    `*Respect all admins and follow our channel* ⚡︎.\n\n` +
                    `© 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 𝙘𝙮𝙗𝙚𝙧𝙣𝙤𝙫𝘼\n` +
                    `*https://whatsapp.com/channel/0029Vb8BKWwH5JLxq1ef1R43*`;

                // Contexte CyberNova commun
                const contextInfo = {
                    mentionedJid: [jid],
                    forwardingScore: 540,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202
                    }
                };

                let sent = false;

                // Essayer d'envoyer avec média
                try {
                    const randomMedia = getRandomImage();
                    const mediaType = getMediaType(randomMedia);

                    const messageContent = {
                        caption: captionText,
                        contextInfo: contextInfo
                    };

                    if (mediaType === 'video') {
                        messageContent.video = { url: randomMedia };
                    } else {
                        messageContent.image = { url: randomMedia };
                    }

                    await sock.sendMessage(id, messageContent);
                    sent = true;
                } catch (mediaErr) {
                    console.error('⚠️ Welcome media failed, using text fallback:', mediaErr.message);
                }

                // Fallback : envoyer sans média si le premier essai échoue
                if (!sent) {
                    try {
                        await sock.sendMessage(id, {
                            text: captionText,
                            contextInfo: contextInfo
                        });
                    } catch (textErr) {
                        console.error('❌ Welcome text fallback also failed:', textErr.message);
                    }
                }

                // ⚡ Anti-spam entre les membres
                await new Promise(res => setTimeout(res, 2000));
            }
        }

    } catch (err) {
        console.error('❌ Welcome event error:', err.message || err);
    }
}

// =========================
// ⚙️ COMMANDE WELCOME
// =========================
async function welcomeCommand(sock, msg, args, jid) {
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
        const db = getWelcome();

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

        // Activer/Désactiver welcome
        if (option === 'on') {
            db[jid] = true;
            saveWelcome(db);
            return sock.sendMessage(jid, {
                text: '✅ *Welcome Enabled* in this group',
                contextInfo: contextInfo
            }, { quoted: msg });
        }

        if (option === 'off') {
            db[jid] = false;
            saveWelcome(db);
            return sock.sendMessage(jid, {
                text: '❌ *Welcome Disabled* in this group',
                contextInfo: contextInfo
            }, { quoted: msg });
        }

        // Afficher le statut
        const status = db[jid] === false ? '❌ OFF' : '✅ ON';
        const prefix = global.PREFIX || '.';

        await sock.sendMessage(jid, {
            text: `╭━━━━❲ *WELCOME STATUS* ❳━━━━╮\n` +
                  `┃\n` +
                  `┃  ⚙️ *Status :* ${status}\n` +
                  `┃\n` +
                  `┃  ${prefix}welcome on  = Enable\n` +
                  `┃  ${prefix}welcome off = Disable\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
            contextInfo: contextInfo
        }, { quoted: msg });

    } catch (err) {
        console.error('❌ Welcome command error:', err.message || err);
    }
}

// =========================
// 📤 EXPORTS POUR LE CHARGEUR
// =========================
module.exports = {
    // Pour le chargeur d'événements
    event: 'group-participants.update',
    execute: welcomeEvent,

    // Pour le chargeur de commandes
    name: 'welcome',
    command: welcomeCommand
};
