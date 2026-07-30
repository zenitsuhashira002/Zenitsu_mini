// ./commands/get.js

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// STYLE
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

// ═══════════════════════════════════════
// JID UTILS (compatibles avec main.js)
// ═══════════════════════════════════════

function normalizeJid(jid) {
    if (!jid) return '';
    const [user, server] = jid.split('@');
    const bareUser = user.split(':')[0];
    return server ? `${bareUser}@${server}` : bareUser;
}

function getRawNumber(jid) {
    if (!jid) return '';
    let num = jid.split('@')[0];
    num = num.split(':')[0];
    return num.trim();
}

// ═══════════════════════════════════════
// VÉRIFICATION OWNER (basée sur main.js)
// ═══════════════════════════════════════

function isBotOwner(sock, senderJid) {
    if (!senderJid) return false;
    
    const senderRaw = getRawNumber(senderJid);
    const senderNormalized = normalizeJid(senderJid);

    // 1. Vérifier si c'est le bot lui-même
    const botIds = [];
    if (sock.user?.id) {
        botIds.push(normalizeJid(sock.user.id));
        botIds.push(getRawNumber(sock.user.id));
    }
    if (sock.user?.lid) {
        botIds.push(normalizeJid(sock.user.lid));
        botIds.push(getRawNumber(sock.user.lid));
    }
    
    if (botIds.includes(senderNormalized) || botIds.includes(senderRaw)) {
        return true;
    }

    // 2. Vérifier via le système d'owners du main.js
    try {
        // Importer les fonctions du main.js
        const main = require('../main.js');
        if (main && typeof main.isBotOwner === 'function') {
            // Déterminer la clé du bot (main ou numéro du subbot)
            let botKey = 'main';
            if (sock.user?.id) {
                const rawNumber = getRawNumber(sock.user.id);
                if (rawNumber && rawNumber !== CONFIG?.ownerNumber) {
                    botKey = rawNumber;
                }
            }
            return main.isBotOwner(sock, botKey, senderJid);
        }
    } catch (_) {
        // Fallback si main.js n'est pas disponible
    }

    // 3. Vérifier via global.subBots (si disponible)
    if (global.subBots && global.subBots instanceof Map) {
        for (const [subNumber, subData] of global.subBots) {
            if (subData.sock === sock) {
                // Vérifier si le sender est owner de ce subbot
                const subState = global.botStates?.get(subNumber);
                if (subState && subState.owners) {
                    for (const owner of subState.owners) {
                        if (normalizeJid(owner) === senderNormalized) {
                            return true;
                        }
                    }
                }
                break;
            }
        }
    }

    // 4. Vérifier l'owner configuré (via CONFIG ou process.env)
    const ownerNumber = process.env.OWNER_NUMBER || '50935729494';
    if (senderRaw === ownerNumber || senderNormalized === `${ownerNumber}@s.whatsapp.net`) {
        return true;
    }

    // 5. Vérifier l'OWNER_LID du config
    try {
        const main = require('../main.js');
        if (main && main.CONFIG && main.CONFIG.OWNER_LID) {
            const ownerLid = normalizeJid(main.CONFIG.OWNER_LID);
            if (senderNormalized === ownerLid || getRawNumber(senderNormalized) === getRawNumber(ownerLid)) {
                return true;
            }
        }
    } catch (_) {}

    return false;
}

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

    // Chercher dans ./utils/
    const utilsDir = path.join(process.cwd(), 'utils');
    if (fs.existsSync(utilsDir)) {
        const files = fs.readdirSync(utilsDir).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const baseName = file.replace('.js', '').toLowerCase();
            if (baseName === searchName) {
                return { path: path.join(utilsDir, file), type: 'util' };
            }
        }
    }

    // Chercher à la racine
    const rootDir = process.cwd();
    if (fs.existsSync(rootDir)) {
        const files = fs.readdirSync(rootDir).filter(f => f.endsWith('.js') && !f.startsWith('node_modules'));
        for (const file of files) {
            const baseName = file.replace('.js', '').toLowerCase();
            if (baseName === searchName) {
                return { path: path.join(rootDir, file), type: 'root' };
            }
        }
    }

    return null;
}

// ═══════════════════════════════════════
// LISTE DES FICHIERS DISPONIBLES
// ═══════════════════════════════════════

function listAvailableFiles() {
    const files = [];
    const dirs = ['commands', 'events', 'utils'];

    for (const dir of dirs) {
        const dirPath = path.join(process.cwd(), dir);
        if (fs.existsSync(dirPath)) {
            const items = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
            for (const item of items) {
                files.push({ name: item.replace('.js', ''), type: dir });
            }
        }
    }

    // Ajouter main.js
    if (fs.existsSync(path.join(process.cwd(), 'main.js'))) {
        files.push({ name: 'main', type: 'root' });
    }

    return files;
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'get',
    aliases: ['getcode', 'source', 'src', 'code'],
    category: 'owner',

    async execute({ sock, msg, args, jid, senderJid, config }) {
        // Vérifier si l'utilisateur est owner
        if (!isBotOwner(sock, senderJid)) {
            // Répondre silencieusement (ou pas du tout)
            return;
        }

        const name = args[0];

        // Si aucun nom, afficher la liste des fichiers disponibles
        if (!name) {
            const files = listAvailableFiles();
            
            if (files.length === 0) {
                return sock.sendMessage(jid, {
                    text: '📂 *No source files found.*',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Grouper par type
            const grouped = {};
            for (const file of files) {
                if (!grouped[file.type]) grouped[file.type] = [];
                grouped[file.type].push(file.name);
            }

            let response = '📂 *Available Source Files*\n\n';
            for (const [type, names] of Object.entries(grouped)) {
                response += `📁 *${type}*\n`;
                response += names.map(n => `  • ${n}`).join('\n');
                response += '\n\n';
            }
            response += '💡 *Usage:* .get <filename>\n';
            response += '📝 *Example:* .get gemini';

            return sock.sendMessage(jid, {
                text: response,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Rechercher le fichier
        const fileInfo = findFile(name);

        if (!fileInfo) {
            // Proposer des fichiers similaires
            const files = listAvailableFiles();
            const similar = files
                .filter(f => f.name.toLowerCase().includes(name.toLowerCase()))
                .map(f => f.name);

            let message = `❌ *File not found:* ${name}`;
            if (similar.length > 0) {
                message += `\n\n💡 *Did you mean?*\n${similar.slice(0, 5).map(f => `• .get ${f}`).join('\n')}`;
            }

            return sock.sendMessage(jid, {
                text: message,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            const code = fs.readFileSync(fileInfo.path, 'utf8');
            const fileName = path.basename(fileInfo.path);
            const sizeKB = (Buffer.byteLength(code) / 1024).toFixed(2);
            const lines = code.split('\n').length;

            // Type d'icône
            const icons = {
                'command': '⚡',
                'event': '🎯',
                'util': '🔧',
                'root': '📦'
            };
            const icon = icons[fileInfo.type] || '📄';

            // Envoyer le code comme document
            await sock.sendMessage(jid, {
                document: Buffer.from(code, 'utf8'),
                mimetype: 'application/javascript',
                fileName: fileName,
                caption:
                    `${icon} *Source Code*\n\n` +
                    `📄 *File:* ${fileName}\n` +
                    `📁 *Type:* ${fileInfo.type}\n` +
                    `📏 *Size:* ${sizeKB} KB\n` +
                    `📊 *Lines:* ${lines}\n\n` +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE,
            }, { quoted: msg });

        } catch (err) {
            console.error('❌ get error:', err.message);
            
            return sock.sendMessage(jid, {
                text: `❌ *Error reading file:* ${err.message}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
