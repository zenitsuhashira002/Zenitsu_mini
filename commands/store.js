// ./commands/store.js

const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const STORE_DIR = path.join(process.cwd(), 'database', 'store');
if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });

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

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function getStorePath(folderName) {
    const safeName = folderName.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const folderPath = path.join(STORE_DIR, safeName);
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    return folderPath;
}

function listFolders() {
    try {
        return fs.readdirSync(STORE_DIR).filter(f => {
            const stat = fs.statSync(path.join(STORE_DIR, f));
            return stat.isDirectory();
        });
    } catch (_) {
        return [];
    }
}

function listItems(folderName) {
    try {
        const folderPath = getStorePath(folderName);
        return fs.readdirSync(folderPath).filter(f => {
            const stat = fs.statSync(path.join(folderPath, f));
            return stat.isFile();
        }).map(f => ({
            name: f,
            size: (fs.statSync(path.join(folderPath, f)).size / 1024).toFixed(2),
            date: fs.statSync(path.join(folderPath, f)).mtime.toLocaleString('en-US'),
        }));
    } catch (_) {
        return [];
    }
}

async function downloadMedia(mediaMessage, type) {
    const stream = await downloadContentFromMessage(mediaMessage, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

function getMediaType(quoted) {
    if (quoted.imageMessage) return { type: 'image', ext: 'jpg', message: quoted.imageMessage };
    if (quoted.videoMessage) return { type: 'video', ext: 'mp4', message: quoted.videoMessage };
    if (quoted.stickerMessage) return { type: 'sticker', ext: 'webp', message: quoted.stickerMessage };
    if (quoted.audioMessage) return { type: 'audio', ext: quoted.audioMessage?.ptt ? 'ogg' : 'mp3', message: quoted.audioMessage };
    if (quoted.voiceMessage) return { type: 'voice', ext: 'ogg', message: quoted.voiceMessage };
    if (quoted.documentMessage) return { type: 'document', ext: quoted.documentMessage?.fileName?.split('.').pop() || 'bin', message: quoted.documentMessage };
    if (quoted.conversation || quoted.extendedTextMessage?.text) return { type: 'text', ext: 'txt', message: null };
    return null;
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'store',
    aliases: ['storage', 'save', 'getitem', 'deleteitem', 'liststore'],
    category: 'owner',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;

        if (!isOwner(sock, senderJid)) {
            return; // Silencieux
        }

        const subCommand = args[0]?.toLowerCase();

        // ═══════════════════════════════
        // LIST — Afficher tous les dossiers
        // ═══════════════════════════════

        if (!subCommand || subCommand === 'list') {
            const folders = listFolders();

            if (folders.length === 0) {
                return sock.sendMessage(jid, {
                    text:
                        '📦 *Store — No Folders*\n\n' +
                        '💡 *Usage:*\n' +
                        '.store save <folder>\n' +
                        '.store get <folder>\n' +
                        '.store get <folder> <item>\n' +
                        '.store delete <folder>\n' +
                        '.store delete <folder> <item>\n' +
                        '.store list\n\n' +
                        '⚡ _Zenitsu Store_',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            let text = '📦 *Store — Folders*\n\n';
            folders.forEach((f, i) => {
                const items = listItems(f);
                text += `*${i + 1}.* ${f} (${items.length} items)\n`;
            });
            text += '\n💡 .store get <folder> to see items\n⚡ _Zenitsu Store_';

            return sock.sendMessage(jid, { text, contextInfo: STYLE }, { quoted: msg });
        }

        // ═══════════════════════════════
        // SAVE — Sauvegarder un élément
        // ═══════════════════════════════

        if (subCommand === 'save' || subCommand === 'add') {
            const folderName = args[1];

            if (!folderName) {
                return sock.sendMessage(jid, {
                    text: '⚠️ Specify a folder name.\n\nExample: .store save myfolder',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (!quoted) {
                return sock.sendMessage(jid, {
                    text: '⚠️ Reply to a message to save it.\n\nExample: Reply to an image with .store save myfolder',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const mediaInfo = getMediaType(quoted);

            if (!mediaInfo) {
                return sock.sendMessage(jid, {
                    text: '❌ Unsupported media type.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            try { await sock.sendMessage(jid, { react: { text: '💾', key: msg.key } }); } catch (_) {}

            try {
                const folderPath = getStorePath(folderName);
                const timestamp = Date.now();
                let fileName, buffer;

                if (mediaInfo.type === 'text') {
                    const text = quoted.conversation || quoted.extendedTextMessage?.text || '';
                    fileName = `text_${timestamp}.txt`;
                    buffer = Buffer.from(text, 'utf8');
                } else {
                    buffer = await downloadMedia(mediaInfo.message, mediaInfo.type);
                    fileName = `${mediaInfo.type}_${timestamp}.${mediaInfo.ext}`;
                }

                const filePath = path.join(folderPath, fileName);
                fs.writeFileSync(filePath, buffer);

                const sizeKB = (buffer.length / 1024).toFixed(2);

                await sock.sendMessage(jid, {
                    text:
                        '✅ *Saved!*\n\n' +
                        `📁 *Folder:* ${folderName}\n` +
                        `📄 *File:* ${fileName}\n` +
                        `📏 *Size:* ${sizeKB} KB\n` +
                        `📦 *Type:* ${mediaInfo.type}\n\n` +
                        '⚡ _Zenitsu Store_',
                    contextInfo: STYLE,
                }, { quoted: msg });

                try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

            } catch (err) {
                console.error('❌ store save error:', err.message);
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                await sock.sendMessage(jid, {
                    text: `❌ Failed to save: ${err.message}`,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
        }

        // ═══════════════════════════════
        // GET — Récupérer un élément ou lister un dossier
        // ═══════════════════════════════

        else if (subCommand === 'get' || subCommand === 'show') {
            const folderName = args[1];

            if (!folderName) {
                return sock.sendMessage(jid, {
                    text: '⚠️ Specify a folder name.\n\nExample: .store get myfolder',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const folderPath = getStorePath(folderName);
            const items = listItems(folderName);

            // Si un item spécifique est demandé
            const itemName = args[2];
            if (itemName) {
                const filePath = path.join(folderPath, itemName);
                if (!fs.existsSync(filePath)) {
                    return sock.sendMessage(jid, {
                        text: `❌ Item "${itemName}" not found in folder "${folderName}".`,
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }

                const buffer = fs.readFileSync(filePath);
                const ext = itemName.split('.').pop()?.toLowerCase();

                // Détecter le type et envoyer
                if (['jpg', 'jpeg', 'png', 'webp'].includes(ext) && !itemName.startsWith('sticker_')) {
                    await sock.sendMessage(jid, { image: buffer, caption: `📦 ${folderName}/${itemName}`, contextInfo: STYLE }, { quoted: msg });
                } else if (ext === 'webp' || itemName.startsWith('sticker_')) {
                    await sock.sendMessage(jid, { sticker: buffer, contextInfo: STYLE }, { quoted: msg });
                } else if (['mp4'].includes(ext)) {
                    await sock.sendMessage(jid, { video: buffer, caption: `📦 ${folderName}/${itemName}`, contextInfo: STYLE }, { quoted: msg });
                } else if (['mp3', 'ogg'].includes(ext)) {
                    await sock.sendMessage(jid, { audio: buffer, mimetype: ext === 'ogg' ? 'audio/ogg' : 'audio/mpeg', ptt: ext === 'ogg', contextInfo: STYLE }, { quoted: msg });
                } else {
                    await sock.sendMessage(jid, { document: buffer, mimetype: 'application/octet-stream', fileName: itemName, caption: `📦 ${folderName}/${itemName}`, contextInfo: STYLE }, { quoted: msg });
                }
                return;
            }

            // Lister les items du dossier
            if (items.length === 0) {
                return sock.sendMessage(jid, {
                    text: `📁 *${folderName}* — Empty folder\n\n💡 Reply to a message with .store save ${folderName}`,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            let text = `📁 *${folderName}* — ${items.length} items\n\n`;
            items.forEach((item, i) => {
                text += `*${i + 1}.* ${item.name}\n   📏 ${item.size} KB | 📅 ${item.date}\n\n`;
            });
            text += '💡 .store get <folder> <item> to retrieve\n⚡ _Zenitsu Store_';

            await sock.sendMessage(jid, { text, contextInfo: STYLE }, { quoted: msg });
        }

        // ═══════════════════════════════
        // DELETE — Supprimer un dossier ou un item
        // ═══════════════════════════════

        else if (subCommand === 'delete' || subCommand === 'remove' || subCommand === 'del') {
            const folderName = args[1];

            if (!folderName) {
                return sock.sendMessage(jid, {
                    text: '⚠️ Specify a folder name.\n\nExample: .store delete myfolder',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const folderPath = path.join(STORE_DIR, folderName);

            if (!fs.existsSync(folderPath)) {
                return sock.sendMessage(jid, {
                    text: `❌ Folder "${folderName}" not found.`,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Supprimer un item spécifique
            const itemName = args[2];
            if (itemName) {
                const filePath = path.join(folderPath, itemName);
                if (!fs.existsSync(filePath)) {
                    return sock.sendMessage(jid, {
                        text: `❌ Item "${itemName}" not found.`,
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }

                fs.unlinkSync(filePath);
                return sock.sendMessage(jid, {
                    text: `✅ Deleted "${itemName}" from "${folderName}".`,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Supprimer tout le dossier
            fs.rmSync(folderPath, { recursive: true, force: true });
            return sock.sendMessage(jid, {
                text: `✅ Folder "${folderName}" deleted.`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════════════════
        // UNKNOWN
        // ═══════════════════════════════

        return sock.sendMessage(jid, {
            text:
                '📦 *Store — Help*\n\n' +
                '.store list\n' +
                '.store save <folder> (reply to message)\n' +
                '.store get <folder>\n' +
                '.store get <folder> <item>\n' +
                '.store delete <folder>\n' +
                '.store delete <folder> <item>\n\n' +
                '⚡ _Zenitsu Store_',
            contextInfo: STYLE,
        }, { quoted: msg });
    },
};
