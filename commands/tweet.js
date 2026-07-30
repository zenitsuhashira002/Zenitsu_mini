// ./commands/tweet.js
const axios = require('axios');

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

module.exports = {
    name: 'tweet',
    aliases: ['faketweet', 'twitter'],
    category: 'fun',

    async execute({ sock, msg, args, jid }) {
        const input = args.join(' ').split('|').map(s => s.trim());
        
        if (input.length < 3) {
            return sock.sendMessage(jid, {
                text: '🐦 *Fake Tweet Generator*\n\n⚡ *Usage:* .tweet <name> | <username> | <text>\n\n✨ *Examples:*\n.tweet Zenitsu Hashira | zenitsu | I love this bot!\n.tweet Pop Cat | popcat | gib me food',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        const [name, username, text] = input;
        
        if (!name || !username || !text) {
            return sock.sendMessage(jid, {
                text: '❌ *Invalid format*\n\n⚡ *Usage:* .tweet <name> | <username> | <text>',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Utiliser la photo de profil de l'utilisateur qui commande
        let pfp = 'https://cdn.popcat.xyz/popcat.png'; // Fallback
        try {
            const senderJid = msg.key.participant || msg.key.remoteJid;
            pfp = await sock.profilePictureUrl(senderJid, 'image');
        } catch (_) {}

        try {
            await sock.sendMessage(jid, { react: { text: '🐦', key: msg.key } });
            
            const url = `https://api.popcat.xyz/v2/tweet?name=${encodeURIComponent(name)}&username=${encodeURIComponent(username)}&text=${encodeURIComponent(text)}&pfp=${encodeURIComponent(pfp)}`;
            const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
            const buffer = Buffer.from(response.data);

            await sock.sendMessage(jid, {
                image: buffer,
                caption: `🐦 *Fake Tweet*\n\n👤 ${name} (@${username})\n💬 ${text}\n\n⚡ _Zenitsu AI_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.log(`❌ Tweet error: ${err.message}`);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to generate tweet.*\n\nTry again later.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    }
};
