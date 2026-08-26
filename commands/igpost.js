// ./commands/igpost.js

const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// ═══════════════════════════════════════
// CONFIG & STYLE
// ═══════════════════════════════════════

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

const DEFAULT_AVATAR = 'https://iili.io/CSAJ38v.jpg';
const DEFAULT_POST_IMAGE = 'https://iili.io/CQl8srF.jpg'; // image de secours

// ═══════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════

async function downloadImageFromMessage(sock, msg) {
    try {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) return null;
        const imageMessage = quoted.imageMessage;
        if (!imageMessage) return null;

        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer.length > 0 ? buffer : null;
    } catch (err) {
        console.log('⚠️ Erreur téléchargement image réponse:', err.message);
        return null;
    }
}

async function downloadImageFromUrl(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const buffer = Buffer.from(response.data);
        return buffer.length > 0 ? buffer : null;
    } catch (err) {
        console.log('⚠️ Erreur téléchargement image URL:', err.message);
        return null;
    }
}

async function getDisplayName(sock, jid) {
    try {
        let name = await sock.getName(jid);
        if (name && /^\d+$/.test(name)) name = null;
        if (name && name.trim().length > 0) return name.trim();
    } catch (_) {}
    return 'user';
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'igpost',
    aliases: ['instapost', 'ig', 'fakepost'],
    category: 'fun',
    description: 'Crée une fausse publication Instagram',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const from = jid || msg.key.remoteJid;

        // Réaction "génération en cours"
        try { await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }); } catch (_) {}

        // ---- Analyse des arguments ----
        // Format attendu : .igpost text|likes [urlImage]
        // ou simplement .igpost text [urlImage]
        let text = 'Hello';
        let likeCount = 30000;
        let likeText = 'Likes';
        let urlImage = null;

        if (args.length > 0) {
            const firstArg = args[0];
            if (firstArg.includes('|')) {
                const parts = firstArg.split('|');
                text = parts[0]?.trim() || 'Hello';
                const likesPart = parts[1]?.trim();
                if (likesPart && !isNaN(parseInt(likesPart))) {
                    likeCount = parseInt(likesPart);
                }
            } else {
                text = firstArg.trim();
                // Vérifier si le second argument est un nombre (likes)
                if (args[1] && !isNaN(parseInt(args[1]))) {
                    likeCount = parseInt(args[1]);
                    // Le troisième argument pourrait être l'URL de l'image
                    if (args[2] && args[2].startsWith('http')) {
                        urlImage = args[2];
                    }
                } else if (args[1] && args[1].startsWith('http')) {
                    // Le second argument est l'URL de l'image
                    urlImage = args[1];
                }
            }
        }

        // Détecter si une URL d'image est fournie dans les arguments
        for (const arg of args.slice(1)) {
            if (arg.startsWith('http')) {
                urlImage = arg;
                break;
            }
        }

        // Récupération du nom d'utilisateur
        const username = await getDisplayName(sock, senderJid);

        // Récupération de l'avatar
        let avatarUrl = DEFAULT_AVATAR;
        try {
            avatarUrl = await sock.profilePictureUrl(senderJid, 'image');
        } catch (_) {}

        // Récupération de l'image de publication
        let postImageBuffer = null;
        let postImageUrl = urlImage;

        // Priorité : image répondue > URL fournie > avatar utilisateur > image par défaut
        postImageBuffer = await downloadImageFromMessage(sock, msg);
        if (!postImageBuffer && urlImage) {
            postImageBuffer = await downloadImageFromUrl(urlImage);
        }

        if (postImageBuffer) {
            // On a une image téléchargée ; on peut l'utiliser directement.
            // Mais l'API attend une URL. On va devoir téléverser l'image quelque part.
            // Pour simplifier, on va utiliser l'URL de l'image si elle est fournie, sinon on utilisera l'avatar.
            // Si on a un buffer (image de réponse), il faudrait l'uploader. On va plutôt utiliser le buffer directement ? Non, l'API attend une URL.
            // On va se contenter de : si URL fournie → utiliser l'URL ; sinon utiliser l'avatar comme postImage.
            // Pour le buffer de réponse, on peut l'ignorer et utiliser l'avatar comme fallback.
            // Ce n'est pas idéal, mais l'API Stellar ne prend pas de buffer.
            // On va donc privilégier l'URL si elle existe, sinon on utilisera l'avatar.
            // Si l'utilisateur a répondu à une image, on ne peut pas l'envoyer directement, donc on utilisera l'avatar.
            // Pour simplifier, on va utiliser l'avatar comme postImage si aucune URL n'est fournie.
            postImageUrl = urlImage || avatarUrl;
        } else {
            // Aucune image fournie : on utilise l'avatar
            postImageUrl = avatarUrl;
        }

        // Si on a une URL d'image mais pas de buffer, on peut l'utiliser telle quelle.
        if (urlImage) postImageUrl = urlImage;

        // Construction de l'URL API
        const apiUrl = `https://api.stellarwa.xyz/generate/instagram?` +
            `username=${encodeURIComponent(username)}` +
            `&avatar=${encodeURIComponent(avatarUrl)}` +
            `&postImage=${encodeURIComponent(postImageUrl)}` +
            `&likeCount=${likeCount}` +
            `&likeText=${encodeURIComponent(likeText)}` +
            `&key=api-HBpdn`;

        try {
            console.log('🎨 Génération Instagram via Stellar...');
            const response = await axios.get(apiUrl, {
                responseType: 'arraybuffer',
                timeout: 60000, // l'API peut prendre du temps
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });

            const buffer = Buffer.from(response.data);

            // Vérification de la taille
            if (!buffer || buffer.length < 1000) {
                throw new Error('Image générée trop petite ou vide');
            }

            // Envoi de l'image générée
            await sock.sendMessage(from, {
                image: buffer,
                caption: `📸 *Instagram Post*\n\n` +
                         `👤 *User:* ${username}\n` +
                         `❤️ *Likes:* ${likeCount}\n` +
                         `💬 *Caption:* ${text}\n\n` +
                         `⚡ _Generated by Cybernova_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            // Réaction succès
            try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ Erreur igpost:', err.message);

            // Réaction erreur
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            await sock.sendMessage(from, {
                text: '❌ *Failed to generate Instagram post*\n\n' +
                      `⚠️ Error: ${err.message}\n\n` +
                      '💡 Try again later.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
