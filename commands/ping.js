module.exports = {
    name: 'ping',

    execute: async ({ sock, msg }) => {
        const from = msg.key.remoteJid;

        const start = Date.now();

        await sock.sendMessage(from, {
            react: { text: "⚡", key: msg.key }
        });
        const end = Date.now();
        const speed = end - start;
        const message = `
⚡ *Zenitsu Mini* ⚡

🏓 Response Speed: ${speed}ms
`.trim();

        // 🔥 CORRIGÉ : thumbnailUrl et sourceUrl étaient inversés.
        // - thumbnailUrl = l'IMAGE affichée dans la preview (doit être une
        //   vraie URL directe d'image : .jpg/.png, pas un lien whatsapp.com).
        // - sourceUrl = le lien vers lequel le tap sur la carte redirige.
        // - renderLargerThumbnail: true = c'est CE flag qui déclenche le
        //   rendu "grande image" façon vraie preview de lien natif (au lieu
        //   de la petite vignette carrée par défaut). WhatsApp met aussi en
        //   cache l'image par sourceUrl côté client : une fois chargée une
        //   première fois, elle réapparaît instantanément dans les envois
        //   suivants du même lien — c'est l'effet que tu as observé.
        const contextInfo = {
            externalAdReply: {
                title: "𝙯𝙚𝙣𝙞𝙩𝙨𝙪 𝙈𝙄𝙉𝙄 • PING",
                body: `Response: ${speed}ms`,
                thumbnailUrl: 'https://iili.io/CEfM5Gf.jpg',
                sourceUrl: 'https://chat.whatsapp.com/FPE3RV3sH5iGTjlSP7N8Fw',
                mediaUrl: 'https://iili.io/CEfM5Gf.jpg',
                mediaType: 1,
                renderLargerThumbnail: true,
                showAdAttribution: false,
            },
            forwardingScore: 54,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: "120363425394543602@newsletter",
                newsletterName: "모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟",
                serverMessageId: 202
            }
        };

        await sock.sendMessage(
            from,
            {
                text: message,
                contextInfo: contextInfo
            },
            {
                quoted: msg
            }
        );
    }
};
