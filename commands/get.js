// ./commands/get.js

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// JID UTILS
// ═══════════════════════════════════════

function getRawNumber(jid) {
    if (!jid) return '';
    let num = jid.split('@')[0];
    num = num.split(':')[0];
    return num.trim();
}

function isOwner(sock, senderJid) {
    if (!senderJid) return false;
    const senderRaw = getRawNumber(senderJid);
    const botIds = [];
    if (sock.user?.id) botIds.push(getRawNumber(sock.user.id));
    if (sock.user?.lid) botIds.push(getRawNumber(sock.user.lid));
    botIds.push(process.env.OWNER_NUMBER || '50935729494');
    return botIds.includes(senderRaw);
}

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

// ═══════════════════════════════════════
// RECHERCHE DU FICHIER
// ═══════════════════════════════════════

function findFile(name) {
    const searchName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '');

    // Chercher dans ./commands/
    const commandsDir = path.join(process.cwd(), 'commands');
    if (fs.existsSync(commandsDir)) {
        const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const baseName = file.replace('.js', '').toLowerCase();
            if (baseName === searchName) {
                return { path: path.join(commandsDir, file), type: 'command' };
            }
        }
    }

    // Chercher dans ./events/
    const eventsDir = path.join(process.cwd(), 'events');
    if (fs.existsSync(eventsDir)) {
        const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const baseName = file.replace('.js', '').toLowerCase();
            if (baseName === searchName) {
                return { path: path.join(eventsDir, file), type: 'event' };
            }
        }
    }

    return null;
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'get',
    aliases: ['getcode', 'source', 'src', 'code'],
    category: 'owner',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;

        if (!isOwner(sock, senderJid)) {
            return; // Silencieux
        }

        const name = args[0];

        if (!name) {
            return; // Silencieux
        }

        const fileInfo = findFile(name);

        if (!fileInfo) {
            return; // Silencieux
        }

        try {
            const code = fs.readFileSync(fileInfo.path, 'utf8');
            const fileName = path.basename(fileInfo.path);
            const sizeKB = (Buffer.byteLength(code) / 1024).toFixed(2);

            // Envoyer le code comme document
            await sock.sendMessage(jid, {
                document: Buffer.from(code, 'utf8'),
                mimetype: 'application/javascript',
                fileName: fileName,
                caption:
                    `📂 *Source Code*\n\n` +
                    `📄 *File:* ${fileName}\n` +
                    `📁 *Type:* ${fileInfo.type}\n` +
                    `📏 *Size:* ${sizeKB} KB\n\n` +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });

        } catch (err) {
            console.error('❌ get error:', err.message);
        }
    },
};
